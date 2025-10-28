"use client"

import { useState, useEffect } from "react"
import { ChatPage } from "@/components/chat-page"
import { useRouter } from "next/navigation"

export default function Chat() {
  const [userId, setUserId] = useState<string>("")
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const storedUserId = localStorage.getItem("userId")
    if (!storedUserId) {
      router.push("/")
      return
    }
    setUserId(storedUserId)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("userId")
    router.push("/")
  }

  if (!userId) {
    return null
  }

  return <ChatPage userId={userId} onLogout={handleLogout} />
}
