// Moniepoint webhook receiver (Node.js + Express)
// Place this file in server/index.js
// Environment variables (see .env.example):
// MONIEPOINT_WEBHOOK_SECRET, DATABASE_URL (mysql://user:pass@host/db), PORT

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();

// Keep raw body for signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));

const SECRET = process.env.MONIEPOINT_WEBHOOK_SECRET || '';
const DB_URL = process.env.DATABASE_URL || '';

if (!SECRET) {
  console.warn('Warning: MONIEPOINT_WEBHOOK_SECRET is not set. Set it in your environment.');
}
if (!DB_URL) {
  console.warn('Warning: DATABASE_URL is not set. Set it in your environment.');
}

async function getConn() {
  return mysql.createConnection(DB_URL);
}

function verifySignature(rawBody, headerSignature) {
  // Moniepoint may use HMAC-SHA256. Confirm with Moniepoint docs and header name.
  if (!headerSignature || !SECRET) return false;
  const computed = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
  try {
    // headerSignature could be prefixed like "sha256=...". Normalize if so.
    const sig = headerSignature.startsWith('sha256=') ? headerSignature.slice(7) : headerSignature;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
  } catch (e) {
    return false;
  }
}

app.post('/webhook', async (req, res) => {
  const rawBody = req.body; // Buffer
  const headerSig = req.headers['x-signature'] || req.headers['x-moniepoint-signature'] || req.headers['x-webhook-signature'] || '';

  if (!verifySignature(rawBody, headerSig)) {
    console.warn('Invalid or missing signature');
    return res.status(401).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (err) {
    console.warn('Invalid JSON payload');
    return res.status(400).send('Invalid JSON');
  }

  // Extract identifiers - adapt these keys to the real Moniepoint payload
  const eventId = event.id || event.event_id || event.tx_ref || event.transaction_reference || null;
  const status = event.status || event.payment_status || null;
  const reference = event.reference || event.tx_ref || event.transaction_reference || null;

  const conn = await getConn();
  try {
    // Idempotency check
    if (eventId) {
      const [rows] = await conn.execute('SELECT processed FROM webhook_events WHERE event_id = ? LIMIT 1', [eventId]);
      if (rows.length > 0 && rows[0].processed) {
        await conn.end();
        return res.status(200).send('Already processed');
      }
    }

    await conn.beginTransaction();

    // Save raw event for auditing (upsert)
    if (eventId) {
      await conn.execute(
        `INSERT INTO webhook_events (event_id, payload, received_at, processed)
         VALUES (?, ?, NOW(), 0)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), received_at = NOW()`,
        [eventId, JSON.stringify(event)]
      );
    } else {
      await conn.execute(
        `INSERT INTO webhook_events (event_id, payload, received_at, processed)
         VALUES (?, ?, NOW(), 0)`,
        [null, JSON.stringify(event)]
      );
    }

    // Business logic: update orders table based on reference and status
    if (reference && status) {
      if (['success', 'completed', 'paid'].includes(String(status).toLowerCase())) {
        await conn.execute(
          `UPDATE orders SET payment_status = 'paid', paid_at = NOW() WHERE payment_reference = ?`,
          [reference]
        );
      } else if (['failed', 'declined'].includes(String(status).toLowerCase())) {
        await conn.execute(
          `UPDATE orders SET payment_status = 'failed', paid_at = NULL WHERE payment_reference = ?`,
          [reference]
        );
      } else {
        // other statuses can be handled here
      }
    }

    if (eventId) {
      await conn.execute(`UPDATE webhook_events SET processed = 1 WHERE event_id = ?`, [eventId]);
    }

    await conn.commit();
    await conn.end();

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook processing error:', err);
    try { await conn.rollback(); await conn.end(); } catch (e) {}
    return res.status(500).send('Processing error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Moniepoint webhook listening on port ${PORT}`));
