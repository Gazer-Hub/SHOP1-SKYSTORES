const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Netlify Function: netlify/functions/webhook.js
// Environment required:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONIEPOINT_WEBHOOK_SECRET

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.MONIEPOINT_WEBHOOK_SECRET;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing');
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Supabase credentials' }) };
  }
  if (!secret) {
    console.warn('MONIEPOINT_WEBHOOK_SECRET is not set — signature verification will fail');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ status: 'Webhook Online' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Raw body as string
    const rawBody = event.body || '';

    // Moniepoint-specific signature headers
    const mpId = event.headers && (event.headers['moniepoint-webhook-id'] || event.headers['Moniepoint-Webhook-Id'] || event.headers['moniepoint_webhook_id']);
    const mpTs = event.headers && (event.headers['moniepoint-webhook-timestamp'] || event.headers['Moniepoint-Webhook-Timestamp'] || event.headers['moniepoint_webhook_timestamp']);
    const mpSig = event.headers && (event.headers['moniepoint-webhook-signature'] || event.headers['Moniepoint-Webhook-Signature'] || event.headers['moniepoint_webhook_signature'] || event.headers['signature']);

    function verifyMoniepointSignature(id, ts, raw, headerSig) {
      if (!secret || !id || !ts || !headerSig) return false;
      // Build the signed string per Moniepoint: id + "__" + timestamp + "__" + rawBody
      const message = `${id}__${ts}__${raw}`;
      const computed = crypto.createHmac('sha256', secret).update(message).digest('hex');
      // headerSig may include 'sha256=' prefix — normalize
      const h = headerSig.startsWith('sha256=') ? headerSig.slice(7) : headerSig;
      try {
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(h));
      } catch (e) {
        return false;
      }
    }

    if (!verifyMoniepointSignature(mpId, mpTs, rawBody, mpSig)) {
      console.warn('Invalid or missing Moniepoint signature');
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    const payload = JSON.parse(rawBody);
    console.log('📥 VERIFIED MONIEPOINT WEBHOOK:', { id: mpId, timestamp: mpTs, payload });

    // Extract commonly used fields from Moniepoint payload
    const eventId = mpId || payload.id || payload.event_id || payload.data && (payload.data.transactionReference || payload.data.tx_ref) || null;
    const data = payload.data || payload.eventData || payload.payload || payload;

    const amount = Number(data.amount || data.transactionAmount || data.totalAmount || 0);
    const customer_name = data.accountName || data.customerName || data.cardHolderName || data.senderName || 'Shop Customer';
    const reference = data.paymentReference || data.reference || data.transactionReference || data.tx_ref || null;
    const status = payload.status || payload.event || payload.event_type || data.status || data.paymentStatus || '';

    if (amount <= 0 && !reference) {
      console.warn('Ignored payload with zero amount and no reference');
      return { statusCode: 200, body: JSON.stringify({ message: 'Ignored payload' }) };
    }

    // Idempotency checks using eventId or reference
    if (eventId) {
      const { data: existingEvents, error: e1 } = await supabase.from('webhook_events').select('event_id').eq('event_id', eventId).limit(1);
      if (!e1 && existingEvents && existingEvents.length > 0) {
        console.log('Event already processed:', eventId);
        return { statusCode: 200, body: JSON.stringify({ message: 'Already processed' }) };
      }
    } else if (reference) {
      const { data: existingTx, error: e2 } = await supabase.from('transactions').select('id').eq('reference', reference).limit(1);
      if (!e2 && existingTx && existingTx.length > 0) {
        console.log('Transaction with reference already exists:', reference);
        return { statusCode: 200, body: JSON.stringify({ message: 'Duplicate reference, ignored' }) };
      }
    }

    // Save audit record to webhook_events table (best-effort)
    if (eventId) {
      const { error: we } = await supabase.from('webhook_events').insert([{
        event_id: eventId,
        payload: payload,
        received_at: new Date().toISOString(),
        processed: true
      }]);
      if (we) {
        console.warn('Could not insert into webhook_events (table may not exist):', we.message || we);
      }
    }

    // Insert transaction row
    const txRow = {
      amount: amount || 0,
      customer_name: customer_name || 'Shop Customer',
      reference: reference || ('REF-' + Date.now()),
      status: status || null,
      received_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from('transactions').insert([txRow]);
    if (insertErr) {
      console.error('❌ Supabase Insert Error:', insertErr.message || insertErr);
      return { statusCode: 500, body: JSON.stringify({ error: insertErr.message || insertErr }) };
    }

    console.log('✅ Processed and saved transaction:', txRow);

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Processed successfully' }) };

  } catch (err) {
    console.error('❌ Webhook Execution Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || err }) };
  }
};
