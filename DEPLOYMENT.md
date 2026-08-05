Moniepoint webhook & Supabase integration

Files added:
- netlify/functions/moniepoint-webhook.js  # webhook receiver (Netlify Function)
- netlify/functions/payment-status.js     # simple lookup function to read payment status
- supabase/migrations/0001_create_payments.sql  # create payments table
- web/js/payment-status.js                 # frontend polling helper

Required environment variables (set in Netlify and Supabase as appropriate):
- SUPABASE_URL = https://<project-ref>.supabase.co
- SUPABASE_SERVICE_ROLE_KEY = <service_role_key>   # server-side only
- MONIEPOINT_WEBHOOK_SECRET = <optional HMAC secret if Moniepoint provides one>
- MONIEPOINT_VERIFY_URL = <optional verify endpoint base, e.g. https://api.moniepoint.com/v1/transactions>
- MONIEPOINT_API_KEY = <optional API key for verify endpoint>

Notes:
1) Do NOT commit any keys or secrets to the repository. Add the variables in Netlify's dashboard (Site settings > Build & deploy > Environment) and in Supabase (for migrations you can run the SQL in the SQL editor).

2) Deploying:
- Netlify functions are deployed automatically when pushed to the repo connected to Netlify.
- Ensure Netlify builds your site and that functions are enabled.

3) Supabase migration:
- Run the SQL file in Supabase SQL editor to create the payments table.
- Alternatively, use Supabase CLI if you have CI configured.

4) Webhook URL:
- Configure Moniepoint to POST webhooks to: https://<your-site-domain>/.netlify/functions/moniepoint-webhook
- If Moniepoint requires a signature header name other than 'x-mon-signature', set MONIEPOINT_WEBHOOK_SECRET but the function will accept header 'x-mon-signature' or 'x-signature'. Adjust if needed.

5) Frontend usage:
- Include the JS on your payment page (example):

<script src="/js/payment-status.js"></script>
<div id="payment-status">waiting</div>
<script>
  // Replace ORDER_REF with your transaction reference available on the page
  window.startPaymentStatusPoll('ORDER_REF', 'payment-status', 3000);
</script>

Security & idempotency:
- The payments table uses reference as PRIMARY KEY. The webhook upserts using Supabase REST ?on_conflict=reference to avoid duplicates.
- The function verifies HMAC if configured, and can optionally call Moniepoint's verify endpoint if MONIEPOINT_VERIFY_URL and MONIEPOINT_API_KEY are provided.

If you want I can now:
- adjust the function to call Supabase via @supabase/supabase-js (requires adding the dependency and package.json changes), or
- modify the functions to use a different runtime (Supabase Edge Functions) if you prefer.

Let me know if you want any additional changes or if I should update an existing HTML file in the repo to include the frontend script (I did not modify your HTML to avoid interfering with your current UI).