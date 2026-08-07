exports.handler = async function(event, context) {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const MONIEPOINT_API_KEY = process.env.MONIEPOINT_API_KEY; 
  const MONIEPOINT_SECRET_KEY = process.env.MONIEPOINT_SECRET_KEY; 
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; 

  try {
    // Step 1: Generate Bearer Token from Monnify/Moniepoint Auth API
    const credentials = Buffer.from(`${MONIEPOINT_API_KEY}:${MONIEPOINT_SECRET_KEY}`).toString('base64');
    
    const authResponse = await fetch('https://api.monnify.com/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });
    
    const authResult = await authResponse.json();
    if (!authResult.requestSuccessful) {
      return { statusCode: 401, body: JSON.stringify({ error: "Monnify authentication failed" }) };
    }
    
    const accessToken = authResult.responseBody.accessToken;

    // Step 2: Fetch transaction history using the generated token
    const txResponse = await fetch('https://api.monnify.com/api/v1/transactions/search?page=0&size=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const txResult = await txResponse.json();
    if (!txResult.requestSuccessful) {
      return { statusCode: 400, body: JSON.stringify({ error: "Failed to fetch transactions list" }) };
    }

    const externalTransactions = txResult.responseBody.content || [];

    // Step 3: Connect to Supabase to fetch current inventory payload
    const sbFetch = await fetch(`${SUPABASE_URL}/rest/v1/inventory?id=eq.1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    const sbData = await sbFetch.json();
    let currentDb = sbData[0]?.payload || { stock: [], sales: [], opayPayments: [] };

    // Step 4: Map and merge transactions into your app's array
    currentDb.opayPayments = externalTransactions.map(tx => ({
      orderNo: tx.paymentReference,
      senderName: tx.customerName || tx.accountName || 'Customer',
      amount: tx.amountPaid,
      status: tx.paymentStatus,
      timestamp: tx.createdOn
    }));

    // Step 5: Push updated state back into Supabase cloud
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
