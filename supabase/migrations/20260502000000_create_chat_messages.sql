create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     text not null,
  display_name text not null,
  text        text not null,
  type        text not null default 'message' check (type in ('message', 'question')),
  upvotes     integer not null default 0,
  created_at  timestamptz not null default now()
);

create index chat_messages_event_id_created_at on public.chat_messages (event_id, created_at asc);

-- RLS
alter table public.chat_messages enable row level security;

-- Anyone can read messages for an event
create policy "chat_messages_select"
  on public.chat_messages for select
  using (true);

-- Anyone (including anon) can insert — userId is app-level, not auth-level
create policy "chat_messages_insert"
  on public.chat_messages for insert
  with check (true);

-- Upvote tracking: separate table so we know who upvoted what
create table if not exists public.chat_upvotes (
  message_id  uuid not null references public.chat_messages(id) on delete cascade,
  user_id     text not null,
  primary key (message_id, user_id)
);

alter table public.chat_upvotes enable row level security;

create policy "chat_upvotes_select"
  on public.chat_upvotes for select
  using (true);

create policy "chat_upvotes_insert"
  on public.chat_upvotes for insert
  with check (true);

-- Atomic upvote increment used by the client
create or replace function public.increment_chat_upvotes(msg_id uuid)
returns void language sql security definer as $$
  update public.chat_messages set upvotes = upvotes + 1 where id = msg_id;
$$;
