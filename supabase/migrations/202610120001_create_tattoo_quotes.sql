create table if not exists public.orcamentos_tatuagem (
    id uuid primary key default gen_random_uuid(),
    client_name text not null check (char_length(client_name) between 1 and 100),
    product_id bigint,
    product_name text not null,
    image_path text not null unique,
    created_at timestamptz not null default now()
);

alter table public.orcamentos_tatuagem enable row level security;

insert into storage.buckets (id, name, public)
values ('orcamentos-tatuagem', 'orcamentos-tatuagem', true)
on conflict (id) do update set public = excluded.public;