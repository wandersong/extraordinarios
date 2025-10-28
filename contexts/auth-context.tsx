'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface UserData {
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

interface AuthContextType {
  user: SupabaseUser | null
  userData: UserData | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  // Função para buscar dados do usuário na tabela users
  const fetchUserData = async (userId: string, email: string, name: string) => {
    try {
      // Tentar buscar usuário na tabela users
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (existingUser && !error) {
        // Usuário encontrado na tabela
        setUserData(existingUser)
      } else {
        // Usuário não encontrado, criar dados com informações do auth
        const newUserData: UserData = {
          id: userId,
          email: email,
          name: name,
          role: 'normal',
          avatar_url: undefined,
          is_active: true,
          metadata: { createdFromAuth: true },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setUserData(newUserData)

        // Opcionalmente, tentar inserir na tabela users (se as políticas permitirem)
        const { error: insertError } = await supabase
          .from('users')
          .insert([newUserData])

        if (insertError) {
          console.warn('Não foi possível inserir usuário na tabela:', insertError)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error)
      // Fallback para dados mock em caso de erro
      const fallbackUserData: UserData = {
        id: userId,
        email: email,
        name: name,
        role: 'normal',
        avatar_url: undefined,
        is_active: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setUserData(fallbackUserData)
    }
  }

  useEffect(() => {
    // Verificar sessão inicial
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        // Buscar dados reais do usuário da tabela
        await fetchUserData(session.user.id, session.user.email || '', session.user.user_metadata?.name || 'Usuário')
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (session?.user) {
          setUser(session.user)
          // Buscar dados reais do usuário da tabela
          await fetchUserData(session.user.id, session.user.email || '', session.user.user_metadata?.name || 'Usuário')
        } else {
          setUser(null)
          setUserData(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setLoading(false)
      return { error }
    }

    return { error: null }
  }

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true)
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name
        }
      }
    })

    if (error) {
      setLoading(false)
      return { error }
    }

    return { error: null }
  }

  const signOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setUserData(null)
    setLoading(false)
  }

  const isAdmin = userData?.role === 'admin'

  const value = {
    user,
    userData,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}