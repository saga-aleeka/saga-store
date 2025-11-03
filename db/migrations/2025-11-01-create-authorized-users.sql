-- Migration: create authorized_users table
-- Adds a simple table to store initials, optional name, and a generated token
-- Uses gen_random_uuid() from pgcrypto

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.authorized_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initials text NOT NULL UNIQUE,
  name text,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_authorized_users_token ON public.authorized_users (token);
