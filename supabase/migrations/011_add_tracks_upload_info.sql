-- Информация о подготовке трека к загрузке по FTP
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prepared_by TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_prepared_at ON tracks(prepared_at DESC);
