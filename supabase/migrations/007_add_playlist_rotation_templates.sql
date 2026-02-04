CREATE TABLE playlist_rotation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  template JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE playlist_rotation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon" ON playlist_rotation_templates
  FOR ALL USING (true) WITH CHECK (true);
