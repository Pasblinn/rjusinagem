export type UserRole = 'financeiro' | 'chefe' | 'operador'

// =====================================================
// STATUS SEPARADOS (V3)
// =====================================================

// Status de Produção - ciclo operacional
export type StatusProducao = 'criada' | 'em_producao' | 'pausada' | 'finalizada' | 'cancelada'

// Status Financeiro - ciclo de pagamento
export type StatusFinanceiro = 'pendente' | 'parcial' | 'pago' | 'atrasado' | 'cancelado'

// =====================================================
// TIPOS LEGADOS (mantidos para compatibilidade)
// =====================================================

// @deprecated - Usar StatusProducao e StatusFinanceiro
export type OPStatus = 'criada' | 'em_producao' | 'finalizada' | 'faturada' | 'nota_emitida' | 'paga'

export type OPType = 'encomenda' | 'estoque'

// @deprecated - Usar StatusFinanceiro
export type PaymentStatus = 'pendente' | 'pago' | 'atrasado' | 'parcial' | 'nao_pago'

export type OrcamentoStatus = 'rascunho' | 'aberto' | 'enviado' | 'aprovado' | 'reprovado' | 'convertido' | 'cancelado'

export type SituacaoFinanceira = 'pendente' | 'pago' | 'atrasado' | 'parcial'

export interface User {
  id: string
  email: string
  nome: string
  role: UserRole
  active?: boolean // V3: soft delete
  created_at: string
}

// =====================================================
// V3 - CLIENTES NORMALIZADOS
// =====================================================

export interface Cliente {
  id: string
  nome: string
  nome_fantasia: string | null
  documento: string | null
  tipo_documento: 'cpf' | 'cnpj' | null
  email: string | null
  telefone: string | null
  celular: string | null
  contato_nome: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface ClienteEstatisticas extends Cliente {
  total_ops: number
  total_faturado: number
  total_pago: number
  total_pendente: number
  ultima_op_data: string | null
  ops_atrasadas: number
}

export interface OrdemProducao {
  id: string
  codigo: string
  tipo: OPType
  data_inicio: string
  data_termino: string | null

  // Novos campos de status (V3)
  status_producao: StatusProducao
  status_financeiro: StatusFinanceiro

  // @deprecated - Mantido para compatibilidade, usar status_producao e status_financeiro
  status: OPStatus

  preparacao_maquina: string

  material: string | null
  codigo_descricao_material: string | null
  quantidade_material: number | null
  lote: string | null
  fornecedor: string | null
  observacoes_material: string | null

  // V3: cliente normalizado
  cliente_id: string | null
  // @deprecated - usar cliente_id
  cliente: string
  nome_peca: string
  quantidade_total: number
  unidade: string | null
  preco_servico: number
  preco_material: number | null

  maquina_utilizada: string | null
  operador_responsavel: string | null

  // V3: campos adicionais
  cnpj_cliente: string | null
  imagem_planta_url: string | null

  supervisor_nome: string | null
  supervisor_data_aprovacao: string | null
  aprovada: boolean

  // Campos de Nota Fiscal
  nota_fiscal_numero: string | null
  nota_fiscal_data: string | null
  nota_fiscal_emitida: boolean

