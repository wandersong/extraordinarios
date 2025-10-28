import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  synced?: boolean // Indica se foi sincronizado com o Supabase
}

export function useMessages(userId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const STORAGE_KEY = `chat_messages_${userId}`

  // Carregar mensagens do localStorage
  const loadLocalMessages = (): Message[] => {
    try {
      console.log('📂 Tentando carregar mensagens do localStorage:', STORAGE_KEY)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('📂 Encontrou', parsed.length, 'mensagens no cache local')
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      } else {
        console.log('📂 Nenhuma mensagem encontrada no cache local')
      }
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens locais:', error)
    }
    return []
  }

  // Salvar mensagens no localStorage
  const saveLocalMessages = (msgs: Message[]) => {
    try {
      console.log('💾 Salvando', msgs.length, 'mensagens no localStorage')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
      console.log('💾 Salvo com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao salvar mensagens locais:', error)
    }
  }

  // Sincronizar mensagens com o Supabase
  const syncWithSupabase = async (msgs: Message[]) => {
    if (!userId || msgs.length === 0) {
      console.log('🔴 Sync cancelado: userId=', userId, 'msgs.length=', msgs.length)
      return false
    }

    setIsSyncing(true)
    try {
      console.log('🔄 Iniciando sync de', msgs.length, 'mensagens para userId:', userId)
      
      // Preparar mensagens para o banco (formato esperado pelo Supabase)
      const dbMessages = msgs.map(msg => ({
        id: msg.id,
        content: msg.content,
        type: msg.role,
        timestamp: msg.timestamp.toISOString(),
        metadata: {
          synced: true,
          syncedAt: new Date().toISOString()
        }
      }))

      console.log('📋 Dados preparados para Supabase:', { user_id: userId, messages: dbMessages.length })

      // Tentar salvar no Supabase usando upsert com onConflict
      const { data, error } = await supabase
        .from('user_messages')
        .upsert({
          user_id: userId,
          messages: dbMessages,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()

      if (error) {
        console.error('❌ Erro ao sincronizar com Supabase:', error)
        console.error('❌ Detalhes do erro:', error.message, error.code, error.details)
        return false
      } else {
        console.log('✅ Mensagens sincronizadas com sucesso!')
        console.log('✅ Dados retornados:', data)
        
        // Marcar mensagens como sincronizadas
        const syncedMessages = msgs.map(msg => ({ ...msg, synced: true }))
        setMessages(syncedMessages)
        saveLocalMessages(syncedMessages)
        return true
      }
    } catch (error) {
      console.error('💥 Erro na sincronização (catch):', error)
      return false
    } finally {
      setIsSyncing(false)
    }
  }

  // Carregar mensagens iniciais (localStorage primeiro, depois Supabase)
  const loadMessages = async () => {
    console.log('Iniciando carregamento de mensagens para usuário:', userId)
    setIsLoading(true)
    
    try {
      // 1. Carregar mensagens locais primeiro (sempre funciona)
      const localMessages = loadLocalMessages()
      console.log('Mensagens locais carregadas:', localMessages.length)
      
      if (localMessages.length > 0) {
        setMessages(localMessages)
        setIsLoading(false) // Parar loading imediatamente se tem mensagens locais
        
        // Tentar sincronizar com Supabase em background
        setTimeout(() => {
          syncFromSupabase(localMessages)
        }, 500)
        return
      }

      // 2. Se não tem mensagens locais, tentar carregar do Supabase
      console.log('Tentando carregar do Supabase...')
      await syncFromSupabase([])

    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  // Função separada para sincronizar com Supabase
  const syncFromSupabase = async (currentMessages: Message[]) => {
    try {
      const { data: supabaseData, error } = await supabase
        .from('user_messages')
        .select('messages')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.log('Erro ao buscar no Supabase (normal se não existir):', error.code)
        return
      }

      if (supabaseData && supabaseData.messages) {
        const dbMessages = supabaseData.messages as any[]
        console.log('Mensagens do Supabase:', dbMessages.length)
        
        const formattedMessages: Message[] = dbMessages.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          role: (msg.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          synced: true
        })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

        // Usar mensagens do Supabase se forem mais recentes ou em maior quantidade
        if (formattedMessages.length > currentMessages.length) {
          console.log('Usando mensagens do Supabase (mais recentes)')
          setMessages(formattedMessages)
          saveLocalMessages(formattedMessages)
        }
      }
    } catch (error) {
      console.log('Erro na sincronização com Supabase:', error)
    }
  }

  // Adicionar nova mensagem
  const addMessage = async (message: Omit<Message, 'id' | 'timestamp' | 'synced'>) => {
    console.log('🔵 addMessage chamado:', message)
    
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      synced: false,
      ...message
    }

    // 1. Adicionar ao estado imediatamente
    const updatedMessages = [...messages, newMessage]
    console.log('🔵 Atualizando state com', updatedMessages.length, 'mensagens')
    setMessages(updatedMessages)

    // 2. Salvar no localStorage imediatamente
    console.log('🔵 Salvando no localStorage...')
    saveLocalMessages(updatedMessages)

    // 3. Sincronizar com Supabase em background
    setTimeout(() => {
      console.log('🔵 Iniciando sync com Supabase...')
      syncWithSupabase(updatedMessages)
    }, 100) // Pequeno delay para não bloquear a UI

    return newMessage
  }

  // Adicionar múltiplas mensagens (usuário + IA)
  const addConversation = async (userMessage: string, aiResponse: string) => {
    const messagesToAdd: Message[] = []

    // Só adicionar mensagem do usuário se não estiver vazia
    if (userMessage.trim()) {
      messagesToAdd.push({
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        synced: false
      })
    }

    // Só adicionar resposta da IA se não estiver vazia
    if (aiResponse.trim()) {
      messagesToAdd.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant', 
        content: aiResponse,
        timestamp: new Date(Date.now() + 1),
        synced: false
      })
    }

    if (messagesToAdd.length > 0) {
      // 1. Adicionar ao estado imediatamente
      const updatedMessages = [...messages, ...messagesToAdd]
      setMessages(updatedMessages)

      // 2. Salvar no localStorage imediatamente
      saveLocalMessages(updatedMessages)

      // 3. Sincronizar com Supabase em background
      setTimeout(() => {
        syncWithSupabase(updatedMessages)
      }, 100)

      return messagesToAdd
    }

    return []
  }

  // Carregar mensagens na inicialização
  useEffect(() => {
    console.log('useMessages - useEffect disparado, userId:', userId)
    
    if (userId) {
      loadMessages()
    } else {
      console.log('Sem userId, parando loading')
      setIsLoading(false)
    }
  }, [userId])

  return {
    messages,
    isLoading,
    isSyncing,
    addMessage,
    addConversation,
    syncWithSupabase: () => syncWithSupabase(messages),
    refreshFromSupabase: loadMessages
  }
}