Deployment & Providers

This project now supports receiving webhooks from both Moniepoint and OPay. The webhook handler will:
- Detect provider via signature headers or payload shape.
- Verify HMAC signatures if you provide provider-specific webhook secrets.
- Optionally call provider verify endpoints if configured.
- Upsert a normalized payments row into the Supabase `payments` table with `provider`, `reference`, `status`, `amount`, `datetime`, `sender_name`, `account_number`, and `metadata`.

Environment variables to set in Netlify (server-side):
- SUPABASE_URL = https://<project-ref>.supabase.co
- SUPABASE_SERVICE_ROLE_KEY = <service_role_key>
- MONIEPOINT_WEBHOOK_SECRET = <moniepoint_webhook_hmac_secret>  # optional but recommended
- MONIEPOINT_VERIFY_URL = https://api.moniepoint.com/v1/transactions  # optional
- MONIEPOINT_API_KEY = <moniepoint_api_key>  # optional
- OPAY_WEBHOOK_SECRET = <opay_webhook_hmac_secret>  # optional but recommended
- OPAY_VERIFY_URL = https://api.opay.com/v1/transactions  # replace with OPAY's verify endpoint if available
- OPAY_API_KEY = <opay_api_key>  # optional

Frontend (Realtime)
- The frontend subscribes to Supabase Realtime and merges payment rows into the in-browser DB and shows toast notifications. That requires the SUPABASE_ANON_KEY in the site (already present in Index.html). Make sure Realtime is enabled for your Supabase project and that RLS or appropriate policies are in place if you expose anon key publicly.

Testing
- To test Moniepoint or OPay webhook handling you can POST a sample JSON to the webhook URL which contains a reference and amount. The function will upsert into Supabase and your frontend should receive the update via Realtime.

Security note
- Do not commit any secret keys to the repo. Use Netlify environment variables for server-side keys. If exposing SUPABASE_ANON_KEY to the browser, enable RLS and create policies so users can only read rows they should access.
