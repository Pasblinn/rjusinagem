import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Clock,
  Users,
  Copy,
  CheckCircle,
  Edit,
  Calendar,
  RefreshCw,
  FileText,
  Trash2,
  PlusCircle,
  MinusCircle,
  DollarSign,
  Download,
} from 'lucide-react'
import { exportRelatorioHorasPDF, exportRelatorioFuncionarioPDF, exportRelatorioFuncionarioDOCX } from '@/utils/pontoExport'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Modal } from '@/components/Modal'
import { Toast } from '@/components/Toast'
import { api } from '@/services/api'
import { FuncionarioPonto, PontoDetalhado } from '@/types'

interface PontoTabProps {
  userId?: string
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  const iso = date.includes('T') ? date : `${date}T00:00:00`
  return new Date(iso).toLocaleDateString('pt-BR')
}

const formatTime = (datetime: string | null) => {
  if (!datetime) return '-'
  return new Date(datetime).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatMinutesToHours = (minutes: number | null) => {
  if (!minutes) return '0h 0min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}min`
}

export function PontoTab({ userId }: PontoTabProps) {
  const [loading, setLoading] = useState(true)
  const [funcionarios, setFuncionarios] = useState<FuncionarioPonto[]>([])
  const [registros, setRegistros] = useState<PontoDetalhado[]>([])
  const [resumo, setResumo] = useState<any[]>([])
  const [relatorioHoras, setRelatorioHoras] = useState<any[]>([])

  // Período para relatório
  const [periodoTipo, setPeriodoTipo] = useState<'dia' | 'semana' | 'mes' | 'custom'>('mes')
  const [periodoDataInicio, setPeriodoDataInicio] = useState('')
  const [periodoDataFim, setPeriodoDataFim] = useState('')
  const [periodoFuncionario, setPeriodoFuncionario] = useState('')

  // Filtros
  const [filtroFuncionario, setFiltroFuncionario] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showInativos, setShowInativos] = useState(false)

  // Modais
  const [showNovoFuncionarioModal, setShowNovoFuncionarioModal] = useState(false)
  const [showEditarFuncionarioModal, setShowEditarFuncionarioModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showExcluirModal, setShowExcluirModal] = useState(false)
  const [showAjusteModal, setShowAjusteModal] = useState(false)
  const [showPagamentoModal, setShowPagamentoModal] = useState(false)
  const [pagamentoPreview, setPagamentoPreview] = useState<{
    funcionario: FuncionarioPonto
    desde: string
    totalMinutos: number
    totalHoras: number
    valorHora: number
    valorTotal: number
  } | null>(null)
  const [pagamentoSaving, setPagamentoSaving] = useState(false)
  const [showFolhaModal, setShowFolhaModal] = useState(false)
  const [folhaFuncionario, setFolhaFuncionario] = useState<FuncionarioPonto | null>(null)
  const [folhaDataInicio, setFolhaDataInicio] = useState('')
  const [folhaDataFim, setFolhaDataFim] = useState('')
  const [folhaSaving, setFolhaSaving] = useState(false)
  const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioPonto | null>(null)
  const [funcionarioParaExcluir, setFuncionarioParaExcluir] = useState<FuncionarioPonto | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Formulário de ajuste
  const [ajusteForm, setAjusteForm] = useState({
    tipo: 'adicionar' as 'adicionar' | 'remover',
    horas: '',
    minutos: '',
    observacao: '',
  })

  // Formulário
  const [formFuncionario, setFormFuncionario] = useState({
    nome: '',
    cargo: '',
    valor_hora: '',
  })

  // Modais e estado de edição/criação/exclusão de registro
  const [showCriarRegistroModal, setShowCriarRegistroModal] = useState(false)
  const [showEditarRegistroModal, setShowEditarRegistroModal] = useState(false)
  const [showExcluirRegistroModal, setShowExcluirRegistroModal] = useState(false)
  const [registroSelecionado, setRegistroSelecionado] = useState<PontoDetalhado | null>(null)
  const [registroSaving, setRegistroSaving] = useState(false)
  const [criarRegistroForm, setCriarRegistroForm] = useState({
    funcionario_id: '',
    data: '',
    hora_entrada: '',
    hora_saida: '',
    observacao: '',
  })
  const [editarRegistroForm, setEditarRegistroForm] = useState({
    data: '',
    hora_entrada: '',
    hora_saida: '',
    observacao: '',
  })

  // Sub-aba
  const [subTab, setSubTab] = useState<'funcionarios' | 'registros' | 'resumo'>('funcionarios')

  // Inicializar datas do período
  useEffect(() => {
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    setPeriodoDataInicio(inicioMes.toISOString().split('T')[0])
    setPeriodoDataFim(fimMes.toISOString().split('T')[0])
  }, [])

  // Carregar dados
  useEffect(() => {
    loadData()
  }, [showInativos])

  useEffect(() => {
    if (subTab === 'registros') {
      loadRegistros()
    } else if (subTab === 'resumo') {
      loadResumo()
      if (periodoDataInicio && periodoDataFim) {
        loadRelatorioHoras()
      }
    }
  }, [subTab, filtroFuncionario, filtroDataInicio, filtroDataFim, periodoDataInicio, periodoDataFim, periodoFuncionario])

  async function loadData() {
    try {
      setLoading(true)
      const funcs = await api.listFuncionariosPonto({ ativo: !showInativos ? true : undefined })
      setFuncionarios(funcs)
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRegistros() {
    try {
      const regs = await api.listRegistrosPonto({
        funcionarioId: filtroFuncionario || undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      })
      setRegistros(regs)
    } catch (error) {
      console.error('Erro ao carregar registros:', error)
    }
  }

  async function loadResumo() {
    try {
      const res = await api.getResumoPontoFuncionarios()
      setResumo(res)
    } catch (error) {
      console.error('Erro ao carregar resumo:', error)
    }
  }

  async function loadRelatorioHoras() {
    if (!periodoDataInicio || !periodoDataFim) return
    try {
      const res = await api.getRelatorioHorasPorPeriodo({
        dataInicio: periodoDataInicio,
        dataFim: periodoDataFim,
        funcionarioId: periodoFuncionario || undefined,
      })
      setRelatorioHoras(res)
    } catch (error) {
      console.error('Erro ao carregar relatório de horas:', error)
    }
  }

  function handlePeriodoChange(tipo: 'dia' | 'semana' | 'mes' | 'custom') {
    setPeriodoTipo(tipo)
    const hoje = new Date()

    if (tipo === 'dia') {
      const dataHoje = hoje.toISOString().split('T')[0]
      setPeriodoDataInicio(dataHoje)
      setPeriodoDataFim(dataHoje)
    } else if (tipo === 'semana') {
      const diaSemana = hoje.getDay()
      const inicioSemana = new Date(hoje)
      inicioSemana.setDate(hoje.getDate() - diaSemana)
      const fimSemana = new Date(inicioSemana)
      fimSemana.setDate(inicioSemana.getDate() + 6)
      setPeriodoDataInicio(inicioSemana.toISOString().split('T')[0])
      setPeriodoDataFim(fimSemana.toISOString().split('T')[0])
    } else if (tipo === 'mes') {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      setPeriodoDataInicio(inicioMes.toISOString().split('T')[0])
      setPeriodoDataFim(fimMes.toISOString().split('T')[0])
    }
  }

  async function handleSalvarFuncionario(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (selectedFuncionario) {
        await api.updateFuncionarioPonto(selectedFuncionario.id, {
          nome: formFuncionario.nome,
          cargo: formFuncionario.cargo || undefined,
          valor_hora: formFuncionario.valor_hora ? parseFloat(formFuncionario.valor_hora) : 0,
        })
      } else {
        await api.createFuncionarioPonto({
          nome: formFuncionario.nome,
          cargo: formFuncionario.cargo || undefined,
          valor_hora: formFuncionario.valor_hora ? parseFloat(formFuncionario.valor_hora) : 0,
        } as any, userId)
      }
      setShowNovoFuncionarioModal(false)
      setShowEditarFuncionarioModal(false)
      setFormFuncionario({ nome: '', cargo: '', valor_hora: '' })
      setSelectedFuncionario(null)
      loadData()
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error)
    }
  }

  async function handleToggleAtivo(funcionario: FuncionarioPonto) {
    try {
      await api.updateFuncionarioPonto(funcionario.id, {
        ativo: !funcionario.ativo,
      })
      loadData()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    }
  }

  function abrirEditarFuncionario(funcionario: FuncionarioPonto) {
    setSelectedFuncionario(funcionario)
    setFormFuncionario({
      nome: funcionario.nome,
      cargo: funcionario.cargo || '',
      valor_hora: funcionario.valor_hora?.toString() || '',
    })
    setShowEditarFuncionarioModal(true)
  }

  async function handleCalcularPagamento(funcionario: FuncionarioPonto) {
    try {
      const valorHora = Number(funcionario.valor_hora)
      if (!valorHora || valorHora <= 0 || !Number.isFinite(valorHora)) {
        setToast({
          message: `${funcionario.nome} não tem valor/hora configurado. Edite o funcionário antes de calcular o pagamento.`,
          type: 'error',
        })
        return
      }

      const desde = funcionario.data_ultimo_pagamento || funcionario.created_at.split('T')[0]
      const totalMinutos = await api.getHorasTrabalhadasDesde(funcionario.id, desde)

      if (totalMinutos === 0) {
        setToast({ message: `${funcionario.nome} não tem horas fechadas desde ${desde}`, type: 'error' })
        return
      }

      const totalHoras = totalMinutos / 60
      const valorTotal = Math.round(totalHoras * valorHora * 100) / 100

      setPagamentoPreview({ funcionario, desde, totalMinutos, totalHoras, valorHora, valorTotal })
      setShowPagamentoModal(true)
    } catch (error: any) {
      console.error('Erro ao calcular pagamento:', error)
      const msg = error?.message || error?.details || 'Erro ao calcular pagamento'
      setToast({ message: `Erro ao calcular pagamento: ${msg}`, type: 'error' })
    }
  }

  async function confirmarPagamento() {
    if (!pagamentoPreview) return
    const { funcionario, desde, totalHoras, valorHora, valorTotal } = pagamentoPreview
    setPagamentoSaving(true)
    try {
      await api.createContaPagar({
        descricao: `Pagamento ${funcionario.nome} - ${totalHoras.toFixed(1)}h trabalhadas`,
        tipo: 'variavel',
        categoria: 'salarios',
        valor: valorTotal,
        data_vencimento: new Date().toISOString().split('T')[0],
        observacoes: `${totalHoras.toFixed(1)}h x R$${valorHora.toFixed(2)} | Desde: ${desde}`,
      }, userId || undefined)

      await api.marcarPagamentoFuncionario(funcionario.id, new Date().toISOString().split('T')[0])

      setToast({ message: `Conta a pagar de R$ ${valorTotal.toFixed(2)} criada para ${funcionario.nome}`, type: 'success' })
      setShowPagamentoModal(false)
      setPagamentoPreview(null)
      loadData()
    } catch (error: any) {
      console.error('Erro ao confirmar pagamento:', error)
      const msg = error?.message || error?.details || 'Erro ao confirmar pagamento'
      setToast({ message: `Erro: ${msg}`, type: 'error' })
    } finally {
      setPagamentoSaving(false)
    }
  }

  function handleBaixarRelatorioPDF() {
    if (!periodoDataInicio || !periodoDataFim || relatorioHoras.length === 0) return
    const rows = relatorioHoras.map((r) => {
      const func = funcionarios.find((f) => f.id === r.funcionario_id)
      return { ...r, valor_hora: func?.valor_hora ?? null }
    })
    exportRelatorioHorasPDF(rows, periodoDataInicio, periodoDataFim)
  }

  async function carregarDiasFuncionario(funcionarioId: string) {
    const registrosFunc = await api.listRegistrosPonto({
      funcionarioId,
      dataInicio: periodoDataInicio,
      dataFim: periodoDataFim,
      status: 'fechado',
    })
    return registrosFunc
      .map((r: any) => ({
        data: r.data,
        entrada: r.hora_entrada || null,
        saida: r.hora_saida || null,
        minutos: r.total_minutos || 0,
      }))
      .sort((a: any, b: any) => a.data.localeCompare(b.data))
  }

  async function handleBaixarRelatorioFuncionarioPDF(funcionarioId: string) {
    if (!periodoDataInicio || !periodoDataFim) {
      setToast({ message: 'Selecione o período antes de baixar', type: 'error' })
      return
    }
    const func = funcionarios.find((f) => f.id === funcionarioId)
    if (!func) return
    try {
      const dias = await carregarDiasFuncionario(funcionarioId)
      exportRelatorioFuncionarioPDF(
        func.nome,
        func.cargo || null,
        func.valor_hora || null,
        dias,
        periodoDataInicio,
        periodoDataFim,
      )
    } catch (e) {
      console.error(e)
      setToast({ message: 'Erro ao gerar PDF do funcionário', type: 'error' })
    }
  }

  function abrirBaixarFolhaModal(funcionario: FuncionarioPonto) {
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    setFolhaFuncionario(funcionario)
    setFolhaDataInicio(inicioMes.toISOString().split('T')[0])
    setFolhaDataFim(hoje.toISOString().split('T')[0])
    setShowFolhaModal(true)
  }

  async function baixarFolha(formato: 'pdf' | 'docx') {
    if (!folhaFuncionario || !folhaDataInicio || !folhaDataFim) return
    setFolhaSaving(true)
    try {
      const registrosFunc = await api.listRegistrosPonto({
        funcionarioId: folhaFuncionario.id,
        dataInicio: folhaDataInicio,
        dataFim: folhaDataFim,
        status: 'fechado',
      })
      const dias = registrosFunc
        .map((r: any) => ({
          data: r.data,
          entrada: r.hora_entrada || null,
          saida: r.hora_saida || null,
          minutos: r.total_minutos || 0,
        }))
        .sort((a: any, b: any) => a.data.localeCompare(b.data))

      if (dias.length === 0) {
        setToast({ message: 'Nenhum registro fechado no período selecionado', type: 'error' })
        return
      }

      if (formato === 'pdf') {
        exportRelatorioFuncionarioPDF(
          folhaFuncionario.nome,
          folhaFuncionario.cargo || null,
          folhaFuncionario.valor_hora || null,
          dias,
          folhaDataInicio,
          folhaDataFim,
        )
      } else {
        await exportRelatorioFuncionarioDOCX(
          folhaFuncionario.nome,
          folhaFuncionario.cargo || null,
          folhaFuncionario.valor_hora || null,
          dias,
          folhaDataInicio,
          folhaDataFim,
        )
      }
      setShowFolhaModal(false)
    } catch (e: any) {
      console.error(e)
      setToast({ message: `Erro ao gerar folha: ${e?.message || 'erro desconhecido'}`, type: 'error' })
    } finally {
      setFolhaSaving(false)
    }
  }

  async function handleBaixarRelatorioFuncionarioDOCX(funcionarioId: string) {
    if (!periodoDataInicio || !periodoDataFim) {
      setToast({ message: 'Selecione o período antes de baixar', type: 'error' })
      return
    }
    const func = funcionarios.find((f) => f.id === funcionarioId)
    if (!func) return
    try {
      const dias = await carregarDiasFuncionario(funcionarioId)
      await exportRelatorioFuncionarioDOCX(
        func.nome,
        func.cargo || null,
        func.valor_hora || null,
        dias,
        periodoDataInicio,
        periodoDataFim,
      )
    } catch (e) {
      console.error(e)
      setToast({ message: 'Erro ao gerar DOCX do funcionário', type: 'error' })
    }
  }

  function abrirLinkModal(funcionario: FuncionarioPonto) {
    setSelectedFuncionario(funcionario)
    setShowLinkModal(true)
    setCopiedLink(false)
  }

  function getLinkPonto(token: string): string {
    // URL fixa do ponto-mobile na Vercel
    return `https://ponto-mobile.vercel.app/ponto/${token}`
  }

  async function copiarLink() {
    if (!selectedFuncionario) return
    const link = getLinkPonto(selectedFuncionario.ponto_token)
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 3000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
    }
  }

  function abrirExcluirModal(funcionario: FuncionarioPonto) {
    setFuncionarioParaExcluir(funcionario)
    setShowExcluirModal(true)
  }

  async function confirmarExclusao() {
    if (!funcionarioParaExcluir) return
    try {
      await api.deleteFuncionarioPonto(funcionarioParaExcluir.id)
      setToast({ message: 'Funcionário excluído com sucesso!', type: 'success' })
      setShowExcluirModal(false)
      setFuncionarioParaExcluir(null)
      loadData()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao excluir funcionário', type: 'error' })
    }
  }

  function abrirAjusteModal(funcionario: FuncionarioPonto) {
    setSelectedFuncionario(funcionario)
    setAjusteForm({
      tipo: 'adicionar',
      horas: '',
      minutos: '',
      observacao: '',
    })
    setShowAjusteModal(true)
  }

  async function handleAjusteHoras(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFuncionario) return

    const horas = parseInt(ajusteForm.horas || '0')
    const minutos = parseInt(ajusteForm.minutos || '0')
    let totalMinutos = (horas * 60) + minutos

    if (ajusteForm.tipo === 'remover') {
      totalMinutos = -totalMinutos
    }

    if (totalMinutos === 0) {
      setToast({ message: 'Informe as horas ou minutos a ajustar', type: 'error' })
      return
    }

    try {
      await api.criarAjusteHoras(
        selectedFuncionario.id,
        totalMinutos,
        ajusteForm.observacao || `Ajuste manual: ${ajusteForm.tipo === 'adicionar' ? '+' : '-'}${horas}h ${minutos}min`,
        userId
      )
      setToast({
        message: `Ajuste de ${ajusteForm.tipo === 'adicionar' ? '+' : '-'}${horas}h ${minutos}min registrado!`,
        type: 'success'
      })
      setShowAjusteModal(false)
      setSelectedFuncionario(null)
      loadResumo()
      loadRegistros()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao registrar ajuste', type: 'error' })
    }
  }

  function abrirCriarRegistro() {
    const hoje = new Date().toISOString().split('T')[0]
    setCriarRegistroForm({
      funcionario_id: filtroFuncionario || (funcionarios[0]?.id ?? ''),
      data: hoje,
      hora_entrada: '08:00',
      hora_saida: '17:00',
      observacao: '',
    })
    setShowCriarRegistroModal(true)
  }

  function combinarDataHoraISO(data: string, hora: string): string {
    return new Date(`${data}T${hora}:00`).toISOString()
  }

  async function handleCriarRegistroManual(e: React.FormEvent) {
    e.preventDefault()
    if (!criarRegistroForm.funcionario_id || !criarRegistroForm.data || !criarRegistroForm.hora_entrada) {
      setToast({ message: 'Preencha funcionário, data e hora de entrada', type: 'error' })
      return
    }

    if (criarRegistroForm.hora_saida && criarRegistroForm.hora_saida <= criarRegistroForm.hora_entrada) {
      setToast({ message: 'A hora de saída deve ser maior que a hora de entrada', type: 'error' })
      return
    }

    setRegistroSaving(true)
    try {
      await api.createRegistroPontoManual({
        funcionario_id: criarRegistroForm.funcionario_id,
        data: criarRegistroForm.data,
        hora_entrada: combinarDataHoraISO(criarRegistroForm.data, criarRegistroForm.hora_entrada),
        hora_saida: criarRegistroForm.hora_saida
          ? combinarDataHoraISO(criarRegistroForm.data, criarRegistroForm.hora_saida)
          : undefined,
        observacao: criarRegistroForm.observacao || undefined,
      }, userId)

      setToast({ message: 'Registro criado com sucesso!', type: 'success' })
      setShowCriarRegistroModal(false)
      loadRegistros()
      loadResumo()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao criar registro', type: 'error' })
    } finally {
      setRegistroSaving(false)
    }
  }

  function abrirEditarRegistro(reg: PontoDetalhado) {
    const horaEntradaLocal = reg.hora_entrada
      ? new Date(reg.hora_entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
      : ''
    const horaSaidaLocal = reg.hora_saida
      ? new Date(reg.hora_saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
      : ''

    setRegistroSelecionado(reg)
    setEditarRegistroForm({
      data: reg.data,
      hora_entrada: horaEntradaLocal,
      hora_saida: horaSaidaLocal,
      observacao: reg.observacao || '',
    })
    setShowEditarRegistroModal(true)
  }

  async function handleSalvarEdicaoRegistro(e: React.FormEvent) {
    e.preventDefault()
    if (!registroSelecionado) return

    if (editarRegistroForm.hora_saida && editarRegistroForm.hora_entrada
        && editarRegistroForm.hora_saida <= editarRegistroForm.hora_entrada) {
      setToast({ message: 'A hora de saída deve ser maior que a hora de entrada', type: 'error' })
      return
    }

    setRegistroSaving(true)
    try {
      const updates: { hora_entrada?: string; hora_saida?: string; observacao?: string } = {}

      if (editarRegistroForm.hora_entrada) {
        updates.hora_entrada = combinarDataHoraISO(editarRegistroForm.data, editarRegistroForm.hora_entrada)
      }
      if (editarRegistroForm.hora_saida) {
        updates.hora_saida = combinarDataHoraISO(editarRegistroForm.data, editarRegistroForm.hora_saida)
      }
      if (editarRegistroForm.observacao !== (registroSelecionado.observacao || '')) {
        updates.observacao = editarRegistroForm.observacao
      }

      if (Object.keys(updates).length === 0) {
        setToast({ message: 'Nenhuma alteração para salvar', type: 'error' })
        setRegistroSaving(false)
        return
      }

      await api.updateRegistroPonto(registroSelecionado.id, updates, userId)

      setToast({ message: 'Registro atualizado com sucesso!', type: 'success' })
      setShowEditarRegistroModal(false)
      setRegistroSelecionado(null)
      loadRegistros()
      loadResumo()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao atualizar registro', type: 'error' })
    } finally {
      setRegistroSaving(false)
    }
  }

  function abrirExcluirRegistro(reg: PontoDetalhado) {
    setRegistroSelecionado(reg)
    setShowExcluirRegistroModal(true)
  }

  async function confirmarExclusaoRegistro() {
    if (!registroSelecionado) return
    setRegistroSaving(true)
    try {
      await api.deleteRegistroPonto(registroSelecionado.id)
      setToast({ message: 'Registro excluído com sucesso!', type: 'success' })
      setShowExcluirRegistroModal(false)
      setRegistroSelecionado(null)
      loadRegistros()
      loadResumo()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao excluir registro', type: 'error' })
    } finally {
      setRegistroSaving(false)
    }
  }

  // Filtrar funcionários por busca
  const funcionariosFiltrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.cargo && f.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-slate-400 text-lg">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-4">
        <Button
          variant={subTab === 'funcionarios' ? 'primary' : 'outline'}
          onClick={() => setSubTab('funcionarios')}
        >
          <Users size={18} className="mr-2" />
          Funcionários
        </Button>
        <Button
          variant={subTab === 'registros' ? 'primary' : 'outline'}
          onClick={() => setSubTab('registros')}
        >
          <Clock size={18} className="mr-2" />
          Registros
        </Button>
        <Button
          variant={subTab === 'resumo' ? 'primary' : 'outline'}
          onClick={() => setSubTab('resumo')}
        >
          <Calendar size={18} className="mr-2" />
          Resumo
        </Button>
      </div>

      {/* Sub-tab: Funcionários */}
      {subTab === 'funcionarios' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar funcionário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={showInativos}
                  onChange={(e) => setShowInativos(e.target.checked)}
                  className="rounded"
                />
                Mostrar inativos
              </label>
            </div>
            <Button onClick={() => {
              setSelectedFuncionario(null)
              setFormFuncionario({ nome: '', cargo: '', valor_hora: '' })
              setShowNovoFuncionarioModal(true)
            }}>
              <Plus size={20} className="mr-2" />
              Novo Funcionário
            </Button>
          </div>

          {/* Lista de funcionários */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {funcionariosFiltrados.map((funcionario) => (
              <Card key={funcionario.id} className={!funcionario.ativo ? 'opacity-60' : ''}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{funcionario.nome}</h3>
                    {funcionario.cargo && (
                      <p className="text-gray-500 dark:text-slate-500">{funcionario.cargo}</p>
                    )}
                    {funcionario.valor_hora > 0 && (
                      <p className="text-blue-600 font-semibold mt-1">R$ {funcionario.valor_hora.toFixed(2)}/hora</p>
                    )}
                    <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full ${
                      funcionario.ativo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {funcionario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => abrirLinkModal(funcionario)}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg"
                      title="Ver link do ponto"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => abrirEditarFuncionario(funcionario)}
                      className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => abrirExcluirModal(funcionario)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                  {funcionario.valor_hora > 0 && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleCalcularPagamento(funcionario)}
                      fullWidth
                    >
                      <DollarSign size={16} className="mr-2" />
                      Calcular Pagamento
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirBaixarFolhaModal(funcionario)}
                    fullWidth
                  >
                    <Download size={16} className="mr-2" />
                    Baixar Folha (PDF/DOCX)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirAjusteModal(funcionario)}
                    fullWidth
                  >
                    <Clock size={16} className="mr-2" />
                    Ajustar Horas
                  </Button>
                  <Button
                    size="sm"
                    variant={funcionario.ativo ? 'danger' : 'success'}
                    onClick={() => handleToggleAtivo(funcionario)}
                    fullWidth
                  >
                    {funcionario.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {funcionariosFiltrados.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500 dark:text-slate-500">Nenhum funcionário encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab: Registros */}
      {subTab === 'registros' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Funcionário</label>
              <select
                value={filtroFuncionario}
                onChange={(e) => setFiltroFuncionario(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Início</label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data Fim</label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button onClick={loadRegistros} variant="secondary">
              <RefreshCw size={18} className="mr-2" />
              Atualizar
            </Button>
            <Button onClick={abrirCriarRegistro} variant="primary">
              <Plus size={18} className="mr-2" />
              Novo registro manual
            </Button>
          </div>

          {/* Tabela de registros */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                  <th className="text-left p-3 font-semibold">Funcionário</th>
                  <th className="text-left p-3 font-semibold">Data</th>
                  <th className="text-left p-3 font-semibold">Entrada</th>
                  <th className="text-left p-3 font-semibold">Saída</th>
                  <th className="text-left p-3 font-semibold">Total</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Origem</th>
                  <th className="text-right p-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((reg) => (
                  <tr key={reg.id} className="border-b hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{reg.funcionario_nome}</p>
                        {reg.funcionario_cargo && (
                          <p className="text-sm text-gray-500 dark:text-slate-500">{reg.funcionario_cargo}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{formatDate(reg.data)}</td>
                    <td className="p-3 text-green-600 font-medium">{formatTime(reg.hora_entrada)}</td>
                    <td className="p-3 text-red-600 font-medium">{formatTime(reg.hora_saida)}</td>
                    <td className="p-3 font-bold">{reg.total_formatado || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        reg.status === 'fechado'
                          ? 'bg-green-100 text-green-700'
                          : reg.status === 'aberto'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {reg.status === 'fechado' ? 'Fechado' : reg.status === 'aberto' ? 'Aberto' : 'Ajustado'}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-500 dark:text-slate-500">{reg.origem}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEditarRegistro(reg)}
                          className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                          title="Editar registro"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => abrirExcluirRegistro(reg)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg"
                          title="Excluir registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {registros.length === 0 && (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500 dark:text-slate-500">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab: Resumo */}
      {subTab === 'resumo' && (
        <div className="space-y-6">
          {/* Filtros de Período */}
          <Card className="bg-blue-50 border-blue-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Período</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => handlePeriodoChange('dia')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'dia'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => handlePeriodoChange('semana')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'semana'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => handlePeriodoChange('mes')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'mes'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => setPeriodoTipo('custom')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'custom'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">De</label>
                <input
                  type="date"
                  value={periodoDataInicio}
                  onChange={(e) => {
                    setPeriodoDataInicio(e.target.value)
                    setPeriodoTipo('custom')
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Até</label>
                <input
                  type="date"
                  value={periodoDataFim}
                  onChange={(e) => {
                    setPeriodoDataFim(e.target.value)
                    setPeriodoTipo('custom')
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Funcionário</label>
                <select
                  value={periodoFuncionario}
                  onChange={(e) => setPeriodoFuncionario(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <Button onClick={loadRelatorioHoras} variant="secondary">
                <RefreshCw size={18} className="mr-2" />
                Atualizar
              </Button>
              <Button
                onClick={handleBaixarRelatorioPDF}
                variant="primary"
                disabled={relatorioHoras.length === 0 || !periodoDataInicio || !periodoDataFim}
              >
                <Download size={18} className="mr-2" />
                Baixar PDF
              </Button>
            </div>
          </Card>

          {/* Relatório de Horas por Período */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <FileText size={20} />
              Relatório de Horas - {periodoDataInicio && periodoDataFim
                ? `${new Date(periodoDataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(periodoDataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                : 'Selecione um período'}
            </h3>

            {relatorioHoras.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white dark:bg-slate-900 rounded-lg overflow-hidden shadow">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                      <th className="text-left p-4 font-semibold">Funcionário</th>
                      <th className="text-center p-4 font-semibold">Dias Trabalhados</th>
                      <th className="text-center p-4 font-semibold">Total de Horas</th>
                      <th className="text-center p-4 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioHoras.map((r) => (
                      <tr key={r.funcionario_id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">{r.funcionario_nome}</p>
                            {r.funcionario_cargo && (
                              <p className="text-sm text-gray-500 dark:text-slate-500">{r.funcionario_cargo}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold">{r.total_dias}</span>
                          <span className="text-gray-500 dark:text-slate-500 text-sm ml-1">dias</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold text-blue-600 text-lg">
                            {r.total_horas_formatado}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleBaixarRelatorioFuncionarioPDF(r.funcionario_id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                              title="Baixar folha detalhada em PDF"
                            >
                              <Download size={14} />
                              PDF
                            </button>
                            <button
                              onClick={() => handleBaixarRelatorioFuncionarioDOCX(r.funcionario_id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                              title="Baixar folha detalhada em DOCX"
                            >
                              <Download size={14} />
                              DOCX
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                    <tr>
                      <td className="p-4 font-semibold text-gray-900 dark:text-slate-100">TOTAL GERAL</td>
                      <td className="p-4 text-center font-semibold text-gray-900 dark:text-slate-100">
                        {relatorioHoras.reduce((acc, r) => acc + r.total_dias, 0)} dias
                      </td>
                      <td className="p-4 text-center font-semibold text-blue-700 dark:text-blue-400 text-base">
                        {formatMinutesToHours(relatorioHoras.reduce((acc, r) => acc + r.total_minutos, 0))}
                      </td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg shadow">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500 dark:text-slate-500">Nenhum registro encontrado no período selecionado</p>
              </div>
            )}
          </div>

          {/* Resumo Geral (histórico) */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Histórico Geral (todos os registros)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumo.map((r) => (
                <Card key={r.funcionario_id}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{r.nome}</h3>
                      {r.cargo && <p className="text-gray-500 dark:text-slate-500">{r.cargo}</p>}
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      r.ativo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {r.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Total de registros:</span>
                      <span className="font-bold">{r.total_registros}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-slate-400">Horas trabalhadas:</span>
                      <span className="font-bold text-blue-600">
                        {formatMinutesToHours(r.total_minutos_trabalhados)}
                      </span>
                    </div>
                    {r.pontos_abertos > 0 && (
                      <div className="flex justify-between text-yellow-600">
                        <span>Pontos abertos:</span>
                        <span className="font-bold">{r.pontos_abertos}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-slate-500">Último ponto:</span>
                      <span>{formatDate(r.ultima_data_ponto)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {resumo.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500 dark:text-slate-500">Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Novo/Editar Funcionário */}
      <Modal
        isOpen={showNovoFuncionarioModal || showEditarFuncionarioModal}
        onClose={() => {
          setShowNovoFuncionarioModal(false)
          setShowEditarFuncionarioModal(false)
          setSelectedFuncionario(null)
        }}
        title={selectedFuncionario ? 'Editar Funcionário' : 'Novo Funcionário'}
      >
        <form onSubmit={handleSalvarFuncionario} className="space-y-4">
          <Input
            label="Nome *"
            value={formFuncionario.nome}
            onChange={(e) => setFormFuncionario({ ...formFuncionario, nome: e.target.value })}
            required
          />
          <Input
            label="Cargo"
            value={formFuncionario.cargo}
            onChange={(e) => setFormFuncionario({ ...formFuncionario, cargo: e.target.value })}
            placeholder="Ex: Operador, Torneiro, etc."
          />
          <Input
            label="Valor da Hora (R$)"
            type="number"
            step="0.01"
            value={formFuncionario.valor_hora}
            onChange={(e) => setFormFuncionario({ ...formFuncionario, valor_hora: e.target.value })}
            placeholder="Ex: 25.00"
          />
          <Button type="submit" fullWidth>
            {selectedFuncionario ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
          </Button>
        </form>
      </Modal>

      {/* Modal: Link do Ponto */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false)
          setSelectedFuncionario(null)
        }}
        title="Link do Ponto Eletrônico"
      >
        {selectedFuncionario && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{selectedFuncionario.nome}</p>
              {selectedFuncionario.cargo && (
                <p className="text-gray-500 dark:text-slate-500">{selectedFuncionario.cargo}</p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">Link para bater ponto:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getLinkPonto(selectedFuncionario.ponto_token)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-sm"
                />
                <Button onClick={copiarLink}>
                  {copiedLink ? (
                    <>
                      <CheckCircle size={18} className="mr-1" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={18} className="mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Instruções:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copie o link acima</li>
                <li>Envie para o funcionário via WhatsApp</li>
                <li>O funcionário salva o link na tela inicial do celular</li>
                <li>Ao acessar, pode bater entrada ou saída</li>
              </ol>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar Exclusão */}
      <Modal
        isOpen={showExcluirModal}
        onClose={() => {
          setShowExcluirModal(false)
          setFuncionarioParaExcluir(null)
        }}
        title="Confirmar Exclusão"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              Tem certeza que deseja excluir o funcionário "{funcionarioParaExcluir?.nome}"?
            </p>
            <p className="text-red-600 text-sm mt-2">
              Esta ação não pode ser desfeita. Todos os registros de ponto deste funcionário também serão excluídos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowExcluirModal(false)
                setFuncionarioParaExcluir(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={confirmarExclusao}
            >
              Excluir Funcionário
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar Pagamento */}
      <Modal
        isOpen={showPagamentoModal}
        onClose={() => {
          if (pagamentoSaving) return
          setShowPagamentoModal(false)
          setPagamentoPreview(null)
        }}
        title="Calcular pagamento"
        size="sm"
      >
        {pagamentoPreview && (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                {pagamentoPreview.funcionario.nome}
              </p>
              {pagamentoPreview.funcionario.cargo && (
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  {pagamentoPreview.funcionario.cargo}
                </p>
              )}
            </div>

            <div className="rounded-md border border-gray-200 dark:border-slate-800 divide-y divide-gray-200 dark:divide-slate-800">
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-500 dark:text-slate-400">Período</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {new Date(pagamentoPreview.desde + 'T12:00:00').toLocaleDateString('pt-BR')} → hoje
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-500 dark:text-slate-400">Horas trabalhadas</span>
                <span className="font-medium text-gray-900 dark:text-slate-100 tabular-nums">
                  {pagamentoPreview.totalHoras.toFixed(1)}h
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-gray-500 dark:text-slate-400">Valor/hora</span>
                <span className="font-medium text-gray-900 dark:text-slate-100 tabular-nums">
                  R$ {pagamentoPreview.valorHora.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800/50">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Total a pagar</span>
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  R$ {pagamentoPreview.valorTotal.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Uma conta a pagar será criada e o funcionário será marcado como pago até hoje.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPagamentoModal(false)
                  setPagamentoPreview(null)
                }}
                disabled={pagamentoSaving}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmarPagamento}
                disabled={pagamentoSaving}
              >
                {pagamentoSaving ? 'Salvando...' : 'Confirmar pagamento'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Baixar Folha */}
      <Modal
        isOpen={showFolhaModal}
        onClose={() => {
          if (folhaSaving) return
          setShowFolhaModal(false)
          setFolhaFuncionario(null)
        }}
        title={folhaFuncionario ? `Baixar folha — ${folhaFuncionario.nome}` : 'Baixar folha'}
        size="sm"
      >
        {folhaFuncionario && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Data início</label>
                <input
                  type="date"
                  value={folhaDataInicio}
                  onChange={(e) => setFolhaDataInicio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Data fim</label>
                <input
                  type="date"
                  value={folhaDataFim}
                  onChange={(e) => setFolhaDataFim(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const hoje = new Date()
                  setFolhaDataInicio(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0])
                  setFolhaDataFim(hoje.toISOString().split('T')[0])
                }}
                className="px-3 py-1 text-xs rounded-md border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Mês atual
              </button>
              <button
                type="button"
                onClick={() => {
                  const hoje = new Date()
                  const ultimoMes = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
                  const fimUltimoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
                  setFolhaDataInicio(ultimoMes.toISOString().split('T')[0])
                  setFolhaDataFim(fimUltimoMes.toISOString().split('T')[0])
                }}
                className="px-3 py-1 text-xs rounded-md border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Mês anterior
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              A folha inclui apenas os dias com ponto <strong>fechado</strong> no período.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowFolhaModal(false)
                  setFolhaFuncionario(null)
                }}
                disabled={folhaSaving}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => baixarFolha('docx')}
                disabled={folhaSaving || !folhaDataInicio || !folhaDataFim}
              >
                <Download size={14} className="mr-1" />
                DOCX
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => baixarFolha('pdf')}
                disabled={folhaSaving || !folhaDataInicio || !folhaDataFim}
              >
                <Download size={14} className="mr-1" />
                PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Criar Registro Manual */}
      <Modal
        isOpen={showCriarRegistroModal}
        onClose={() => {
          if (registroSaving) return
          setShowCriarRegistroModal(false)
        }}
        title="Novo registro manual"
      >
        <form onSubmit={handleCriarRegistroManual} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
            Use para lançar um dia em que o funcionário esqueceu de bater ponto.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Funcionário *</label>
            <select
              value={criarRegistroForm.funcionario_id}
              onChange={(e) => setCriarRegistroForm({ ...criarRegistroForm, funcionario_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="">Selecione...</option>
              {funcionarios.filter(f => f.ativo).map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data *</label>
            <input
              type="date"
              value={criarRegistroForm.data}
              onChange={(e) => setCriarRegistroForm({ ...criarRegistroForm, data: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Entrada *</label>
              <input
                type="time"
                value={criarRegistroForm.hora_entrada}
                onChange={(e) => setCriarRegistroForm({ ...criarRegistroForm, hora_entrada: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Saída</label>
              <input
                type="time"
                value={criarRegistroForm.hora_saida}
                onChange={(e) => setCriarRegistroForm({ ...criarRegistroForm, hora_saida: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Observação</label>
            <textarea
              value={criarRegistroForm.observacao}
              onChange={(e) => setCriarRegistroForm({ ...criarRegistroForm, observacao: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={2}
              placeholder="Ex: Esqueceu de bater ponto"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCriarRegistroModal(false)}
              disabled={registroSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={registroSaving}>
              {registroSaving ? 'Salvando...' : 'Criar registro'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Editar Registro */}
      <Modal
        isOpen={showEditarRegistroModal}
        onClose={() => {
          if (registroSaving) return
          setShowEditarRegistroModal(false)
          setRegistroSelecionado(null)
        }}
        title={registroSelecionado ? `Editar registro — ${registroSelecionado.funcionario_nome}` : 'Editar registro'}
      >
        {registroSelecionado && (
          <form onSubmit={handleSalvarEdicaoRegistro} className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
              Edite só o que precisa corrigir. Campos vazios serão removidos.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data</label>
              <input
                type="date"
                value={editarRegistroForm.data}
                readOnly
                disabled
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-md cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Para mover o registro para outro dia, exclua-o e crie um novo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Entrada</label>
                <input
                  type="time"
                  value={editarRegistroForm.hora_entrada}
                  onChange={(e) => setEditarRegistroForm({ ...editarRegistroForm, hora_entrada: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Saída</label>
                <input
                  type="time"
                  value={editarRegistroForm.hora_saida}
                  onChange={(e) => setEditarRegistroForm({ ...editarRegistroForm, hora_saida: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Observação</label>
              <textarea
                value={editarRegistroForm.observacao}
                onChange={(e) => setEditarRegistroForm({ ...editarRegistroForm, observacao: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowEditarRegistroModal(false)
                  setRegistroSelecionado(null)
                }}
                disabled={registroSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={registroSaving}>
                {registroSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Confirmar Exclusão de Registro */}
      <Modal
        isOpen={showExcluirRegistroModal}
        onClose={() => {
          if (registroSaving) return
          setShowExcluirRegistroModal(false)
          setRegistroSelecionado(null)
        }}
        title="Excluir registro"
      >
        {registroSelecionado && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-300 font-medium">
                Apagar o registro abaixo?
              </p>
              <div className="mt-3 text-sm text-red-700 dark:text-red-300 space-y-1">
                <p><strong>Funcionário:</strong> {registroSelecionado.funcionario_nome}</p>
                <p><strong>Data:</strong> {formatDate(registroSelecionado.data)}</p>
                <p><strong>Entrada:</strong> {formatTime(registroSelecionado.hora_entrada)}</p>
                <p><strong>Saída:</strong> {formatTime(registroSelecionado.hora_saida)}</p>
                <p><strong>Origem:</strong> {registroSelecionado.origem}</p>
              </div>
              <p className="text-red-600 dark:text-red-400 text-xs mt-3">
                Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowExcluirRegistroModal(false)
                  setRegistroSelecionado(null)
                }}
                disabled={registroSaving}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmarExclusaoRegistro}
                disabled={registroSaving}
              >
                {registroSaving ? 'Excluindo...' : 'Excluir registro'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Ajustar Horas */}
      <Modal
        isOpen={showAjusteModal}
        onClose={() => {
          setShowAjusteModal(false)
          setSelectedFuncionario(null)
        }}
        title={`Ajustar Horas - ${selectedFuncionario?.nome}`}
      >
        <form onSubmit={handleAjusteHoras} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-300 text-sm">
              Use esta função para corrigir problemas no ponto. O ajuste será registrado como "ajuste manual".
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Tipo de Ajuste</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAjusteForm({ ...ajusteForm, tipo: 'adicionar' })}
                className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  ajusteForm.tipo === 'adicionar'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <PlusCircle size={20} />
                Adicionar Horas
              </button>
              <button
                type="button"
                onClick={() => setAjusteForm({ ...ajusteForm, tipo: 'remover' })}
                className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  ajusteForm.tipo === 'remover'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <MinusCircle size={20} />
                Remover Horas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Horas</label>
              <input
                type="number"
                min="0"
                max="24"
                value={ajusteForm.horas}
                onChange={(e) => setAjusteForm({ ...ajusteForm, horas: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Minutos</label>
              <input
                type="number"
                min="0"
                max="59"
                value={ajusteForm.minutos}
                onChange={(e) => setAjusteForm({ ...ajusteForm, minutos: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Motivo do Ajuste</label>
            <textarea
              value={ajusteForm.observacao}
              onChange={(e) => setAjusteForm({ ...ajusteForm, observacao: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={2}
              placeholder="Ex: Esqueceu de bater ponto na saída"
            />
          </div>

          <Button type="submit" fullWidth variant={ajusteForm.tipo === 'adicionar' ? 'success' : 'danger'}>
            {ajusteForm.tipo === 'adicionar' ? (
              <>
                <PlusCircle size={20} className="mr-2" />
                Adicionar {ajusteForm.horas || '0'}h {ajusteForm.minutos || '0'}min
              </>
            ) : (
              <>
                <MinusCircle size={20} className="mr-2" />
                Remover {ajusteForm.horas || '0'}h {ajusteForm.minutos || '0'}min
              </>
            )}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
