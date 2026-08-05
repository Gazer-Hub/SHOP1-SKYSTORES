const crypto = require('crypto');

exports.handler = async (event) => {
  try {
    const rawBody = event.body || '';
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [k.toLowerCase(), v]));

    const sigHeader = headers['x-mon-signature'] || headers['x-signature'];
    const MONIEPOINT_WEBHOOK_SECRET = process.env.MONIEPOINT_WEBHOOK_SECRET;

    // Verify signature if secret & header present
    if (MONIEPOINT_WEBHOOK_SECRET && sigHeader) {
      const computed = crypto.createHmac('sha256', MONIEPOINT_WEBHOOK_SECRET).update(rawBody).digest('hex');
      const ok = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sigHeader));
      if (!ok) {
        console.warn('Invalid webhook signature');
        return { statusCode: 400, body: 'Invalid signature' };
      }
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      console.warn('Invalid JSON payload');
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const data = payload.data || {};
    const reference = data.reference || data.transaction_ref || data.tx_ref || data.ref;
    const status = data.status || payload.event || 'unknown';
    const amount = data.amount ?? null;

    if (!reference) {
      console.warn('No transaction reference in webhook');
      return { statusCode: 400, body: 'Missing reference' };
    }

    // Optional: verify with Moniepoint verify endpoint if configured
    const MONIEPOINT_VERIFY_URL = process.env.MONIEPOINT_VERIFY_URL; // e.g. https://api.moniepoint.com/v1/transactions
    const MONIEPOINT_API_KEY = process.env.MONIEPOINT_API_KEY;
    let verified = false;
    let verifyInfo = null;

    if (MONIEPOINT_VERIFY_URL && MONIEPOINT_API_KEY) {
      try {
        const verifyRes = await fetch(`${MONIEPOINT_VERIFY_URL}/${encodeURIComponent(reference)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${MONIEPOINT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (verifyRes.ok) {
          verifyInfo = await verifyRes.json();
          // You may need to adjust the checks according to Moniepoint verify response shape
          if (verifyInfo && (verifyInfo.status === 'success' || verifyInfo.data?.status === 'success' || verifyInfo.data?.transaction_status === 'success')) {
            verified = true;
          }
        } else {
          console.warn('Moniepoint verify returned non-200', verifyRes.status);
        }
      } catch (err) {
        console.error('Error calling Moniepoint verify API', err);
      }
    }

    // Upsert into Supabase via REST (service role key required)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
      return { statusCode: 500, body: 'Server not configured' };
    }

    const paymentRow = {
      reference: reference,
      status: status,
      amount: amount,
      metadata: Object.assign({}, data, { verified }),
    };

    try {
      const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/payments?on_conflict=reference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(paymentRow)
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('Supabase upsert failed', res.status, txt);
        return { statusCode: 500, body: 'DB upsert failed' };
      }

    } catch (err) {
      console.error('Error saving to Supabase', err);
      return { statusCode: 500, body: 'DB error' };
    }

    // Return 200 quickly
    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Unexpected error in webhook', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};
