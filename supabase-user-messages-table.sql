-- Estrutura corrigida da tabela user_messages
create table public.user_messages (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  messages jsonb null default '[]'::jsonb,
  last_message_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_messages_pkey primary key (id),
  constraint user_messages_user_id_key unique (user_id),
  constraint user_messages_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_messages_user_id on public.user_messages using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_messages_last_message on public.user_messages using btree (last_message_at) TABLESPACE pg_default;

create index IF not exists idx_user_messages_updated on public.user_messages using btree (updated_at) TABLESPACE pg_default;

create index IF not exists idx_user_messages_jsonb on public.user_messages using gin (messages) TABLESPACE pg_default;

create trigger update_user_messages_updated_at BEFORE
update on user_messages for EACH row
execute FUNCTION update_updated_at_column ();

-- Políticas RLS para user_messages
alter table public.user_messages enable row level security;

-- Permitir que usuários vejam apenas suas próprias mensagens
create policy "Users can view their own messages" on public.user_messages
for select using (auth.uid() = user_id);

-- Permitir que usuários insiram suas próprias mensagens
create policy "Users can insert their own messages" on public.user_messages
for insert with check (auth.uid() = user_id);

-- Permitir que usuários atualizem suas próprias mensagens
create policy "Users can update their own messages" on public.user_messages
for update using (auth.uid() = user_id);

-- Permitir que usuários deletem suas próprias mensagens
create policy "Users can delete their own messages" on public.user_messages
for delete using (auth.uid() = user_id);