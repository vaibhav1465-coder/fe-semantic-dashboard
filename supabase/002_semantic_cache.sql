create table if not exists public.fe_semantic_cache (
  cache_key text primary key,
  payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists fe_semantic_cache_expires_at_idx
  on public.fe_semantic_cache (expires_at);

alter table public.fe_semantic_cache enable row level security;

-- No public policies are created. The server uses the Supabase service-role key.
-- Optional maintenance query:
-- delete from public.fe_semantic_cache where expires_at < now() - interval '90 days';
