create table if not exists public.fe_editorial_actions (
  record_key text primary key,
  action text not null check (action in ('used','ignore','reject','cleared')),
  editor_name text default '',
  notes text default '',
  updated_at timestamptz not null default now()
);

alter table public.fe_editorial_actions enable row level security;

-- The dashboard writes through the server-side service-role key only.
-- Do not expose SUPABASE_SERVICE_ROLE_KEY in browser code.