  created_by: string
  created_at: string
  updated_at: string
}

export interface ProducaoDiaria {
  id: string
  op_id: string
  data: string
  turno: string
  hora_inicio: string | null
  hora_fim: string | null
  descricao_operacao: string | null
  quantidade_produzida: number // legado - não usar mais
  pecas_defeituosas: number
  observacoes: string | null
  operador_id: string
  created_at: string
}

export interface PecaDefeituosa {
  id: string
  op_id: string
  data: string
  quantidade: number
  tipo_defeito: string
  causa_provavel: string
  acao_corretiva: string
  created_at: string
}

export interface Financeiro {
  id: string
  op_id: string
  valor_total: number
  valor_pago: number
  forma_pagamento: string
  status_pagamento: PaymentStatus
  data_vencimento: string | null
  data_pagamento: string | null
  numero_parcelas: number
  parcela_atual: number
  custos_extras: number
  prejuizo_defeitos: number
  lucro_final: number
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface OrcamentoItem {
  id: string
  orcamento_id: string
  nome_peca: string
  quantidade: number
  valor_unitario: number
  subtotal: number
  observacoes: string | null
  created_at: string
}

export interface Orcamento {
  id: string
  // V3: cliente normalizado
  cliente_id: string | null
  cliente: string
  cnpj_cliente: string | null
  telefone_cliente: string | null
  email_cliente: string | null
  // Campos legados (mantidos para compatibilidade)
  nome_peca: string | null
  quantidade: number | null
  valor_estimado: number
  // Novo campo
  valor_total: number
  observacoes: string | null
  status: OrcamentoStatus
  data_envio: string | null
  data_resposta: string | null
  versao: number
  convertido_op_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  updated_by: string | null
  // Itens do orçamento (carregados separadamente)
  itens?: OrcamentoItem[]
}

export interface HistoricoFinanceiro {
  id: string
  op_id: string
  usuario_id: string
  acao: string
  valor_anterior: number | null
  valor_novo: number | null
  status_anterior: string | null
  status_novo: string | null
  observacao: string | null
  created_at: string
}

export interface ContaReceber {
  id: string
  codigo: string
  cliente: string
  nome_peca: string
  // Novos campos (V3)
  status_producao: StatusProducao
  status_financeiro: StatusFinanceiro
  // @deprecated
  status_op: OPStatus
  valor_total: number
  valor_pago: number
  valor_pendente: number
  data_vencimento: string | null
  status_pagamento: PaymentStatus | null
  forma_pagamento: string | null
  nota_fiscal_emitida: boolean
  nota_fiscal_numero: string | null
  situacao_financeira: SituacaoFinanceira
}

export interface ContaReceberAvulsa {
  id: string
  cliente: string
  cnpj_cliente: string | null
  descricao: string
  valor_total: number
  valor_pago: number
  data_vencimento: string
  data_pagamento: string | null
  forma_pagamento: string | null
  status: SituacaoFinanceira | 'cancelado'
  numero_documento: string | null
  observacoes: string | null
  op_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface PrevisaoFaturamento {
  id: string
  codigo: string
  cliente: string
  nome_peca: string
  // Novos campos (V3)
  status_producao: StatusProducao
  status_financeiro: StatusFinanceiro
  // @deprecated
  status: OPStatus
  preco_servico: number
  nota_fiscal_emitida: boolean
  nota_fiscal_numero: string | null
  nota_fiscal_data: string | null
  status_pagamento: PaymentStatus | null
  data_vencimento: string | null
}

export interface DashboardStats {
  total_ops: number
  ops_em_producao: number
  ops_finalizadas_mes: number
  valor_a_receber: number
}

export interface DashboardFinanceiro {
  faturado_mes: number
  recebido_mes: number
  total_em_aberto: number
  ops_aguardando_pagamento: number
  ops_atrasadas: number
  ops_sem_nota: number
}

export interface HistoricoCliente {
  total_ops: number
  total_faturado: number
  total_pago: number
  total_pendente: number
  ultima_op_data: string | null
}

// =====================================================
// V3 - MOVIMENTOS FINANCEIROS (LEDGER)
// =====================================================

export type MovimentoTipo =
  | 'pagamento'
  | 'pagamento_parcial'
  | 'estorno'
  | 'ajuste'
  | 'desconto'
  | 'juros'
  | 'multa'
  | 'custo_extra'
  | 'prejuizo'
  | 'cancelamento'

export interface FinanceiroMovimento {
  id: string
  financeiro_id: string
  op_id: string
  tipo: MovimentoTipo
  valor: number
  saldo_anterior: number
  saldo_atual: number
  forma_pagamento: string | null
  data_movimento: string
  data_competencia: string | null
  observacao: string | null
  created_by: string | null
  created_at: string
}

export interface ExtratoFinanceiro extends FinanceiroMovimento {
  op_codigo: string
  cliente: string
  nome_peca: string
  registrado_por: string | null
}

// =====================================================
// PONTO ELETRÔNICO
// =====================================================

export type PontoStatus = 'aberto' | 'fechado' | 'ajustado'
export type PontoOrigem = 'mobile' | 'desktop' | 'ajuste'

export interface FuncionarioPonto {
  id: string
  user_id: string | null
  nome: string
  cargo: string | null
  ponto_token: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RegistroPonto {
  id: string
  funcionario_id: string
  data: string
  hora_entrada: string | null
  hora_saida: string | null
  total_minutos: number | null
  status: PontoStatus
  origem: PontoOrigem
  observacao: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface PontoDetalhado extends RegistroPonto {
  funcionario_nome: string
  funcionario_cargo: string | null
  total_formatado: string
}

export interface ResumoPontoFuncionario {
  funcionario_id: string
  nome: string
  cargo: string | null
  ativo: boolean
  total_registros: number
  total_minutos_trabalhados: number
  pontos_abertos: number
  ultima_data_ponto: string | null
}

export interface ResultadoBaterPonto {
  sucesso: boolean
  tipo: 'entrada' | 'saida' | 'erro'
  mensagem: string
  registro_id: string | null
  hora: string | null
  total_horas: string | null
}
