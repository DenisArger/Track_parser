-- Add role-based access flag to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Backfill existing rows so every user has a known role value.
UPDATE public.users
SET role = COALESCE(role, 'user')
WHERE role IS NULL OR role = '';
