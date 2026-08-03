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
        const signature = event.headers['monnify-signature'];
        const secretKey = process.env.MONNIFY_SECRET_KEY;

        if (signature && secretKey) {
            const computedSignature = crypto
                .createHmac('sha512', secretKey)
                .update(event.body, 'utf-8')
                .digest('hex');

            if (computedSignature !== signature) {
                return { statusCode: 401, body: 'Invalid signature' };
            }
        }

        const payload = JSON.parse(event.body);

        if (payload.eventType === 'SUCCESSFUL_TRANSACTION' || payload.eventType === 'ACCOUNT_ACTIVITY') {
            const eventData = payload.eventData;

            const paymentData = {
                amount: eventData.amount,
                customer_name: eventData.accountName || eventData.customerName || 'Valued Customer',
                reference: eventData.paymentReference || eventData.reference
            };

            const { error } = await supabase.from('payments').insert([paymentData]);

            if (error) {
                console.error('Supabase insert error:', error);
                return { statusCode: 500, body: 'Database Error' };
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook processed successfully' })
        };

    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
