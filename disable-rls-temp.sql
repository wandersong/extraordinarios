-- SOLUÇÃO RÁPIDA: Desabilitar temporariamente RLS para testar
-- Execute este SQL se a correção de políticas não funcionar

-- Desabilitar RLS temporariamente para debug
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages DISABLE ROW LEVEL SECURITY;

-- Após testar que funciona, você pode reabilitar com políticas corretas
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;