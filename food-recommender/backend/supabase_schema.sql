-- Crave — Supabase schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table if not exists users (
  id          serial primary key,
  email       text unique not null,
  password_hash text not null,
  name        text not null,
  dietary_restrictions text[]   default '{}',
  dietary_notes        text[]   default '{}',
  cuisine_preferences  text[]   default '{}',
  default_party_size   integer  default 2,
  created_at  timestamptz default now()
);

create table if not exists visited_restaurants (
  id          serial primary key,
  user_id     integer references users(id) on delete cascade,
  place_id    text not null,
  name        text not null,
  address     text,
  rating      integer,
  notes       text,
  would_return boolean,
  visited_at  timestamptz default now(),
  updated_at  timestamptz,
  unique(user_id, place_id)
);

create table if not exists youtube_cache (
  place_id    text primary key,
  video_id    text,
  title       text,
  channel     text,
  thumbnail   text,
  cached_at   timestamptz default now()
);

-- Row Level Security (keep data private — service role key bypasses this)
alter table users                enable row level security;
alter table visited_restaurants  enable row level security;
alter table youtube_cache        enable row level security;
