import { supabase } from './supabase'
import {
  OrdemProducao,
  ProducaoDiaria,
  PecaDefeituosa,
  Financeiro,
  Orcamento,
  OrcamentoItem,
  DashboardStats,
  DashboardFinanceiro,
  ContaReceber,
  ContaReceberAvulsa,
  PrevisaoFaturamento,
  HistoricoFinanceiro,
  HistoricoCliente,
  Cliente,
  ClienteEstatisticas,
  Parcela,
  FuncionarioPonto,
} from '@/types'

export const api = {
  // =====================================================
  // ORDENS DE PRODUÇÃO
  // =====================================================

  async gerarCodigoOP(): Promise<string> {
    const { data, error } = await supabase.rpc('gerar_codigo_op')
    if (error) throw error
    return data
  },

  async getOrdemProducao(id: string): Promise<OrdemProducao> {
    const { data, error } = await supabase
      .from('ordens_producao')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async listOrdensProducao(filters?: {
    status?: string
    statusProducao?: string
    statusFinanceiro?: string
    search?: string
  }): Promise<OrdemProducao[]> {
    let query = supabase
      .from('ordens_producao')
      .select('*')
      .order('created_at', { ascending: false })

    // Filtro por status_producao (V3)
    if (filters?.statusProducao) {
      query = query.eq('status_producao', filters.statusProducao)
    }

    // Filtro por status_financeiro (V3)
    if (filters?.statusFinanceiro) {
      query = query.eq('status_financeiro', filters.statusFinanceiro)
    }

    // Filtro legado (mantido para compatibilidade)
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.search) {
      query = query.or(`codigo.ilike.%${filters.search}%,cliente.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async createOrdemProducao(op: Partial<OrdemProducao>): Promise<OrdemProducao> {
    // 1. Criar a OP com os novos campos de status (V3)
    const opData = {
      ...op,
      status_producao: op.status_producao || 'criada',
      status_financeiro: op.status_financeiro || 'pendente',
      status: op.status || 'criada', // Mantém legado para compatibilidade
    }

    const { data, error } = await supabase
      .from('ordens_producao')
      .insert([opData])
      .select()
      .single()

    if (error) throw error

    // 2. Criar automaticamente o registro financeiro vinculado
    const { error: finError } = await supabase
      .from('financeiro')
      .insert([{
        op_id: data.id,
        valor_total: op.preco_servico || 0,
        valor_pago: 0,
        forma_pagamento: '',
        status_pagamento: 'pendente',
        custos_extras: 0,
        prejuizo_defeitos: 0,
        numero_parcelas: 1,
        parcela_atual: 1,
      }])

    if (finError) {
      console.error('Erro ao criar financeiro automático:', finError)
      // Não lança erro para não impedir a criação da OP
    }

    return data
  },

  async updateOrdemProducao(id: string, updates: Partial<OrdemProducao>): Promise<OrdemProducao> {
    const { data, error } = await supabase
      .from('ordens_producao')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteOrdemProducao(id: string): Promise<void> {
    // 1. Deletar peças defeituosas associadas
    await supabase
      .from('pecas_defeituosas')
      .delete()
      .eq('op_id', id)

    // 2. Deletar produção diária associada
    await supabase
      .from('producao_diaria')
      .delete()
      .eq('op_id', id)

    // 3. Deletar financeiro associado (se existir)
    await supabase
      .from('financeiro')
      .delete()
      .eq('op_id', id)

    // 4. Por fim, deletar a OP
    const { error } = await supabase
      .from('ordens_producao')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar OP:', error)
      throw error
    }
  },

  async uploadImagemPlanta(opId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${opId}/planta.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('op-imagens')
      .upload(path, file, { upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('op-imagens')
      .getPublicUrl(path)

    const publicUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('ordens_producao')
      .update({ imagem_planta_url: publicUrl })
      .eq('id', opId)

    if (updateError) throw updateError

    return publicUrl
  },

  async removeImagemPlanta(opId: string): Promise<void> {
    const op = await this.getOrdemProducao(opId)
    if (!op.imagem_planta_url) return

    const match = op.imagem_planta_url.match(/op-imagens\/(.+)$/)
    if (match) {
      await supabase.storage.from('op-imagens').remove([match[1]])
    }

    await supabase
      .from('ordens_producao')
      .update({ imagem_planta_url: null })
      .eq('id', opId)
  },

  async aprovarOP(id: string, supervisorNome: string): Promise<OrdemProducao> {
    const { data, error } = await supabase
      .from('ordens_producao')
      .update({
        aprovada: true,
        supervisor_nome: supervisorNome,
        supervisor_data_aprovacao: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async emitirNotaFiscal(id: string, numeroNota: string): Promise<OrdemProducao> {
    const { data, error } = await supabase
      .from('ordens_producao')
      .update({
        nota_fiscal_emitida: true,
        nota_fiscal_numero: numeroNota,
        nota_fiscal_data: new Date().toISOString().split('T')[0],
        status: 'nota_emitida', // Legado
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // =====================================================
  // FUNÇÕES V3 - STATUS SEPARADOS
  // =====================================================

  // Alterar status de produção
  async alterarStatusProducao(
    id: string,
    novoStatus: 'criada' | 'em_producao' | 'pausada' | 'finalizada' | 'cancelada'
  ): Promise<OrdemProducao> {
    // Mapeia para status legado para manter compatibilidade
    const statusLegadoMap: Record<string, string> = {
      criada: 'criada',
      em_producao: 'em_producao',
      pausada: 'em_producao',
      finalizada: 'finalizada',
      cancelada: 'finalizada',
    }

    const { data, error } = await supabase
      .from('ordens_producao')
      .update({
        status_producao: novoStatus,
        status: statusLegadoMap[novoStatus], // Mantém legado sincronizado
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Alterar status financeiro manualmente (se necessário)
  async alterarStatusFinanceiro(
    id: string,
    novoStatus: 'pendente' | 'parcial' | 'pago' | 'atrasado' | 'cancelado'
  ): Promise<OrdemProducao> {
    // Mapeia para status legado
    const statusLegadoMap: Record<string, string> = {
      pendente: 'faturada',
      parcial: 'faturada',
      pago: 'paga',
      atrasado: 'faturada',
      cancelado: 'finalizada',
    }

    const { data, error } = await supabase
      .from('ordens_producao')
      .update({
        status_financeiro: novoStatus,
        status: statusLegadoMap[novoStatus], // Mantém legado sincronizado
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Iniciar produção
  async iniciarProducao(id: string): Promise<OrdemProducao> {
    return this.alterarStatusProducao(id, 'em_producao')
  },

  // Pausar produção
  async pausarProducao(id: string): Promise<OrdemProducao> {
    return this.alterarStatusProducao(id, 'pausada')
  },

  // Finalizar produção
  async finalizarProducao(id: string): Promise<OrdemProducao> {
    return this.alterarStatusProducao(id, 'finalizada')
  },

  // Cancelar OP
  async cancelarOP(id: string): Promise<OrdemProducao> {
    const { data, error } = await supabase
      .from('ordens_producao')
      .update({
        status_producao: 'cancelada',
        status_financeiro: 'cancelado',
        status: 'finalizada', // Legado
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // =====================================================
  // PRODUÇÃO DIÁRIA
  // =====================================================

  async getProducaoDiaria(opId: string): Promise<ProducaoDiaria[]> {
    const { data, error } = await supabase
      .from('producao_diaria')
      .select('*')
      .eq('op_id', opId)
      .order('data', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createProducaoDiaria(producao: Partial<ProducaoDiaria>): Promise<ProducaoDiaria> {
    const { data, error } = await supabase
      .from('producao_diaria')
      .insert([producao])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateProducaoDiaria(id: string, updates: Partial<ProducaoDiaria>): Promise<ProducaoDiaria> {
    const { data, error } = await supabase
      .from('producao_diaria')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // =====================================================
  // PEÇAS DEFEITUOSAS
  // =====================================================

  async getPecasDefeituosas(opId: string): Promise<PecaDefeituosa[]> {
    const { data, error } = await supabase
      .from('pecas_defeituosas')
      .select('*')
      .eq('op_id', opId)
      .order('data', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createPecaDefeituosa(defeito: Partial<PecaDefeituosa>): Promise<PecaDefeituosa> {
    const { data, error } = await supabase
      .from('pecas_defeituosas')
      .insert([defeito])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // =====================================================
  // FINANCEIRO
  // =====================================================

  async getFinanceiro(opId: string): Promise<Financeiro | null> {
    // maybeSingle: OPs sem registro financeiro retornam null em vez de 406.
    const { data, error } = await supabase
      .from('financeiro')
      .select('*')
      .eq('op_id', opId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async createFinanceiro(financeiro: Partial<Financeiro>): Promise<Financeiro> {
    const { data, error } = await supabase
      .from('financeiro')
      .insert([financeiro])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateFinanceiro(id: string, updates: Partial<Financeiro>): Promise<Financeiro> {
    const { data, error } = await supabase
      .from('financeiro')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async registrarPagamento(
    financeiroId: string,
    valorPago: number,
    dataPagamento: string,
    formaPagamento: string
  ): Promise<Financeiro> {
    const { data: financeiro } = await supabase
      .from('financeiro')
      .select('*')
      .eq('id', financeiroId)
      .single()

    if (!financeiro) throw new Error('Financeiro não encontrado')

    const novoValorPago = (financeiro.valor_pago || 0) + valorPago
    let novoStatus: string = 'parcial'

    if (novoValorPago >= financeiro.valor_total) {
      novoStatus = 'pago'
    } else if (novoValorPago > 0) {
      novoStatus = 'parcial'
    }

    const { data, error } = await supabase
      .from('financeiro')
      .update({
        valor_pago: novoValorPago,
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento,
        status_pagamento: novoStatus,
      })
      .eq('id', financeiroId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // =====================================================
  // ORÇAMENTOS
  // =====================================================

  // Buscar cliente por CNPJ/CPF (documento)
  async buscarClientePorDocumento(documento: string): Promise<Cliente | null> {
    // Limpar documento (remover pontos, traços, barras)
    const docLimpo = documento.replace(/[^\d]/g, '')

    if (docLimpo.length !== 11 && docLimpo.length !== 14) return null

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('documento', docLimpo)
      .maybeSingle()

    if (error) {
      console.warn('Erro ao buscar cliente por documento:', error)
      return null
    }
    return data
  },

  // Busca cliente pelo documento; se nao existe, cria. Sempre retorna o cliente.
  // Usado pelo formulario de orcamento para evitar duplicacao de cadastro
  // toda vez que o usuario digita o mesmo CNPJ.
  async findOrCreateClientePorDocumento(input: {
    documento: string
    nome: string
    telefone?: string | null
    email?: string | null
    userId?: string | null
  }): Promise<Cliente | null> {
    const docLimpo = input.documento.replace(/[^\d]/g, '')
    if (docLimpo.length !== 11 && docLimpo.length !== 14) return null
    if (!input.nome.trim()) return null

    const existente = await this.buscarClientePorDocumento(docLimpo)
    if (existente) return existente

    const tipo_documento: 'cpf' | 'cnpj' = docLimpo.length === 11 ? 'cpf' : 'cnpj'
    const payload: Partial<Cliente> = {
      nome: input.nome.trim(),
      documento: docLimpo,
      tipo_documento,
      telefone: input.telefone?.trim() || null,
      email: input.email?.trim() || null,
      ativo: true,
      created_by: input.userId ?? null,
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert([payload])
      .select('*')
      .single()

    // Race condition: outro usuario inseriu o mesmo documento entre a busca e o insert.
    // Recupera o cliente vencedor da unique constraint.
    if (error?.code === '23505') {
      return this.buscarClientePorDocumento(docLimpo)
    }
    if (error) {
      console.error('Erro ao criar cliente:', error)
      return null
    }
    return data
  },

  async listOrcamentos(status?: string): Promise<Orcamento[]> {
    let query = supabase
      .from('orcamentos')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async getOrcamento(id: string): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Buscar orçamento com itens
  async getOrcamentoComItens(id: string): Promise<Orcamento & { itens: OrcamentoItem[] }> {
    const { data: orcamento, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    const { data: itens } = await supabase
      .from('orcamento_itens')
      .select('*')
      .eq('orcamento_id', id)
      .order('created_at')

    return { ...orcamento, itens: itens || [] }
  },

  // Listar itens de um orçamento
  async getOrcamentoItens(orcamentoId: string): Promise<OrcamentoItem[]> {
    const { data, error } = await supabase
      .from('orcamento_itens')
      .select('*')
      .eq('orcamento_id', orcamentoId)
      .order('created_at')

    if (error) throw error
    return data || []
  },

  async createOrcamento(orcamento: Partial<Orcamento>): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .insert([{
        ...orcamento,
        status: 'rascunho',
        versao: 1,
        valor_total: orcamento.valor_total || orcamento.valor_estimado || 0,
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Criar orçamento com itens (transação)
  async createOrcamentoComItens(
    orcamento: Partial<Orcamento>,
    itens: Array<{ nome_peca: string; quantidade: number; valor_unitario: number; observacoes?: string }>
  ): Promise<Orcamento> {
    // Calcular valor total
    const valorTotal = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0)

    // Criar orçamento
    const { data: novoOrcamento, error: orcError } = await supabase
      .from('orcamentos')
      .insert([{
        ...orcamento,
        status: 'rascunho',
        versao: 1,
        valor_total: valorTotal,
        valor_estimado: valorTotal,
      }])
      .select()
      .single()

    if (orcError) throw orcError

    // Criar itens
    if (itens.length > 0) {
      const itensComOrcamento = itens.map(item => ({
        orcamento_id: novoOrcamento.id,
        nome_peca: item.nome_peca,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        subtotal: item.quantidade * item.valor_unitario,
        observacoes: item.observacoes || null,
      }))

      const { error: itensError } = await supabase
        .from('orcamento_itens')
        .insert(itensComOrcamento)

      if (itensError) {
        console.error('Erro ao criar itens do orçamento:', itensError)
        // Tentar deletar o orçamento criado
        await supabase.from('orcamentos').delete().eq('id', novoOrcamento.id)
        throw itensError
      }
    }

    return novoOrcamento
  },

  async updateOrcamento(id: string, updates: Partial<Orcamento>): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Atualizar orçamento com itens
  async updateOrcamentoComItens(
    id: string,
    updates: Partial<Orcamento>,
    itens: Array<{ id?: string; nome_peca: string; quantidade: number; valor_unitario: number; observacoes?: string }>
  ): Promise<Orcamento> {
    // Calcular valor total
    const valorTotal = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0)

    // Atualizar orçamento
    const { data: orcamento, error: orcError } = await supabase
      .from('orcamentos')
      .update({
        ...updates,
        valor_total: valorTotal,
        valor_estimado: valorTotal,
      })
      .eq('id', id)
      .select()
      .single()

    if (orcError) throw orcError

    // Deletar itens antigos e criar novos
    await supabase.from('orcamento_itens').delete().eq('orcamento_id', id)

    if (itens.length > 0) {
      const itensComOrcamento = itens.map(item => ({
        orcamento_id: id,
        nome_peca: item.nome_peca,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        subtotal: item.quantidade * item.valor_unitario,
        observacoes: item.observacoes || null,
      }))

      const { error: itensError } = await supabase
        .from('orcamento_itens')
        .insert(itensComOrcamento)

      if (itensError) {
        console.error('Erro ao atualizar itens do orçamento:', itensError)
        throw itensError
      }
    }

    return orcamento
  },

  // Adicionar item ao orçamento
  async addOrcamentoItem(item: Partial<OrcamentoItem>): Promise<OrcamentoItem> {
    const { data, error } = await supabase
      .from('orcamento_itens')
      .insert([item])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Remover item do orçamento
  async removeOrcamentoItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('orcamento_itens')
      .delete()
      .eq('id', itemId)

    if (error) throw error
  },

  async enviarOrcamento(id: string): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .update({
        status: 'enviado',
        data_envio: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async aprovarOrcamento(id: string): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .update({
        status: 'aprovado',
        data_resposta: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async reprovarOrcamento(id: string): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .update({
        status: 'reprovado',
        data_resposta: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async converterOrcamentoEmOP(orcamentoId: string, opId: string): Promise<Orcamento> {
    const { data, error } = await supabase
      .from('orcamentos')
      .update({
        status: 'convertido',
        convertido_op_id: opId,
      })
      .eq('id', orcamentoId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // =====================================================
  // DASHBOARD E RELATÓRIOS
  // =====================================================

  async getDashboardStats(): Promise<DashboardStats> {
    const { data, error } = await supabase
      .from('dashboard_stats')
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async getDashboardFinanceiro(): Promise<DashboardFinanceiro> {
    // Buscar todas as OPs
    const { data: allOps } = await supabase
      .from('ordens_producao')
      .select('id, preco_servico, created_at, status, status_producao')

    // Filtrar canceladas no JavaScript (trata NULL corretamente)
    const opsData = allOps?.filter(op =>
      op.status !== 'cancelada' && op.status_producao !== 'cancelada'
    ) || []

    const mesAtual = new Date().getMonth()
    const anoAtual = new Date().getFullYear()

    const opsMes = opsData.filter(op => {
      const data = new Date(op.created_at)
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual
    })

    const faturadoMes = opsMes.reduce((sum, op) => sum + (op.preco_servico || 0), 0)

    // Buscar todos os financeiros
    const { data: financeiros } = await supabase
      .from('financeiro')
      .select('*')

    // Criar mapa de financeiros por op_id
    const financeirosPorOp = new Map<string, any>()
    financeiros?.forEach(f => financeirosPorOp.set(f.op_id, f))

    // Filtrar apenas financeiros de OPs não canceladas
    const opsIds = new Set(opsData.map(op => op.id))
    const financeirosAtivos = financeiros?.filter(f => opsIds.has(f.op_id)) || []

    const recebidoMes = financeirosAtivos.filter(f => {
      if (!f.data_pagamento) return false
      const data = new Date(f.data_pagamento)
      return data.getMonth() === mesAtual && data.getFullYear() === anoAtual
    }).reduce((sum, f) => sum + (f.valor_pago || 0), 0)

    // Total em aberto: OPs com financeiro não pago + OPs sem financeiro
    let totalEmAberto = 0
    let opsAguardando = 0

    for (const op of opsData) {
      const fin = financeirosPorOp.get(op.id)
      if (fin) {
        // Tem financeiro
        if (fin.status_pagamento !== 'pago') {
          totalEmAberto += (fin.valor_total || 0) - (fin.valor_pago || 0)
          opsAguardando++
        }
      } else {
        // Não tem financeiro = pendente
        totalEmAberto += op.preco_servico || 0
        opsAguardando++
      }
    }

    const hoje = new Date().toISOString().split('T')[0]
    const opsAtrasadas = financeirosAtivos.filter(f =>
      f.data_vencimento && f.data_vencimento < hoje && f.status_pagamento !== 'pago'
    ).length

    // OPs sem nota (excluindo canceladas)
    const opsSemNota = opsData.filter(op =>
      (op.status === 'finalizada' || op.status === 'faturada')
    )

    return {
      faturado_mes: faturadoMes,
      recebido_mes: recebidoMes,
      total_em_aberto: totalEmAberto,
      ops_aguardando_pagamento: opsAguardando,
      ops_atrasadas: opsAtrasadas,
      ops_sem_nota: opsSemNota.length,
    }
  },

  async getContasReceber(): Promise<ContaReceber[]> {
    const { data: allOps } = await supabase
      .from('ordens_producao')
      .select('*')
      .order('created_at', { ascending: false })

    // Filtrar no JavaScript para tratar NULL corretamente
    const ops = allOps?.filter(op =>
      op.status !== 'criada' &&
      op.status !== 'cancelada' &&
      op.status_producao !== 'cancelada'
    ) || []

    if (ops.length === 0) return []

    const contasReceber: ContaReceber[] = []

    for (const op of ops) {
      const financeiro = await this.getFinanceiro(op.id)

      const valorTotal = financeiro?.valor_total || op.preco_servico
      const valorPago = financeiro?.valor_pago || 0
      const valorPendente = valorTotal - valorPago

      let situacao: 'pendente' | 'pago' | 'atrasado' | 'parcial' = 'pendente'

      if (financeiro?.status_pagamento === 'pago') {
        situacao = 'pago'
      } else if (financeiro?.data_vencimento) {
        const hoje = new Date().toISOString().split('T')[0]
        if (financeiro.data_vencimento < hoje) {
          situacao = 'atrasado'
        } else if (valorPago > 0) {
          situacao = 'parcial'
        }
      } else if (valorPago > 0 && valorPago < valorTotal) {
        situacao = 'parcial'
      }

      contasReceber.push({
        id: op.id,
        codigo: op.codigo,
        cliente: op.cliente,
        nome_peca: op.nome_peca,
        // Novos campos V3
        status_producao: op.status_producao || 'criada',
        status_financeiro: op.status_financeiro || 'pendente',
        // Legado
        status_op: op.status,
        valor_total: valorTotal,
        valor_pago: valorPago,
        valor_pendente: valorPendente,
        data_vencimento: financeiro?.data_vencimento || null,
        status_pagamento: financeiro?.status_pagamento || null,
        forma_pagamento: financeiro?.forma_pagamento || null,
        nota_fiscal_emitida: op.nota_fiscal_emitida || false,
        nota_fiscal_numero: op.nota_fiscal_numero || null,
        situacao_financeira: situacao,
      })
    }

    // Ordenar: atrasados primeiro, depois pendentes, depois parciais, depois pagos
    return contasReceber.sort((a, b) => {
      const ordem = { atrasado: 0, pendente: 1, parcial: 2, pago: 3 }
      return ordem[a.situacao_financeira] - ordem[b.situacao_financeira]
    })
  },

  async getPrevisaoFaturamento(): Promise<PrevisaoFaturamento[]> {
    const { data: allData, error } = await supabase
      .from('ordens_producao')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error

    // Filtrar OPs finalizadas - excluir apenas canceladas
    const data = allData?.filter(op => {
      // Excluir canceladas
      if (op.status === 'cancelada' || op.status_producao === 'cancelada') {
        return false
      }
      // Incluir finalizadas (por qualquer critério)
      const isFinalizadaLegado = op.status === 'finalizada' || op.status === 'faturada' || op.status === 'nota_emitida' || op.status === 'paga'
      const isFinalizadaV3 = op.status_producao === 'finalizada'
      return isFinalizadaLegado || isFinalizadaV3
    }) || []

    const previsoes: PrevisaoFaturamento[] = []

    for (const op of data) {
      const financeiro = await this.getFinanceiro(op.id)

      previsoes.push({
        id: op.id,
        codigo: op.codigo,
        cliente: op.cliente,
        nome_peca: op.nome_peca,
        // Novos campos V3
        status_producao: op.status_producao || 'finalizada',
        status_financeiro: op.status_financeiro || 'pendente',
        // Legado
        status: op.status,
        preco_servico: op.preco_servico,
        nota_fiscal_emitida: op.nota_fiscal_emitida || false,
        nota_fiscal_numero: op.nota_fiscal_numero,
        nota_fiscal_data: op.nota_fiscal_data,
        status_pagamento: financeiro?.status_pagamento || null,
        data_vencimento: financeiro?.data_vencimento || null,
      })
    }

    return previsoes
  },

  // =====================================================
  // HISTÓRICO
  // =====================================================

  async getHistoricoFinanceiro(opId: string): Promise<HistoricoFinanceiro[]> {
    const { data, error } = await supabase
      .from('historico_financeiro')
      .select('*')
      .eq('op_id', opId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createHistoricoFinanceiro(historico: Partial<HistoricoFinanceiro>): Promise<HistoricoFinanceiro> {
    const { data, error } = await supabase
      .from('historico_financeiro')
      .insert([historico])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getHistoricoCliente(clienteNome: string): Promise<HistoricoCliente> {
    const { data: ops } = await supabase
      .from('ordens_producao')
      .select('id, data_inicio, preco_servico')
      .ilike('cliente', `%${clienteNome}%`)

    if (!ops || ops.length === 0) {
      return {
        total_ops: 0,
        total_faturado: 0,
        total_pago: 0,
        total_pendente: 0,
        ultima_op_data: null,
      }
    }

    let totalFaturado = 0
    let totalPago = 0

    for (const op of ops) {
      const financeiro = await this.getFinanceiro(op.id)
      totalFaturado += financeiro?.valor_total || op.preco_servico || 0
      totalPago += financeiro?.valor_pago || 0
    }

    const ultimaOp = ops.sort((a, b) =>
      new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime()
    )[0]

    return {
      total_ops: ops.length,
      total_faturado: totalFaturado,
      total_pago: totalPago,
      total_pendente: totalFaturado - totalPago,
      ultima_op_data: ultimaOp?.data_inicio || null,
    }
  },

  // =====================================================
  // CLIENTES (lista única)
  // =====================================================

  // @deprecated - usar listClientes() para tabela normalizada
  async getClientes(): Promise<string[]> {
    const { data, error } = await supabase
      .from('ordens_producao')
      .select('cliente')
      .order('cliente')

    if (error) throw error

    const clientesUnicos = [...new Set(data?.map(d => d.cliente) || [])]
    return clientesUnicos
  },

  // =====================================================
  // V3 - CLIENTES NORMALIZADOS
  // =====================================================

  // Listar clientes
  async listClientes(filtros?: {
    ativo?: boolean
    busca?: string
  }): Promise<Cliente[]> {
    let query = supabase
      .from('clientes')
      .select('*')
      .order('nome')

    if (filtros?.ativo !== undefined) {
      query = query.eq('ativo', filtros.ativo)
    }

    if (filtros?.busca) {
      query = query.or(`nome.ilike.%${filtros.busca}%,documento.ilike.%${filtros.busca}%,email.ilike.%${filtros.busca}%`)
    }

    const { data, error } = await query

    if (error) {
      console.warn('Tabela clientes não disponível:', error)
      return []
    }
    return data || []
  },

  // Buscar cliente por ID
  async getCliente(id: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.warn('Erro ao buscar cliente:', error)
      return null
    }
    return data
  },

  // Criar cliente
  async createCliente(cliente: Partial<Cliente>): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .insert([cliente])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Atualizar cliente
  async updateCliente(id: string, updates: Partial<Cliente>): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Desativar cliente (soft delete)
  async desativarCliente(id: string): Promise<Cliente> {
    return this.updateCliente(id, { ativo: false })
  },

  // Reativar cliente
  async reativarCliente(id: string): Promise<Cliente> {
    return this.updateCliente(id, { ativo: true })
  },

  // Buscar estatísticas do cliente
  async getClienteEstatisticas(clienteId: string): Promise<ClienteEstatisticas | null> {
    const { data, error } = await supabase
      .from('cliente_estatisticas')
      .select('*')
      .eq('id', clienteId)
      .single()

    if (error) {
      console.warn('View cliente_estatisticas não disponível:', error)
      return null
    }
    return data
  },

  // Listar estatísticas de todos os clientes
  async listClientesEstatisticas(): Promise<ClienteEstatisticas[]> {
    const { data, error } = await supabase
      .from('cliente_estatisticas')
      .select('*')
      .order('total_faturado', { ascending: false })

    if (error) {
      console.warn('View cliente_estatisticas não disponível:', error)
      return []
    }
    return data || []
  },

  // Buscar ou criar cliente pelo nome
  async buscarOuCriarCliente(nome: string, userId?: string): Promise<string> {
    // Tentar usar função do banco
    try {
      const { data, error } = await supabase.rpc('buscar_ou_criar_cliente', {
        p_nome: nome,
        p_user_id: userId || null,
      })

      if (error) throw error
      return data
    } catch {
      // Fallback: fazer manualmente
      const { data: existente } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nome', nome.trim())
        .single()

      if (existente) return existente.id

      const { data: novo, error } = await supabase
        .from('clientes')
        .insert([{ nome: nome.trim(), created_by: userId }])
        .select('id')
        .single()

      if (error) throw error
      return novo.id
    }
  },

  // =====================================================
  // V3 - MOVIMENTOS FINANCEIROS (LEDGER)
  // =====================================================

  // Registrar movimento financeiro
  async registrarMovimento(
    financeiroId: string,
    tipo: 'pagamento' | 'pagamento_parcial' | 'estorno' | 'ajuste' | 'desconto' | 'juros' | 'multa' | 'custo_extra' | 'prejuizo' | 'cancelamento',
    valor: number,
    opcoes?: {
      formaPagamento?: string
      observacao?: string
      userId?: string
    }
  ): Promise<string> {
    // Usar função do banco se disponível, senão fazer manualmente
    try {
      const { data, error } = await supabase.rpc('registrar_movimento_financeiro', {
        p_financeiro_id: financeiroId,
        p_tipo: tipo,
        p_valor: valor,
        p_forma_pagamento: opcoes?.formaPagamento || null,
        p_observacao: opcoes?.observacao || null,
        p_user_id: opcoes?.userId || null,
      })

      if (error) throw error
      return data
    } catch {
      // Fallback: inserir diretamente
      const { data: financeiro } = await supabase
        .from('financeiro')
        .select('*')
        .eq('id', financeiroId)
        .single()

      if (!financeiro) throw new Error('Financeiro não encontrado')

      const saldoAnterior = financeiro.valor_pago || 0
      let saldoAtual = saldoAnterior

      // Calcular novo saldo baseado no tipo
      if (['pagamento', 'pagamento_parcial', 'juros', 'multa'].includes(tipo)) {
        saldoAtual = saldoAnterior + valor
      } else if (['estorno', 'desconto', 'cancelamento'].includes(tipo)) {
        saldoAtual = saldoAnterior - valor
      }

      // Inserir movimento
      const { data: movimento, error: movError } = await supabase
        .from('financeiro_movimentos')
        .insert([{
          financeiro_id: financeiroId,
          op_id: financeiro.op_id,
          tipo,
          valor,
          saldo_anterior: saldoAnterior,
          saldo_atual: saldoAtual,
          forma_pagamento: opcoes?.formaPagamento || null,
          observacao: opcoes?.observacao || null,
          created_by: opcoes?.userId || null,
        }])
        .select()
        .single()

      if (movError) throw movError

      // Atualizar saldo no financeiro
      await supabase
        .from('financeiro')
        .update({ valor_pago: saldoAtual })
        .eq('id', financeiroId)

      return movimento.id
    }
  },

  // Listar movimentos de um financeiro
  async getMovimentosFinanceiro(financeiroId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('financeiro_movimentos')
      .select('*')
      .eq('financeiro_id', financeiroId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Listar movimentos de uma OP
  async getMovimentosOP(opId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('financeiro_movimentos')
      .select('*')
      .eq('op_id', opId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Extrato financeiro completo (com dados da OP e usuário)
  async getExtratoFinanceiro(filtros?: {
    opId?: string
    financeiroId?: string
    tipo?: string
    dataInicio?: string
    dataFim?: string
  }): Promise<any[]> {
    let query = supabase
      .from('extrato_financeiro')
      .select('*')
      .order('created_at', { ascending: false })

    if (filtros?.opId) {
      query = query.eq('op_id', filtros.opId)
    }
    if (filtros?.financeiroId) {
      query = query.eq('financeiro_id', filtros.financeiroId)
    }
    if (filtros?.tipo) {
      query = query.eq('tipo', filtros.tipo)
    }
    if (filtros?.dataInicio) {
      query = query.gte('data_movimento', filtros.dataInicio)
    }
    if (filtros?.dataFim) {
      query = query.lte('data_movimento', filtros.dataFim)
    }

    const { data, error } = await query

    if (error) {
      // View pode não existir ainda, retornar vazio
      console.warn('Extrato financeiro não disponível:', error)
      return []
    }
    return data || []
  },

  // =====================================================
  // PONTO ELETRÔNICO
  // =====================================================

  // --- Funções para MOBILE (públicas, via token) ---

  // Buscar funcionário pelo token (mobile)
  async buscarFuncionarioPorToken(token: string): Promise<{
    id: string
    nome: string
    cargo: string | null
    ativo: boolean
  } | null> {
    const { data, error } = await supabase
      .rpc('buscar_funcionario_por_token', { p_token: token })

    if (error || !data || data.length === 0) {
      return null
    }
    return data[0]
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

  // --- Funções para DESKTOP (autenticadas) ---

  // Listar funcionários do ponto
  async listFuncionariosPonto(filtros?: {
    ativo?: boolean
    busca?: string
  }): Promise<any[]> {
    let query = supabase
      .from('funcionarios_ponto')
      .select('*')
      .order('nome')

    if (filtros?.ativo !== undefined) {
      query = query.eq('ativo', filtros.ativo)
    }

    if (filtros?.busca) {
      query = query.or(`nome.ilike.%${filtros.busca}%,cargo.ilike.%${filtros.busca}%`)
    }

    const { data, error } = await query

    if (error) {
      console.warn('Erro ao listar funcionários do ponto:', error)
      return []
    }
    return data || []
  },

  // Buscar funcionário do ponto por ID
  async getFuncionarioPonto(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('funcionarios_ponto')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.warn('Erro ao buscar funcionário:', error)
      return null
    }
    return data
  },

  // Criar funcionário do ponto
  async createFuncionarioPonto(funcionario: {
    nome: string
    cargo?: string
    user_id?: string
  }, userId?: string): Promise<any> {
    const { data, error } = await supabase
      .from('funcionarios_ponto')
      .insert([{
        ...funcionario,
        created_by: userId,
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Atualizar funcionário do ponto
  async updateFuncionarioPonto(id: string, updates: {
    nome?: string
    cargo?: string
    ativo?: boolean
    valor_hora?: number
  }): Promise<any> {
    const { data, error } = await supabase
      .from('funcionarios_ponto')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Gerar novo token para funcionário
  async regenerarTokenPonto(id: string): Promise<string> {
    const novoToken = crypto.randomUUID()

    const { error } = await supabase
      .from('funcionarios_ponto')
      .update({ ponto_token: novoToken })
      .eq('id', id)

    if (error) throw error
    return novoToken
  },

  // Excluir funcionário do ponto (e seus registros)
  async deleteFuncionarioPonto(id: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('excluir_funcionario_ponto', { p_funcionario_id: id })

    if (error) throw error
    return data
  },

  // Criar ajuste manual de horas (adicionar ou remover)
  async criarAjusteHoras(
    funcionarioId: string,
    minutos: number, // positivo = adicionar, negativo = remover
    observacao: string,
    userId?: string
  ): Promise<any> {
    const hoje = new Date()
    const { data, error } = await supabase
      .from('registro_ponto')
      .insert([{
        funcionario_id: funcionarioId,
        data: hoje.toISOString().split('T')[0],
        hora_entrada: hoje.toISOString(),
        hora_saida: hoje.toISOString(),
        total_minutos: minutos,
        status: 'ajustado',
        origem: 'ajuste',
        observacao: observacao,
        updated_by: userId,
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Listar registros de ponto
  async listRegistrosPonto(filtros?: {
    funcionarioId?: string
    dataInicio?: string
    dataFim?: string
    status?: string
  }): Promise<any[]> {
    let query = supabase
      .from('ponto_detalhado')
      .select('*')
      .order('data', { ascending: false })
      .order('hora_entrada', { ascending: false })

    if (filtros?.funcionarioId) {
      query = query.eq('funcionario_id', filtros.funcionarioId)
    }

    if (filtros?.dataInicio) {
      query = query.gte('data', filtros.dataInicio)
    }

    if (filtros?.dataFim) {
      query = query.lte('data', filtros.dataFim)
    }

    if (filtros?.status) {
      query = query.eq('status', filtros.status)
    }

    const { data, error } = await query

    if (error) {
      console.warn('Erro ao listar registros de ponto:', error)
      return []
    }
    return data || []
  },

  // Resumo de ponto por funcionário
  async getResumoPontoFuncionarios(): Promise<any[]> {
    const { data, error } = await supabase
      .from('resumo_ponto_funcionario')
      .select('*')
      .order('nome')

    if (error) {
      console.warn('Erro ao buscar resumo de ponto:', error)
      return []
    }
    return data || []
  },

  // Relatório de horas trabalhadas por período
  async getRelatorioHorasPorPeriodo(filtros: {
    dataInicio: string
    dataFim: string
    funcionarioId?: string
  }): Promise<{
    funcionario_id: string
    funcionario_nome: string
    funcionario_cargo: string | null
    total_dias: number
    total_minutos: number
    total_horas_formatado: string
    registros: Array<{
      data: string
      hora_entrada: string
      hora_saida: string | null
      minutos_trabalhados: number
    }>
  }[]> {
    let query = supabase
      .from('ponto_detalhado')
      .select('*')
      .gte('data', filtros.dataInicio)
      .lte('data', filtros.dataFim)
      // Conta fechados E ajustados. Editar/corrigir os horários de um ponto o
      // marca como 'ajustado', e ajustes manuais (+/-) também são 'ajustado'.
      // Filtrar só 'fechado' descartava horas reais corrigidas — por isso o
      // total do mês não somava. 'aberto' fica de fora (não tem duração).
      .in('status', ['fechado', 'ajustado'])
      .order('funcionario_nome')
      .order('data', { ascending: true })

    if (filtros.funcionarioId) {
      query = query.eq('funcionario_id', filtros.funcionarioId)
    }

    const { data, error } = await query

    if (error) {
      console.warn('Erro ao buscar relatório de horas:', error)
      return []
    }

    // Agrupar por funcionário
    const agrupado: Record<string, {
      funcionario_id: string
      funcionario_nome: string
      funcionario_cargo: string | null
      registros: Array<{
        data: string
        hora_entrada: string
        hora_saida: string | null
        minutos_trabalhados: number
      }>
    }> = {}

    for (const reg of data || []) {
      if (!agrupado[reg.funcionario_id]) {
        agrupado[reg.funcionario_id] = {
          funcionario_id: reg.funcionario_id,
          funcionario_nome: reg.funcionario_nome,
          funcionario_cargo: reg.funcionario_cargo,
          registros: [],
        }
      }
      agrupado[reg.funcionario_id].registros.push({
        data: reg.data,
        hora_entrada: reg.hora_entrada,
        hora_saida: reg.hora_saida,
        minutos_trabalhados: reg.total_minutos || 0,
      })
    }

    // Calcular totais
    return Object.values(agrupado).map(func => {
      const totalMinutos = func.registros.reduce((acc, r) => acc + r.minutos_trabalhados, 0)
      const diasUnicos = new Set(func.registros.map(r => r.data)).size
      const horas = Math.floor(totalMinutos / 60)
      const minutos = totalMinutos % 60

      return {
        ...func,
        total_dias: diasUnicos,
        total_minutos: totalMinutos,
        total_horas_formatado: `${horas}h ${minutos}min`,
      }
    })
  },

  // Criar registro de ponto manual (ajuste)
  async createRegistroPontoManual(registro: {
    funcionario_id: string
    data: string
    hora_entrada: string
    hora_saida?: string
    observacao?: string
  }, userId?: string): Promise<any> {
    let totalMinutos = null
    if (registro.hora_saida && registro.hora_entrada) {
      const entrada = new Date(registro.hora_entrada)
      const saida = new Date(registro.hora_saida)
      totalMinutos = Math.round((saida.getTime() - entrada.getTime()) / 60000)
    }

    const { data, error } = await supabase
      .from('registro_ponto')
      .insert([{
        funcionario_id: registro.funcionario_id,
        data: registro.data,
        hora_entrada: registro.hora_entrada,
        hora_saida: registro.hora_saida || null,
        total_minutos: totalMinutos,
        status: registro.hora_saida ? 'fechado' : 'aberto',
        origem: 'ajuste',
        observacao: registro.observacao || 'Registro manual',
        updated_by: userId,
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Atualizar registro de ponto (ajuste)
  async updateRegistroPonto(id: string, updates: {
    hora_entrada?: string
    hora_saida?: string
    observacao?: string
  }, userId?: string): Promise<any> {
    // Calcular total de minutos se tiver entrada e saída
    let totalMinutos = undefined
    let status = undefined

    if (updates.hora_entrada || updates.hora_saida) {
      // Buscar registro atual para calcular
      const { data: atual } = await supabase
        .from('registro_ponto')
        .select('hora_entrada, hora_saida')
        .eq('id', id)
        .single()

      const horaEntrada = updates.hora_entrada || atual?.hora_entrada
      const horaSaida = updates.hora_saida || atual?.hora_saida

      if (horaEntrada && horaSaida) {
        const entrada = new Date(horaEntrada)
        const saida = new Date(horaSaida)
        totalMinutos = Math.round((saida.getTime() - entrada.getTime()) / 60000)
        status = 'ajustado'
      }
    }

    const { data, error } = await supabase
      .from('registro_ponto')
      .update({
        ...updates,
        ...(totalMinutos !== undefined ? { total_minutos: totalMinutos } : {}),
        ...(status !== undefined ? { status } : {}),
        updated_by: userId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Excluir registro de ponto (ajuste, batida duplicada, etc)
  async deleteRegistroPonto(id: string): Promise<void> {
    const { error } = await supabase
      .from('registro_ponto')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Calcular total de horas em um período
  async calcularHorasTrabalhadas(filtros: {
    funcionarioId?: string
    dataInicio: string
    dataFim: string
  }): Promise<{
    totalMinutos: number
    totalFormatado: string
    diasTrabalhados: number
  }> {
    let query = supabase
      .from('registro_ponto')
      .select('total_minutos, data')
      .gte('data', filtros.dataInicio)
      .lte('data', filtros.dataFim)
      // Inclui ajustados (pontos editados/corrigidos e ajustes manuais), não só fechados.
      .in('status', ['fechado', 'ajustado'])

    if (filtros.funcionarioId) {
      query = query.eq('funcionario_id', filtros.funcionarioId)
    }

    const { data, error } = await query

    if (error || !data) {
      return { totalMinutos: 0, totalFormatado: '0h 0min', diasTrabalhados: 0 }
    }

    const totalMinutos = data.reduce((sum, r) => sum + (r.total_minutos || 0), 0)
    const diasUnicos = new Set(data.map(r => r.data)).size

    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60

    return {
      totalMinutos,
      totalFormatado: `${horas}h ${minutos}min`,
      diasTrabalhados: diasUnicos,
    }
  },

  // =====================================================
  // CONTAS A RECEBER AVULSAS
  // =====================================================

  async listContasReceberAvulsas(): Promise<ContaReceberAvulsa[]> {
    const { data, error } = await supabase
      .from('contas_receber_avulsas')
      .select('*')
      .order('data_vencimento', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createContaReceberAvulsa(conta: {
    cliente: string
    cnpj_cliente?: string
    descricao: string
    valor_total: number
    data_vencimento: string
    numero_documento?: string
    observacoes?: string
  }, userId?: string): Promise<ContaReceberAvulsa> {
    const { data, error } = await supabase
      .from('contas_receber_avulsas')
      .insert([{ ...conta, created_by: userId }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateContaReceberAvulsa(id: string, updates: Partial<ContaReceberAvulsa>, userId?: string): Promise<ContaReceberAvulsa> {
    const { data, error } = await supabase
      .from('contas_receber_avulsas')
      .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async registrarRecebimentoAvulso(id: string, valorPago: number, formaPagamento: string, userId?: string): Promise<ContaReceberAvulsa> {
    const { data: conta } = await supabase
      .from('contas_receber_avulsas')
      .select('valor_total, valor_pago')
      .eq('id', id)
      .single()

    if (!conta) throw new Error('Conta não encontrada')

    const novoValorPago = (conta.valor_pago || 0) + valorPago
    const status = novoValorPago >= conta.valor_total ? 'pago' : 'parcial'

    const { data, error } = await supabase
      .from('contas_receber_avulsas')
      .update({
        valor_pago: novoValorPago,
        status,
        forma_pagamento: formaPagamento,
        data_pagamento: status === 'pago' ? new Date().toISOString().split('T')[0] : null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteContaReceberAvulsa(id: string): Promise<void> {
    const { error } = await supabase
      .from('contas_receber_avulsas')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // =====================================================
  // CONTAS A PAGAR
  // =====================================================

  // Listar contas a pagar
  async listContasPagar(filtros?: {
    status?: string
    tipo?: string
    categoria?: string
    dataInicio?: string
    dataFim?: string
  }): Promise<any[]> {
    let query = supabase
      .from('contas_pagar')
      .select('*')
      .order('data_vencimento', { ascending: true })

    if (filtros?.status) {
      query = query.eq('status', filtros.status)
    }
    if (filtros?.tipo) {
      query = query.eq('tipo', filtros.tipo)
    }
    if (filtros?.categoria) {
      query = query.eq('categoria', filtros.categoria)
    }
    if (filtros?.dataInicio) {
      query = query.gte('data_vencimento', filtros.dataInicio)
    }
    if (filtros?.dataFim) {
      query = query.lte('data_vencimento', filtros.dataFim)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  // Criar conta a pagar
  async createContaPagar(conta: {
    descricao: string
    tipo: 'fixa' | 'variavel'
    categoria: string
    valor: number
    data_vencimento: string
    fornecedor?: string
    numero_documento?: string
    observacoes?: string
    op_id?: string
    recorrente?: boolean
    dia_vencimento?: number
  }, userId?: string): Promise<any> {
    const { data, error } = await supabase
      .from('contas_pagar')
      .insert([{
        ...conta,
        created_by: userId,
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Atualizar conta a pagar
  async updateContaPagar(id: string, updates: Partial<{
    descricao: string
    tipo: string
    categoria: string
    valor: number
    valor_pago: number
    data_vencimento: string
    data_pagamento: string
    status: string
    fornecedor: string
    numero_documento: string
    observacoes: string
  }>, userId?: string): Promise<any> {
    const { data, error } = await supabase
      .from('contas_pagar')
      .update({
        ...updates,
        updated_by: userId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Registrar pagamento de conta
  async pagarConta(id: string, valorPago: number, userId?: string): Promise<any> {
    // Buscar conta atual
    const { data: conta } = await supabase
      .from('contas_pagar')
      .select('valor, valor_pago')
      .eq('id', id)
      .single()

    if (!conta) throw new Error('Conta não encontrada')

    const novoValorPago = (conta.valor_pago || 0) + valorPago
    const status = novoValorPago >= conta.valor ? 'pago' : 'pendente'

    const { data, error } = await supabase
      .from('contas_pagar')
      .update({
        valor_pago: novoValorPago,
        status,
        data_pagamento: status === 'pago' ? new Date().toISOString().split('T')[0] : null,
        updated_by: userId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Excluir conta a pagar
  async deleteContaPagar(id: string): Promise<void> {
    const { error } = await supabase
      .from('contas_pagar')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Dashboard de contas a pagar
  async getDashboardContasPagar(): Promise<{
    total_pendente: number
    total_atrasado: number
    total_pago_mes: number
    qtd_pendentes: number
    qtd_atrasados: number
    vencendo_hoje: number
    vencendo_semana: number
  }> {
    const { data, error } = await supabase
      .from('dashboard_contas_pagar')
      .select('*')
      .single()

    if (error) {
      // Se a view não existir, calcular manualmente
      const { data: contas } = await supabase
        .from('contas_pagar')
        .select('*')
        .neq('status', 'cancelado')

      if (!contas) {
        return {
          total_pendente: 0,
          total_atrasado: 0,
          total_pago_mes: 0,
          qtd_pendentes: 0,
          qtd_atrasados: 0,
          vencendo_hoje: 0,
          vencendo_semana: 0,
        }
      }

      const hoje = new Date()
      const inicioSemana = new Date(hoje)
      inicioSemana.setDate(hoje.getDate() + 7)

      return {
        total_pendente: contas.filter(c => c.status === 'pendente').reduce((acc, c) => acc + (c.valor - c.valor_pago), 0),
        total_atrasado: contas.filter(c => c.status === 'atrasado').reduce((acc, c) => acc + (c.valor - c.valor_pago), 0),
        total_pago_mes: contas.filter(c => {
          if (c.status !== 'pago' || !c.data_pagamento) return false
          const pagamento = new Date(c.data_pagamento)
          return pagamento.getMonth() === hoje.getMonth() && pagamento.getFullYear() === hoje.getFullYear()
        }).reduce((acc, c) => acc + c.valor_pago, 0),
        qtd_pendentes: contas.filter(c => c.status === 'pendente').length,
        qtd_atrasados: contas.filter(c => c.status === 'atrasado').length,
        vencendo_hoje: contas.filter(c => c.status === 'pendente' && c.data_vencimento === hoje.toISOString().split('T')[0]).length,
        vencendo_semana: contas.filter(c => {
          if (c.status !== 'pendente') return false
          const venc = new Date(c.data_vencimento)
          return venc >= hoje && venc <= inicioSemana
        }).length,
      }
    }

    return data
  },

  // =====================================================
  // PARCELAS
  // =====================================================

  async createParcelas(financeiro_id: string, op_id: string, valor_total: number, num_parcelas: number, primeira_data: string, intervalo_dias: number = 30): Promise<Parcela[]> {
    const parcelas: Partial<Parcela>[] = []
    const valorParcela = Math.round((valor_total / num_parcelas) * 100) / 100

    for (let i = 0; i < num_parcelas; i++) {
      const data = new Date(primeira_data + 'T00:00:00')
      data.setDate(data.getDate() + intervalo_dias * i)
      parcelas.push({
        financeiro_id,
        op_id,
        numero_parcela: i + 1,
        valor: i === num_parcelas - 1 ? Math.round((valor_total - valorParcela * (num_parcelas - 1)) * 100) / 100 : valorParcela,
        data_vencimento: data.toISOString().split('T')[0],
        status: 'pendente',
      })
    }

    const { data, error } = await supabase
      .from('parcelas')
      .insert(parcelas)
      .select()

    if (error) throw error
    return data || []
  },

  async getParcelasByFinanceiro(financeiro_id: string): Promise<Parcela[]> {
    const { data, error } = await supabase
      .from('parcelas')
      .select('*')
      .eq('financeiro_id', financeiro_id)
      .order('numero_parcela')

    if (error) throw error
    return data || []
  },

  async listParcelasPeriodo(data_inicio: string, data_fim: string): Promise<Parcela[]> {
    const { data, error } = await supabase
      .from('parcelas')
      .select('*')
      .gte('data_vencimento', data_inicio)
      .lte('data_vencimento', data_fim)
      .order('data_vencimento')

    if (error) {
      console.warn('Erro ao listar parcelas:', error)
      return []
    }
    return data || []
  },

  async getParcelasByOp(op_id: string): Promise<Parcela[]> {
    const { data, error } = await supabase
      .from('parcelas')
      .select('*')
      .eq('op_id', op_id)
      .order('numero_parcela')

    if (error) throw error
    return data || []
  },

  async updateParcela(id: string, updates: Partial<Parcela>): Promise<Parcela> {
    const { data, error } = await supabase
      .from('parcelas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteParcelasByFinanceiro(financeiro_id: string): Promise<void> {
    const { error } = await supabase
      .from('parcelas')
      .delete()
      .eq('financeiro_id', financeiro_id)

    if (error) throw error
  },

  // =====================================================
  // FUNCIONÁRIOS - VALOR HORA
  // =====================================================

  async updateFuncionarioValorHora(id: string, valor_hora: number): Promise<FuncionarioPonto> {
    const { data, error } = await supabase
      .from('funcionarios_ponto')
      .update({ valor_hora })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async marcarPagamentoFuncionario(id: string, data_pagamento: string): Promise<FuncionarioPonto> {
    const { data, error } = await supabase
      .from('funcionarios_ponto')
      .update({ data_ultimo_pagamento: data_pagamento })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getHorasTrabalhadasDesde(funcionario_id: string, desde: string): Promise<number> {
    const { data, error } = await supabase
      .from('registro_ponto')
      .select('total_minutos')
      .eq('funcionario_id', funcionario_id)
      // Inclui ajustados: horas corrigidas/ajustadas também contam no pagamento.
      .in('status', ['fechado', 'ajustado'])
      .gte('data', desde)

    if (error) throw error
    return (data || []).reduce((acc, r) => acc + (r.total_minutos || 0), 0)
  },
}
