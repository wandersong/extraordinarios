-- =====================================================
-- Schema SQL para Supabase - App de Chat
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA USERS
-- =====================================================

-- Enum para tipos de usuário (verificar se já existe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'normal');
    END IF;
END $$;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'normal',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA MESSAGES (JSONB com uma linha por usuário)
-- =====================================================

-- Tabela de mensagens - uma linha por usuário com todas as mensagens em JSONB
CREATE TABLE IF NOT EXISTS user_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    messages JSONB DEFAULT '[]'::jsonb,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir que cada usuário tenha apenas uma linha
    UNIQUE(user_id)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para a tabela users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Índices para a tabela user_messages
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_last_message ON user_messages(last_message_at);
CREATE INDEX IF NOT EXISTS idx_user_messages_updated ON user_messages(updated_at);

-- Índice GIN para busca eficiente no JSONB
CREATE INDEX IF NOT EXISTS idx_user_messages_jsonb ON user_messages USING GIN (messages);

-- =====================================================
-- TRIGGERS PARA AUTO-UPDATE DOS TIMESTAMPS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at 
            BEFORE UPDATE ON users 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Trigger para user_messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_messages_updated_at') THEN
        CREATE TRIGGER update_user_messages_updated_at 
            BEFORE UPDATE ON user_messages 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- FUNÇÕES AUXILIARES PARA MANIPULAR MENSAGENS
-- =====================================================

-- Função para adicionar nova mensagem ao JSONB
CREATE OR REPLACE FUNCTION add_message_to_user(
    p_user_id UUID,
    p_message_content TEXT,
    p_message_type VARCHAR(50) DEFAULT 'user',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    new_message JSONB;
BEGIN
    -- Criar o objeto da nova mensagem
    new_message := jsonb_build_object(
        'id', uuid_generate_v4(),
        'content', p_message_content,
        'type', p_message_type,
        'timestamp', NOW(),
        'metadata', p_metadata
    );
    
    -- Inserir ou atualizar a linha do usuário
    INSERT INTO user_messages (user_id, messages, last_message_at)
    VALUES (
        p_user_id,
        jsonb_build_array(new_message),
        NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        messages = user_messages.messages || new_message,
        last_message_at = NOW(),
        updated_at = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar mensagens antigas (manter apenas as últimas N)
CREATE OR REPLACE FUNCTION trim_user_messages(
    p_user_id UUID,
    p_max_messages INTEGER DEFAULT 1000
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_messages 
    SET messages = (
        SELECT jsonb_agg(msg ORDER BY (msg->>'timestamp')::timestamp DESC)
        FROM (
            SELECT jsonb_array_elements(messages) as msg
            FROM user_messages 
            WHERE user_id = p_user_id
            ORDER BY (jsonb_array_elements(messages)->>'timestamp')::timestamp DESC
            LIMIT p_max_messages
        ) as recent_messages
    )
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS PARA A TABELA USERS
-- =====================================================

-- Permitir SELECT para usuários autenticados (próprios dados + dados públicos)
DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy" ON users
    FOR SELECT 
    USING (
        auth.uid() IS NOT NULL AND (
            -- Pode ver seus próprios dados
            auth.uid() = id 
            OR 
            -- Admin pode ver todos
            EXISTS (
                SELECT 1 FROM users admin_user 
                WHERE admin_user.id = auth.uid() 
                AND admin_user.role = 'admin'
            )
            OR
            -- Dados básicos são visíveis para usuários autenticados (para chat)
            is_active = true
        )
    );

-- Permitir INSERT apenas para novos usuários (durante signup)
DROP POLICY IF EXISTS "users_insert_policy" ON users;
CREATE POLICY "users_insert_policy" ON users
    FOR INSERT 
    WITH CHECK (
        auth.uid() = id OR
        -- Admins podem criar novos usuários
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.role = 'admin'
        )
    );

-- Permitir UPDATE apenas para próprios dados ou admin
DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE 
    USING (
        auth.uid() = id OR
        -- Admin pode atualizar qualquer usuário
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.role = 'admin'
        )
    );

-- Permitir DELETE apenas para admin
DROP POLICY IF EXISTS "users_delete_policy" ON users;
CREATE POLICY "users_delete_policy" ON users
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.role = 'admin'
        )
    );

-- =====================================================
-- POLÍTICAS PARA A TABELA USER_MESSAGES
-- =====================================================

