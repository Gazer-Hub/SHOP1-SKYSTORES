exports.handler = async function(event, context) {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const identifier = (process.env.MONIEPOINT_API_KEY || '').trim(); 
  const secretKey = (process.env.MONNIFY_SECRET_KEY || '').trim(); 
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim(); 

  try {
    const baseUrl = 'https://api.monnify.com';

    // If you only have the secret key, some configurations allow passing it directly or paired with your account email/ID
    const credentials = Buffer.from(`${identifier}:${secretKey}`).toString('base64').replace(/\s+/g, '');
    
    const authResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
    
    const authResult = await authResponse.json();
    if (!authResult.requestSuccessful) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ 
          error: "Monnify authentication failed", 
          message: "Monnify requires both an API Key and a Secret Key. If your dashboard only shows the Secret, please contact Monnify support to retrieve your public API Key.",
          details: authResult 
        }) 
      };
    }
    
    const accessToken = authResult.responseBody.accessToken;

    const txResponse = await fetch(`${baseUrl}/api/v1/transactions/search?page=0&size=50&paymentStatus=PAID`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const txResult = await txResponse.json();
    if (!txResult.requestSuccessful) {
      return { statusCode: 400, body: JSON.stringify({ error: "Failed to fetch transactions list", details: txResult }) };
    }

    const externalTransactions = txResult.responseBody.content || [];

    const sbFetch = await fetch(`${SUPABASE_URL}/rest/v1/inventory?id=eq.1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    const sbData = await sbFetch.json();
    let currentDb = sbData[0]?.payload || { stock: [], sales: [], opayPayments: [] };

    currentDb.opayPayments = externalTransactions.map(tx => ({
      orderNo: tx.paymentReference,
      senderName: tx.customerName || tx.accountName || 'Customer',
      amount: tx.amountPaid,
      status: tx.paymentStatus,
      timestamp: tx.createdOn || tx.paidOn
    }));

    await fetch(`${SUPABASE_URL}/rest/v1/inventory`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: 1, payload: currentDb, updated_at: new Date().toISOString() })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Sync successful", count: externalTransactions.length })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
