import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://webhook.digabot.com.br/webhook/cfdf2bf1-e1cf-4fa3-adda-7e663aad2961'

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  let message = ''
  let userData = null
  let userId = ''
  
  try {
    const body = await request.json()
    const { userId: bodyUserId, message: bodyMessage, userData: bodyUserData } = body
    
    userId = bodyUserId
    
    message = bodyMessage
    userData = bodyUserData

    // Validar dados obrigatórios
    if (!userId || !message) {
      return NextResponse.json(
        { error: 'userId e message são obrigatórios' },
        { status: 400 }
      )
    }

    console.log('Webhook Mentoria Extraordinários recebido:', {
      userId,
      message: message.substring(0, 100) + '...',
      userEmail: userData?.email,
      userRole: userData?.role
    })

    // Enviar para o webhook real do n8n
    const response = await callN8nWebhook(message, userData, userId)
    
    // Gravar a conversa no banco de dados
    const aiResponse = response.output || response.message || 'Resposta recebida do n8n'
    await saveConversation(userId, message, aiResponse, userData)

    return NextResponse.json({
      success: true,
      output: aiResponse,
      processingTime: response.processingTime || Date.now()
    })

  } catch (error) {
    console.error('Erro no webhook:', error)
    
    // Em caso de erro, usar resposta de fallback
    const fallbackResponse = await getFallbackResponse(message, userData)
    
    // Salvar a conversa mesmo com fallback
    await saveConversation(userId, message, fallbackResponse, userData)
    
    return NextResponse.json({
      success: true,
      output: fallbackResponse,
      processingTime: Date.now(),
      fallback: true
    })
  }
}

// Função para chamar o webhook do n8n
async function callN8nWebhook(message: string, userData: any, userId: string) {
  console.log('Enviando para n8n webhook:', N8N_WEBHOOK_URL)
  
  const payload = {
    message: message,
    user: {
      id: userId,
      name: userData?.name || 'Usuário',
      email: userData?.email || '',
      role: userData?.role || 'normal'
    },
    timestamp: new Date().toISOString(),
    source: 'mentoria-extraordinarios-frontend'
  }

  console.log('Payload enviado:', JSON.stringify(payload, null, 2))

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    // Timeout de 30 segundos
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    console.error('Erro na resposta do n8n:', response.status, response.statusText)
    throw new Error(`N8N webhook error: ${response.status} ${response.statusText}`)
  }

  const responseData = await response.json()
  console.log('Resposta do n8n:', responseData)
  
  return responseData
}

// Resposta de fallback em caso de erro
async function getFallbackResponse(message: string, userData: any) {
  const userName = userData?.name || 'Extraordinário'
  
  const fallbackResponses = [
    `Obrigado pela sua mensagem, ${userName}! Estou temporariamente indisponível, mas retornarei em breve para continuar nossa conversa sobre "${message.substring(0, 30)}...".`,
    `${userName}, recebi sua mensagem sobre "${message.substring(0, 40)}...". Momentaneamente estou processando outras solicitações, mas logo estarei de volta para ajudá-lo!`,
    `Olá ${userName}! Sua mensagem foi recebida com sucesso. Estou passando por uma atualização rápida, mas em instantes estarei pronto para nossa mentoria extraordinária!`
  ]
  
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
}

// Função para salvar a conversa no banco de dados
async function saveConversation(userId: string, userMessage: string, aiResponse: string, userData: any) {
  try {
    console.log('Salvando conversa no banco:', { userId, userMessage: userMessage.substring(0, 50) + '...', aiResponse: aiResponse.substring(0, 50) + '...' })
    
    // Primeiro, garantir que o usuário existe na tabela users
    await ensureUserExists(userId, userData)
    
    // Criar as mensagens para salvar
    const userMsg = {
      id: Date.now().toString(),
      content: userMessage,
      type: 'user',
      timestamp: new Date().toISOString(),
      metadata: {
        userEmail: userData?.email,
        userRole: userData?.role,
        userName: userData?.name
      }
    }
    
    const aiMsg = {
      id: (Date.now() + 1).toString(),
      content: aiResponse,
      type: 'assistant',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'n8n-webhook',
        processed: true
      }
    }

    // Usar a função SQL para adicionar as mensagens
    const { error: userError } = await supabase.rpc('add_message_to_user', {
      p_user_id: userId,
      p_message_content: userMessage,
      p_message_type: 'user',
      p_metadata: userMsg.metadata
    })

    if (userError) {
      console.error('Erro ao salvar mensagem do usuário:', userError)
    }

    const { error: aiError } = await supabase.rpc('add_message_to_user', {
      p_user_id: userId,
      p_message_content: aiResponse,
      p_message_type: 'assistant',
      p_metadata: aiMsg.metadata
    })

    if (aiError) {
      console.error('Erro ao salvar resposta da IA:', aiError)
    }

    console.log('Conversa salva com sucesso no banco')
    
  } catch (error) {
    console.error('Erro ao salvar conversa:', error)
  }
}

// Função para garantir que o usuário existe no banco
async function ensureUserExists(userId: string, userData: any) {
  try {
    // Verificar se o usuário já existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Erro ao verificar usuário:', checkError)
      return
    }

    // Se o usuário não existe, criar
    if (!existingUser) {
      console.log('Criando usuário no banco:', { userId, email: userData?.email })
      
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: userData?.email || 'user@example.com',
            name: userData?.name || 'Usuário',
            role: userData?.role || 'normal',
            is_active: true,
            metadata: {
              createdFromChat: true,
              firstMessage: new Date().toISOString()
            }
          }
        ])

      if (insertError) {
        console.error('Erro ao criar usuário:', insertError)
      } else {
        console.log('Usuário criado com sucesso')
      }
    }
  } catch (error) {
    console.error('Erro ao garantir usuário:', error)
  }
}
