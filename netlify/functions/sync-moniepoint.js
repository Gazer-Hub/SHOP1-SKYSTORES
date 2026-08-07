exports.handler = async function(event, context) {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const MONIEPOINT_API_KEY = process.env.MONIEPOINT_API_KEY; // Your merchant/Monnify secret key
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service role key to write freely

  try {
    // 1. Fetch transaction history from Moniepoint/Monnify API endpoint
    const response = await fetch('https://api.monnify.com/api/v2/transactions/search?page=0&size=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MONIEPOINT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    if (!result.requestSuccessful) {
      return { statusCode: 400, body: JSON.stringify({ error: "Failed to fetch from Moniepoint" }) };
    }

    const externalTransactions = result.responseBody.content || [];

    // 2. Connect to Supabase to fetch current inventory payload
    const sbFetch = await fetch(`${SUPABASE_URL}/rest/v1/inventory?id=eq.1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    const sbData = await sbFetch.json();
    let currentDb = sbData[0]?.payload || { stock: [], sales: [], opayPayments: [] };

    // 3. Map and merge transactions into your app's payment history array
    currentDb.opayPayments = externalTransactions.map(tx => ({
      orderNo: tx.paymentReference,
      senderName: tx.customerName || tx.accountName || 'Customer',
      amount: tx.amountPaid,
      status: tx.paymentStatus,
      timestamp: tx.createdOn
    }));

    // 4. Push updated state back into Supabase cloud
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
