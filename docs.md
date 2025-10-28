# Documentação do Projeto - App de Chat

## Regras Gerais de Desenvolvimento

### 🎯 Princípio da Ultra Componentização
- **REGRA FUNDAMENTAL**: Tudo deve ser componentizado ao máximo
- Cada elemento da interface deve ser um componente reutilizável
- Separação clara de responsabilidades entre componentes
- Componentes devem ser modulares e independentes

### 🚫 Regras de Modificação
- **NUNCA altere o que não foi solicitado especificamente**
- **APENAS modifique exatamente o que for pedido**
- Mantenha a estrutura e funcionalidades existentes intactas
- Qualquer mudança deve ser explicitamente autorizada

### 📋 Escopo do Projeto

#### Funcionalidades Principais:
1. **Sistema de Login/Autenticação**
   - Interface de login componentizada
   - Gerenciamento de estado de autenticação
   - Proteção de rotas

2. **Área de Criação de Novos Membros**
   - Interface para cadastro de membros
   - Integração com webhook do Supabase
   - Formulários componentizados

3. **Sistema de Chat**
   - Interface de chat em tempo real
   - Lógica de chat gerenciada pelo n8n
   - Comunicação via webhooks

### 🔧 Arquitetura Técnica

#### Frontend (Next.js):
- **Framework**: Next.js com TypeScript
- **Styling**: Tailwind CSS
- **Componentes**: Shadcn/ui
- **Estado**: Context API / Zustand (conforme necessário)

#### Backend/Lógica:
- **Chat Logic**: n8n (automação via webhooks)
- **Database**: Supabase
- **Webhooks**: Integração Supabase → Frontend
- **API Routes**: Next.js API routes para webhooks

#### Integrações:
- **Supabase**: 
  - Autenticação
  - Database
  - Webhooks para criação de membros
- **n8n**:
  - Lógica completa do chat
  - Processamento de mensagens
  - Automações

### 📁 Estrutura de Componentes

```
components/
├── auth/           # Componentes de autenticação
├── chat/           # Componentes do sistema de chat
├── members/        # Componentes de gerenciamento de membros
├── layout/         # Componentes de layout
├── forms/          # Componentes de formulários
└── ui/            # Componentes base (shadcn/ui)
```

### 🔄 Fluxo de Dados

1. **Login**: Frontend → Supabase Auth → Estado da aplicação
2. **Criação de Membros**: Frontend → Supabase → Webhook → n8n
3. **Chat**: Frontend → n8n (via webhook) → Processamento → Resposta

### �️ Schema do Banco de Dados (Supabase)

#### Tabelas Principais:
1. **`users`**: Gerenciamento de usuários
   - `id` (UUID, PK)
   - `email` (VARCHAR, UNIQUE)
   - `name` (VARCHAR)
   - `role` (ENUM: 'admin', 'normal')
   - `avatar_url`, `is_active`, `metadata` (JSONB)
   - Timestamps automáticos

2. **`user_messages`**: Mensagens em JSONB (uma linha por usuário)
   - `id` (UUID, PK)
   - `user_id` (UUID, FK → users.id)
   - `messages` (JSONB Array) - todas as mensagens do usuário
   - `last_message_at` - timestamp da última mensagem
   - Constraint UNIQUE por user_id

#### Funcionalidades Especiais:
- **Row Level Security (RLS)** configurado
- **Funções customizadas** para manipular mensagens
- **Índices otimizados** para busca em JSONB
- **Triggers automáticos** para timestamps
- **Views** para estatísticas e relatórios

### �📋 Checklist de Desenvolvimento

- [x] Schema SQL criado (`supabase-schema.sql`)
- [x] Queries de exemplo criadas (`supabase-queries-examples.sql`)
- [ ] Setup do Supabase
- [ ] Configuração de webhooks
- [ ] Componentes de autenticação
- [ ] Interface de chat
- [ ] Sistema de membros
- [ ] Integração com n8n
- [ ] Testes de fluxo completo

### 🛠️ Dependências Necessárias

#### Principais:
- `@supabase/supabase-js` - Cliente Supabase
- `@supabase/auth-helpers-nextjs` - Helpers de autenticação
- `lucide-react` - Ícones
- `react-hook-form` - Gerenciamento de formulários
- `zod` - Validação de schemas
- `@hookform/resolvers` - Resolvers para react-hook-form
- `sonner` - Notificações toast
- `zustand` - Gerenciamento de estado (se necessário)

#### UI/Styling:
- `tailwindcss` - CSS framework
- `@tailwindcss/typography` - Tipografia
- `class-variance-authority` - Variantes de classes
- `clsx` - Utility para classes condicionais
- `tailwind-merge` - Merge de classes Tailwind

### 🔐 Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# n8n
N8N_WEBHOOK_URL=
N8N_API_KEY=

# Webhooks
WEBHOOK_SECRET=
```

### 📝 Notas Importantes

- Manter sempre a componentização como prioridade
- Documentar qualquer mudança significativa
- Testar integrações de webhook antes do deploy
- Validar todas as entradas de dados
- Implementar tratamento de erros robusto

---

**Última atualização**: 28 de outubro de 2025