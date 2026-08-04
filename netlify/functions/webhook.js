const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables!');
        return { statusCode: 500, body: JSON.stringify({ error: 'Missing DB credentials' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (event.httpMethod === 'GET') {
        return { statusCode: 200, body: JSON.stringify({ status: 'Online' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        console.log('📥 RAW PAYLOAD:', JSON.stringify(payload));

        // Safe extraction handling Moniepoint POS structure
        const data = payload?.eventData || payload?.data || payload;

        const amount = Number(
            data?.amount || 
            data?.transactionAmount || 
            data?.totalAmount || 
            0
        );

        const customer_name = 
            data?.accountName || 
            data?.customerName || 
            data?.cardHolderName || 
            data?.senderName || 
            'POS Customer';

        const reference = 
            data?.paymentReference || 
            data?.reference || 
            data?.transactionReference || 
            ('PUR-' + Date.now());

        console.log(`Inserting -> Amount: ${amount}, Customer: ${customer_name}, Ref: ${reference}`);

        // Insert into Supabase 'transactions' table
        const { error } = await supabase
            .from('transactions')
            .insert([{
                amount: amount,
                customer_name: customer_name,
                reference: reference
            }]);

        if (error) {
            console.error('❌ Supabase Insert Error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }

        console.log('✅ Successfully saved to Supabase!');
        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (err) {
        console.error('❌ Critical Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