-- Permitir SELECT das próprias mensagens ou admin vê tudo
DROP POLICY IF EXISTS "messages_select_policy" ON user_messages;
CREATE POLICY "messages_select_policy" ON user_messages
    FOR SELECT 
    USING (
        auth.uid() IS NOT NULL AND (
            -- Usuário pode ver suas próprias mensagens
            user_id = auth.uid() 
            OR 
            -- Admin pode ver todas as mensagens
            EXISTS (
                SELECT 1 FROM users admin_user 
                WHERE admin_user.id = auth.uid() 
                AND admin_user.role = 'admin'
            )
        )
    );

-- Permitir INSERT apenas para próprias mensagens ou admin
DROP POLICY IF EXISTS "messages_insert_policy" ON user_messages;
CREATE POLICY "messages_insert_policy" ON user_messages
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() 
            OR 
            EXISTS (
                SELECT 1 FROM users admin_user 
                WHERE admin_user.id = auth.uid() 
                AND admin_user.role = 'admin'
            )
        )
    );

-- Permitir UPDATE apenas para próprias mensagens ou admin
DROP POLICY IF EXISTS "messages_update_policy" ON user_messages;
CREATE POLICY "messages_update_policy" ON user_messages
    FOR UPDATE 
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() 
            OR 
            EXISTS (
                SELECT 1 FROM users admin_user 
                WHERE admin_user.id = auth.uid() 
                AND admin_user.role = 'admin'
            )
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() 
            OR 
            EXISTS (
                SELECT 1 FROM users admin_user 
                WHERE admin_user.id = auth.uid() 
                AND admin_user.role = 'admin'
            )
        )
    );

-- Permitir DELETE apenas para admin (usuários não podem deletar mensagens)
DROP POLICY IF EXISTS "messages_delete_policy" ON user_messages;
CREATE POLICY "messages_delete_policy" ON user_messages
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.id = auth.uid() 
            AND admin_user.role = 'admin'
        )
    );

-- =====================================================
-- FUNÇÕES AUXILIARES PARA RLS
-- =====================================================

-- Função para verificar se usuário é admin (otimizada para cache)
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_uuid 
        AND role = 'admin'
        AND is_active = true
    );
$$;

-- Função para verificar se usuário pode acessar dados de outro usuário
CREATE OR REPLACE FUNCTION can_access_user_data(target_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
AS $$
    SELECT 
        auth.uid() IS NOT NULL 
        AND (
            auth.uid() = target_user_id 
            OR is_admin(auth.uid())
        );
$$;

-- =====================================================
-- DADOS INICIAIS (OPCIONAL)
-- =====================================================

-- Inserir um usuário admin inicial (substitua pelos dados reais)
INSERT INTO users (email, name, role) 
VALUES ('admin@exemplo.com', 'Administrador', 'admin')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para listar usuários com contagem de mensagens
DROP VIEW IF EXISTS users_with_message_count;
CREATE VIEW users_with_message_count AS
SELECT 
    u.*,
    COALESCE(jsonb_array_length(um.messages), 0) as message_count,
    um.last_message_at
FROM users u
LEFT JOIN user_messages um ON u.id = um.user_id;

-- View para estatísticas de mensagens
DROP VIEW IF EXISTS message_statistics;
CREATE VIEW message_statistics AS
SELECT 
    COUNT(DISTINCT user_id) as total_users_with_messages,
    SUM(jsonb_array_length(messages)) as total_messages,
    AVG(jsonb_array_length(messages)) as avg_messages_per_user,
    MAX(last_message_at) as last_activity
FROM user_messages;

-- =====================================================
-- COMENTÁRIOS EXPLICATIVOS
-- =====================================================

COMMENT ON TABLE users IS 'Tabela de usuários do sistema de chat';
COMMENT ON COLUMN users.role IS 'Tipo de usuário: admin ou normal';
COMMENT ON COLUMN users.metadata IS 'Dados adicionais em formato JSON';

COMMENT ON TABLE user_messages IS 'Mensagens de chat armazenadas em JSONB - uma linha por usuário';
COMMENT ON COLUMN user_messages.messages IS 'Array JSON com todas as mensagens do usuário';
COMMENT ON COLUMN user_messages.last_message_at IS 'Timestamp da última mensagem para ordenação rápida';

COMMENT ON FUNCTION add_message_to_user IS 'Adiciona uma nova mensagem ao array JSONB do usuário';
COMMENT ON FUNCTION trim_user_messages IS 'Remove mensagens antigas, mantendo apenas as mais recentes';