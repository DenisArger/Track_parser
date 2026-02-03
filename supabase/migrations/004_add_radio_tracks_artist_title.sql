ALTER TABLE radio_tracks
  ADD COLUMN artist TEXT,
  ADD COLUMN title TEXT;

WITH src AS (
  SELECT
    id,
    regexp_replace(raw_name, '\.mp3$', '', 'i') AS cleaned
  FROM radio_tracks
)
UPDATE radio_tracks rt
SET
  artist = CASE
    WHEN s.cleaned IS NULL OR btrim(s.cleaned) = '' THEN NULL
    WHEN position(' - ' in s.cleaned) > 0 THEN NULLIF(btrim(split_part(s.cleaned, ' - ', 1)), '')
    ELSE NULL
  END,
  title = CASE
    WHEN s.cleaned IS NULL OR btrim(s.cleaned) = '' THEN NULL
    WHEN position(' - ' in s.cleaned) > 0 THEN NULLIF(btrim(substring(s.cleaned from position(' - ' in s.cleaned) + 3)), '')
    ELSE NULLIF(btrim(s.cleaned), '')
  END
FROM src s
WHERE rt.id = s.id;
