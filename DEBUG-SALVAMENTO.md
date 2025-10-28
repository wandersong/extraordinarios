# 🔧 DEBUG: Problema de Salvamento de Mensagens

## 📋 Checklist de Verificação

### 1. **Acesse o Chat com Debug**
- URL: http://localhost:3000/chat
- Faça login com suas credenciais
- Observe o painel de debug que aparece abaixo do header

### 2. **Verifique a Conexão Supabase**
No painel de debug, você deve ver:
- ✅ "Usuário autenticado: seu@email.com"
- ✅ "Tabela user_messages acessível"
- ✅ "Inserção funcionando!"

Se houver erro, anote a mensagem exata.

### 3. **Execute a Tabela SQL**
Se a tabela não existir, execute este SQL no Supabase:

```sql
-- EXECUTE ESTE SQL NO SUPABASE SQL EDITOR
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
);

-- Índices
create index IF not exists idx_user_messages_user_id on public.user_messages using btree (user_id);
create index IF not exists idx_user_messages_last_message on public.user_messages using btree (last_message_at);
create index IF not exists idx_user_messages_updated on public.user_messages using btree (updated_at);
create index IF not exists idx_user_messages_jsonb on public.user_messages using gin (messages);

-- RLS Policies
alter table public.user_messages enable row level security;

create policy "Users can view their own messages" on public.user_messages
for select using (auth.uid() = user_id);

create policy "Users can insert their own messages" on public.user_messages
for insert with check (auth.uid() = user_id);

create policy "Users can update their own messages" on public.user_messages
for update using (auth.uid() = user_id);

create policy "Users can delete their own messages" on public.user_messages
for delete using (auth.uid() = user_id);
```

### 4. **Teste o Fluxo de Mensagem**
1. Envie uma mensagem no chat
2. Abra o console do navegador (F12)
3. Procure pelos logs:
   - 🔵 "addMessage chamado"
   - 💾 "Salvando X mensagens no localStorage" 
   - 🔄 "Iniciando sync de X mensagens"
   - ✅ "Mensagens sincronizadas com sucesso!"

### 5. **Verifique Erros Específicos**
Se houver erro ❌, anote:
- Código do erro
- Mensagem detalhada
- Se é problema de auth, tabela, ou RLS

### 6. **Teste Manual no Supabase**
No SQL Editor do Supabase:
```sql
-- Ver suas mensagens
SELECT * FROM user_messages WHERE user_id = auth.uid();

-- Ver estrutura da tabela
\d user_messages;

-- Testar inserção manual
INSERT INTO user_messages (user_id, messages) 
VALUES (auth.uid(), '[{"id": "test", "content": "teste", "type": "user", "timestamp": "2025-10-28T12:00:00Z"}]'::jsonb);
```

## 🎯 Problemas Comuns e Soluções

### ❌ "relation user_messages does not exist"
**Solução**: Execute o SQL da seção 3

### ❌ "permission denied for table user_messages"  
**Solução**: Verifique se as policies RLS foram criadas

### ❌ "duplicate key value violates unique constraint"
**Solução**: O upsert deve usar `onConflict: 'user_id'`

### ❌ "invalid input syntax for type uuid"
**Solução**: Verifique se `auth.uid()` retorna um UUID válido

## 📊 Status Esperado

Após as correções, você deve ver:
- ✅ Debug panel mostra conexão OK
- ✅ Mensagens aparecem imediatamente no chat
- ✅ Console mostra logs de sync bem-sucedido
- ✅ Mensagens persistem após reload da página
- ✅ Tabela user_messages no Supabase contém os dados

---
**Se ainda houver problemas, copie exatamente os erros do console e do debug panel.**