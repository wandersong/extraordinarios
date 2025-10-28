"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, LogOut, Loader2 } from "lucide-react"
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import Image from 'next/image'

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

interface ChatPageProps {
  userId: string
  userData: {
    id: string
    name: string
    email: string
    role: 'admin' | 'normal'
  }
}

export function ChatPage({ userId, userData }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { signOut } = useAuth()

  // Loading state enquanto userData não está disponível
  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
          <span className="text-white">Carregando...</span>
        </div>
      </div>
    )
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Carregar mensagem de boas-vindas
  useEffect(() => {
    const loadWelcomeMessage = () => {
      const userName = userData?.name || 'Usuário'
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `🎯 Olá ${userName}! Bem-vindo à **Mentoria Extraordinários**!

Sou seu assistente de IA especializado em transformar pessoas extraordinárias em versões ainda mais extraordinárias. Estou aqui para ajudá-lo a sair do ponto A e chegar ao seu ponto B.

Como posso ajudá-lo hoje em sua jornada extraordinária? 🚀`,
        timestamp: new Date()
      }
      setMessages([welcomeMessage])
      setLoadingMessages(false)
    }

    loadWelcomeMessage()
  }, [userData?.name])

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('Logout realizado com sucesso')
    } catch (error) {
      console.error('Erro no logout:', error)
      toast.error('Erro ao fazer logout')
    }
  }

  const sendToWebhook = async (message: string) => {
    try {
      setIsLoading(true)

      // Send to webhook (n8n)
      const response = await fetch("/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          message,
          userData: {
            name: userData?.name || 'Usuário',
            email: userData?.email || '',
            role: userData?.role || 'normal'
          }
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Add AI response to messages
        if (data.output) {
          const aiMessage: Message = {
            id: Date.now().toString() + "-ai",
            role: "assistant",
            content: data.output,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiMessage])
        }
      } else {
        throw new Error(`Erro na resposta do webhook: ${response.status}`)
      }
    } catch (error) {
      console.error("Erro ao processar mensagem:", error)
      toast.error('Erro ao processar mensagem')

      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString() + "-error",
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    await sendToWebhook(input)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900/50 backdrop-blur-xl border-b border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10">
              <Image
                src="/logo.png"
                alt="Mentoria Extraordinários"
                width={40}
                height={40}
                className="rounded-full object-cover border-2 border-[#D4AF37]"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Mentoria Extraordinários</h1>
              <p className="text-sm text-zinc-400">Chat Multi-Agente IA - {userData?.name || 'Usuário'}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && !loadingMessages && (
            <div className="text-center py-12">
              <div className="relative w-24 h-24 mx-auto mb-6 opacity-50">
                <Image
                  src="/logo.png"
                  alt="Mentoria Extraordinários"
                  width={96}
                  height={96}
                  className="rounded-full object-cover border-4 border-[#D4AF37]/30"
                />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">Olá {userData?.name || 'Usuário'}! 🎯</h2>
              <p className="text-zinc-400">Seja bem-vindo à Mentoria Extraordinários!</p>
              <p className="text-zinc-400 mt-1">Envie uma mensagem para começar sua jornada extraordinária 🚀</p>
            </div>
          )}

          {loadingMessages && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37] mx-auto mb-4" />
              <p className="text-zinc-400">Carregando histórico de mensagens...</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-zinc-900"
                    : "bg-zinc-800/50 text-white border border-zinc-700"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-2 ${message.role === "user" ? "text-zinc-700" : "text-zinc-500"}`}>
                  {message.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                  <p className="text-sm text-zinc-400">Processando sua mensagem...</p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border-t border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={isLoading}
                className="min-h-[52px] max-h-32 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] resize-none"
              />
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="h-[52px] w-[52px] bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] hover:from-[#C19B2B] hover:to-[#D4AF37] text-zinc-900 transition-all duration-200"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
