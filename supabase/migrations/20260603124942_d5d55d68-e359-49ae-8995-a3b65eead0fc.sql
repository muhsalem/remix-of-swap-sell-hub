CREATE TYPE public.account_type AS ENUM ('individual', 'company');

ALTER TABLE public.profiles
  ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'individual',
  ADD COLUMN company_name text,
  ADD COLUMN commercial_register text,
  ADD COLUMN company_verified boolean NOT NULL DEFAULT false;