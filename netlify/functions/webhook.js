const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    // 1. Safe check for environment variables so it never crashes mysteriously
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables on Netlify!');
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Server configuration error: Missing database credentials.' }) 
        };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Allow GET requests to verify the endpoint is online
    if (event.httpMethod === 'GET') {
        return { 
            statusCode: 200, 
            body: JSON.stringify({ status: 'Webhook endpoint is active and online!' }) 
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        console.log('📥 INCOMING MONIEPOINT WEBHOOK:', JSON.stringify(payload));

        // Moniepoint POS / Purchase event data extraction
        const data = payload.eventData || payload.data || payload;

        const amount = Number(
            data.amount || 
            data.transactionAmount || 
            data.totalAmount || 
            0
        );

        const customer_name = 
            data.accountName || 
            data.customerName || 
            data.cardHolderName || 
            data.senderName || 
            'POS Customer';

        const reference = 
            data.paymentReference || 
            data.reference || 
            data.transactionReference || 
            ('PUR-' + Date.now());

        console.log(`Parsed -> Amount: ${amount}, Customer: ${customer_name}, Ref: ${reference}`);

        // Insert into your 'transactions' table in Supabase
        const { data: insertedData, error } = await supabase
            .from('transactions')
            .insert([{
                amount: amount,
                customer_name: customer_name,
                reference: reference
            }])
            .select();

        if (error) {
            console.error('❌ Supabase Insert Error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }

        console.log('✅ Successfully saved transaction to Supabase:', insertedData);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Transaction processed and saved!' })
        };

    } catch (err) {
        console.error('❌ Webhook Execution Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
