-- Migration: create sample_types table
-- Allows users to define custom sample types with colors and settings

CREATE TABLE IF NOT EXISTS public.sample_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text NOT NULL DEFAULT '#6b7280',
  default_temperature text,
  is_system boolean DEFAULT false, -- true for built-in types, false for user-created
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sample_types_name ON public.sample_types (name);

-- Enable RLS
ALTER TABLE public.sample_types ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow all users to read sample types"
  ON public.sample_types
  FOR SELECT
  USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow all users to create sample types"
  ON public.sample_types
  FOR INSERT
  WITH CHECK (true);

-- Allow all authenticated users to update non-system types
CREATE POLICY "Allow all users to update custom sample types"
  ON public.sample_types
  FOR UPDATE
  USING (is_system = false);

-- Allow all authenticated users to delete non-system types
CREATE POLICY "Allow all users to delete custom sample types"
  ON public.sample_types
  FOR DELETE
  USING (is_system = false);

-- Insert existing sample types as system types
INSERT INTO public.sample_types (name, color, default_temperature, is_system) VALUES
  ('PA Pools', '#fb923c', '-20°C', true),
  ('DP Pools', '#10b981', '-20°C', true),
  ('cfDNA Tubes', '#9ca3af', '-20°C', true),
  ('DTC Tubes', '#7c3aed', '4°C', true),
  ('MNC Tubes', '#ef4444', '-20°C', true),
  ('Plasma Tubes', '#f59e0b', '-80°C', true),
  ('BC Tubes', '#3b82f6', '-80°C', true),
  ('IDT Plates', '#06b6d4', '-20°C', true)
ON CONFLICT (name) DO NOTHING;
