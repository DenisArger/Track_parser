-- Expand tracks.status constraint to match current app states.
-- Keep legacy statuses for existing rows while allowing the newer workflow.

ALTER TABLE public.tracks
  DROP CONSTRAINT IF EXISTS tracks_status_check;

ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_status_check
  CHECK (status IN (
    'downloading',
    'downloaded',
    'processing',
    'processed',
    'reviewed_approved',
    'reviewed_rejected',
    'ready_for_upload',
    'trimmed',
    'rejected',
    'uploading',
    'uploaded',
    'uploaded_ftp',
    'uploaded_radio',
    'error'
  ));
