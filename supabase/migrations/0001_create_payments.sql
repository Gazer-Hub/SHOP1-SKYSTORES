-- Supabase migration: create payments table (idempotent)

CREATE TABLE IF NOT EXISTS payments (
  reference text PRIMARY KEY,
  status text,
  amount numeric,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at ON payments;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
