-- À coller UNE FOIS dans Supabase : menu « SQL Editor » → New query → Run.
-- Une ligne par « document » de sauvegarde (en-tête + morceaux), propre à chaque compte.
create table if not exists public.documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  chemin text not null,
  donnees jsonb not null,
  maj timestamptz not null default now(),
  primary key (user_id, chemin)
);

alter table public.documents enable row level security;

-- chacun ne voit et ne modifie que ses propres lignes
drop policy if exists "chacun ses documents" on public.documents;
create policy "chacun ses documents" on public.documents
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
