const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function(event, context) {
    // Allow both POST and GET (GET makes it easy to test in your browser if the URL works)
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
        let payload = {};
        try {
            payload = JSON.parse(event.body || '{}');
        } catch (e) {
            console.warn('⚠️ Raw body text received instead of strict JSON');
        }

        console.log('📥 INCOMING WEBHOOK PAYLOAD:', JSON.stringify(payload));

        // Deep search for fields across any variation Moniepoint might use
        const data = payload.eventData || payload.data || payload;

        const amount = Number(
            data.amount || 
            data.transactionAmount || 
            data.totalAmount || 
            payload.amount || 
            0
        );

        const customer_name = 
            data.accountName || 
            data.customerName || 
            data.senderName || 
            payload.customerName || 
            'Direct Bank Transfer';

        const reference = 
            data.paymentReference || 
            data.reference || 
            data.transactionReference || 
            payload.reference || 
            ('TXN-' + Date.now());

        console.log(`Parsed Data -> Amount: ${amount}, Customer: ${customer_name}, Ref: ${reference}`);

        // Insert into your 'transactions' table
        const { data: insertedData, error } = await supabase
            .from('transactions')
            .insert([{
                amount: amount,
                customer_name: customer_name,
                reference: reference
            }])
            .select();

        if (error) {
            console.error('❌ Supabase Database Insert Failed:', error);
            return { 
                statusCode: 500, 
                body: JSON.stringify({ success: false, error: error.message }) 
            };
        }

        console.log('✅ Successfully inserted into Supabase transactions table!', insertedData);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Processed & saved successfully' })
        };

    } catch (err) {
        console.error('❌ Critical Webhook Error:', err);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ success: false, error: err.message }) 
        };
    }
};
