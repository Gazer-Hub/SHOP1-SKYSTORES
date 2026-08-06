exports.handler = async (event) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return { statusCode: 500, body: 'Server not configured' };
    }

    const reference = (event.queryStringParameters && event.queryStringParameters.reference) || null;
    if (!reference) return { statusCode: 400, body: 'Missing reference query param' };

    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/payments?reference=eq.${encodeURIComponent(reference)}&select=*`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Supabase query failed', res.status, txt);
      return { statusCode: 500, body: 'DB query failed' };
    }

    const rows = await res.json();
    if (!rows || rows.length === 0) return { statusCode: 404, body: 'Not found' };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows[0])
    };

  } catch (err) {
    console.error('Error in payment-status function', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};

// Inside your Netlify Function handler (e.g., netlify/functions/moniepoint-webhook.js)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);

    // 1. Extract and sanitize incoming values
    const reference = payload.reference || payload.transactionReference || payload.data?.reference;
    
    // Convert Kobo to Naira (e.g., 1030000 -> 10300)
    const rawAmount = payload.amount || payload.data?.amount || 0;
    const formattedAmount = rawAmount / 100;

    // Normalize status (ensure uppercase: 'SUCCESSFUL', 'FAILED', etc.)
    const rawStatus = payload.status || payload.data?.status || 'SUCCESSFUL';
    const status = rawStatus.toUpperCase();

    // 2. Save directly to Supabase with status and provider pre-populated
    const { error } = await supabaseClient
      .from('payments')
      .upsert(
        [
          {
            reference: reference,
            amount: formattedAmount,       // Fixes amount denomination
            status: status,                // Sets SUCCESSFUL / FAILED
            provider: 'Moniepoint',        // Explicitly sets provider
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'reference' }       // Prevents duplicates on webhook retries
      );

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Payment recorded successfully' })
    };
  } catch (err) {
    console.error('Webhook execution error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
