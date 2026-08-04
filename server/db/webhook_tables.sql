# Webhook DB schema

-- Table to store received webhook events (idempotency + audit)
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id VARCHAR(191) PRIMARY KEY,
  payload JSON NOT NULL,
  received_at DATETIME NOT NULL,
  processed TINYINT(1) DEFAULT 0
) ENGINE=InnoDB;

-- Example orders table (adjust to your existing schema)
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(100) UNIQUE,
  payment_reference VARCHAR(191) UNIQUE,
  payment_status VARCHAR(50),
  paid_at DATETIME NULL
) ENGINE=InnoDB;
