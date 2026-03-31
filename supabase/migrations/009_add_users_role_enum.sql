-- Convert public.users.role to enum-based access control
DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
      AND data_type <> 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE public.users
      ALTER COLUMN role TYPE public.user_role
      USING (
        CASE
          WHEN role::text = 'admin' THEN 'admin'::public.user_role
          ELSE 'user'::public.user_role
        END
      );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user'::public.user_role;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

UPDATE public.users
SET role = 'user'::public.user_role
WHERE role IS NULL;
