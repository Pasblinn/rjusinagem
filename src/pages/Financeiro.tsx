import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  DollarSign,
  FileText,
  ExternalLink,
  BarChart3,
  Receipt,
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle,
  Send,
  Check,
  X,
  ArrowRight,
  Calendar,
  Search,
  Edit,
  Printer,
  ClipboardList,
  RefreshCw,
  History,
  Users,
  CreditCard,
  Trash2,
  Download,
} from 'lucide-react'
import { Layout } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { Select } from '@/components/Select'
import { Modal } from '@/components/Modal'
import { Toast } from '@/components/Toast'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { PontoTab } from '@/components/PontoTab'
import { CalendarioTab } from '@/components/CalendarioTab'
import { exportOrcamentoPDF, exportOrcamentoDOCX } from '@/utils/orcamentoExport'
import {
  OrdemProducao,
  Orcamento,
  OrcamentoItem,
  Financeiro as FinanceiroType,
  DashboardFinanceiro,
  ContaReceber,
  ContaReceberAvulsa,
  PrevisaoFaturamento,
  OrcamentoStatus,
  Cliente,
} from '@/types'

// Interface para item do formulário
interface OrcamentoItemForm {
  id?: string
  nome_peca: string
  quantidade: string
  valor_unitario: string
  observacoes: string
}

type TabType = 'dashboard' | 'calendario' | 'orcamentos' | 'contas' | 'despesas' | 'ops' | 'previsao' | 'relatorios' | 'ponto'

