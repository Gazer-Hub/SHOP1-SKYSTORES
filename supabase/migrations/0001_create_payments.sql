-- Supabase migration: create payments table (idempotent)

CREATE TABLE IF NOT EXISTS payments (
  reference text PRIMARY KEY,
  status text,
  amount numeric,
  datetime timestamptz,
  sender_name text,
  account_number text,
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

-- Optional: enable RLS and leave policies commented for you to enable if you use Supabase Auth
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- Example policy for authenticated users (requires payments.owner uuid column and auth setup):
-- CREATE POLICY "Allow select if owner = auth.uid()" ON payments
--   FOR SELECT
--   USING (owner = auth.uid());
