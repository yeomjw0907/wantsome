-- 016_settlement_rate_to_50.sql
-- Normalize creator settlement rate to 50%

ALTER TABLE creators
  ALTER COLUMN settlement_rate SET DEFAULT 0.5;

UPDATE creators
SET settlement_rate = 0.5
WHERE settlement_rate IS DISTINCT FROM 0.5;