// Intervalo de atualização automática (30 segundos)
const POLLING_INTERVAL = 30000

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatDate = (date: string | null) => {
  if (!date) return '-'
  // Datas "YYYY-MM-DD" são interpretadas como UTC pelo JS, causando shift de 1 dia no Brasil.
  // Forçamos leitura local adicionando T00:00:00 antes de formatar.
  const iso = date.includes('T') ? date : `${date}T00:00:00`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function Financeiro() {
  const { hasPermission, user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardFinanceiro | null>(null)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([])
  const [contasReceberAvulsas, setContasReceberAvulsas] = useState<ContaReceberAvulsa[]>([])
  const [contasPagar, setContasPagar] = useState<any[]>([])
  const [dashboardContasPagar, setDashboardContasPagar] = useState<any>(null)
  const [previsaoFaturamento, setPrevisaoFaturamento] = useState<PrevisaoFaturamento[]>([])
  const [ops, setOps] = useState<OrdemProducao[]>([])
  const [financeiros, setFinanceiros] = useState<Map<string, FinanceiroType>>(new Map())

  // Modal Conta Receber Avulsa
  const [showContaReceberModal, setShowContaReceberModal] = useState(false)
  const [selectedContaAvulsa, setSelectedContaAvulsa] = useState<ContaReceberAvulsa | null>(null)
  const [showPagamentoAvulsaModal, setShowPagamentoAvulsaModal] = useState(false)
  const [contaAvulsaParaPagar, setContaAvulsaParaPagar] = useState<ContaReceberAvulsa | null>(null)
  const [contaReceberForm, setContaReceberForm] = useState({
    cliente: '',
    cnpj_cliente: '',
    descricao: '',
    valor_total: '',
    data_vencimento: '',
    numero_documento: '',
    observacoes: '',
  })
  const [pagamentoAvulsaForm, setPagamentoAvulsaForm] = useState({
    valor_pago: '',
    forma_pagamento: '',
  })

  // Filters
  const [orcamentoFilter, setOrcamentoFilter] = useState<string>('todos')
  const [contasFilter, setContasFilter] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Modals
  const [showOrcamentoModal, setShowOrcamentoModal] = useState(false)
  const [showFinanceiroModal, setShowFinanceiroModal] = useState(false)
  const [showPagamentoModal, setShowPagamentoModal] = useState(false)
  const [showNotaFiscalModal, setShowNotaFiscalModal] = useState(false)
  const [showMovimentosModal, setShowMovimentosModal] = useState(false)
  const [selectedOP, setSelectedOP] = useState<OrdemProducao | null>(null)
  const [selectedConta, setSelectedConta] = useState<ContaReceber | null>(null)
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null)
  const [movimentosHistorico, setMovimentosHistorico] = useState<any[]>([])

  // Forms
  const [orcamentoForm, setOrcamentoForm] = useState({
    cliente: '',
    cnpj_cliente: '',
    telefone_cliente: '',
    email_cliente: '',
    observacoes: '',
  })
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItemForm[]>([
    { nome_peca: '', quantidade: '1', valor_unitario: '', observacoes: '' }
  ])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null)

  const [financeiroForm, setFinanceiroForm] = useState({
    valor_total: '',
    forma_pagamento: '',
    status_pagamento: 'pendente',
    data_vencimento: '',
    custos_extras: '',
    prejuizo_defeitos: '',
    observacoes: '',
    parcelado: false,
    num_parcelas: '1',
    primeira_data_parcela: '',
    intervalo_dias: '30',
  })
  const [parcelas, setParcelas] = useState<any[]>([])

  const [pagamentoForm, setPagamentoForm] = useState({
    valor_pago: '',
    data_pagamento: '',
    forma_pagamento: '',
  })

  const [notaFiscalForm, setNotaFiscalForm] = useState({
    numero_nota: '',
  })

  useEffect(() => {
    if (!hasPermission('financeiro')) {
      navigate('/')
      return
    }
    loadAllData()

    // Configura polling automático
    pollingRef.current = setInterval(() => {
      loadAllDataSilent()
    }, POLLING_INTERVAL)

    // Limpa o intervalo quando o componente desmonta
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  async function loadAllData() {
    try {
      setLoading(true)
      await Promise.all([
        loadDashboard(),
        loadOrcamentos(),
        loadContasReceber(),
        loadContasReceberAvulsas(),
        loadContasPagar(),
        loadPrevisaoFaturamento(),
        loadOPs(),
      ])
      setLastUpdate(new Date())
    } catch (error: any) {
      setToast({ message: 'Erro ao carregar dados', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Atualização silenciosa (sem loading)
  async function loadAllDataSilent() {
    try {
      await Promise.all([
        loadDashboard(),
        loadOrcamentos(),
        loadContasReceber(),
        loadContasReceberAvulsas(),
        loadContasPagar(),
        loadPrevisaoFaturamento(),
        loadOPs(),
      ])
      setLastUpdate(new Date())
    } catch (error: any) {
      console.warn('Erro na atualização automática:', error)
    }
  }

  // Atualização manual com indicador
  async function handleRefresh() {
    setIsRefreshing(true)
    await loadAllDataSilent()
    setIsRefreshing(false)
  }

  async function loadDashboard() {
    const data = await api.getDashboardFinanceiro()
    setDashboardData(data)
  }

  async function loadOrcamentos() {
    const data = await api.listOrcamentos()
    setOrcamentos(data)
  }

  async function handleDownloadPDF(orc: Orcamento) {
    try {
      const data = await api.getOrcamentoComItens(orc.id)
      exportOrcamentoPDF(data, data.itens)
      setToast({ message: 'PDF gerado com sucesso!', type: 'success' })
    } catch {
      setToast({ message: 'Erro ao gerar PDF', type: 'error' })
    }
  }

  async function handleDownloadDOCX(orc: Orcamento) {
    try {
      const data = await api.getOrcamentoComItens(orc.id)
      await exportOrcamentoDOCX(data, data.itens)
      setToast({ message: 'Documento Word gerado com sucesso!', type: 'success' })
    } catch {
      setToast({ message: 'Erro ao gerar documento Word', type: 'error' })
    }
  }

  async function loadContasReceber() {
    const data = await api.getContasReceber()
    setContasReceber(data)
  }

  async function loadContasReceberAvulsas() {
    try {
      const data = await api.listContasReceberAvulsas()
      setContasReceberAvulsas(data)
    } catch (error) {
      console.warn('Erro ao carregar contas avulsas:', error)
    }
  }

  // Handlers - Contas a Receber Avulsas
  function abrirNovaContaReceber() {
    setSelectedContaAvulsa(null)
    setContaReceberForm({ cliente: '', cnpj_cliente: '', descricao: '', valor_total: '', data_vencimento: '', numero_documento: '', observacoes: '' })
    setShowContaReceberModal(true)
  }

  function abrirEditarContaAvulsa(conta: ContaReceberAvulsa) {
    setSelectedContaAvulsa(conta)
    setContaReceberForm({
      cliente: conta.cliente,
      cnpj_cliente: conta.cnpj_cliente || '',
      descricao: conta.descricao,
      valor_total: conta.valor_total.toString(),
      data_vencimento: conta.data_vencimento,
      numero_documento: conta.numero_documento || '',
      observacoes: conta.observacoes || '',
    })
    setShowContaReceberModal(true)
  }

  async function handleSalvarContaReceberAvulsa(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (selectedContaAvulsa) {
        await api.updateContaReceberAvulsa(selectedContaAvulsa.id, {
          cliente: contaReceberForm.cliente,
          cnpj_cliente: contaReceberForm.cnpj_cliente || null,
          descricao: contaReceberForm.descricao,
          valor_total: parseFloat(contaReceberForm.valor_total),
          data_vencimento: contaReceberForm.data_vencimento,
          numero_documento: contaReceberForm.numero_documento || null,
          observacoes: contaReceberForm.observacoes || null,
        }, user?.id)
        setToast({ message: 'Conta atualizada com sucesso!', type: 'success' })
      } else {
        await api.createContaReceberAvulsa({
          cliente: contaReceberForm.cliente,
          cnpj_cliente: contaReceberForm.cnpj_cliente || undefined,
          descricao: contaReceberForm.descricao,
          valor_total: parseFloat(contaReceberForm.valor_total),
          data_vencimento: contaReceberForm.data_vencimento,
          numero_documento: contaReceberForm.numero_documento || undefined,
          observacoes: contaReceberForm.observacoes || undefined,
        }, user?.id)
        setToast({ message: 'Conta criada com sucesso!', type: 'success' })
      }
      setShowContaReceberModal(false)
      setSelectedContaAvulsa(null)
      loadContasReceberAvulsas()
    } catch (error: any) {
      setToast({ message: 'Erro ao salvar conta', type: 'error' })
    }
  }

  function abrirPagamentoAvulsa(conta: ContaReceberAvulsa) {
    setContaAvulsaParaPagar(conta)
    setPagamentoAvulsaForm({
      valor_pago: (conta.valor_total - conta.valor_pago).toString(),
      forma_pagamento: conta.forma_pagamento || '',
    })
    setShowPagamentoAvulsaModal(true)
  }

  async function handleRegistrarPagamentoAvulso(e: React.FormEvent) {
    e.preventDefault()
    if (!contaAvulsaParaPagar) return
    try {
      await api.registrarRecebimentoAvulso(
        contaAvulsaParaPagar.id,
        parseFloat(pagamentoAvulsaForm.valor_pago),
        pagamentoAvulsaForm.forma_pagamento,
        user?.id
      )
      setToast({ message: 'Pagamento registrado!', type: 'success' })
      setShowPagamentoAvulsaModal(false)
      setContaAvulsaParaPagar(null)
      loadContasReceberAvulsas()
    } catch (error: any) {
      setToast({ message: 'Erro ao registrar pagamento', type: 'error' })
    }
  }

  async function handleExcluirContaAvulsa(id: string) {
    try {
      await api.deleteContaReceberAvulsa(id)
      setToast({ message: 'Conta excluída!', type: 'success' })
      loadContasReceberAvulsas()
    } catch (error: any) {
      setToast({ message: 'Erro ao excluir conta', type: 'error' })
    }
  }

  async function loadPrevisaoFaturamento() {
    const data = await api.getPrevisaoFaturamento()
    setPrevisaoFaturamento(data)
  }

  async function loadContasPagar() {
    const [contas, dashboard] = await Promise.all([
      api.listContasPagar(),
      api.getDashboardContasPagar(),
    ])
    setContasPagar(contas)
    setDashboardContasPagar(dashboard)
  }

  async function loadOPs() {
    const opsData = await api.listOrdensProducao()
    setOps(opsData)

    const financeirosMap = new Map<string, FinanceiroType>()
    for (const op of opsData) {
      try {
        const fin = await api.getFinanceiro(op.id)
        if (fin) {
          financeirosMap.set(op.id, fin)
        }
      } catch (error) {
        // Financeiro não encontrado para esta OP
      }
    }
    setFinanceiros(financeirosMap)
  }

  // Handlers - Orçamentos

  // Buscar cliente pelo CNPJ
  async function handleBuscarClientePorCnpj() {
    if (!orcamentoForm.cnpj_cliente || orcamentoForm.cnpj_cliente.length < 11) return

    setBuscandoCliente(true)
    try {
      const cliente = await api.buscarClientePorDocumento(orcamentoForm.cnpj_cliente)
      if (cliente) {
        setClienteEncontrado(cliente)
        setOrcamentoForm(prev => ({
          ...prev,
          cliente: cliente.nome,
          telefone_cliente: cliente.telefone || cliente.celular || '',
          email_cliente: cliente.email || '',
        }))
        setToast({ message: 'Cliente encontrado!', type: 'success' })
      } else {
        setClienteEncontrado(null)
        setToast({ message: 'Cliente não encontrado com este CNPJ/CPF', type: 'error' })
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error)
    } finally {
      setBuscandoCliente(false)
    }
  }

  // Calcular valor total dos itens
  function calcularValorTotalItens(): number {
    return orcamentoItens.reduce((total, item) => {
      const qtd = parseInt(item.quantidade) || 0
      const valor = parseFloat(item.valor_unitario) || 0
      return total + (qtd * valor)
    }, 0)
  }

  // Adicionar item ao orçamento
  function adicionarItemOrcamento() {
    setOrcamentoItens(prev => [...prev, { nome_peca: '', quantidade: '1', valor_unitario: '', observacoes: '' }])
  }

  // Remover item do orçamento
  function removerItemOrcamento(index: number) {
    if (orcamentoItens.length <= 1) {
      setToast({ message: 'O orçamento deve ter pelo menos um item', type: 'error' })
      return
    }
    setOrcamentoItens(prev => prev.filter((_, i) => i !== index))
  }

  // Atualizar item do orçamento
  function atualizarItemOrcamento(index: number, campo: keyof OrcamentoItemForm, valor: string) {
    setOrcamentoItens(prev => prev.map((item, i) =>
      i === index ? { ...item, [campo]: valor } : item
    ))
  }

  async function handleSalvarOrcamento(e: React.FormEvent) {
    e.preventDefault()

    // Validar itens
    const itensValidos = orcamentoItens.filter(item =>
      item.nome_peca.trim() && parseInt(item.quantidade) > 0 && parseFloat(item.valor_unitario) > 0
    )

    if (itensValidos.length === 0) {
      setToast({ message: 'Adicione pelo menos um item válido ao orçamento', type: 'error' })
      return
    }

    const itensParaSalvar = itensValidos.map(item => ({
      nome_peca: item.nome_peca.trim(),
      quantidade: parseInt(item.quantidade),
      valor_unitario: parseFloat(item.valor_unitario),
      observacoes: item.observacoes || undefined,
    }))

    try {
      if (selectedOrcamento) {
        // Editar orçamento existente
        await api.updateOrcamentoComItens(
          selectedOrcamento.id,
          {
            cliente: orcamentoForm.cliente,
            cnpj_cliente: orcamentoForm.cnpj_cliente || null,
            telefone_cliente: orcamentoForm.telefone_cliente || null,
            email_cliente: orcamentoForm.email_cliente || null,
            cliente_id: clienteEncontrado?.id || null,
            observacoes: orcamentoForm.observacoes || null,
            updated_by: user?.id || null,
          } as any,
          itensParaSalvar
        )
        setToast({ message: 'Orçamento atualizado com sucesso!', type: 'success' })
      } else {
        // Criar novo orçamento
        await api.createOrcamentoComItens(
          {
            cliente: orcamentoForm.cliente,
            cnpj_cliente: orcamentoForm.cnpj_cliente || null,
            telefone_cliente: orcamentoForm.telefone_cliente || null,
            email_cliente: orcamentoForm.email_cliente || null,
            cliente_id: clienteEncontrado?.id || null,
            observacoes: orcamentoForm.observacoes || null,
            created_by: user?.id || '',
          } as any,
          itensParaSalvar
        )
        setToast({ message: 'Orçamento criado com sucesso!', type: 'success' })
      }
      setShowOrcamentoModal(false)
      setSelectedOrcamento(null)
      resetOrcamentoForm()
      loadOrcamentos()
    } catch (error: any) {
      console.error('Erro ao salvar orçamento:', error)
      setToast({ message: 'Erro ao salvar orçamento', type: 'error' })
    }
  }

  async function abrirEditarOrcamento(orcamento: Orcamento) {
    setSelectedOrcamento(orcamento)
    setOrcamentoForm({
      cliente: orcamento.cliente,
      cnpj_cliente: (orcamento as any).cnpj_cliente || '',
      telefone_cliente: (orcamento as any).telefone_cliente || '',
      email_cliente: (orcamento as any).email_cliente || '',
      observacoes: orcamento.observacoes || '',
    })
    setClienteEncontrado(null)

    // Carregar itens do orçamento
    try {
      const itens = await api.getOrcamentoItens(orcamento.id)
      if (itens.length > 0) {
        setOrcamentoItens(itens.map(item => ({
          id: item.id,
          nome_peca: item.nome_peca,
          quantidade: item.quantidade.toString(),
          valor_unitario: item.valor_unitario.toString(),
          observacoes: item.observacoes || '',
        })))
      } else {
        // Fallback para orçamentos antigos (sem itens)
        setOrcamentoItens([{
          nome_peca: orcamento.nome_peca || '',
          quantidade: (orcamento.quantidade || 1).toString(),
          valor_unitario: orcamento.quantidade
            ? (orcamento.valor_estimado / orcamento.quantidade).toFixed(2)
            : orcamento.valor_estimado.toString(),
          observacoes: '',
        }])
      }
    } catch (error) {
      // Tabela de itens pode não existir ainda
      setOrcamentoItens([{
        nome_peca: orcamento.nome_peca || '',
        quantidade: (orcamento.quantidade || 1).toString(),
        valor_unitario: orcamento.quantidade
          ? (orcamento.valor_estimado / orcamento.quantidade).toFixed(2)
          : orcamento.valor_estimado.toString(),
        observacoes: '',
      }])
    }

    setShowOrcamentoModal(true)
  }

  function abrirNovoOrcamento() {
    setSelectedOrcamento(null)
    setClienteEncontrado(null)
    resetOrcamentoForm()
    setShowOrcamentoModal(true)
  }

  async function handleEnviarOrcamento(id: string) {
    try {
      await api.enviarOrcamento(id)
      setToast({ message: 'Orçamento marcado como enviado!', type: 'success' })
      loadOrcamentos()
    } catch (error: any) {
      setToast({ message: 'Erro ao enviar orçamento', type: 'error' })
    }
  }

  async function handleAprovarOrcamento(id: string) {
    try {
      await api.aprovarOrcamento(id)
      setToast({ message: 'Orçamento aprovado!', type: 'success' })
      loadOrcamentos()
    } catch (error: any) {
      setToast({ message: 'Erro ao aprovar orçamento', type: 'error' })
    }
  }

  async function handleReprovarOrcamento(id: string) {
    try {
      await api.reprovarOrcamento(id)
      setToast({ message: 'Orçamento reprovado!', type: 'success' })
      loadOrcamentos()
    } catch (error: any) {
      setToast({ message: 'Erro ao reprovar orçamento', type: 'error' })
    }
  }

  async function handleConverterOrcamento(orcamento: Orcamento) {
    try {
      // Carregar itens do orçamento
      let itens: OrcamentoItem[] = []
      try {
        itens = await api.getOrcamentoItens(orcamento.id)
      } catch {
        // Tabela pode não existir
      }

      // Determinar nome da peça e quantidade
      let nomePeca = orcamento.nome_peca || ''
      let quantidadeTotal = orcamento.quantidade || 0
      const valorTotal = orcamento.valor_total || orcamento.valor_estimado

      if (itens.length > 0) {
        // Se tem múltiplos itens, concatenar os nomes
        if (itens.length === 1) {
          nomePeca = itens[0].nome_peca
          quantidadeTotal = itens[0].quantidade
        } else {
          nomePeca = itens.map(i => `${i.nome_peca} (${i.quantidade})`).join(', ')
          quantidadeTotal = itens.reduce((sum, i) => sum + i.quantidade, 0)
        }
      }

      // Criar nova OP a partir do orçamento
      const codigo = await api.gerarCodigoOP()
      const op = await api.createOrdemProducao({
        codigo,
        tipo: 'encomenda',
        cliente: orcamento.cliente,
        cliente_id: (orcamento as any).cliente_id || null,
        nome_peca: nomePeca,
        quantidade_total: quantidadeTotal,
        preco_servico: valorTotal,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'criada',
        preparacao_maquina: '',
        created_by: user?.id || '',
        aprovada: false,
        nota_fiscal_emitida: false,
      })

      // Marcar orçamento como convertido
      await api.converterOrcamentoEmOP(orcamento.id, op.id)

      setToast({ message: 'Orçamento convertido em OP com sucesso!', type: 'success' })
      loadOrcamentos()
      loadOPs()
    } catch (error: any) {
      setToast({ message: 'Erro ao converter orçamento', type: 'error' })
    }
  }

  // Handlers - Financeiro/Pagamentos
  async function handleSalvarFinanceiro(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOP) return

    try {
      const financeiro = financeiros.get(selectedOP.id)

      const numParcelas = financeiroForm.parcelado ? parseInt(financeiroForm.num_parcelas) || 1 : 1

      const finData = {
        valor_total: parseFloat(financeiroForm.valor_total),
        forma_pagamento: financeiroForm.forma_pagamento,
        status_pagamento: financeiroForm.status_pagamento as any,
        data_vencimento: financeiroForm.data_vencimento || null,
        custos_extras: parseFloat(financeiroForm.custos_extras) || 0,
        prejuizo_defeitos: parseFloat(financeiroForm.prejuizo_defeitos) || 0,
        observacoes: financeiroForm.observacoes || null,
        numero_parcelas: numParcelas,
      }

      let financeiroId: string

      if (financeiro) {
        await api.updateFinanceiro(financeiro.id, finData)
        financeiroId = financeiro.id
      } else {
        const created = await api.createFinanceiro({
          op_id: selectedOP.id,
          ...finData,
          valor_pago: 0,
          parcela_atual: 1,
        })
        financeiroId = created.id
      }

      // Create/recreate parcelas if parcelado
      if (financeiroForm.parcelado && numParcelas > 1 && financeiroForm.primeira_data_parcela) {
        await api.deleteParcelasByFinanceiro(financeiroId)
        await api.createParcelas(
          financeiroId,
          selectedOP.id,
          parseFloat(financeiroForm.valor_total),
          numParcelas,
          financeiroForm.primeira_data_parcela,
          parseInt(financeiroForm.intervalo_dias) || 30,
        )
      }

      setToast({ message: 'Dados financeiros salvos!', type: 'success' })
      setShowFinanceiroModal(false)
      setSelectedOP(null)
      loadAllData()
    } catch (error: any) {
      setToast({ message: 'Erro ao salvar dados financeiros', type: 'error' })
    }
  }

  async function handleRegistrarPagamento(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedConta) return

    try {
      let financeiro = financeiros.get(selectedConta.id)
      const valorPago = parseFloat(pagamentoForm.valor_pago)

      if (!financeiro) {
        // Criar financeiro se não existir
        console.log('Criando novo financeiro para OP:', selectedConta.id)
        const novoFinanceiro = await api.createFinanceiro({
          op_id: selectedConta.id,
          valor_total: selectedConta.valor_total,
          valor_pago: 0,
          forma_pagamento: pagamentoForm.forma_pagamento,
          status_pagamento: 'pendente',
          numero_parcelas: 1,
          parcela_atual: 1,
          custos_extras: 0,
          prejuizo_defeitos: 0,
        })
        console.log('Financeiro criado:', novoFinanceiro)
        financeiro = novoFinanceiro
      }

      // Usar método direto que atualiza a tabela financeiro
      console.log('Registrando pagamento no financeiro:', financeiro.id, 'Valor:', valorPago)
      await api.registrarPagamento(
        financeiro.id,
        valorPago,
        pagamentoForm.data_pagamento,
        pagamentoForm.forma_pagamento
      )

      setToast({ message: 'Pagamento registrado com sucesso!', type: 'success' })
      setShowPagamentoModal(false)
      setSelectedConta(null)
      resetPagamentoForm()
      loadAllData()
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error)
      const mensagem = error?.message || 'Erro ao registrar pagamento'
      setToast({ message: mensagem, type: 'error' })
    }
  }

  // Handler - Nota Fiscal
  async function handleEmitirNotaFiscal(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOP) return

    try {
      await api.emitirNotaFiscal(selectedOP.id, notaFiscalForm.numero_nota)
      setToast({ message: 'Nota fiscal registrada com sucesso!', type: 'success' })
      setShowNotaFiscalModal(false)
      setSelectedOP(null)
      setNotaFiscalForm({ numero_nota: '' })
      loadAllData()
    } catch (error: any) {
      setToast({ message: 'Erro ao registrar nota fiscal', type: 'error' })
    }
  }

  // Helpers
  function resetOrcamentoForm() {
    setOrcamentoForm({
      cliente: '',
      cnpj_cliente: '',
      telefone_cliente: '',
      email_cliente: '',
      observacoes: '',
    })
    setOrcamentoItens([{ nome_peca: '', quantidade: '1', valor_unitario: '', observacoes: '' }])
    setClienteEncontrado(null)
  }

  function resetPagamentoForm() {
    setPagamentoForm({
      valor_pago: '',
      data_pagamento: '',
      forma_pagamento: '',
    })
  }

  function abrirFinanceiroModal(op: OrdemProducao) {
    setSelectedOP(op)
    const financeiro = financeiros.get(op.id)

    if (financeiro) {
      setFinanceiroForm({
        valor_total: financeiro.valor_total.toString(),
        forma_pagamento: financeiro.forma_pagamento || '',
        status_pagamento: financeiro.status_pagamento || 'pendente',
        data_vencimento: financeiro.data_vencimento || '',
        custos_extras: financeiro.custos_extras?.toString() || '0',
        prejuizo_defeitos: financeiro.prejuizo_defeitos?.toString() || '0',
        observacoes: financeiro.observacoes || '',
        parcelado: financeiro.numero_parcelas > 1,
        num_parcelas: financeiro.numero_parcelas?.toString() || '1',
        primeira_data_parcela: financeiro.data_vencimento || '',
        intervalo_dias: '30',
      })
      // Load existing parcelas
      api.getParcelasByFinanceiro(financeiro.id).then(setParcelas).catch(() => setParcelas([]))
    } else {
      setFinanceiroForm({
        valor_total: op.preco_servico.toString(),
        forma_pagamento: '',
        status_pagamento: 'pendente',
        data_vencimento: '',
        custos_extras: '0',
        prejuizo_defeitos: '0',
        observacoes: '',
        parcelado: false,
        num_parcelas: '1',
        primeira_data_parcela: '',
        intervalo_dias: '30',
      })
      setParcelas([])
    }

    setShowFinanceiroModal(true)
  }

  function abrirPagamentoModal(conta: ContaReceber) {
    setSelectedConta(conta)
    setPagamentoForm({
      valor_pago: conta.valor_pendente.toString(),
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: conta.forma_pagamento || '',
    })
    setShowPagamentoModal(true)
  }

  function abrirNotaFiscalModal(op: OrdemProducao | PrevisaoFaturamento) {
    setSelectedOP(op as OrdemProducao)
    setNotaFiscalForm({ numero_nota: '' })
    setShowNotaFiscalModal(true)
  }

  function abrirNotaFiscalExterna() {
    window.open('https://pontagrossa.iss.elotech.com.br/emissao-nfse', '_blank')
  }

  // V3: Abrir modal de histórico de movimentos
  async function abrirMovimentosModal(op: OrdemProducao) {
    setSelectedOP(op)
    try {
      const movimentos = await api.getMovimentosOP(op.id)
      setMovimentosHistorico(movimentos)
    } catch (error) {
      setMovimentosHistorico([])
      console.warn('Erro ao carregar movimentos:', error)
    }
    setShowMovimentosModal(true)
  }

  function getOrcamentoStatusColor(status: OrcamentoStatus): string {
    const colors: Record<OrcamentoStatus, string> = {
      rascunho: 'bg-gray-100 text-gray-700 dark:text-neutral-300 border-gray-300',
      aberto: 'bg-blue-100 text-blue-700 border-blue-300',
      enviado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      aprovado: 'bg-green-100 text-green-700 border-green-300',
      reprovado: 'bg-red-100 text-red-700 border-red-300',
      convertido: 'bg-purple-100 text-purple-700 border-purple-300',
      cancelado: 'bg-gray-100 text-gray-500 dark:text-neutral-500 border-gray-300',
    }
    return colors[status] || colors.rascunho
  }

  function getOrcamentoStatusLabel(status: OrcamentoStatus): string {
    const labels: Record<OrcamentoStatus, string> = {
      rascunho: 'Rascunho',
      aberto: 'Aberto',
      enviado: 'Enviado',
      aprovado: 'Aprovado',
      reprovado: 'Reprovado',
      convertido: 'Convertido em OP',
      cancelado: 'Cancelado',
    }
    return labels[status] || status
  }

  function getSituacaoColor(situacao: string): string {
    const colors: Record<string, string> = {
      pago: 'bg-green-100 text-green-700 border-green-500',
      pendente: 'bg-yellow-100 text-yellow-700 border-yellow-500',
      atrasado: 'bg-red-100 text-red-700 border-red-500',
      parcial: 'bg-blue-100 text-blue-700 border-blue-500',
    }
    return colors[situacao] || colors.pendente
  }

  // Filter data
  const filteredOrcamentos = orcamentos.filter((o) => {
    if (orcamentoFilter !== 'todos' && o.status !== orcamentoFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return o.cliente.toLowerCase().includes(term) || (o.nome_peca || '').toLowerCase().includes(term)
    }
    return true
  })

  const filteredContas = contasReceber.filter((c) => {
    if (contasFilter !== 'todos' && c.situacao_financeira !== contasFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        c.cliente.toLowerCase().includes(term) ||
        c.codigo.toLowerCase().includes(term) ||
        c.nome_peca.toLowerCase().includes(term)
      )
    }
    return true
  })

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-neutral-400 text-lg">Carregando...</p>
        </div>
      </Layout>
    )
  }

  // Tab Navigation
  const tabs = [
    { id: 'dashboard', label: 'Visão Geral', icon: BarChart3 },
    { id: 'calendario', label: 'Calendário', icon: Calendar },
    { id: 'orcamentos', label: 'Orçamentos', icon: FileText },
    { id: 'contas', label: 'Contas a Receber', icon: Wallet },
    { id: 'despesas', label: 'Contas a Pagar', icon: CreditCard },
    { id: 'ops', label: 'OPs e Financeiro', icon: Receipt },
    { id: 'previsao', label: 'Faturamento', icon: Calendar },
    { id: 'ponto', label: 'Ponto Eletrônico', icon: Users },
    { id: 'relatorios', label: 'Relatórios', icon: Printer },
  ]

  return (
    <Layout>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-neutral-100">Financeiro</h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-1">Gestão financeira completa</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Indicador de última atualização */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-500">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                title="Atualizar agora"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              <span>Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
            </div>
            <Button variant="success" size="lg" onClick={abrirNotaFiscalExterna}>
              <FileText size={24} className="inline mr-2" />
              Emitir NF (Site)
              <ExternalLink size={16} className="inline ml-2" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center px-6 py-4 text-lg font-semibold border-b-4 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300 hover:border-gray-300'
                }`}
              >
                <tab.icon size={20} className="mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <DashboardTab data={dashboardData} despesasData={dashboardContasPagar} onTabChange={setActiveTab} />
        )}

        {activeTab === 'calendario' && (
          <CalendarioTab />
        )}

        {activeTab === 'orcamentos' && (
          <OrcamentosTab
            orcamentos={filteredOrcamentos}
            filter={orcamentoFilter}
            setFilter={setOrcamentoFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onNovo={abrirNovoOrcamento}
            onEditar={abrirEditarOrcamento}
            onEnviar={handleEnviarOrcamento}
            onAprovar={handleAprovarOrcamento}
            onReprovar={handleReprovarOrcamento}
            onConverter={handleConverterOrcamento}
            onDownloadPDF={handleDownloadPDF}
            onDownloadDOCX={handleDownloadDOCX}
            getStatusColor={getOrcamentoStatusColor}
            getStatusLabel={getOrcamentoStatusLabel}
          />
        )}

        {activeTab === 'contas' && (
          <ContasReceberTab
            contas={filteredContas}
            contasAvulsas={contasReceberAvulsas}
            filter={contasFilter}
            setFilter={setContasFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onPagamento={abrirPagamentoModal}
            onNovaAvulsa={abrirNovaContaReceber}
            onEditarAvulsa={abrirEditarContaAvulsa}
            onPagamentoAvulsa={abrirPagamentoAvulsa}
            onExcluirAvulsa={handleExcluirContaAvulsa}
            getSituacaoColor={getSituacaoColor}
          />
        )}

        {activeTab === 'ops' && (
          <OPsFinanceiroTab
            ops={ops}
            financeiros={financeiros}
            onEditar={abrirFinanceiroModal}
            onVerHistorico={abrirMovimentosModal}
          />
        )}

        {activeTab === 'previsao' && (
          <PrevisaoFaturamentoTab
            previsoes={previsaoFaturamento}
            onEmitirNota={abrirNotaFiscalModal}
          />
        )}

        {activeTab === 'despesas' && (
          <DespesasTab
            contas={contasPagar}
            dashboard={dashboardContasPagar}
            onReload={loadContasPagar}
            userId={user?.id}
          />
        )}

        {activeTab === 'relatorios' && (
          <RelatoriosTab
            ops={ops}
            financeiros={financeiros}
            contasReceber={contasReceber}
            dashboardData={dashboardData}
          />
        )}

        {activeTab === 'ponto' && (
          <PontoTab userId={user?.id} />
        )}
      </div>

      {/* Modal - Nova/Editar Conta a Receber Avulsa */}
      <Modal
        isOpen={showContaReceberModal}
        onClose={() => { setShowContaReceberModal(false); setSelectedContaAvulsa(null) }}
        title={selectedContaAvulsa ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}
      >
        <form onSubmit={handleSalvarContaReceberAvulsa} className="space-y-4">
          <Input
            label="Cliente *"
            value={contaReceberForm.cliente}
            onChange={(e) => setContaReceberForm({ ...contaReceberForm, cliente: e.target.value })}
            required
          />
          <Input
            label="CNPJ/CPF do Cliente"
            value={contaReceberForm.cnpj_cliente}
            onChange={(e) => setContaReceberForm({ ...contaReceberForm, cnpj_cliente: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
          <Input
            label="Descrição do Serviço/Produto *"
            value={contaReceberForm.descricao}
            onChange={(e) => setContaReceberForm({ ...contaReceberForm, descricao: e.target.value })}
            placeholder="Ex: Usinagem de peças, Serviço de torno..."
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor Total (R$) *"
              type="number"
              step="0.01"
              min="0.01"
              value={contaReceberForm.valor_total}
              onChange={(e) => setContaReceberForm({ ...contaReceberForm, valor_total: e.target.value })}
              required
            />
            <Input
              label="Data de Vencimento *"
              type="date"
              value={contaReceberForm.data_vencimento}
              onChange={(e) => setContaReceberForm({ ...contaReceberForm, data_vencimento: e.target.value })}
              required
            />
          </div>
          <Input
            label="Número do Documento / NF"
            value={contaReceberForm.numero_documento}
            onChange={(e) => setContaReceberForm({ ...contaReceberForm, numero_documento: e.target.value })}
            placeholder="(Opcional)"
          />
          <Textarea
            label="Observações"
            value={contaReceberForm.observacoes}
            onChange={(e) => setContaReceberForm({ ...contaReceberForm, observacoes: e.target.value })}
          />
          <Button type="submit" fullWidth size="lg">
            {selectedContaAvulsa ? 'Salvar Alterações' : 'Criar Conta a Receber'}
          </Button>
        </form>
      </Modal>

      {/* Modal - Registrar Recebimento Avulso */}
      <Modal
        isOpen={showPagamentoAvulsaModal}
        onClose={() => { setShowPagamentoAvulsaModal(false); setContaAvulsaParaPagar(null) }}
        title={`Registrar Recebimento - ${contaAvulsaParaPagar?.cliente}`}
      >
        <form onSubmit={handleRegistrarPagamentoAvulso} className="space-y-4">
          {contaAvulsaParaPagar && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-neutral-400">Descrição: <strong>{contaAvulsaParaPagar.descricao}</strong></p>
              <p className="text-sm text-gray-600 dark:text-neutral-400">Valor total: <strong>{formatCurrency(contaAvulsaParaPagar.valor_total)}</strong></p>
              <p className="text-sm text-gray-600 dark:text-neutral-400">Já recebido: <strong>{formatCurrency(contaAvulsaParaPagar.valor_pago)}</strong></p>
              <p className="text-sm font-semibold text-orange-600">Pendente: {formatCurrency(contaAvulsaParaPagar.valor_total - contaAvulsaParaPagar.valor_pago)}</p>
            </div>
          )}
          <Input
            label="Valor Recebido (R$)"
            type="number"
            step="0.01"
            min="0.01"
            value={pagamentoAvulsaForm.valor_pago}
            onChange={(e) => setPagamentoAvulsaForm({ ...pagamentoAvulsaForm, valor_pago: e.target.value })}
            required
          />
          <Input
            label="Forma de Pagamento"
            value={pagamentoAvulsaForm.forma_pagamento}
            onChange={(e) => setPagamentoAvulsaForm({ ...pagamentoAvulsaForm, forma_pagamento: e.target.value })}
            placeholder="PIX, Boleto, Transferência..."
          />
          <Button type="submit" fullWidth size="lg" variant="success">
            Confirmar Recebimento
          </Button>
        </form>
      </Modal>

      {/* Modal - Novo/Editar Orçamento */}
      <Modal
        isOpen={showOrcamentoModal}
        onClose={() => {
          setShowOrcamentoModal(false)
          setSelectedOrcamento(null)
          resetOrcamentoForm()
        }}
        title={selectedOrcamento ? 'Editar Orçamento' : 'Novo Orçamento'}
        size="lg"
      >
        <form onSubmit={handleSalvarOrcamento} className="space-y-6">
          {/* Seção: Dados do Cliente */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-2">
              <Users size={18} />
              Dados do Cliente
            </h3>

            {/* CNPJ com busca */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="CNPJ/CPF do Cliente"
                  value={orcamentoForm.cnpj_cliente}
                  onChange={(e) => setOrcamentoForm({ ...orcamentoForm, cnpj_cliente: e.target.value })}
                  placeholder="00.000.000/0000-00 ou 000.000.000-00"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBuscarClientePorCnpj}
                  disabled={buscandoCliente || !orcamentoForm.cnpj_cliente}
                >
                  {buscandoCliente ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                </Button>
              </div>
            </div>

            {clienteEncontrado && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                Cliente encontrado: {clienteEncontrado.nome}
              </div>
            )}

            <Input
              label="Nome do Cliente"
              value={orcamentoForm.cliente}
              onChange={(e) => setOrcamentoForm({ ...orcamentoForm, cliente: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Telefone"
                value={orcamentoForm.telefone_cliente}
                onChange={(e) => setOrcamentoForm({ ...orcamentoForm, telefone_cliente: e.target.value })}
                placeholder="(00) 00000-0000"
              />
              <Input
                label="E-mail"
                type="email"
                value={orcamentoForm.email_cliente}
                onChange={(e) => setOrcamentoForm({ ...orcamentoForm, email_cliente: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          {/* Seção: Itens do Orçamento */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-2">
                <ClipboardList size={18} />
                Itens do Orçamento
              </h3>
              <Button type="button" variant="secondary" size="sm" onClick={adicionarItemOrcamento}>
                <Plus size={16} className="mr-1" />
                Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {orcamentoItens.map((item, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">Item {index + 1}</span>
                    {orcamentoItens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerItemOrcamento(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <Input
                    label="Nome da Peça"
                    value={item.nome_peca}
                    onChange={(e) => atualizarItemOrcamento(index, 'nome_peca', e.target.value)}
                    required
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Quantidade"
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) => atualizarItemOrcamento(index, 'quantidade', e.target.value)}
                      required
                    />
                    <Input
                      label="Valor Unitário (R$)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.valor_unitario}
                      onChange={(e) => atualizarItemOrcamento(index, 'valor_unitario', e.target.value)}
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Subtotal</label>
                      <div className="h-10 flex items-center px-3 bg-gray-100 rounded-lg text-gray-700 dark:text-neutral-300 font-medium">
                        {formatCurrency(
                          (parseInt(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0)
                        )}
                      </div>
                    </div>
                  </div>

                  <Input
                    label="Observações do Item"
                    value={item.observacoes}
                    onChange={(e) => atualizarItemOrcamento(index, 'observacoes', e.target.value)}
                    placeholder="(Opcional)"
                  />
                </div>
              ))}
            </div>

            {/* Total Geral */}
            <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
              <span className="text-lg font-semibold text-blue-800">Valor Total do Orçamento:</span>
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(calcularValorTotalItens())}
              </span>
            </div>
          </div>

          {/* Seção: Observações Gerais */}
          <Textarea
            label="Observações Gerais"
            value={orcamentoForm.observacoes}
            onChange={(e) => setOrcamentoForm({ ...orcamentoForm, observacoes: e.target.value })}
            placeholder="Condições de pagamento, prazo de entrega, etc."
          />

          <Button type="submit" fullWidth size="lg">
            {selectedOrcamento ? 'Salvar Alterações' : 'Criar Orçamento'}
          </Button>
        </form>
      </Modal>

      {/* Modal - Dados Financeiros */}
      <Modal
        isOpen={showFinanceiroModal}
        onClose={() => setShowFinanceiroModal(false)}
        title={`Dados Financeiros - ${selectedOP?.codigo}`}
      >
        <form onSubmit={handleSalvarFinanceiro} className="space-y-4">
          <Input
            label="Valor Total (R$)"
            type="number"
            step="0.01"
            value={financeiroForm.valor_total}
            onChange={(e) => setFinanceiroForm({ ...financeiroForm, valor_total: e.target.value })}
            required
          />
          <Input
            label="Forma de Pagamento"
            value={financeiroForm.forma_pagamento}
            onChange={(e) =>
              setFinanceiroForm({ ...financeiroForm, forma_pagamento: e.target.value })
            }
            placeholder="Ex: Boleto, PIX, Cartão"
          />
          <Select
            label="Status do Pagamento"
            options={[
              { value: 'pendente', label: 'Pendente' },
              { value: 'parcial', label: 'Parcial' },
              { value: 'pago', label: 'Pago' },
              { value: 'atrasado', label: 'Atrasado' },
            ]}
            value={financeiroForm.status_pagamento}
            onChange={(e) =>
              setFinanceiroForm({ ...financeiroForm, status_pagamento: e.target.value })
            }
          />
          <Input
            label="Data de Vencimento"
            type="date"
            value={financeiroForm.data_vencimento}
            onChange={(e) =>
              setFinanceiroForm({ ...financeiroForm, data_vencimento: e.target.value })
            }
          />
          <Input
            label="Custos Extras (R$)"
            type="number"
            step="0.01"
            value={financeiroForm.custos_extras}
            onChange={(e) =>
              setFinanceiroForm({ ...financeiroForm, custos_extras: e.target.value })
            }
          />
          <Input
            label="Prejuízo por Defeitos (R$)"
            type="number"
            step="0.01"
            value={financeiroForm.prejuizo_defeitos}
            onChange={(e) =>
              setFinanceiroForm({ ...financeiroForm, prejuizo_defeitos: e.target.value })
            }
          />
          {/* Parcelamento */}
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={financeiroForm.parcelado}
                onChange={(e) => setFinanceiroForm({ ...financeiroForm, parcelado: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <span className="font-semibold text-blue-800">Parcelado (Boleto)</span>
            </label>

            {financeiroForm.parcelado && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Número de Parcelas"
                  type="number"
                  min="2"
                  value={financeiroForm.num_parcelas}
                  onChange={(e) => setFinanceiroForm({ ...financeiroForm, num_parcelas: e.target.value })}
                  required
                />
                <Input
                  label="1ª Parcela - Vencimento"
                  type="date"
                  value={financeiroForm.primeira_data_parcela}
                  onChange={(e) => setFinanceiroForm({ ...financeiroForm, primeira_data_parcela: e.target.value })}
                  required
                />
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-blue-800 mb-1">Intervalo entre parcelas</label>
                  <div className="flex gap-2 flex-wrap">
                    {[20, 30, 45, 60].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFinanceiroForm({ ...financeiroForm, intervalo_dias: d.toString() })}
                        className={`px-3 py-2 rounded border-2 text-sm font-medium transition ${
                          financeiroForm.intervalo_dias === d.toString()
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 hover:border-blue-400 dark:text-neutral-200'
                        }`}
                      >
                        {d} dias
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={financeiroForm.intervalo_dias}
                      onChange={(e) => setFinanceiroForm({ ...financeiroForm, intervalo_dias: e.target.value })}
                      className="w-24 px-3 py-2 rounded border-2 border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-sm"
                      placeholder="Dias"
                    />
                  </div>
                </div>
                {financeiroForm.valor_total && parseInt(financeiroForm.num_parcelas) > 1 && financeiroForm.primeira_data_parcela && (
                  <div className="col-span-2 text-sm text-blue-700 dark:text-blue-300 bg-white dark:bg-neutral-900 p-2 rounded border border-blue-200 dark:border-neutral-800">
                    <div>
                      {parseInt(financeiroForm.num_parcelas)}x de{' '}
                      <strong>{formatCurrency(parseFloat(financeiroForm.valor_total) / parseInt(financeiroForm.num_parcelas))}</strong>
                      {' '}a cada {financeiroForm.intervalo_dias} dias
                    </div>
                    <div className="mt-1 text-xs">
                      Última parcela em:{' '}
                      <strong>
                        {(() => {
                          const d = new Date(financeiroForm.primeira_data_parcela + 'T00:00:00')
                          d.setDate(d.getDate() + (parseInt(financeiroForm.intervalo_dias) || 30) * (parseInt(financeiroForm.num_parcelas) - 1))
                          return d.toLocaleDateString('pt-BR')
                        })()}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parcelas existentes */}
            {parcelas.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="font-semibold text-blue-800 text-sm">Parcelas:</p>
                {parcelas.map((p) => (
                  <div key={p.id} className={`flex items-center justify-between p-2 rounded text-sm ${
                    p.status === 'pago' ? 'bg-green-100 dark:bg-emerald-900/30' : p.status === 'atrasado' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-white dark:bg-neutral-900'
                  }`}>
                    <span>Parcela {p.numero_parcela}/{parcelas.length}</span>
                    <span className="font-semibold">{formatCurrency(p.valor)}</span>
                    <span>{formatDate(p.data_vencimento)}</span>
                    <select
                      value={p.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value
                        await api.updateParcela(p.id, {
                          status: newStatus as any,
                          data_pagamento: newStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
                        })
                        const updated = await api.getParcelasByFinanceiro(p.financeiro_id)
                        setParcelas(updated)
                      }}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="atrasado">Atrasado</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Textarea
            label="Observações"
            value={financeiroForm.observacoes}
            onChange={(e) => setFinanceiroForm({ ...financeiroForm, observacoes: e.target.value })}
          />

          {financeiroForm.valor_total && (
            <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
              <p className="font-bold text-purple-900 text-lg">
                Lucro Final:{' '}
                {formatCurrency(
                  parseFloat(financeiroForm.valor_total) -
                    (parseFloat(financeiroForm.custos_extras) || 0) -
                    (parseFloat(financeiroForm.prejuizo_defeitos) || 0)
                )}
              </p>
            </div>
          )}

          <Button type="submit" fullWidth>
            Salvar Dados Financeiros
          </Button>
        </form>
      </Modal>

      {/* Modal - Registrar Pagamento */}
      <Modal
        isOpen={showPagamentoModal}
        onClose={() => setShowPagamentoModal(false)}
        title={`Registrar Pagamento - ${selectedConta?.codigo}`}
      >
        <form onSubmit={handleRegistrarPagamento} className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <p className="text-gray-600 dark:text-neutral-400">
              Cliente: <strong>{selectedConta?.cliente}</strong>
            </p>
            <p className="text-gray-600 dark:text-neutral-400">
              Valor Total: <strong>{formatCurrency(selectedConta?.valor_total || 0)}</strong>
            </p>
            <p className="text-gray-600 dark:text-neutral-400">
              Já Pago: <strong>{formatCurrency(selectedConta?.valor_pago || 0)}</strong>
            </p>
            <p className="text-lg font-bold text-blue-600 mt-2">
              Pendente: {formatCurrency(selectedConta?.valor_pendente || 0)}
            </p>
          </div>

          <Input
            label="Valor do Pagamento (R$)"
            type="number"
            step="0.01"
            value={pagamentoForm.valor_pago}
            onChange={(e) => setPagamentoForm({ ...pagamentoForm, valor_pago: e.target.value })}
            required
          />
          <Input
            label="Data do Pagamento"
            type="date"
            value={pagamentoForm.data_pagamento}
            onChange={(e) =>
              setPagamentoForm({ ...pagamentoForm, data_pagamento: e.target.value })
            }
            required
          />
          <Input
            label="Forma de Pagamento"
            value={pagamentoForm.forma_pagamento}
            onChange={(e) =>
              setPagamentoForm({ ...pagamentoForm, forma_pagamento: e.target.value })
            }
            placeholder="Ex: PIX, Boleto, Transferência"
            required
          />

          <Button type="submit" fullWidth variant="success">
            <DollarSign size={20} className="inline mr-2" />
            Registrar Pagamento
          </Button>
        </form>
      </Modal>

      {/* Modal - Registrar Nota Fiscal */}
      <Modal
        isOpen={showNotaFiscalModal}
        onClose={() => setShowNotaFiscalModal(false)}
        title={`Registrar Nota Fiscal - ${selectedOP?.codigo}`}
      >
        <form onSubmit={handleEmitirNotaFiscal} className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg mb-4">
            <p className="text-yellow-800 text-sm">
              Após gerar a nota fiscal no site da prefeitura, registre o número aqui para
              controle interno.
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm font-medium mb-2">Dados de acesso NFS-e:</p>
            <p className="text-blue-700 text-sm">Login: <strong>09827248960</strong></p>
            <p className="text-blue-700 text-sm">Senha: <strong>EMERSON</strong></p>
          </div>

          <Input
            label="Número da Nota Fiscal"
            value={notaFiscalForm.numero_nota}
            onChange={(e) => setNotaFiscalForm({ numero_nota: e.target.value })}
            placeholder="Ex: 123456"
            required
          />

          <div className="flex gap-3">
            <Button type="button" variant="outline" fullWidth onClick={abrirNotaFiscalExterna}>
              <ExternalLink size={16} className="inline mr-2" />
              Abrir Site NF
            </Button>
            <Button type="submit" fullWidth variant="success">
              <Check size={20} className="inline mr-2" />
              Registrar NF
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Histórico de Movimentos V3 */}
      <Modal
        isOpen={showMovimentosModal}
        onClose={() => {
          setShowMovimentosModal(false)
          setMovimentosHistorico([])
        }}
        title={`Histórico de Movimentos - ${selectedOP?.codigo}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 dark:text-neutral-400">
              Cliente: <strong>{selectedOP?.cliente}</strong>
            </p>
            <p className="text-gray-600 dark:text-neutral-400">
              Peça: <strong>{selectedOP?.nome_peca}</strong>
            </p>
          </div>

          {movimentosHistorico.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-neutral-500">
              <History size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhum movimento registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {movimentosHistorico.map((mov) => (
                <div
                  key={mov.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    mov.tipo === 'pagamento' || mov.tipo === 'pagamento_parcial'
                      ? 'bg-green-50 border-l-green-500'
                      : mov.tipo === 'estorno' || mov.tipo === 'cancelamento'
                      ? 'bg-red-50 border-l-red-500'
                      : 'bg-blue-50 border-l-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold capitalize">
                        {mov.tipo.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-neutral-400">
                        {new Date(mov.created_at).toLocaleDateString('pt-BR')}{' '}
                        {new Date(mov.created_at).toLocaleTimeString('pt-BR')}
                      </p>
                      {mov.forma_pagamento && (
                        <p className="text-sm text-gray-500 dark:text-neutral-500">
                          Forma: {mov.forma_pagamento}
                        </p>
                      )}
                      {mov.observacao && (
                        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                          {mov.observacao}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        mov.tipo === 'estorno' || mov.tipo === 'cancelamento'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        {mov.tipo === 'estorno' || mov.tipo === 'cancelamento' ? '-' : '+'}
                        {formatCurrency(mov.valor)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-500">
                        Saldo: {formatCurrency(mov.saldo_atual)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  )
}

// Sub-components for each tab

interface DashboardTabProps {
  data: DashboardFinanceiro | null
  despesasData: any
  onTabChange: (tab: TabType) => void
}

function DashboardTab({ data, despesasData, onTabChange }: DashboardTabProps) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-lg">Faturado no Mês</p>
              <p className="text-4xl font-bold mt-2">{formatCurrency(data.faturado_mes)}</p>
            </div>
            <BarChart3 size={48} className="text-green-200" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-lg">Recebido no Mês</p>
              <p className="text-4xl font-bold mt-2">{formatCurrency(data.recebido_mes)}</p>
            </div>
            <CheckCircle size={48} className="text-blue-200" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-lg">Total em Aberto</p>
              <p className="text-4xl font-bold mt-2">{formatCurrency(data.total_em_aberto)}</p>
            </div>
            <Wallet size={48} className="text-orange-200" />
          </div>
        </Card>
      </div>

      {/* Alertas e Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className={`cursor-pointer hover:shadow-lg transition-shadow ${
            data.ops_atrasadas > 0 ? 'border-2 border-red-500' : ''
          }`}
          onClick={() => onTabChange('contas')}
        >
          <div className="flex items-center">
            <div
              className={`p-4 rounded-full mr-4 ${
                data.ops_atrasadas > 0 ? 'bg-red-100' : 'bg-gray-100'
              }`}
            >
              <AlertTriangle
                size={32}
                className={data.ops_atrasadas > 0 ? 'text-red-600' : 'text-gray-400'}
              />
            </div>
            <div>
              <p className="text-gray-600 dark:text-neutral-400 text-lg">Pagamentos Atrasados</p>
              <p
                className={`text-3xl font-bold ${
                  data.ops_atrasadas > 0 ? 'text-red-600' : 'text-gray-700 dark:text-neutral-300'
                }`}
              >
                {data.ops_atrasadas}
              </p>
            </div>
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onTabChange('contas')}
        >
          <div className="flex items-center">
            <div className="p-4 rounded-full bg-yellow-100 mr-4">
              <Clock size={32} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-neutral-400 text-lg">Aguardando Pagamento</p>
              <p className="text-3xl font-bold text-yellow-600">{data.ops_aguardando_pagamento}</p>
            </div>
          </div>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-lg transition-shadow ${
            data.ops_sem_nota > 0 ? 'border-2 border-orange-500' : ''
          }`}
          onClick={() => onTabChange('previsao')}
        >
          <div className="flex items-center">
            <div className="p-4 rounded-full bg-orange-100 mr-4">
              <Receipt size={32} className="text-orange-600" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-neutral-400 text-lg">OPs sem Nota Fiscal</p>
              <p className="text-3xl font-bold text-orange-600">{data.ops_sem_nota}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contas a Pagar - Despesas */}
      {despesasData && (
        <div className="mt-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <CreditCard size={24} className="text-red-500" />
            Contas a Pagar
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                despesasData.total_atrasado > 0 ? 'border-2 border-red-500 bg-red-50' : 'bg-red-50'
              }`}
              onClick={() => onTabChange('despesas')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 font-medium">Atrasadas</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(despesasData.total_atrasado || 0)}</p>
                  <p className="text-xs text-red-600">{despesasData.qtd_atrasados || 0} contas</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow bg-yellow-50"
              onClick={() => onTabChange('despesas')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-600 font-medium">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-700">{formatCurrency(despesasData.total_pendente || 0)}</p>
                  <p className="text-xs text-yellow-600">{despesasData.qtd_pendentes || 0} contas</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow bg-blue-50"
              onClick={() => onTabChange('despesas')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 font-medium">Vencendo esta Semana</p>
                  <p className="text-2xl font-bold text-blue-700">{despesasData.vencendo_semana || 0}</p>
                  <p className="text-xs text-blue-600">{despesasData.vencendo_hoje || 0} hoje</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow bg-green-50"
              onClick={() => onTabChange('despesas')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 font-medium">Pago no Mês</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(despesasData.total_pago_mes || 0)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

interface OrcamentosTabProps {
  orcamentos: Orcamento[]
  filter: string
  setFilter: (f: string) => void
  searchTerm: string
  setSearchTerm: (s: string) => void
  onNovo: () => void
  onEditar: (o: Orcamento) => void
  onEnviar: (id: string) => void
  onAprovar: (id: string) => void
  onReprovar: (id: string) => void
  onConverter: (o: Orcamento) => void
  onDownloadPDF: (o: Orcamento) => void
  onDownloadDOCX: (o: Orcamento) => void
  getStatusColor: (s: OrcamentoStatus) => string
  getStatusLabel: (s: OrcamentoStatus) => string
}

function OrcamentosTab({
  orcamentos,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  onNovo,
  onEditar,
  onEnviar,
  onAprovar,
  onReprovar,
  onConverter,
  onDownloadPDF,
  onDownloadDOCX,
  getStatusColor,
  getStatusLabel,
}: OrcamentosTabProps) {
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente ou peça..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="rascunho">Rascunho</option>
            <option value="aberto">Aberto</option>
            <option value="enviado">Enviado</option>
            <option value="aprovado">Aprovado</option>
            <option value="reprovado">Reprovado</option>
            <option value="convertido">Convertido</option>
          </select>
        </div>
        <Button size="lg" onClick={onNovo}>
          <Plus size={24} className="inline mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Lista */}
      {orcamentos.length === 0 ? (
        <Card>
          <p className="text-gray-600 dark:text-neutral-400 text-center py-8 text-lg">Nenhum orçamento encontrado</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orcamentos.map((orc) => (
            <Card key={orc.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Cliente</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-medium">{orc.cliente}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Peça</p>
                    <p className="text-gray-900 dark:text-neutral-100">{orc.nome_peca}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Quantidade</p>
                    <p className="text-gray-900 dark:text-neutral-100">{orc.quantidade}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Valor</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-bold text-lg">
                      {formatCurrency(orc.valor_estimado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400 mb-1">Status</p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(
                        orc.status
                      )}`}
                    >
                      {getStatusLabel(orc.status)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {/* Botão Editar - disponível para rascunho, aberto e enviado */}
                  {(orc.status === 'rascunho' || orc.status === 'aberto' || orc.status === 'enviado') && (
                    <Button size="sm" variant="secondary" onClick={() => onEditar(orc)}>
                      <Edit size={16} className="mr-1" />
                      Editar
                    </Button>
                  )}
                  {(orc.status === 'rascunho' || orc.status === 'aberto') && (
                    <Button size="sm" variant="outline" onClick={() => onEnviar(orc.id)}>
                      <Send size={16} className="mr-1" />
                      Enviar
                    </Button>
                  )}
                  {orc.status === 'enviado' && (
                    <>
                      <Button size="sm" variant="success" onClick={() => onAprovar(orc.id)}>
                        <Check size={16} className="mr-1" />
                        Aprovar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onReprovar(orc.id)}>
                        <X size={16} className="mr-1" />
                        Reprovar
                      </Button>
                    </>
                  )}
                  {orc.status === 'aprovado' && (
                    <Button size="sm" variant="primary" onClick={() => onConverter(orc)}>
                      <ArrowRight size={16} className="mr-1" />
                      Converter em OP
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onDownloadPDF(orc)} title="Baixar PDF">
                    <Download size={16} className="mr-1" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDownloadDOCX(orc)} title="Baixar Word">
                    <Download size={16} className="mr-1" />
                    DOC
                  </Button>
                </div>
              </div>
              {orc.observacoes && (
                <p className="text-sm text-gray-500 dark:text-neutral-500 mt-3 pt-3 border-t">
                  Obs: {orc.observacoes}
                </p>
              )}
              <div className="text-xs text-gray-400 mt-2">
                Criado em: {formatDate(orc.created_at)}
                {orc.data_envio && ` | Enviado em: ${formatDate(orc.data_envio)}`}
                {orc.data_resposta && ` | Resposta em: ${formatDate(orc.data_resposta)}`}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

interface ContasReceberTabProps {
  contas: ContaReceber[]
  contasAvulsas: ContaReceberAvulsa[]
  filter: string
  setFilter: (f: string) => void
  searchTerm: string
  setSearchTerm: (s: string) => void
  onPagamento: (c: ContaReceber) => void
  onNovaAvulsa: () => void
  onEditarAvulsa: (c: ContaReceberAvulsa) => void
  onPagamentoAvulsa: (c: ContaReceberAvulsa) => void
  onExcluirAvulsa: (id: string) => void
  getSituacaoColor: (s: string) => string
}

function ContasReceberTab({
  contas,
  contasAvulsas,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  onPagamento,
  onNovaAvulsa,
  onEditarAvulsa,
  onPagamentoAvulsa,
  onExcluirAvulsa,
  getSituacaoColor,
}: ContasReceberTabProps) {
  const [showExcluirAvulsaModal, setShowExcluirAvulsaModal] = useState(false)
  const [avulsaParaExcluir, setAvulsaParaExcluir] = useState<ContaReceberAvulsa | null>(null)

  const totalAvulsas = contasAvulsas.reduce((acc, c) => ({
    total: acc.total + c.valor_total,
    pago: acc.pago + c.valor_pago,
    pendente: acc.pendente + (c.valor_total - c.valor_pago),
  }), { total: 0, pago: 0, pendente: 0 })

  const totals = contas.reduce(
    (acc, c) => ({
      total: acc.total + c.valor_total + totalAvulsas.total,
      pago: acc.pago + c.valor_pago + totalAvulsas.pago,
      pendente: acc.pendente + c.valor_pendente + totalAvulsas.pendente,
    }),
    { total: 0, pago: 0, pendente: 0 }
  )

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gray-50">
          <p className="text-gray-600 dark:text-neutral-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(totals.total)}</p>
        </Card>
        <Card className="bg-green-50">
          <p className="text-green-600">Recebido</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totals.pago)}</p>
        </Card>
        <Card className="bg-orange-50">
          <p className="text-orange-600">Pendente</p>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(totals.pendente)}</p>
        </Card>
      </div>

      {/* Filtros + Botão Novo */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente, código ou peça..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
        >
          <option value="todos">Todas as Situações</option>
          <option value="pendente">Pendente</option>
          <option value="parcial">Parcial</option>
          <option value="atrasado">Atrasado</option>
          <option value="pago">Pago</option>
        </select>
        <Button size="lg" onClick={onNovaAvulsa}>
          <Plus size={20} className="inline mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Contas Avulsas */}
      {contasAvulsas.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-2">
            <DollarSign size={18} className="text-purple-500" />
            Contas Avulsas ({contasAvulsas.length})
          </h3>
          {contasAvulsas.map((conta) => (
            <Card key={conta.id} className={`border-l-4 ${
              conta.status === 'pago' ? 'border-l-green-500 bg-green-50'
              : conta.status === 'atrasado' ? 'border-l-red-500 bg-red-50'
              : conta.status === 'parcial' ? 'border-l-blue-500 bg-blue-50'
              : 'border-l-purple-500 bg-purple-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Cliente</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-bold">{conta.cliente}</p>
                    {conta.cnpj_cliente && <p className="text-xs text-gray-500 dark:text-neutral-500">{conta.cnpj_cliente}</p>}
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Descrição</p>
                    <p className="text-gray-900 dark:text-neutral-100">{conta.descricao}</p>
                    {conta.numero_documento && <p className="text-xs text-gray-500 dark:text-neutral-500">Doc: {conta.numero_documento}</p>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Valor</p>
                    <p className="font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(conta.valor_total)}</p>
                    {conta.valor_pago > 0 && <p className="text-xs text-green-600">Pago: {formatCurrency(conta.valor_pago)}</p>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Vencimento</p>
                    <p className="text-gray-900 dark:text-neutral-100">{formatDate(conta.data_vencimento)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      conta.status === 'pago' ? 'bg-green-100 text-green-700'
                      : conta.status === 'atrasado' ? 'bg-red-100 text-red-700'
                      : conta.status === 'parcial' ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                    }`}>
                      {conta.status === 'pago' ? 'Pago' : conta.status === 'atrasado' ? 'Atrasado'
                        : conta.status === 'parcial' ? 'Parcial' : 'Pendente'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {conta.status !== 'pago' && (
                    <Button size="sm" variant="success" onClick={() => onPagamentoAvulsa(conta)}>
                      <DollarSign size={16} className="mr-1" />
                      Receber
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => onEditarAvulsa(conta)}>
                    <Edit size={16} />
                  </Button>
                  <button
                    onClick={() => {
                      setAvulsaParaExcluir(conta)
                      setShowExcluirAvulsaModal(true)
                    }}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal confirmar exclusão avulsa */}
      <Modal isOpen={showExcluirAvulsaModal} onClose={() => setShowExcluirAvulsaModal(false)} title="Excluir Conta">
        <p className="text-gray-600 dark:text-neutral-400 mb-6">Tem certeza que deseja excluir a conta de <strong>{avulsaParaExcluir?.cliente}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowExcluirAvulsaModal(false)}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={() => {
            if (avulsaParaExcluir) onExcluirAvulsa(avulsaParaExcluir.id)
            setShowExcluirAvulsaModal(false)
            setAvulsaParaExcluir(null)
          }}>Excluir</Button>
        </div>
      </Modal>

      {/* Divisor */}
      {contasAvulsas.length > 0 && contas.length > 0 && (
        <div className="border-t-2 border-gray-200 pt-4">
          <h3 className="font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-2 mb-3">
            <Receipt size={18} className="text-blue-500" />
            Contas de Ordens de Produção ({contas.length})
          </h3>
        </div>
      )}

      {/* Lista OPs */}
      {contas.length === 0 && contasAvulsas.length === 0 ? (
        <Card>
          <p className="text-gray-600 dark:text-neutral-400 text-center py-8 text-lg">Nenhuma conta encontrada. Clique em "Nova Conta" para criar uma conta avulsa.</p>
        </Card>
      ) : contas.length === 0 ? null : (
        <div className="space-y-3">
          {contas.map((conta) => (
            <Card
              key={conta.id}
              className={`border-l-4 ${
                conta.situacao_financeira === 'atrasado'
                  ? 'border-l-red-500 bg-red-50'
                  : conta.situacao_financeira === 'pago'
                  ? 'border-l-green-500 bg-green-50'
                  : conta.situacao_financeira === 'parcial'
                  ? 'border-l-blue-500 bg-blue-50'
                  : 'border-l-yellow-500 bg-yellow-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-6 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">OP</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-bold">{conta.codigo}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Cliente</p>
                    <p className="text-gray-900 dark:text-neutral-100">{conta.cliente}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Valor Total</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-bold">{formatCurrency(conta.valor_total)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Pago</p>
                    <p className="text-green-600 font-bold">{formatCurrency(conta.valor_pago)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Pendente</p>
                    <p className="text-orange-600 font-bold">
                      {formatCurrency(conta.valor_pendente)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400 mb-1">Situação</p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border-2 ${getSituacaoColor(
                        conta.situacao_financeira
                      )}`}
                    >
                      {conta.situacao_financeira === 'atrasado'
                        ? 'ATRASADO'
                        : conta.situacao_financeira === 'pago'
                        ? 'PAGO'
                        : conta.situacao_financeira === 'parcial'
                        ? 'PARCIAL'
                        : 'PENDENTE'}
                    </span>
                  </div>
                </div>
                {conta.situacao_financeira !== 'pago' && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => onPagamento(conta)}
                    className="ml-4"
                  >
                    <DollarSign size={16} className="mr-1" />
                    Registrar Pagamento
                  </Button>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-neutral-500 mt-3 pt-3 border-t flex gap-4">
                <span>Peça: {conta.nome_peca}</span>
                {conta.data_vencimento && <span>Vencimento: {formatDate(conta.data_vencimento)}</span>}
                {conta.forma_pagamento && <span>Forma: {conta.forma_pagamento}</span>}
                {conta.nota_fiscal_emitida && (
                  <span className="text-green-600">NF: {conta.nota_fiscal_numero}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

interface OPsFinanceiroTabProps {
  ops: OrdemProducao[]
  financeiros: Map<string, FinanceiroType>
  onEditar: (op: OrdemProducao) => void
  onVerHistorico: (op: OrdemProducao) => void
}

function OPsFinanceiroTab({ ops, financeiros, onEditar, onVerHistorico }: OPsFinanceiroTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFinanceiroFilter, setStatusFinanceiroFilter] = useState<string>('todos')
  const [statusProducaoFilter, setStatusProducaoFilter] = useState<string>('todos')

  const filteredOps = ops.filter((op) => {
    const financeiro = financeiros.get(op.id)
    const statusPag = financeiro?.status_pagamento || 'pendente'
    const statusProd = op.status_producao || op.status

    if (statusFinanceiroFilter !== 'todos' && statusPag !== statusFinanceiroFilter) return false
    if (statusProducaoFilter !== 'todos' && statusProd !== statusProducaoFilter) return false

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        op.codigo.toLowerCase().includes(term) ||
        op.cliente.toLowerCase().includes(term) ||
        op.nome_peca.toLowerCase().includes(term)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Barra de pesquisa */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por código, cliente ou peça..."
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Filtros financeiro */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase mb-2">Financeiro</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'todos', label: 'Todos', color: '' },
            { key: 'pendente', label: 'Pendente', color: 'border-yellow-400 text-yellow-700' },
            { key: 'pago', label: 'Pago', color: 'border-green-400 text-green-700' },
            { key: 'atrasado', label: 'Atrasado', color: 'border-red-400 text-red-700' },
            { key: 'parcial', label: 'Parcial', color: 'border-blue-400 text-blue-700' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFinanceiroFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                statusFinanceiroFilter === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : `bg-white dark:bg-neutral-900 ${f.color || 'text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-700'} hover:border-blue-400`
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros produção */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase mb-2">Produção</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'criada', label: 'Criada' },
            { key: 'em_producao', label: 'Em Produção' },
            { key: 'finalizada', label: 'Finalizada' },
            { key: 'cancelada', label: 'Cancelada' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusProducaoFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                statusProducaoFilter === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-700 hover:border-blue-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-neutral-500">{filteredOps.length} resultado(s)</p>

      {filteredOps.length === 0 ? (
        <Card>
          <p className="text-gray-600 dark:text-neutral-400 text-center py-8 text-lg">Nenhuma ordem de produção encontrada</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOps.map((op) => {
            const financeiro = financeiros.get(op.id)
            const statusPagamento = financeiro?.status_pagamento || 'pendente'

            return (
              <Card
                key={op.id}
                className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
                  statusPagamento === 'pago'
                    ? 'border-l-green-500 bg-green-50'
                    : statusPagamento === 'atrasado'
                    ? 'border-l-red-500 bg-red-50'
                    : statusPagamento === 'parcial'
                    ? 'border-l-blue-500 bg-blue-50'
                    : 'border-l-yellow-500 bg-yellow-50'
                }`}
                onClick={() => onEditar(op)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/* Linha principal - Cliente + Peça em destaque */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">{op.codigo}</span>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-neutral-100">{op.cliente}</h4>
                      <span className="text-gray-500 dark:text-neutral-500">-</span>
                      <span className="text-gray-700 dark:text-neutral-300 font-medium">{op.nome_peca}</span>
                      {op.quantidade_total && (
                        <span className="text-sm text-gray-500 dark:text-neutral-500">({op.quantidade_total} {op.unidade || 'unid.'})</span>
                      )}
                    </div>
                    {/* Linha de status e valores */}
                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-neutral-500">Produção: </span>
                        <StatusBadge status={op.status_producao || op.status} type="producao" />
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-neutral-500">Pagamento: </span>
                        <StatusBadge status={statusPagamento} type="payment" />
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-neutral-500">Valor: </span>
                        <span className="font-bold text-lg">{formatCurrency(financeiro?.valor_total || op.preco_servico)}</span>
                      </div>
                      {financeiro?.data_vencimento && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-neutral-500">Vencimento: </span>
                          <span className="text-gray-900 dark:text-neutral-100">{formatDate(financeiro.data_vencimento)}</span>
                        </div>
                      )}
                      {financeiro && financeiro.valor_pago > 0 && financeiro.valor_pago < financeiro.valor_total && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-neutral-500">Pago: </span>
                          <span className="font-semibold text-green-600">{formatCurrency(financeiro.valor_pago)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        onVerHistorico(op)
                      }}
                    >
                      <History size={16} className="mr-1" />
                      Histórico
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditar(op)
                      }}
                    >
                      <DollarSign size={16} className="mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface PrevisaoFaturamentoTabProps {
  previsoes: PrevisaoFaturamento[]
  onEmitirNota: (p: PrevisaoFaturamento) => void
}

function PrevisaoFaturamentoTab({ previsoes, onEmitirNota }: PrevisaoFaturamentoTabProps) {
  const totalPrevisao = previsoes.reduce((sum, p) => sum + p.preco_servico, 0)

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-lg">Previsão de Faturamento</p>
            <p className="text-sm text-purple-200">{previsoes.length} OPs aguardando nota fiscal</p>
          </div>
          <p className="text-4xl font-bold">{formatCurrency(totalPrevisao)}</p>
        </div>
      </Card>

      {/* Lista */}
      {previsoes.length === 0 ? (
        <Card>
          <p className="text-gray-600 dark:text-neutral-400 text-center py-8 text-lg">
            Nenhuma OP aguardando emissão de nota fiscal
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {previsoes.map((prev) => (
            <Card
              key={prev.id}
              className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">OP</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-bold">{prev.codigo}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Cliente</p>
                    <p className="text-gray-900 dark:text-neutral-100">{prev.cliente}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Peça</p>
                    <p className="text-gray-900 dark:text-neutral-100">{prev.nome_peca}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Valor</p>
                    <p className="text-gray-900 dark:text-neutral-100 font-bold text-lg">
                      {formatCurrency(prev.preco_servico)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Produção</p>
                    <StatusBadge status={prev.status_producao || prev.status} type="producao" />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => onEmitirNota(prev)}
                  className="ml-4"
                >
                  <Receipt size={16} className="mr-1" />
                  Registrar NF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// DESPESAS (CONTAS A PAGAR) TAB
// =====================================================

interface DespesasTabProps {
  contas: any[]
  dashboard: any
  onReload: () => void
  userId?: string
}

const CATEGORIAS_DESPESA = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'energia', label: 'Energia' },
  { value: 'agua', label: 'Água' },
  { value: 'internet', label: 'Internet' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'salarios', label: 'Salários' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'materiais', label: 'Materiais' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'outros', label: 'Outros' },
]

function DespesasTab({ contas, dashboard, onReload, userId }: DespesasTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [showPagamentoModal, setShowPagamentoModal] = useState(false)
  const [showExcluirModal, setShowExcluirModal] = useState(false)
  const [selectedConta, setSelectedConta] = useState<any>(null)
  const [contaParaExcluir, setContaParaExcluir] = useState<any>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [form, setForm] = useState({
    descricao: '',
    tipo: 'variavel' as 'fixa' | 'variavel',
    categoria: 'outros',
    valor: '',
    data_vencimento: '',
    fornecedor: '',
    numero_documento: '',
    observacoes: '',
  })

  const [valorPagamento, setValorPagamento] = useState('')

  function resetForm() {
    setForm({
      descricao: '',
      tipo: 'variavel',
      categoria: 'outros',
      valor: '',
      data_vencimento: '',
      fornecedor: '',
      numero_documento: '',
      observacoes: '',
    })
  }

  function abrirNovaConta() {
    setSelectedConta(null)
    resetForm()
    setShowModal(true)
  }

  function abrirEditarConta(conta: any) {
    setSelectedConta(conta)
    setForm({
      descricao: conta.descricao,
      tipo: conta.tipo,
      categoria: conta.categoria,
      valor: conta.valor.toString(),
      data_vencimento: conta.data_vencimento,
      fornecedor: conta.fornecedor || '',
      numero_documento: conta.numero_documento || '',
      observacoes: conta.observacoes || '',
    })
    setShowModal(true)
  }

  function abrirPagamento(conta: any) {
    setSelectedConta(conta)
    setValorPagamento((conta.valor - conta.valor_pago).toFixed(2))
    setShowPagamentoModal(true)
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (selectedConta) {
        await api.updateContaPagar(selectedConta.id, {
          descricao: form.descricao,
          tipo: form.tipo,
          categoria: form.categoria,
          valor: parseFloat(form.valor),
          data_vencimento: form.data_vencimento,
          fornecedor: form.fornecedor || undefined,
          numero_documento: form.numero_documento || undefined,
          observacoes: form.observacoes || undefined,
        }, userId)
        setToast({ message: 'Conta atualizada com sucesso!', type: 'success' })
      } else {
        await api.createContaPagar({
          descricao: form.descricao,
          tipo: form.tipo,
          categoria: form.categoria,
          valor: parseFloat(form.valor),
          data_vencimento: form.data_vencimento,
          fornecedor: form.fornecedor || undefined,
          numero_documento: form.numero_documento || undefined,
          observacoes: form.observacoes || undefined,
        }, userId)
        setToast({ message: 'Conta criada com sucesso!', type: 'success' })
      }
      setShowModal(false)
      onReload()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao salvar conta', type: 'error' })
    }
  }

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedConta) return
    try {
      await api.pagarConta(selectedConta.id, parseFloat(valorPagamento), userId)
      setToast({ message: 'Pagamento registrado com sucesso!', type: 'success' })
      setShowPagamentoModal(false)
      onReload()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao registrar pagamento', type: 'error' })
    }
  }

  function handleExcluir(conta: any) {
    setContaParaExcluir(conta)
    setShowExcluirModal(true)
  }

  async function confirmarExclusao() {
    if (!contaParaExcluir) return
    try {
      await api.deleteContaPagar(contaParaExcluir.id)
      setToast({ message: 'Conta excluída com sucesso!', type: 'success' })
      setShowExcluirModal(false)
      setContaParaExcluir(null)
      onReload()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao excluir conta', type: 'error' })
    }
  }

  const contasFiltradas = contas.filter(c => {
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
    if (filtroCategoria !== 'todos' && c.categoria !== filtroCategoria) return false
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      case 'pendente': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'atrasado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      case 'cancelado': return 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pago': return 'Pago'
      case 'pendente': return 'Pendente'
      case 'atrasado': return 'Atrasado'
      case 'cancelado': return 'Cancelado'
      default: return status
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Dashboard de Despesas */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-700">{formatCurrency(dashboard.total_pendente || 0)}</p>
                <p className="text-xs text-yellow-600">{dashboard.qtd_pendentes || 0} contas</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </Card>

          <Card className="bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Atrasadas</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(dashboard.total_atrasado || 0)}</p>
                <p className="text-xs text-red-600">{dashboard.qtd_atrasados || 0} contas</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Pago no Mês</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(dashboard.total_pago_mes || 0)}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Vencendo Semana</p>
                <p className="text-2xl font-bold text-blue-700">{dashboard.vencendo_semana || 0}</p>
                <p className="text-xs text-blue-600">{dashboard.vencendo_hoje || 0} hoje</p>
              </div>
              <Calendar className="w-10 h-10 text-blue-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Header com filtros e botão novo */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-4">
          <Select
            label="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'pendente', label: 'Pendente' },
              { value: 'atrasado', label: 'Atrasado' },
              { value: 'pago', label: 'Pago' },
            ]}
          />
          <Select
            label="Categoria"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            options={[
              { value: 'todos', label: 'Todas' },
              ...CATEGORIAS_DESPESA,
            ]}
          />
        </div>
        <Button onClick={abrirNovaConta}>
          <Plus size={20} className="mr-2" />
          Nova Conta a Pagar
        </Button>
      </div>

      {/* Lista de Contas */}
      {contasFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500 dark:text-neutral-500">Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white dark:bg-neutral-900 rounded-lg overflow-hidden shadow">
            <thead>
              <tr className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300">
                <th className="text-left p-4 font-semibold">Descrição</th>
                <th className="text-left p-4 font-semibold">Categoria</th>
                <th className="text-left p-4 font-semibold">Vencimento</th>
                <th className="text-right p-4 font-semibold">Valor</th>
                <th className="text-right p-4 font-semibold">Pago</th>
                <th className="text-center p-4 font-semibold">Status</th>
                <th className="text-center p-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contasFiltradas.map((conta) => (
                <tr key={conta.id} className="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-gray-900 dark:text-neutral-100">
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{conta.descricao}</p>
                      {conta.fornecedor && (
                        <p className="text-sm text-gray-500 dark:text-neutral-500">{conta.fornecedor}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300">
                      {CATEGORIAS_DESPESA.find(c => c.value === conta.categoria)?.label || conta.categoria}
                    </span>
                  </td>
                  <td className="p-4">{formatDate(conta.data_vencimento)}</td>
                  <td className="p-4 text-right font-semibold">{formatCurrency(conta.valor)}</td>
                  <td className="p-4 text-right">{formatCurrency(conta.valor_pago || 0)}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(conta.status)}`}>
                      {getStatusLabel(conta.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1">
                      {conta.status !== 'pago' && conta.status !== 'cancelado' && (
                        <button
                          onClick={() => abrirPagamento(conta)}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-neutral-800 rounded-lg"
                          title="Registrar Pagamento"
                        >
                          <DollarSign size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => abrirEditarConta(conta)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-neutral-800 rounded-lg"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleExcluir(conta)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-neutral-800 rounded-lg"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova/Editar Conta */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedConta ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
      >
        <form onSubmit={handleSalvar} className="space-y-4">
          <Input
            label="Descrição *"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as 'fixa' | 'variavel' })}
              options={[
                { value: 'variavel', label: 'Variável' },
                { value: 'fixa', label: 'Fixa' },
              ]}
            />
            <Select
              label="Categoria"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              options={CATEGORIAS_DESPESA}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor *"
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              required
            />
            <Input
              label="Data Vencimento *"
              type="date"
              value={form.data_vencimento}
              onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
              required
            />
          </div>
          <Input
            label="Fornecedor"
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
          />
          <Input
            label="Nº Documento"
            value={form.numero_documento}
            onChange={(e) => setForm({ ...form, numero_documento: e.target.value })}
          />
          <Textarea
            label="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={2}
          />
          <Button type="submit" fullWidth>
            {selectedConta ? 'Salvar Alterações' : 'Criar Conta'}
          </Button>
        </form>
      </Modal>

      {/* Modal Pagamento */}
      <Modal
        isOpen={showPagamentoModal}
        onClose={() => setShowPagamentoModal(false)}
        title="Registrar Pagamento"
      >
        {selectedConta && (
          <form onSubmit={handlePagar} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold">{selectedConta.descricao}</p>
              <p className="text-sm text-gray-600 dark:text-neutral-400">Valor Total: {formatCurrency(selectedConta.valor)}</p>
              <p className="text-sm text-gray-600 dark:text-neutral-400">Já Pago: {formatCurrency(selectedConta.valor_pago || 0)}</p>
              <p className="text-sm font-semibold text-blue-600">
                Restante: {formatCurrency(selectedConta.valor - (selectedConta.valor_pago || 0))}
              </p>
            </div>
            <Input
              label="Valor do Pagamento *"
              type="number"
              step="0.01"
              value={valorPagamento}
              onChange={(e) => setValorPagamento(e.target.value)}
              required
            />
            <Button type="submit" fullWidth variant="success">
              <DollarSign size={20} className="mr-2" />
              Confirmar Pagamento
            </Button>
          </form>
        )}
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal
        isOpen={showExcluirModal}
        onClose={() => {
          setShowExcluirModal(false)
          setContaParaExcluir(null)
        }}
        title="Confirmar Exclusão"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              Tem certeza que deseja excluir a conta "{contaParaExcluir?.descricao}"?
            </p>
            <p className="text-red-600 text-sm mt-2">
              Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowExcluirModal(false)
                setContaParaExcluir(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={confirmarExclusao}
            >
              Excluir Conta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// =====================================================
// RELATÓRIOS TAB
// =====================================================

interface RelatoriosTabProps {
  ops: OrdemProducao[]
  financeiros: Map<string, FinanceiroType>
  contasReceber: ContaReceber[]
  dashboardData: DashboardFinanceiro | null
}

type ReportType = 'ficha-op' | 'resumo-financeiro' | 'contas-receber' | 'historico-cliente' | 'producao' | 'ops-status'

function RelatoriosTab({ ops, financeiros, contasReceber, dashboardData }: RelatoriosTabProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [selectedOPId, setSelectedOPId] = useState<string>('')
  const [selectedCliente, setSelectedCliente] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')
  const [periodoInicio, setPeriodoInicio] = useState<string>('')
  const [periodoFim, setPeriodoFim] = useState<string>('')
  const [clientes, setClientes] = useState<string[]>([])

  useEffect(() => {
    const clientesUnicos = [...new Set(ops.map(op => op.cliente))].sort()
    setClientes(clientesUnicos)
  }, [ops])

  const reportTypes = [
    { id: 'ficha-op', label: 'Ficha de OP', icon: ClipboardList, description: 'Detalhes completos para produção' },
    { id: 'resumo-financeiro', label: 'Resumo Financeiro', icon: BarChart3, description: 'Faturamento e pendências do mês' },
    { id: 'contas-receber', label: 'Contas a Receber', icon: Wallet, description: 'Valores pendentes por cliente' },
    { id: 'historico-cliente', label: 'Histórico do Cliente', icon: FileText, description: 'OPs e pagamentos do cliente' },
    { id: 'producao', label: 'Produção por Período', icon: Calendar, description: 'Produção em um período' },
    { id: 'ops-status', label: 'OPs por Status', icon: Receipt, description: 'OPs filtradas por status' },
  ]

  function handlePrint() { window.print() }
  function getSelectedOP() { return ops.find(op => op.id === selectedOPId) }
  function getOPsByCliente(cliente: string) { return ops.filter(op => op.cliente === cliente) }
  function getOPsByStatus(status: string) { return status === 'todos' ? ops : ops.filter(op => op.status === status) }

  function getClienteTotals(cliente: string) {
    const clienteOps = getOPsByCliente(cliente)
    let totalFaturado = 0, totalPago = 0
    clienteOps.forEach(op => {
      const fin = financeiros.get(op.id)
      totalFaturado += fin?.valor_total || op.preco_servico
      totalPago += fin?.valor_pago || 0
    })
    return { totalOps: clienteOps.length, totalFaturado, totalPago, totalPendente: totalFaturado - totalPago }
  }

  return (
    <div className="space-y-6">
      {!selectedReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => (
            <Card key={report.id} className="cursor-pointer hover:shadow-lg hover:border-blue-500 transition-all" onClick={() => setSelectedReport(report.id as ReportType)}>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 rounded-lg"><report.icon size={28} className="text-blue-600" /></div>
                <div><h3 className="font-bold text-lg text-gray-900 dark:text-neutral-100">{report.label}</h3><p className="text-gray-600 dark:text-neutral-400 text-sm mt-1">{report.description}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedReport && (
        <div className="space-y-4">
          <Button variant="secondary" onClick={() => setSelectedReport(null)} className="no-print">
            <ArrowRight size={16} className="mr-2 rotate-180" /> Voltar
          </Button>

          {selectedReport === 'ficha-op' && (
            <div>
              <Card className="no-print">
                <h3 className="font-bold text-xl mb-4">Selecione a OP</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Ordem de Produção</label>
                    <select value={selectedOPId} onChange={(e) => setSelectedOPId(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg">
                      <option value="">Selecione...</option>
                      {ops.map((op) => <option key={op.id} value={op.id}>{op.codigo} - {op.cliente} - {op.nome_peca}</option>)}
                    </select>
                  </div>
                  <Button onClick={handlePrint} disabled={!selectedOPId} size="lg"><Printer size={20} className="mr-2" />Imprimir</Button>
                </div>
              </Card>
              {selectedOPId && getSelectedOP() && <div className="print-container mt-4"><FichaOPPrint op={getSelectedOP()!} /></div>}
            </div>
          )}

          {selectedReport === 'resumo-financeiro' && (
            <div>
              <Card className="no-print"><div className="flex justify-between items-center"><h3 className="font-bold text-xl">Resumo Financeiro</h3><Button onClick={handlePrint} size="lg"><Printer size={20} className="mr-2" />Imprimir</Button></div></Card>
              <div className="print-container mt-4"><ResumoFinanceiroPrint dashboardData={dashboardData} /></div>
            </div>
          )}

          {selectedReport === 'contas-receber' && (
            <div>
              <Card className="no-print"><div className="flex justify-between items-center"><h3 className="font-bold text-xl">Contas a Receber</h3><Button onClick={handlePrint} size="lg"><Printer size={20} className="mr-2" />Imprimir</Button></div></Card>
              <div className="print-container mt-4"><ContasReceberPrint contasReceber={contasReceber} /></div>
            </div>
          )}

          {selectedReport === 'historico-cliente' && (
            <div>
              <Card className="no-print">
                <h3 className="font-bold text-xl mb-4">Histórico do Cliente</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Cliente</label>
                    <select value={selectedCliente} onChange={(e) => setSelectedCliente(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg">
                      <option value="">Selecione...</option>
                      {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Button onClick={handlePrint} disabled={!selectedCliente} size="lg"><Printer size={20} className="mr-2" />Imprimir</Button>
                </div>
              </Card>
              {selectedCliente && <div className="print-container mt-4"><HistoricoClientePrint cliente={selectedCliente} ops={getOPsByCliente(selectedCliente)} financeiros={financeiros} totals={getClienteTotals(selectedCliente)} /></div>}
            </div>
          )}

          {selectedReport === 'producao' && (
            <div>
              <Card className="no-print">
                <h3 className="font-bold text-xl mb-4">Produção por Período</h3>
                <div className="flex gap-4 items-end">
                  <div><label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Início</label><input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="px-4 py-3 border-2 border-gray-300 rounded-lg text-lg" /></div>
                  <div><label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Fim</label><input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="px-4 py-3 border-2 border-gray-300 rounded-lg text-lg" /></div>
                  <Button onClick={handlePrint} size="lg"><Printer size={20} className="mr-2" />Imprimir</Button>
                </div>
              </Card>
              <div className="print-container mt-4"><ProducaoPrint ops={ops} financeiros={financeiros} periodoInicio={periodoInicio} periodoFim={periodoFim} /></div>
            </div>
          )}

          {selectedReport === 'ops-status' && (
            <div>
              <Card className="no-print">
                <h3 className="font-bold text-xl mb-4">OPs por Status</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Status</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg">
                      <option value="todos">Todos</option>
                      <option value="criada">Criada</option>
                      <option value="em_producao">Em Produção</option>
                      <option value="finalizada">Finalizada</option>
                      <option value="faturada">Faturada</option>
                      <option value="nota_emitida">Nota Emitida</option>
                      <option value="paga">Paga</option>
                    </select>
                  </div>
                  <Button onClick={handlePrint} size="lg"><Printer size={20} className="mr-2" />Imprimir</Button>
                </div>
              </Card>
              <div className="print-container mt-4"><OPsStatusPrint ops={getOPsByStatus(selectedStatus)} financeiros={financeiros} statusFiltro={selectedStatus} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =====================================================
// COMPONENTES DE IMPRESSÃO
// =====================================================

function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
      <h1 className="text-2xl font-bold">RJ USINAGEM</h1>
      <h2 className="text-xl font-semibold mt-2">{title}</h2>
      {subtitle && <p className="text-gray-600 dark:text-neutral-400 mt-1">{subtitle}</p>}
      <p className="text-sm text-gray-500 dark:text-neutral-500 mt-2">Emitido: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
    </div>
  )
}

function PrintFooter() {
  return <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500 dark:text-neutral-500">RJ Usinagem - Sistema de Gestão</div>
}

function FichaOPPrint({ op }: { op: OrdemProducao }) {
  return (
    <Card>
      <PrintHeader title="FICHA DE ORDEM DE PRODUÇÃO" />
      <div className="border-2 border-gray-800 p-4 mb-4">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div><span className="text-sm text-gray-600 dark:text-neutral-400">CÓDIGO</span><p className="text-3xl font-bold">{op.codigo}</p></div>
          <div className="text-right"><span className="text-sm text-gray-600 dark:text-neutral-400">TIPO</span><p className="text-xl font-semibold uppercase">{op.tipo}</p></div>
          <div className="text-right"><span className="text-sm text-gray-600 dark:text-neutral-400">STATUS</span><p className="text-xl font-semibold uppercase">{op.status.replace('_', ' ')}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">CLIENTE</span><p className="text-lg font-semibold">{op.cliente}</p></div>
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">PEÇA</span><p className="text-lg font-semibold">{op.nome_peca}</p></div>
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">QUANTIDADE</span><p className="text-lg font-semibold">{op.quantidade_total} peças</p></div>
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">VALOR</span><p className="text-lg font-semibold">{formatCurrency(op.preco_servico)}</p></div>
          </div>
          <div className="space-y-3">
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">INÍCIO</span><p className="text-lg font-semibold">{formatDate(op.data_inicio)}</p></div>
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">TÉRMINO</span><p className="text-lg font-semibold">{formatDate(op.data_termino)}</p></div>
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">MÁQUINA</span><p className="text-lg font-semibold">{op.maquina_utilizada || '-'}</p></div>
            <div><span className="text-xs text-gray-600 dark:text-neutral-400">OPERADOR</span><p className="text-lg font-semibold">{op.operador_responsavel || '-'}</p></div>
          </div>
        </div>
      </div>
      <div className="border-2 border-gray-800 p-4 mb-4">
        <h3 className="font-bold border-b pb-2 mb-3">PREPARAÇÃO DA MÁQUINA</h3>
        <p className="whitespace-pre-wrap">{op.preparacao_maquina || '-'}</p>
      </div>
      <div className="border-2 border-gray-800 p-4 mb-4">
        <h3 className="font-bold border-b pb-2 mb-3">MATERIAL</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-600 dark:text-neutral-400">Material:</span> {op.material || '-'}</div>
          <div><span className="text-gray-600 dark:text-neutral-400">Código:</span> {op.codigo_descricao_material || '-'}</div>
          <div><span className="text-gray-600 dark:text-neutral-400">Qtd:</span> {op.quantidade_material || '-'}</div>
          <div><span className="text-gray-600 dark:text-neutral-400">Lote:</span> {op.lote || '-'}</div>
          <div><span className="text-gray-600 dark:text-neutral-400">Fornecedor:</span> {op.fornecedor || '-'}</div>
        </div>
      </div>
      <div className="border-2 border-gray-800 p-4">
        <h3 className="font-bold border-b pb-2 mb-4">ASSINATURAS</h3>
        <div className="grid grid-cols-2 gap-8 mt-12">
          <div className="text-center border-t border-gray-800 pt-2"><p>Responsável Produção</p></div>
          <div className="text-center border-t border-gray-800 pt-2"><p>Supervisor</p></div>
        </div>
      </div>
      <PrintFooter />
    </Card>
  )
}

function ResumoFinanceiroPrint({ dashboardData }: { dashboardData: DashboardFinanceiro | null }) {
  return (
    <Card>
      <PrintHeader title="RESUMO FINANCEIRO" subtitle={new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border-2 border-gray-800 p-4 text-center"><p className="text-sm text-gray-600 dark:text-neutral-400">FATURADO</p><p className="text-2xl font-bold text-green-700">{formatCurrency(dashboardData?.faturado_mes || 0)}</p></div>
        <div className="border-2 border-gray-800 p-4 text-center"><p className="text-sm text-gray-600 dark:text-neutral-400">RECEBIDO</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(dashboardData?.recebido_mes || 0)}</p></div>
        <div className="border-2 border-gray-800 p-4 text-center"><p className="text-sm text-gray-600 dark:text-neutral-400">EM ABERTO</p><p className="text-2xl font-bold text-orange-700">{formatCurrency(dashboardData?.total_em_aberto || 0)}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border p-3 text-center"><p className="text-sm">Atrasados</p><p className="text-xl font-bold text-red-600">{dashboardData?.ops_atrasadas || 0}</p></div>
        <div className="border p-3 text-center"><p className="text-sm">Aguardando</p><p className="text-xl font-bold text-yellow-600">{dashboardData?.ops_aguardando_pagamento || 0}</p></div>
        <div className="border p-3 text-center"><p className="text-sm">Sem NF</p><p className="text-xl font-bold text-orange-600">{dashboardData?.ops_sem_nota || 0}</p></div>
      </div>
      <PrintFooter />
    </Card>
  )
}

function ContasReceberPrint({ contasReceber }: { contasReceber: ContaReceber[] }) {
  const total = contasReceber.reduce((s, c) => s + c.valor_total, 0)
  const pago = contasReceber.reduce((s, c) => s + c.valor_pago, 0)
  const pendente = contasReceber.reduce((s, c) => s + c.valor_pendente, 0)
  return (
    <Card>
      <PrintHeader title="CONTAS A RECEBER" subtitle={`${contasReceber.length} registros`} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">TOTAL</p><p className="text-xl font-bold">{formatCurrency(total)}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">RECEBIDO</p><p className="text-xl font-bold text-green-700">{formatCurrency(pago)}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">PENDENTE</p><p className="text-xl font-bold text-red-700">{formatCurrency(pendente)}</p></div>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-gray-200"><th className="border p-2 text-left">OP</th><th className="border p-2 text-left">Cliente</th><th className="border p-2 text-left">Valor</th><th className="border p-2 text-left">Pago</th><th className="border p-2 text-left">Pendente</th><th className="border p-2 text-left">Situação</th></tr></thead>
        <tbody>{contasReceber.map((c) => <tr key={c.id}><td className="border p-2 font-medium">{c.codigo}</td><td className="border p-2">{c.cliente}</td><td className="border p-2">{formatCurrency(c.valor_total)}</td><td className="border p-2 text-green-700">{formatCurrency(c.valor_pago)}</td><td className="border p-2 text-red-700">{formatCurrency(c.valor_pendente)}</td><td className="border p-2 uppercase">{c.situacao_financeira}</td></tr>)}</tbody>
      </table>
      <PrintFooter />
    </Card>
  )
}

function HistoricoClientePrint({ cliente, ops, financeiros, totals }: { cliente: string; ops: OrdemProducao[]; financeiros: Map<string, FinanceiroType>; totals: { totalOps: number; totalFaturado: number; totalPago: number; totalPendente: number } }) {
  return (
    <Card>
      <PrintHeader title="HISTÓRICO DO CLIENTE" subtitle={cliente} />
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">OPs</p><p className="text-xl font-bold">{totals.totalOps}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">FATURADO</p><p className="text-xl font-bold">{formatCurrency(totals.totalFaturado)}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">PAGO</p><p className="text-xl font-bold text-green-700">{formatCurrency(totals.totalPago)}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">PENDENTE</p><p className="text-xl font-bold text-red-700">{formatCurrency(totals.totalPendente)}</p></div>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-gray-200"><th className="border p-2 text-left">OP</th><th className="border p-2 text-left">Peça</th><th className="border p-2 text-left">Data</th><th className="border p-2 text-left">Valor</th><th className="border p-2 text-left">Pago</th><th className="border p-2 text-left">Status</th></tr></thead>
        <tbody>{ops.map((op) => { const fin = financeiros.get(op.id); return <tr key={op.id}><td className="border p-2 font-medium">{op.codigo}</td><td className="border p-2">{op.nome_peca}</td><td className="border p-2">{formatDate(op.data_inicio)}</td><td className="border p-2">{formatCurrency(fin?.valor_total || op.preco_servico)}</td><td className="border p-2 text-green-700">{formatCurrency(fin?.valor_pago || 0)}</td><td className="border p-2">{op.status.replace('_', ' ')}</td></tr> })}</tbody>
      </table>
      <PrintFooter />
    </Card>
  )
}

function ProducaoPrint({ ops, financeiros, periodoInicio, periodoFim }: { ops: OrdemProducao[]; financeiros: Map<string, FinanceiroType>; periodoInicio: string; periodoFim: string }) {
  const filtered = ops.filter(op => { if (!periodoInicio && !periodoFim) return true; const d = new Date(op.data_inicio); return (!periodoInicio || d >= new Date(periodoInicio)) && (!periodoFim || d <= new Date(periodoFim)) })
  const pecas = filtered.reduce((s, op) => s + op.quantidade_total, 0)
  const valor = filtered.reduce((s, op) => s + (financeiros.get(op.id)?.valor_total || op.preco_servico), 0)
  return (
    <Card>
      <PrintHeader title="RELATÓRIO DE PRODUÇÃO" subtitle={periodoInicio && periodoFim ? `${formatDate(periodoInicio)} a ${formatDate(periodoFim)}` : 'Todos os períodos'} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">OPs</p><p className="text-xl font-bold">{filtered.length}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">PEÇAS</p><p className="text-xl font-bold">{pecas.toLocaleString('pt-BR')}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">VALOR</p><p className="text-xl font-bold">{formatCurrency(valor)}</p></div>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-gray-200"><th className="border p-2 text-left">OP</th><th className="border p-2 text-left">Cliente</th><th className="border p-2 text-left">Peça</th><th className="border p-2 text-left">Data</th><th className="border p-2 text-left">Qtd</th><th className="border p-2 text-left">Valor</th></tr></thead>
        <tbody>{filtered.map((op) => <tr key={op.id}><td className="border p-2 font-medium">{op.codigo}</td><td className="border p-2">{op.cliente}</td><td className="border p-2">{op.nome_peca}</td><td className="border p-2">{formatDate(op.data_inicio)}</td><td className="border p-2">{op.quantidade_total}</td><td className="border p-2">{formatCurrency(financeiros.get(op.id)?.valor_total || op.preco_servico)}</td></tr>)}</tbody>
      </table>
      <PrintFooter />
    </Card>
  )
}

function OPsStatusPrint({ ops, financeiros, statusFiltro }: { ops: OrdemProducao[]; financeiros: Map<string, FinanceiroType>; statusFiltro: string }) {
  const valor = ops.reduce((s, op) => s + (financeiros.get(op.id)?.valor_total || op.preco_servico), 0)
  return (
    <Card>
      <PrintHeader title="ORDENS DE PRODUÇÃO" subtitle={`Status: ${statusFiltro === 'todos' ? 'Todos' : statusFiltro.replace('_', ' ')}`} />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">QUANTIDADE</p><p className="text-xl font-bold">{ops.length}</p></div>
        <div className="border-2 border-gray-800 p-3 text-center"><p className="text-sm">VALOR TOTAL</p><p className="text-xl font-bold">{formatCurrency(valor)}</p></div>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-gray-200"><th className="border p-2 text-left">OP</th><th className="border p-2 text-left">Cliente</th><th className="border p-2 text-left">Peça</th><th className="border p-2 text-left">Qtd</th><th className="border p-2 text-left">Valor</th><th className="border p-2 text-left">Status</th></tr></thead>
        <tbody>{ops.map((op) => <tr key={op.id}><td className="border p-2 font-medium">{op.codigo}</td><td className="border p-2">{op.cliente}</td><td className="border p-2">{op.nome_peca}</td><td className="border p-2">{op.quantidade_total}</td><td className="border p-2">{formatCurrency(financeiros.get(op.id)?.valor_total || op.preco_servico)}</td><td className="border p-2">{op.status.replace('_', ' ')}</td></tr>)}</tbody>
      </table>
      <PrintFooter />
    </Card>
  )
}
