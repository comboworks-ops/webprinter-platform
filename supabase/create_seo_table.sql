
-- Create a table for managing SEO metadata for pages
create table if not exists page_seo (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique, -- e.g. '/', '/produkt/salgsmapper'
  title text not null default 'PrintMaker - Professionelt Tryk',
  meta_description text,
  og_image_url text,
  keywords text[], -- Array of keywords
  structured_data jsonb, -- For custom JSON-LD
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table page_seo enable row level security;

-- Everyone can read SEO data
create policy "Allow public read access"
  on page_seo for select
  using (true);

-- Only authenticated users (admins) can update/insert
-- Note: You might want to restrict this further to specific admin roles if you have them implemented in RLS
create policy "Allow authenticated insert"
  on page_seo for insert
  with check (auth.role() = 'authenticated');

create policy "Allow authenticated update"
  on page_seo for update
  using (auth.role() = 'authenticated');

-- Insert default entry for home page
insert into page_seo (slug, title, meta_description)
values 
  ('/', 'Webprinter.dk – Danmarks billigste tryksager √ bannere √ print', 'Få professionelt tryk af foldere, flyers og visitkort til markedets bedste priser. Hurtig levering og høj kvalitet. Bestil online i dag!')
on conflict (slug) do nothing;
