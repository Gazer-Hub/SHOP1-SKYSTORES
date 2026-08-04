# Moniepoint webhook backend (example)

This small Node.js/Express service receives webhook events from Moniepoint, verifies signatures, stores raw events for audit, and updates an `orders` table idempotently.

Files added:
- server/index.js - webhook handler
- server/package.json
- server/.env.example
- server/db/webhook_tables.sql

Configuration (.env example)
- MONIEPOINT_WEBHOOK_SECRET=your_webhook_secret
- DATABASE_URL=mysql://user:password@host/database
- PORT=3000

Run locally
1. Install dependencies: cd server && npm install
2. Start: npm start
3. Expose to the internet for Moniepoint (ngrok/localtunnel) and register the webhook URL in Moniepoint dashboard.

Testing signature locally (example using HMAC-SHA256):

On macOS/Linux:

SECRET="your_secret"
PAYLOAD='{"id":"evt_123","reference":"ORDER123","status":"success"}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIG" \
  --data "$PAYLOAD" https://your-ngrok-url/webhook

Notes
- Confirm the exact signature header and algorithm with Moniepoint docs and update server/index.js to match.
- This example expects a MySQL-compatible DATABASE_URL and uses a simple orders table (see SQL).
- Do not commit secrets to the repository. Use environment variables or a secrets manager in production.
