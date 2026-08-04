const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Missing credentials' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (event.httpMethod === 'GET') {
        return { statusCode: 200, body: JSON.stringify({ status: 'Webhook Online' }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        console.log('📥 INCOMING WEBHOOK PAYLOAD:', JSON.stringify(payload));

        const eventType = payload.eventType || '';
        const data = payload.eventData || payload.data || payload;

        let amount = 0;
        let customer_name = 'Shop Customer';
        let reference = 'TRX-' + Date.now();

        // Handle POS Terminal Purchases AND Direct Wallet/Account Transfers
        if (eventType === 'SUCCESSFUL_TRANSACTION' || eventType === 'ACCOUNT_ACTIVITY' || payload.eventData) {
            amount = Number(data.amount || data.transactionAmount || data.totalAmount || 0);
            customer_name = data.accountName || data.customerName || data.cardHolderName || data.senderName || 'Shop Customer';
            reference = data.paymentReference || data.reference || data.transactionReference || reference;
        } else {
            amount = Number(data.amount || 0);
            customer_name = data.customerName || data.accountName || 'Shop Customer';
            reference = data.reference || reference;
        }

        if (amount <= 0) {
            console.warn('⚠️ Ignored payload with zero or missing amount');
            return { statusCode: 200, body: JSON.stringify({ message: 'Ignored zero amount' }) };
        }

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

        console.log('✅ Successfully processed and saved transaction:', { amount, customer_name, reference });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Processed successfully' })
        };

    } catch (err) {
        console.error('❌ Webhook Execution Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
