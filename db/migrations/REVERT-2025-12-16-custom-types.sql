-- Revert Migration: Drop sample_types and container_types tables
-- Run this in Supabase SQL Editor to completely remove the custom types feature

-- Drop sample_types table and all associated objects
DROP POLICY IF EXISTS "Allow all users to delete custom sample types" ON public.sample_types;
DROP POLICY IF EXISTS "Allow all users to update custom sample types" ON public.sample_types;
DROP POLICY IF EXISTS "Allow all users to create sample types" ON public.sample_types;
DROP POLICY IF EXISTS "Allow all users to read sample types" ON public.sample_types;
DROP INDEX IF EXISTS public.idx_sample_types_name;
DROP TABLE IF EXISTS public.sample_types CASCADE;

-- Drop container_types table and all associated objects
DROP POLICY IF EXISTS "Allow all users to delete custom container types" ON public.container_types;
DROP POLICY IF EXISTS "Allow all users to update custom container types" ON public.container_types;
DROP POLICY IF EXISTS "Allow all users to create container types" ON public.container_types;
DROP POLICY IF EXISTS "Allow all users to read container types" ON public.container_types;
DROP INDEX IF EXISTS public.idx_container_types_name;
DROP TABLE IF EXISTS public.container_types CASCADE;
