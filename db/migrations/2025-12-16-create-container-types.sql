-- Migration: create container_types table
-- Allows users to define custom container types with grid dimensions and settings

CREATE TABLE IF NOT EXISTS public.container_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  rows integer NOT NULL CHECK (rows > 0 AND rows <= 50),
  columns integer NOT NULL CHECK (columns > 0 AND columns <= 50),
  default_temperature text,
  is_system boolean DEFAULT false, -- true for built-in types, false for user-created
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_container_types_name ON public.container_types (name);

-- Enable RLS
ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow all users to read container types"
  ON public.container_types
  FOR SELECT
  USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow all users to create container types"
  ON public.container_types
  FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to update non-system types
CREATE POLICY "Allow all users to update custom container types"
  ON public.container_types
  FOR UPDATE
  USING (is_system = false);

-- Allow all authenticated users to delete non-system types
CREATE POLICY "Allow all users to delete custom container types"
  ON public.container_types
  FOR DELETE
  USING (is_system = false);

-- Insert existing layout types as system types
INSERT INTO public.container_types (name, rows, columns, default_temperature, is_system, description) VALUES
  ('9x9', 9, 9, '-80°C', true, 'Standard 9×9 grid (81 positions)'),
  ('5x5', 5, 5, '-80°C', true, 'Small 5×5 grid (25 positions)'),
  ('14x7', 14, 7, '-20°C', true, 'IDT plate layout (98 positions)')
ON CONFLICT (name) DO NOTHING;
