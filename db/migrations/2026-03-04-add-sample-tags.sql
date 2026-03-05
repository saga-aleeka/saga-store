-- Add sample tagging tables (tags + sample_tags)

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_name_ci_unique ON public.tags (lower(name));

CREATE TABLE IF NOT EXISTS public.sample_tags (
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sample_id, tag_id)
);

CREATE INDEX IF NOT EXISTS sample_tags_sample_id_idx ON public.sample_tags(sample_id);
CREATE INDEX IF NOT EXISTS sample_tags_tag_id_idx ON public.sample_tags(tag_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_tags ENABLE ROW LEVEL SECURITY;

-- Tags: Allow public read access
CREATE POLICY "Allow public read access to tags"
ON public.tags
FOR SELECT
USING (true);

-- Tags: Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert to tags"
ON public.tags
FOR INSERT
WITH CHECK (true);

-- Tags: Allow authenticated users to update
CREATE POLICY "Allow authenticated update to tags"
ON public.tags
FOR UPDATE
USING (true);

-- Tags: Allow authenticated users to delete
CREATE POLICY "Allow authenticated delete to tags"
ON public.tags
FOR DELETE
USING (true);

-- Sample tags: Allow public read access
CREATE POLICY "Allow public read access to sample_tags"
ON public.sample_tags
FOR SELECT
USING (true);

-- Sample tags: Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert to sample_tags"
ON public.sample_tags
FOR INSERT
WITH CHECK (true);

-- Sample tags: Allow authenticated users to update
CREATE POLICY "Allow authenticated update to sample_tags"
ON public.sample_tags
FOR UPDATE
USING (true);

-- Sample tags: Allow authenticated users to delete
CREATE POLICY "Allow authenticated delete to sample_tags"
ON public.sample_tags
FOR DELETE
USING (true);
