# Moniepoint webhook restoration

This commit restores the working Netlify webhook function that verifies Moniepoint signatures and inserts transactions into Supabase. Ensure the following Netlify environment variables are set:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- MONIEPOINT_WEBHOOK_SECRET

After deploy, check Netlify Functions logs and your Supabase transactions table for processed events.
