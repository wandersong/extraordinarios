"use client"

import { useAuth } from '@/contexts/auth-context'
import { LoginPage } from "@/components/login-page"
import { ChatPage } from "@/components/chat-page"
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, userData, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37] mx-auto mb-4" />
          <p className="text-zinc-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user || !userData) {
    return <LoginPage />
  }

  return <ChatPage userId={user.id} userData={userData} />
}
