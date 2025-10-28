# 🔴 ERRO RECURSÃO RLS - SOLUÇÃO IMEDIATA

## ❌ **Problema Identificado:**
```
Error: infinite recursion detected in policy for relation "users"
Code: 42P17
```

## ✅ **SOLUÇÃO RÁPIDA (Execute no Supabase SQL Editor):**

### Opção 1: Desabilitar RLS Temporariamente
```sql
-- EXECUTE PRIMEIRO (solução imediata)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages DISABLE ROW LEVEL SECURITY;
```

### Opção 2: Corrigir Políticas RLS
```sql
-- 1. Remover políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.user_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.user_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.user_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.user_messages;

-- 2. Criar políticas corretas (sem recursão)
CREATE POLICY "Enable read access for users based on user_id" ON public.users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users only" ON public.users
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" ON public.users
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable read access for own messages" ON public.user_messages
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for own messages" ON public.user_messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own messages" ON public.user_messages
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own messages" ON public.user_messages
FOR DELETE USING (auth.uid() = user_id);

-- 3. Reabilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;
```

## 🧪 **Após Executar a SQL:**

1. **Recarregue a página do chat**: http://localhost:3000/chat
2. **Verifique o debug panel** - deve mostrar ✅ status OK
3. **Teste enviar uma mensagem**
4. **Verifique se salva no localStorage e Supabase**

## 📋 **Status Esperado Após Correção:**
- ✅ "Usuário autenticado: seu@email.com"
- ✅ "Tabela user_messages acessível" 
- ✅ "Inserção funcionando!"

## ⚠️ **Se ainda houver problemas:**
Execute a **Opção 1** (desabilitar RLS) primeiro para confirmar que o resto funciona, depois implemente a **Opção 2** gradualmente.

---
**Servidor rodando em: http://localhost:3000**