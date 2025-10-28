-- Correção para o erro de recursão infinita nas políticas RLS
-- Execute este SQL no Supabase SQL Editor

-- 1. Primeiro, vamos remover todas as políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;

-- 2. Remover políticas da tabela user_messages também (para recriar)
DROP POLICY IF EXISTS "Users can view their own messages" ON public.user_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.user_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.user_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.user_messages;

-- 3. Criar políticas corretas para a tabela users (sem recursão)
CREATE POLICY "Enable read access for users based on user_id" ON public.users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users only" ON public.users
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" ON public.users
FOR UPDATE USING (auth.uid() = id);

-- 4. Criar políticas corretas para user_messages (referenciando diretamente o UUID)
CREATE POLICY "Enable read access for own messages" ON public.user_messages
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for own messages" ON public.user_messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own messages" ON public.user_messages
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own messages" ON public.user_messages
FOR DELETE USING (auth.uid() = user_id);

-- 5. Verificar se RLS está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;