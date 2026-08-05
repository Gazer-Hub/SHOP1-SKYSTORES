Moniepoint webhook & Supabase integration

Files added in previous commit (summary):
- netlify/functions/moniepoint-webhook.js
- netlify/functions/payment-status.js
- supabase/migrations/0001_create_payments.sql
- web/js/payment-status.js
- DEPLOYMENT.md

Added now:
- web/js/payment-realtime.js  # client-side Supabase Realtime helper

Realtime usage
- This uses Supabase Realtime (Postgres WAL replication) to push changes to browsers when payments rows are inserted or updated.
- You need to expose your Supabase anon (public) key to the frontend so the browser can subscribe. This key is safe to expose in the browser only if your RLS/policies restrict access appropriately. Consider creating a Row Level Security policy that allows clients to select payments rows only for the reference they are authorized to view.

Example client usage (add to your payment page):

<script src="/js/payment-realtime.js"></script>
<script>
  // Replace these with your values (or inject at build time):
  const SUPABASE_URL = 'https://<project-ref>.supabase.co';
  const SUPABASE_ANON_KEY = '<anon-public-key>';
  const ORDER_REF = 'ORDER_REF_HERE';

  // start realtime subscription and update element with id payment-status
  window.startPaymentRealtime(ORDER_REF, 'payment-status', SUPABASE_URL, SUPABASE_ANON_KEY);
</script>

Security notes
- When exposing the anon key to the browser, ensure you have Row Level Security (RLS) policies in Supabase that prevent data leaks. For example, for the payments table, create a policy that allows SELECT only when reference = auth.jwt() claim or use a custom token-based approach.
- If you cannot expose the anon key, an alternative is to keep subscriptions server-side and push updates to clients via WebSockets/SSE (requires more infra).

If you want, I can:
- Add an HTML snippet to a specific page in the repo that includes the realtime script and initializes with a page-specific ORDER_REF.
- Add RLS example policies for Supabase to secure the anon key usage.
- Convert frontend to use a server-sent events endpoint instead of exposing anon key.

Tell me which option you prefer and I will commit the changes.