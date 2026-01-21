-- Таблица имён треков на радио (для проверки «трек на радио» без вызова API)
CREATE TABLE radio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name TEXT NOT NULL UNIQUE,
  raw_name TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (по аналогии с tracks)
ALTER TABLE radio_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon" ON radio_tracks
  FOR ALL USING (true) WITH CHECK (true);
