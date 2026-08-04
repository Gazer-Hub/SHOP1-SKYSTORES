const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        console.log('📥 Received Webhook Payload:', JSON.stringify(payload));

        // Fallback-friendly extraction so it never crashes if fields are nested differently
        const eventData = payload.eventData || payload.data || payload;

        const amount = eventData.amount || eventData.transactionAmount || eventData.totalAmount || 0;
        const customer_name = eventData.accountName || eventData.customerName || eventData.senderName || 'Valued Customer';
        const reference = eventData.paymentReference || eventData.reference || eventData.transactionReference || 'REF-' + Date.now();

        // Insert into Supabase table 'payments'
        const { error } = await supabase.from('payments').insert([{
            amount: amount,
            customer_name: customer_name,
            reference: reference
        }]);

        if (error) {
            console.error('❌ Supabase insert error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }

        console.log('✅ Payment successfully saved to Supabase:', { amount, customer_name, reference });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook processed and saved successfully' })
        };

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
