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
} from 'lucide-react'
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
      const desde = funcionario.data_ultimo_pagamento || funcionario.created_at.split('T')[0]
      const totalMinutos = await api.getHorasTrabalhadasDesde(funcionario.id, desde)
      const totalHoras = totalMinutos / 60
      const valorTotal = Math.round(totalHoras * funcionario.valor_hora * 100) / 100

      if (totalMinutos === 0) {
        setToast({ message: `${funcionario.nome} não tem horas registradas desde o último pagamento`, type: 'error' })
        return
      }

      const confirma = window.confirm(
        `${funcionario.nome}\n\n` +
        `Período: ${desde} até hoje\n` +
        `Horas trabalhadas: ${totalHoras.toFixed(1)}h\n` +
        `Valor/hora: R$ ${funcionario.valor_hora.toFixed(2)}\n` +
        `Total a pagar: R$ ${valorTotal.toFixed(2)}\n\n` +
        `Deseja criar conta a pagar e marcar como pago até hoje?`
      )

      if (!confirma) return

      // Create conta a pagar
      await api.createContaPagar({
        descricao: `Pagamento ${funcionario.nome} - ${totalHoras.toFixed(1)}h trabalhadas`,
        tipo: 'variavel',
        categoria: 'salarios',
        valor: valorTotal,
        data_vencimento: new Date().toISOString().split('T')[0],
        observacoes: `${totalHoras.toFixed(1)}h x R$${funcionario.valor_hora.toFixed(2)} | Desde: ${desde}`,
      }, userId || undefined)

      // Mark payment date
      await api.marcarPagamentoFuncionario(funcionario.id, new Date().toISOString().split('T')[0])

      setToast({ message: `Conta a pagar de R$ ${valorTotal.toFixed(2)} criada para ${funcionario.nome}`, type: 'success' })
      loadData()
    } catch (error) {
      console.error('Erro ao calcular pagamento:', error)
      setToast({ message: 'Erro ao calcular pagamento', type: 'error' })
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

  // Filtrar funcionários por busca
  const funcionariosFiltrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.cargo && f.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Carregando...</p>
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
                  className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
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
                    <h3 className="text-lg font-bold text-gray-900">{funcionario.nome}</h3>
                    {funcionario.cargo && (
                      <p className="text-gray-500">{funcionario.cargo}</p>
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
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Ver link do ponto"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => abrirEditarFuncionario(funcionario)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
              <p className="mt-4 text-gray-500">Nenhum funcionário encontrado</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
              <select
                value={filtroFuncionario}
                onChange={(e) => setFiltroFuncionario(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">Todos</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <Button onClick={loadRegistros} variant="secondary">
              <RefreshCw size={18} className="mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Tabela de registros */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 font-semibold">Funcionário</th>
                  <th className="text-left p-3 font-semibold">Data</th>
                  <th className="text-left p-3 font-semibold">Entrada</th>
                  <th className="text-left p-3 font-semibold">Saída</th>
                  <th className="text-left p-3 font-semibold">Total</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Origem</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((reg) => (
                  <tr key={reg.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{reg.funcionario_nome}</p>
                        {reg.funcionario_cargo && (
                          <p className="text-sm text-gray-500">{reg.funcionario_cargo}</p>
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
                    <td className="p-3 text-sm text-gray-500">{reg.origem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {registros.length === 0 && (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab: Resumo */}
      {subTab === 'resumo' && (
        <div className="space-y-6">
          {/* Filtros de Período */}
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => handlePeriodoChange('dia')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'dia'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => handlePeriodoChange('semana')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'semana'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => handlePeriodoChange('mes')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'mes'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => setPeriodoTipo('custom')}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      periodoTipo === 'custom'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
                <input
                  type="date"
                  value={periodoDataInicio}
                  onChange={(e) => {
                    setPeriodoDataInicio(e.target.value)
                    setPeriodoTipo('custom')
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Até</label>
                <input
                  type="date"
                  value={periodoDataFim}
                  onChange={(e) => {
                    setPeriodoDataFim(e.target.value)
                    setPeriodoTipo('custom')
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
                <select
                  value={periodoFuncionario}
                  onChange={(e) => setPeriodoFuncionario(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
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
            </div>
          </Card>

          {/* Relatório de Horas por Período */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={20} />
              Relatório de Horas - {periodoDataInicio && periodoDataFim
                ? `${new Date(periodoDataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(periodoDataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                : 'Selecione um período'}
            </h3>

            {relatorioHoras.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-4 font-semibold">Funcionário</th>
                      <th className="text-center p-4 font-semibold">Dias Trabalhados</th>
                      <th className="text-center p-4 font-semibold">Total de Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorioHoras.map((r) => (
                      <tr key={r.funcionario_id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-gray-900">{r.funcionario_nome}</p>
                            {r.funcionario_cargo && (
                              <p className="text-sm text-gray-500">{r.funcionario_cargo}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold">{r.total_dias}</span>
                          <span className="text-gray-500 text-sm ml-1">dias</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold text-blue-600 text-lg">
                            {r.total_horas_formatado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50">
                    <tr>
                      <td className="p-4 font-bold text-gray-900">TOTAL GERAL</td>
                      <td className="p-4 text-center font-bold">
                        {relatorioHoras.reduce((acc, r) => acc + r.total_dias, 0)} dias
                      </td>
                      <td className="p-4 text-center font-bold text-blue-700 text-lg">
                        {formatMinutesToHours(relatorioHoras.reduce((acc, r) => acc + r.total_minutos, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Nenhum registro encontrado no período selecionado</p>
              </div>
            )}
          </div>

          {/* Resumo Geral (histórico) */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Histórico Geral (todos os registros)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumo.map((r) => (
                <Card key={r.funcionario_id}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{r.nome}</h3>
                      {r.cargo && <p className="text-gray-500">{r.cargo}</p>}
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
                      <span className="text-gray-600">Total de registros:</span>
                      <span className="font-bold">{r.total_registros}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Horas trabalhadas:</span>
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
                      <span className="text-gray-500">Último ponto:</span>
                      <span>{formatDate(r.ultima_data_ponto)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {resumo.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Nenhum dado disponível</p>
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
              <p className="text-lg font-bold text-gray-900">{selectedFuncionario.nome}</p>
              {selectedFuncionario.cargo && (
                <p className="text-gray-500">{selectedFuncionario.cargo}</p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Link para bater ponto:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getLinkPonto(selectedFuncionario.ponto_token)}
                  className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm"
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

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Use esta função para corrigir problemas no ponto. O ajuste será registrado como "ajuste manual".
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Ajuste</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAjusteForm({ ...ajusteForm, tipo: 'adicionar' })}
                className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  ajusteForm.tipo === 'adicionar'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <MinusCircle size={20} />
                Remover Horas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
              <input
                type="number"
                min="0"
                max="24"
                value={ajusteForm.horas}
                onChange={(e) => setAjusteForm({ ...ajusteForm, horas: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minutos</label>
              <input
                type="number"
                min="0"
                max="59"
                value={ajusteForm.minutos}
                onChange={(e) => setAjusteForm({ ...ajusteForm, minutos: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Ajuste</label>
            <textarea
              value={ajusteForm.observacao}
              onChange={(e) => setAjusteForm({ ...ajusteForm, observacao: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
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
