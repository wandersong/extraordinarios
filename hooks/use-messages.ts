'use client'

import { useState, useEffect } from 'react'
import { getUserMessages, addMessageToUser, User } from '@/lib/supabase'
import { toast } from 'sonner'

export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  metadata?: any
}

export const useMessages = (userId: string, userData: User) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  // Carregar mensagens iniciais
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const userMessages = await getUserMessages(userId)
        
        if (userMessages && userMessages.messages) {
          const formattedMessages: Message[] = userMessages.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.type as "user" | "assistant" | "system",
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            metadata: msg.metadata
          }))
          
          setMessages(formattedMessages)
        } else {
          // Primeira vez - adicionar mensagem de boas-vindas
          const welcomeMessage: Message = {
            id: 'welcome',
            role: 'assistant',
            content: `Olá ${userData.name}! Bem-vindo à Mentoria Extraordinários. Como posso ajudá-lo hoje?`,
            timestamp: new Date()
          }
          setMessages([welcomeMessage])
          
          // Salvar mensagem de boas-vindas no Supabase
          await addMessageToUser(userId, welcomeMessage.content, 'assistant', {
            welcome_message: true
          })
        }
      } catch (error) {
        console.error('Erro ao carregar mensagens:', error)
        toast.error('Erro ao carregar histórico de mensagens')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      loadMessages()
    }
  }, [userId, userData.name])

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message])
  }

  const saveMessage = async (
    content: string, 
    type: "user" | "assistant" | "system" = "user", 
    metadata: any = {}
  ) => {
    try {
      const success = await addMessageToUser(userId, content, type, metadata)
      if (!success) {
        throw new Error('Falha ao salvar mensagem')
      }
      return true
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error)
      toast.error('Erro ao salvar mensagem')
      return false
    }
  }

  const clearMessages = () => {
    setMessages([])
  }

  return {
    messages,
    loading,
    addMessage,
    saveMessage,
    clearMessages
  }
}