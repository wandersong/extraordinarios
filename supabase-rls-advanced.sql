-- =====================================================
-- POLÍTICAS DE SEGURANÇA AVANÇADAS - SUPABASE RLS
-- =====================================================

-- =====================================================
-- VERSÃO ALTERNATIVA COM POLÍTICAS MAIS GRANULARES
-- =====================================================

/*
Se precisar de controle mais fino, use estas políticas alternativas:
*/

-- Primeiro, remover políticas existentes (se necessário)
/*
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;
DROP POLICY IF EXISTS "messages_select_policy" ON user_messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON user_messages;
DROP POLICY IF EXISTS "messages_update_policy" ON user_messages;
DROP POLICY IF EXISTS "messages_delete_policy" ON user_messages;
*/

-- =====================================================
-- POLÍTICAS GRANULARES PARA USERS
-- =====================================================

-- Usuários podem ver apenas dados básicos de outros (para lista de chat)
CREATE POLICY "users_public_data" ON users
    FOR SELECT 
    USING (
        auth.uid() IS NOT NULL 
        AND is_active = true 
        AND (
            auth.uid() = id OR  -- Seus próprios dados completos
            is_admin(auth.uid()) -- Admin vê tudo
        )
    );

-- Dados públicos limitados para usuários normais
CREATE POLICY "users_basic_info" ON users
    FOR SELECT 
    USING (
        auth.uid() IS NOT NULL 
        AND is_active = true 
        AND auth.uid() != id  -- Não é o próprio usuário
        AND NOT is_admin(auth.uid()) -- Não é admin
    );

-- Permitir criação de conta apenas durante signup
CREATE POLICY "users_signup" ON users
    FOR INSERT 
    WITH CHECK (
        auth.uid() = id AND
        role = 'normal' AND  -- Novos usuários sempre começam como normal
        is_active = true
    );

-- Admins podem criar usuários com qualquer role
CREATE POLICY "admin_create_users" ON users
    FOR INSERT 
    WITH CHECK (
        is_admin(auth.uid())
    );

-- Usuários podem atualizar apenas alguns campos próprios
CREATE POLICY "users_update_own_data" ON users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Usuários não podem mudar o próprio role
        (role = (SELECT role FROM users WHERE id = auth.uid()) OR is_admin(auth.uid()))
    );

-- =====================================================
-- POLÍTICAS PARA DIFERENTES CENÁRIOS DE CHAT
-- =====================================================

-- Mensagens privadas (apenas próprio usuário)
CREATE POLICY "private_messages" ON user_messages
    FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admin pode moderar mensagens
CREATE POLICY "admin_message_moderation" ON user_messages
    FOR ALL 
    USING (is_admin(auth.uid()));

-- =====================================================
-- FUNÇÕES AUXILIARES AVANÇADAS
-- =====================================================

-- Verificar se usuário pode ver perfil de outro
CREATE OR REPLACE FUNCTION can_view_profile(target_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
AS $$
    SELECT 
        auth.uid() IS NOT NULL AND
        EXISTS (SELECT 1 FROM users WHERE id = target_user_id AND is_active = true) AND
        (
            auth.uid() = target_user_id OR
            is_admin(auth.uid()) OR
            -- Adicione outras condições conforme necessário
            -- Por exemplo: usuários podem ver perfis de membros do mesmo grupo
            true  -- Por enquanto, todos podem ver perfis básicos
        );
$$;

-- Verificar se usuário pode enviar mensagem para outro
CREATE OR REPLACE FUNCTION can_message_user(target_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
AS $$
    SELECT 
        auth.uid() IS NOT NULL AND
        auth.uid() != target_user_id AND  -- Não pode enviar mensagem para si mesmo
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = target_user_id 
            AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_active = true
        );
$$;

-- Log de ações administrativas
CREATE OR REPLACE FUNCTION log_admin_action(
    action_type TEXT,
    target_table TEXT,
    target_id UUID,
    details JSONB DEFAULT '{}'
)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Apenas admins podem usar esta função
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores';
    END IF;
    
    -- Aqui você pode inserir em uma tabela de logs
    -- INSERT INTO admin_logs (admin_id, action_type, target_table, target_id, details)
    -- VALUES (auth.uid(), action_type, target_table, target_id, details);
    
    -- Por enquanto, apenas um raise notice para debug
    RAISE NOTICE 'Admin % executou % em %.% (ID: %)', 
        auth.uid(), action_type, target_table, target_id, target_id;
END;
$$;

-- =====================================================
-- TRIGGERS PARA AUDITORIA
-- =====================================================

-- Trigger para log de mudanças em usuários (apenas para admins)
CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log apenas mudanças feitas por admin em outros usuários
    IF is_admin(auth.uid()) AND auth.uid() != NEW.id THEN
        PERFORM log_admin_action(
            TG_OP,
            'users',
            NEW.id,
            jsonb_build_object(
                'old_role', COALESCE(OLD.role::text, null),
                'new_role', NEW.role::text,
                'old_active', COALESCE(OLD.is_active, null),
                'new_active', NEW.is_active
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER audit_user_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION audit_user_changes();

-- =====================================================
-- CONFIGURAÇÕES DE REALTIME (Para chat em tempo real)
-- =====================================================

-- Habilitar realtime para mensagens (apenas para o próprio usuário)
/*
-- Execute no Supabase Dashboard ou via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE user_messages;

-- Configurar filtro RLS para realtime
CREATE POLICY "realtime_messages" ON user_messages
    FOR SELECT 
    USING (
        auth.uid() = user_id OR
        is_admin(auth.uid())
    );
*/

-- =====================================================
-- EXEMPLOS DE USO DAS POLÍTICAS
-- =====================================================

-- Testar se usuário é admin
-- SELECT is_admin();

-- Testar se pode acessar dados de outro usuário
-- SELECT can_access_user_data('uuid-do-usuario-target');

-- Testar se pode ver perfil
-- SELECT can_view_profile('uuid-do-usuario-target');

-- Testar se pode enviar mensagem
-- SELECT can_message_user('uuid-do-usuario-target');

-- =====================================================
-- COMANDOS PARA GERENCIAR POLÍTICAS
-- =====================================================

-- Listar todas as políticas
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies 
-- WHERE schemaname = 'public';

-- Ver políticas de uma tabela específica
-- SELECT * FROM pg_policies WHERE tablename = 'users';
-- SELECT * FROM pg_policies WHERE tablename = 'user_messages';

-- Desabilitar RLS temporariamente (apenas para debug - CUIDADO!)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_messages DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;