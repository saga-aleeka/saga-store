-- Supabase SQL schema for containers, samples, and backups

-- Containers table
create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  sample_type text,
  status text default 'active',
  location_freezer text,
  location_rack text,
  location_drawer text,
  samples jsonb,
  created_at timestamptz default now(),
  created_by text,
  updated_at timestamptz default now(),
  updated_by text,
  locked_by text,
  locked_at timestamptz
);

-- Backups table
create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by text,
  data jsonb not null
);

-- Samples table (optional, if you want to normalize samples)
create table if not exists samples (
  id uuid primary key default gen_random_uuid(),
  container_id uuid references containers(id),
  sample_id text not null,
  position text,
  data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
