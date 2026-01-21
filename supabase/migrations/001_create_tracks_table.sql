-- Таблица треков
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_path TEXT,
  processed_path TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'downloading', 'downloaded', 'processing', 'processed', 
    'trimmed', 'rejected', 'uploading', 'uploaded', 'error'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  download_progress INTEGER DEFAULT 0 CHECK (download_progress >= 0 AND download_progress <= 100),
  processing_progress INTEGER DEFAULT 0 CHECK (processing_progress >= 0 AND processing_progress <= 100),
  upload_progress INTEGER DEFAULT 0 CHECK (upload_progress >= 0 AND upload_progress <= 100),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_tracks_status ON tracks(status);
CREATE INDEX idx_tracks_created_at ON tracks(created_at DESC);
-- GIN индекс на весь JSONB объект для эффективного поиска по любым полям метаданных
CREATE INDEX idx_tracks_metadata ON tracks USING GIN (metadata);
-- B-tree индексы для поиска по конкретным текстовым полям метаданных
CREATE INDEX idx_tracks_metadata_title ON tracks ((metadata->>'title'));
CREATE INDEX idx_tracks_metadata_artist ON tracks ((metadata->>'artist'));

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для updated_at
CREATE TRIGGER update_tracks_updated_at 
  BEFORE UPDATE ON tracks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (опционально, для будущей аутентификации)
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Политика: разрешить все операции для анонимных пользователей (можно изменить позже)
CREATE POLICY "Allow all operations for anon" ON tracks
  FOR ALL USING (true) WITH CHECK (true);
