import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Tipos para o banco de dados
export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'normal'
  avatar_url?: string
  is_active: boolean
  metadata: any
  created_at: string
  updated_at: string
}

export interface UserMessage {
  id: string
  user_id: string
  messages: Array<{
    id: string
    content: string
    type: 'user' | 'assistant' | 'system'
    timestamp: string
    metadata?: any
  }>
  last_message_at: string
  created_at: string
  updated_at: string
}

// Função para adicionar mensagem via SQL function
export const addMessageToUser = async (
  userId: string,
  content: string,
  type: 'user' | 'assistant' | 'system' = 'user',
  metadata: any = {}
) => {
  const { data, error } = await supabase.rpc('add_message_to_user', {
    p_user_id: userId,
    p_message_content: content,
    p_message_type: type,
    p_metadata: metadata
  })

  if (error) {
    console.error('Erro ao adicionar mensagem:', error)
    return false
  }

  return data
}

// Função para buscar mensagens do usuário
export const getUserMessages = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_messages')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Erro ao buscar mensagens:', error)
    return null
  }

  return data
}

// Função para buscar dados do usuário
export const getUserData = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Erro ao buscar usuário:', error)
    return null
  }

  return data
}

// Função para criar usuário no banco após signup
export const createUserInDatabase = async (
  id: string,
  email: string,
  name: string,
  role: 'admin' | 'normal' = 'normal'
) => {
  const { data, error } = await supabase
    .from('users')
    .insert({
      id,
      email,
      name,
      role,
      is_active: true,
      metadata: {}
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar usuário no banco:', error)
    return null
  }

  return data
}