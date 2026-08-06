const crypto = require('crypto');

// safeFetch wrapper: use global fetch when available, otherwise require node-fetch
let safeFetch;
try {
  if (typeof fetch === 'function') safeFetch = fetch;
  else {
    // node environment without global fetch
    // require lazily to avoid failing in environments where it's not available
    const nodeFetch = require('node-fetch');
    safeFetch = nodeFetch;
  }
} catch (e) {
  // last-resort: create a minimal fetch shim that throws (will be caught later)
  safeFetch = async () => { throw new Error('no fetch available in runtime'); };
}

function normalizeHeaderValue(v) {
  if (!v) return '';
  return v.toString().trim();
}

function hmacHex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function hmacBase64(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

function safeCompare(a, b) {
  try {
    if (!a || !b) return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

async function tryVerifyWithSecret(header, secret, rawBody) {
  if (!header || !secret) return false;
  const h = normalizeHeaderValue(header);
  // header may be like "sha256=abcd" or just hex or base64
  const parts = h.split('=');
  const candidate = parts.length > 1 ? parts[1] : parts[0];

  // compare hex
  const hex = hmacHex(secret, rawBody);
  if (safeCompare(hex, candidate)) return true;

  // compare base64
  const b64 = hmacBase64(secret, rawBody);
  if (safeCompare(b64, candidate)) return true;

  return false;
}

function findReferenceRecursive(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const queue = [obj];
  const keyRegex = /(ref|order|trx|transaction|payment|txnid|tx_ref|transaction_id|order_no|orderid)/i;
  while (queue.length) {
    const cur = queue.shift();
    for (const k of Object.keys(cur)) {
      const v = cur[k];
      if (keyRegex.test(k) && (typeof v === 'string' || typeof v === 'number')) {
        return String(v);
      }
      if (v && typeof v === 'object') queue.push(v);
    }
  }
  return null;
}

exports.handler = async (event) => {
  try {
    const rawBody = event.body || '';
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [k.toLowerCase(), v]));

    // possible signature header names from providers
    const signatureHeaders = [
      headers['x-mon-signature'],
      headers['x-signature'],
      headers['x-opay-signature'],
      headers['x-opay-sign'],
      headers['x-pay-signature'],
      headers['x-hook-signature']
    ];

    const MONIEPOINT_WEBHOOK_SECRET = process.env.MONIEPOINT_WEBHOOK_SECRET;
    const OPAY_WEBHOOK_SECRET = process.env.OPAY_WEBHOOK_SECRET;

    // Try to detect provider by signature verification first (if secrets present)
    let provider = null;
    let verified = false;

    for (const sig of signatureHeaders) {
      if (!sig) continue;
      if (MONIEPOINT_WEBHOOK_SECRET) {
        const ok = await tryVerifyWithSecret(sig, MONIEPOINT_WEBHOOK_SECRET, rawBody);
        if (ok) { provider = 'moniepoint'; verified = true; break; }
      }
      if (OPAY_WEBHOOK_SECRET) {
        const ok = await tryVerifyWithSecret(sig, OPAY_WEBHOOK_SECRET, rawBody);
        if (ok) { provider = 'opay'; verified = true; break; }
      }
    }

    // Parse payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
   console.log('Incoming Moniepoint Payload:', JSON.stringify(payload, null, 2));
    } catch (err) {
    
      // Some providers send application/x-www-form-urlencoded; try to parse URL-encoded
      try {
        const params = new URLSearchParams(rawBody);
        payload = {};
        for (const [k,v] of params) payload[k] = v;
      } catch (e) {
        console.warn('Invalid JSON payload and not urlencoded');
        console.error('payload-parse-error', { message: e?.message, rawBody: rawBody?.slice?.(0,200) });
        return { statusCode: 400, body: 'Invalid JSON' };
      }
    }

    // If provider not detected via signature, attempt guess by payload shape
    if (!provider) {
      const p = payload || {};
      const lowercaseKeys = Object.keys(p).map(k => k.toLowerCase()).join(' ');
      if (lowercaseKeys.includes('monie') || lowercaseKeys.includes('moniepoint')) provider = 'moniepoint';
      else if (lowercaseKeys.includes('opay') || lowercaseKeys.includes('order_no') || lowercaseKeys.includes('trxref') || lowercaseKeys.includes('orderid')) provider = 'opay';
    }

    // Normalize data object if wrapped (some providers use { data: {...} })
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;

    // Extract a reference from many common keys, and fallback to recursive search
    const referenceCandidates = [
      data.reference, data.transaction_ref, data.tx_ref, data.ref, data.order_no, data.orderNo, data.orderId, data.txnRef, data.trxref, data.transactionId, data.payment_ref
    ];
    let reference = referenceCandidates.find(x => x);
    if (!reference) reference = findReferenceRecursive(payload);

  // Extract status and amount using correct keys from the payload
    const rawStatus = (data.transactionStatus || data.status || data.transaction_status || data.state || payload.event || 'UNKNOWN').toString();
    const status = rawStatus.toUpperCase();

    const rawAmount = data.amount || data.total_amount || data.value || data.amt || 0;
    const amount = Number(rawAmount) / 100; // Converts kobo to Naira (e.g. 1030000 -> 10300)
  
    // If still no reference, generate a fallback unique reference rather than rejecting request
   if (!reference) {
      const fallback = `${provider || 'unknown'}-${Date.now()}-${Math.floor(Math.random()*900000+100000)}`;
      console.warn('No transaction reference in webhook — generating fallback reference', fallback);
      reference = fallback;
      // preserve the original payload in metadata for debugging
      if (!data.metadata) data.metadata = {};
      data.metadata._generated_reference = true;
      data.metadata._raw_body_excerpt = rawBody?.slice?.(0,200);
    }

    // If not verified via signature earlier and provider has verify API configured, call it
    let verifyInfo = null;
    if (!verified) {
      try {
        if (provider === 'moniepoint' && process.env.MONIEPOINT_VERIFY_URL && process.env.MONIEPOINT_API_KEY) {
          const url = `${process.env.MONIEPOINT_VERIFY_URL.replace(/\/+$/, '')}/${encodeURIComponent(reference)}`;
          const verifyRes = await safeFetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.MONIEPOINT_API_KEY}`, 'Content-Type': 'application/json' }
          });
          const txt = await verifyRes.text();
          try { verifyInfo = JSON.parse(txt); } catch(e){ verifyInfo = txt; }
          if (verifyRes.ok && (verifyInfo.status === 'success' || verifyInfo.data?.status === 'success' || verifyInfo.data?.transaction_status === 'success')) verified = true;
        } else if (provider === 'opay' && process.env.OPAY_VERIFY_URL && process.env.OPAY_API_KEY) {
          const url = `${process.env.OPAY_VERIFY_URL.replace(/\/+$/, '')}/${encodeURIComponent(reference)}`;
          const verifyRes = await safeFetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.OPAY_API_KEY}`, 'Content-Type': 'application/json' }
          });
          const txt = await verifyRes.text();
          try { verifyInfo = JSON.parse(txt); } catch(e){ verifyInfo = txt; }
          if (verifyRes.ok && (verifyInfo.status === 'SUCCESS' || verifyInfo.success === true || verifyInfo.data?.status === 'success')) verified = true;
        }
      } catch (e) {
        console.warn('verify-api-call-error', { message: e?.message });
      }
    }

    // Extract sender/account values into local vars (we'll keep them in metadata to avoid DB schema mismatch)
    const senderName = data.senderName || data.sender_name || data.payer_name || data.customer_name || data.username || null;
    const accountNumber = data.accountNumber || data.account_number || data.payer_account || data.msisdn || null;

    // Normalize datetime but store in metadata to avoid schema mismatch (some DBs may not have datetime column)
    const normalizedDatetime = data.datetime || data.date || data.time || new Date().toISOString();

    const paymentRow = {
      reference: reference,
      provider: provider || 'unknown',
      status: status,
      amount: amount,
      sender_name: senderName,         // Top-level column
      account_number: accountNumber,   // Top-level column
      datetime: normalizedDatetime,    // <-- Add this here as a top-level property
      metadata: Object.assign({}, data, { provider_detected: provider, verified, verifyInfo }),
    };

    // Upsert into Supabase via REST (service role key required)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
      return { statusCode: 500, body: 'Server not configured' };
    }

    try {
      const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/payments?on_conflict=reference`;
      const res = await safeFetch(url, {
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
        console.error('Supabase upsert failed', { status: res.status, body: txt });
        return { statusCode: 500, body: 'DB upsert failed' };
      }
    } catch (err) {
      console.error('Error saving to Supabase', err && err.stack ? err.stack : String(err));
      return { statusCode: 500, body: 'DB error' };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Unexpected error in webhook', err && err.stack ? err.stack : String(err));
    return { statusCode: 500, body: 'Internal error' };
  }
};
