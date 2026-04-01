import { supabase } from '@/lib/supabase'

// API para o Ponto Mobile - apenas funções necessárias
export const api = {
  // Buscar funcionário pelo token (mobile)
  async buscarFuncionarioPorToken(token: string): Promise<{
    id: string
    nome: string
    cargo: string | null
    ativo: boolean
  } | null> {
    const { data, error } = await supabase
      .rpc('buscar_funcionario_por_token', { p_token: token })

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      return null
    }

    return Array.isArray(data) ? data[0] : data
  },

  // Buscar ponto aberto do funcionário (mobile)
  async buscarPontoAberto(funcionarioId: string): Promise<{
    id: string
    data: string
    hora_entrada: string
    status: string
  } | null> {
    const { data, error } = await supabase
      .rpc('buscar_ponto_aberto', { p_funcionario_id: funcionarioId })

    if (error || !data || data.length === 0) {
      return null
    }
    return data[0]
  },

  // Bater ponto (entrada ou saída automática)
  async baterPonto(token: string): Promise<{
    sucesso: boolean
    tipo: 'entrada' | 'saida' | 'erro'
    mensagem: string
    registro_id: string | null
    hora: string | null
    total_horas: string | null
  }> {
    const { data, error } = await supabase
      .rpc('bater_ponto', { p_token: token })

    if (error) {
      return {
        sucesso: false,
        tipo: 'erro',
        mensagem: error.message || 'Erro ao bater ponto',
        registro_id: null,
        hora: null,
        total_horas: null,
      }
    }

    if (!data || data.length === 0) {
      return {
        sucesso: false,
        tipo: 'erro',
        mensagem: 'Resposta inválida do servidor',
        registro_id: null,
        hora: null,
        total_horas: null,
      }
    }

    return data[0]
  },
}
