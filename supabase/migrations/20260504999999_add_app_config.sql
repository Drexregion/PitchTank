CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'
);
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_app_config" ON app_config FOR SELECT USING (true);
INSERT INTO app_config (key, value) VALUES ('failover_enabled', 'false') ON CONFLICT DO NOTHING;
