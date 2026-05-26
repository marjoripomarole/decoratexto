-- Durable TTS cache for generated Azure Speech MP3s.
-- Audio files live in the private Supabase Storage bucket; Postgres stores
-- metadata only, so repeated requests can reuse the same object across users.

insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', false)
on conflict (id) do nothing;

create table if not exists public.tts_audio_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  provider text not null default 'azure',
  voice_id text not null,
  text_hash text not null,
  storage_path text not null,
  content_type text not null default 'audio/mpeg',
  byte_size integer,
  output_format text not null,
  created_at timestamptz not null default now()
);

create index if not exists tts_audio_cache_text_hash_idx
  on public.tts_audio_cache (text_hash);

alter table public.tts_audio_cache enable row level security;

-- The app writes and reads this cache through server-side routes with
-- SUPABASE_SERVICE_ROLE_KEY. Do not expose cached audio directly to clients.
