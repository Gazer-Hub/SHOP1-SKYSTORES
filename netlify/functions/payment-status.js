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
