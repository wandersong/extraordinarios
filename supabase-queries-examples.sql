-- =====================================================
-- EXEMPLOS DE USO - Queries úteis para o sistema
-- =====================================================

-- =====================================================
-- 1. INSERINDO USUÁRIOS
-- =====================================================

-- Inserir usuário normal
INSERT INTO users (email, name, role) 
VALUES ('usuario1@exemplo.com', 'João Silva', 'normal');

-- Inserir usuário admin
INSERT INTO users (email, name, role, metadata) 
VALUES (
    'admin2@exemplo.com', 
    'Maria Admin', 
    'admin',
    '{"permissions": ["read", "write", "delete"], "department": "TI"}'
);

-- =====================================================
-- 2. TRABALHANDO COM MENSAGENS
-- =====================================================

-- Adicionar mensagem usando a função personalizada
SELECT add_message_to_user(
    'USER_ID_AQUI'::uuid,
    'Olá, esta é minha primeira mensagem!',
    'user',
    '{"ip": "192.168.1.1", "device": "mobile"}'::jsonb
);

-- Adicionar resposta do sistema/bot
SELECT add_message_to_user(
    'USER_ID_AQUI'::uuid,
    'Olá! Como posso ajudá-lo hoje?',
    'assistant',
    '{"model": "gpt-4", "tokens": 25}'::jsonb
);

-- =====================================================
-- 3. CONSULTAS ÚTEIS
-- =====================================================

-- Listar todos os usuários com contagem de mensagens
SELECT * FROM users_with_message_count 
ORDER BY last_message_at DESC NULLS LAST;

-- Buscar usuários por role
SELECT * FROM users WHERE role = 'admin';

-- Buscar mensagens de um usuário específico
SELECT 
    u.name,
    u.email,
    um.messages,
    um.last_message_at
FROM users u
JOIN user_messages um ON u.id = um.user_id
WHERE u.email = 'usuario1@exemplo.com';

-- Contar total de mensagens por usuário
SELECT 
    u.name,
    u.email,
    jsonb_array_length(um.messages) as total_messages
FROM users u
LEFT JOIN user_messages um ON u.id = um.user_id
ORDER BY total_messages DESC NULLS LAST;

-- =====================================================
-- 4. BUSCA AVANÇADA EM MENSAGENS (JSONB)
-- =====================================================

-- Buscar mensagens por conteúdo específico
SELECT 
    u.name,
    u.email,
    msg->>'content' as message_content,
    msg->>'timestamp' as message_time
FROM users u
JOIN user_messages um ON u.id = um.user_id,
jsonb_array_elements(um.messages) as msg
WHERE msg->>'content' ILIKE '%palavra_chave%'
ORDER BY (msg->>'timestamp')::timestamp DESC;

-- Buscar apenas mensagens do tipo 'user'
SELECT 
    u.name,
    msg->>'content' as message,
    msg->>'timestamp' as sent_at
FROM users u
JOIN user_messages um ON u.id = um.user_id,
jsonb_array_elements(um.messages) as msg
WHERE msg->>'type' = 'user'
ORDER BY (msg->>'timestamp')::timestamp DESC;

-- Contar mensagens por tipo
SELECT 
    msg->>'type' as message_type,
    COUNT(*) as total
FROM user_messages um,
jsonb_array_elements(um.messages) as msg
GROUP BY msg->>'type'
ORDER BY total DESC;

-- =====================================================
-- 5. ESTATÍSTICAS E RELATÓRIOS
-- =====================================================

-- Estatísticas gerais do sistema
SELECT * FROM message_statistics;

-- Usuários mais ativos (por número de mensagens)
SELECT 
    u.name,
    u.email,
    jsonb_array_length(um.messages) as message_count,
    um.last_message_at
FROM users u
JOIN user_messages um ON u.id = um.user_id
ORDER BY jsonb_array_length(um.messages) DESC
LIMIT 10;

-- Atividade por dia (últimas mensagens)
SELECT 
    DATE(um.last_message_at) as activity_date,
    COUNT(*) as active_users
FROM user_messages um
WHERE um.last_message_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(um.last_message_at)
ORDER BY activity_date DESC;

-- =====================================================
-- 6. MANUTENÇÃO E LIMPEZA
-- =====================================================

-- Limitar mensagens de um usuário específico (manter apenas 100 mais recentes)
SELECT trim_user_messages('USER_ID_AQUI'::uuid, 100);

-- Limitar mensagens de todos os usuários
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM users LOOP
        PERFORM trim_user_messages(user_record.id, 500);
    END LOOP;
END $$;

-- =====================================================
-- 7. QUERIES PARA ADMINS
-- =====================================================

-- Listar todos os usuários (apenas para admins)
SELECT 
    id,
    email,
    name,
    role,
    is_active,
    created_at,
    (metadata->>'department') as department
FROM users 
ORDER BY created_at DESC;

-- Estatísticas detalhadas por usuário (apenas para admins)
SELECT 
    u.name,
    u.email,
    u.role,
    u.created_at,
    COALESCE(jsonb_array_length(um.messages), 0) as total_messages,
    um.last_message_at,
    CASE 
        WHEN um.last_message_at >= NOW() - INTERVAL '7 days' THEN 'Ativo'
        WHEN um.last_message_at >= NOW() - INTERVAL '30 days' THEN 'Pouco Ativo'
        ELSE 'Inativo'
    END as activity_status
FROM users u
LEFT JOIN user_messages um ON u.id = um.user_id
ORDER BY um.last_message_at DESC NULLS LAST;

-- =====================================================
-- 8. WEBHOOKS E INTEGRAÇÕES
-- =====================================================

-- Query para webhook do Supabase (detectar novos usuários)
-- Esta query pode ser usada em uma função trigger
CREATE OR REPLACE FUNCTION notify_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Aqui você pode enviar dados para webhook do n8n
    -- PERFORM pg_notify('new_user', row_to_json(NEW)::text);
    
    -- Ou usar uma extensão HTTP para chamar webhook diretamente
    -- (requer extensão http ou similar)
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para novos usuários
CREATE TRIGGER trigger_new_user
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_user();

-- =====================================================
-- 9. BACKUP E RESTAURAÇÃO
-- =====================================================

-- Exportar dados de usuários (para backup)
COPY (
    SELECT 
        email,
        name,
        role,
        metadata,
        created_at
    FROM users
) TO '/tmp/users_backup.csv' CSV HEADER;

-- Exportar mensagens (para backup)
COPY (
    SELECT 
        u.email,
        um.messages,
        um.last_message_at
    FROM users u
    JOIN user_messages um ON u.id = um.user_id
) TO '/tmp/messages_backup.csv' CSV HEADER;