"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

export function TestSupabaseConnection() {
  const [status, setStatus] = useState<string>('Testando...')
  const [details, setDetails] = useState<any>(null)
  const { user } = useAuth()

  useEffect(() => {
    testConnection()
  }, [user])

  const testConnection = async () => {
    try {
      setStatus('🔄 Testando conexão com Supabase...')
      
      // 1. Testar conexão básica
      const { data: authData, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        setStatus('❌ Erro de autenticação: ' + authError.message)
        return
      }

      if (!authData.user) {
        setStatus('❌ Usuário não autenticado')
        return
      }

      setStatus('✅ Usuário autenticado: ' + authData.user.email)

      // 2. Testar tabela user_messages
      const { data: tableData, error: tableError } = await supabase
        .from('user_messages')
        .select('*')
        .eq('user_id', authData.user.id)

      if (tableError) {
        setStatus('❌ Erro ao acessar tabela user_messages: ' + tableError.message)
        setDetails(tableError)
        return
      }

      setStatus('✅ Tabela user_messages acessível')
      setDetails({
        userId: authData.user.id,
        email: authData.user.email,
        existingMessages: tableData?.length || 0,
        tableData: tableData
      })

      // 3. Testar inserção simples
      const testMessage = {
        user_id: authData.user.id,
        messages: [
          {
            id: 'test-' + Date.now(),
            content: 'Teste de conexão',
            type: 'system',
            timestamp: new Date().toISOString()
          }
        ],
        last_message_at: new Date().toISOString()
      }

      const { data: insertData, error: insertError } = await supabase
        .from('user_messages')
        .upsert(testMessage, { onConflict: 'user_id' })
        .select()

      if (insertError) {
        setStatus('❌ Erro ao testar inserção: ' + insertError.message)
        setDetails({ ...details, insertError })
      } else {
        setStatus('✅ Inserção funcionando!')
        setDetails({ ...details, insertSuccess: true, insertData })
      }

    } catch (error: any) {
      setStatus('💥 Erro geral: ' + error.message)
      setDetails(error)
    }
  }

  if (!user) {
    return <div className="p-4 text-yellow-600">⚠️ Faça login para testar a conexão</div>
  }

  return (
    <div className="p-6 bg-zinc-800 rounded-lg space-y-4">
      <h3 className="text-lg font-semibold text-white">🧪 Teste de Conexão Supabase</h3>
      
      <div className="text-sm text-gray-300">
        <strong>Status:</strong> {status}
      </div>

      {details && (
        <div className="mt-4 p-4 bg-zinc-900 rounded text-xs text-gray-400">
          <strong>Detalhes:</strong>
          <pre className="mt-2 overflow-auto max-h-40">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
      )}

      <button 
        onClick={testConnection}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        🔄 Testar Novamente
      </button>
    </div>
  )
}