import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, CheckCircle, Plus, AlertTriangle, Play, Pause, Square, XCircle, Trash2, Image as ImageIcon, Timer } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { StatusBadge } from '@/components/StatusBadge'
import { Modal } from '@/components/Modal'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { OrdemProducao, ProducaoDiaria, PecaDefeituosa } from '@/types'

export function OrdemProducaoDetalhes() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()

  const [op, setOp] = useState<OrdemProducao | null>(null)
  const [producaoDiaria, setProducaoDiaria] = useState<ProducaoDiaria[]>([])
  const [pecasDefeituosas, setPecasDefeituosas] = useState<PecaDefeituosa[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [showProducaoModal, setShowProducaoModal] = useState(false)
  const [showDefeitoModal, setShowDefeitoModal] = useState(false)
  const [showAprovarModal, setShowAprovarModal] = useState(false)
  const [showExcluirModal, setShowExcluirModal] = useState(false)

  const [producaoForm, setProducaoForm] = useState({
    data: new Date().toISOString().split('T')[0],
    turno: '',
    hora_inicio: '',
    hora_fim: '',
    descricao_operacao: '',
    maquina_utilizada: '',
    pecas_defeituosas: '',
    observacoes: '',
  })
  const [editingProducaoId, setEditingProducaoId] = useState<string | null>(null)

  const [defeitoForm, setDefeitoForm] = useState({
    data: new Date().toISOString().split('T')[0],
    quantidade: '',
    tipo_defeito: '',
    causa_provavel: '',
    acao_corretiva: '',
  })

  const [supervisorNome, setSupervisorNome] = useState('')

  // Timer - Preparação de Máquina
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function formatTimer(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Sync timer state when OP loads
  useEffect(() => {
    if (!op) return
    const saved = op.preparacao_maquina_segundos || 0
    if (op.preparacao_maquina_inicio) {
      // Timer was running - calculate elapsed since last start
      const startTime = new Date(op.preparacao_maquina_inicio).getTime()
      const diff = Math.floor((Date.now() - startTime) / 1000)
      setElapsedSeconds(saved + diff)
      setTimerRunning(true)
    } else {
      setElapsedSeconds(saved)
      setTimerRunning(false)
    }
  }, [op?.id])

  // Tick every second while running
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning])

  async function handleStartTimer() {
    if (!op) return
    const now = new Date().toISOString()
    await api.updateOrdemProducao(op.id, {
      preparacao_maquina_inicio: now,
    } as any)
    setTimerRunning(true)
    setToast({ message: 'Preparação iniciada', type: 'success' })
  }

  async function handlePauseTimer() {
    if (!op) return
    // Save accumulated seconds
    const saved = op.preparacao_maquina_segundos || 0
    const startTime = op.preparacao_maquina_inicio ? new Date(op.preparacao_maquina_inicio).getTime() : Date.now()
    const diff = Math.floor((Date.now() - startTime) / 1000)
    const total = saved + diff

    await api.updateOrdemProducao(op.id, {
      preparacao_maquina_segundos: total,
      preparacao_maquina_inicio: null,
    } as any)
    setElapsedSeconds(total)
    setTimerRunning(false)
    // Update local OP state
    setOp({ ...op, preparacao_maquina_segundos: total, preparacao_maquina_inicio: null })
    setToast({ message: 'Preparação pausada', type: 'success' })
  }

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  async function loadData() {
    try {
      setLoading(true)
      const [opData, producaoData, defeitosData] = await Promise.all([
        api.getOrdemProducao(id!),
        api.getProducaoDiaria(id!),
        api.getPecasDefeituosas(id!),
      ])
      setOp(opData)
      setProducaoDiaria(producaoData)
      setPecasDefeituosas(defeitosData)
    } catch (error: any) {
      setToast({ message: 'Erro ao carregar dados', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function resetProducaoForm() {
    setProducaoForm({
      data: new Date().toISOString().split('T')[0],
      turno: '',
      hora_inicio: '',
      hora_fim: '',
      descricao_operacao: '',
      maquina_utilizada: '',
      pecas_defeituosas: '',
      observacoes: '',
    })
    setEditingProducaoId(null)
  }

  function handleEditarProducao(p: ProducaoDiaria) {
    setProducaoForm({
      data: p.data,
      turno: p.turno,
      hora_inicio: p.hora_inicio || '',
      hora_fim: p.hora_fim || '',
      descricao_operacao: p.descricao_operacao || '',
      maquina_utilizada: p.maquina_utilizada || '',
      pecas_defeituosas: p.pecas_defeituosas?.toString() || '',
      observacoes: p.observacoes || '',
    })
    setEditingProducaoId(p.id)
    setShowProducaoModal(true)
  }

  async function handleRegistrarProducao(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = {
        data: producaoForm.data,
        turno: producaoForm.turno,
        hora_inicio: producaoForm.hora_inicio || null,
        hora_fim: producaoForm.hora_fim || null,
        descricao_operacao: producaoForm.descricao_operacao || null,
        maquina_utilizada: producaoForm.maquina_utilizada || null,
        quantidade_produzida: 0,
        pecas_defeituosas: parseInt(producaoForm.pecas_defeituosas || '0'),
        observacoes: producaoForm.observacoes || null,
      }

      if (editingProducaoId) {
        await api.updateProducaoDiaria(editingProducaoId, payload)
        setToast({ message: 'Produção atualizada!', type: 'success' })
      } else {
        await api.createProducaoDiaria({
          ...payload,
          op_id: id!,
          operador_id: user!.id,
        })
        setToast({ message: 'Produção registrada com sucesso!', type: 'success' })
      }
      setShowProducaoModal(false)
      resetProducaoForm()
      setProducaoForm({
        data: new Date().toISOString().split('T')[0],
        turno: '',
        hora_inicio: '',
        hora_fim: '',
        descricao_operacao: '',
        maquina_utilizada: '',
        pecas_defeituosas: '',
        observacoes: '',
      })
      loadData()
    } catch (error: any) {
      setToast({ message: 'Erro ao registrar produção', type: 'error' })
    }
  }

  async function handleRegistrarDefeito(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.createPecaDefeituosa({
        op_id: id!,
        data: defeitoForm.data,
        quantidade: parseInt(defeitoForm.quantidade),
        tipo_defeito: defeitoForm.tipo_defeito,
        causa_provavel: defeitoForm.causa_provavel,
        acao_corretiva: defeitoForm.acao_corretiva,
      })
      setToast({ message: 'Defeito registrado com sucesso!', type: 'success' })
      setShowDefeitoModal(false)
      setDefeitoForm({
        data: new Date().toISOString().split('T')[0],
        quantidade: '',
        tipo_defeito: '',
        causa_provavel: '',
        acao_corretiva: '',
      })
      loadData()
    } catch (error: any) {
      setToast({ message: 'Erro ao registrar defeito', type: 'error' })
    }
  }

  async function handleAprovar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.aprovarOP(id!, supervisorNome)
      setToast({ message: 'OP aprovada com sucesso!', type: 'success' })
      setShowAprovarModal(false)
      setSupervisorNome('')
      loadData()
    } catch (error: any) {
      setToast({ message: 'Erro ao aprovar OP', type: 'error' })
    }
  }

  async function handleExcluir() {
    try {
      await api.deleteOrdemProducao(id!)
      setToast({ message: 'OP excluída com sucesso!', type: 'success' })
      setTimeout(() => navigate('/'), 1500)
    } catch (error: any) {
      console.error('Erro ao excluir OP:', error)
      setToast({ message: 'Erro ao excluir OP', type: 'error' })
    }
  }

  // V3: Handler para alterar status de produção
  async function handleAlterarStatusProducao(novoStatus: 'criada' | 'em_producao' | 'pausada' | 'finalizada' | 'cancelada') {
    try {
      if (novoStatus === 'cancelada') {
        await api.cancelarOP(id!)
        setToast({ message: 'OP cancelada!', type: 'success' })
      } else {
        await api.alterarStatusProducao(id!, novoStatus)
        const mensagens: Record<string, string> = {
          em_producao: 'Produção iniciada!',
          pausada: 'Produção pausada!',
          finalizada: 'Produção finalizada!',
        }
        setToast({ message: mensagens[novoStatus] || 'Status atualizado!', type: 'success' })
      }
      loadData()
    } catch (error: any) {
      setToast({ message: error.message || 'Erro ao alterar status', type: 'error' })
    }
  }

  const totalOperacoes = producaoDiaria.length
  const totalDefeitos = producaoDiaria.reduce((sum, p) => sum + (p.pecas_defeituosas || 0), 0)

  const formatDateStr = (date: string | null) => {
    if (!date) return '-'
    const iso = date.includes('T') ? date : `${date}T00:00:00`
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Carregando...</p>
        </div>
      </Layout>
    )
  }

  if (!op) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">OP não encontrada</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/')}>
              <ArrowLeft size={20} className="inline mr-2" />
              Voltar
            </Button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{op.codigo}</h2>
              <p className="text-gray-600 mt-1">{op.cliente} - {op.nome_peca}</p>
            </div>
            <StatusBadge status={op.status_producao || op.status} type="producao" />
            <StatusBadge status={op.status_financeiro || 'pendente'} type="financeiro" />
          </div>
          <div className="flex gap-2">
            {/* Botões de controle de produção V3 */}
            {op.status_producao === 'criada' && (
              <Button
                variant="primary"
                onClick={() => handleAlterarStatusProducao('em_producao')}
              >
                <Play size={20} className="inline mr-2" />
                Iniciar
              </Button>
            )}
            {op.status_producao === 'em_producao' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => handleAlterarStatusProducao('pausada')}
                >
                  <Pause size={20} className="inline mr-2" />
                  Pausar
                </Button>
                <Button
                  variant="success"
                  onClick={() => handleAlterarStatusProducao('finalizada')}
                >
                  <Square size={20} className="inline mr-2" />
                  Finalizar
                </Button>
              </>
            )}
            {op.status_producao === 'pausada' && (
              <Button
                variant="primary"
                onClick={() => handleAlterarStatusProducao('em_producao')}
              >
                <Play size={20} className="inline mr-2" />
                Retomar
              </Button>
            )}
            {op.status_producao !== 'finalizada' && op.status_producao !== 'cancelada' && hasPermission('chefe') && (
              <Button
                variant="danger"
                onClick={() => handleAlterarStatusProducao('cancelada')}
              >
                <XCircle size={20} className="inline mr-2" />
                Cancelar
              </Button>
            )}

            {/* Botões originais */}
            {hasPermission('chefe') && !op.aprovada && (
              <Button
                variant="success"
                onClick={() => setShowAprovarModal(true)}
              >
                <CheckCircle size={20} className="inline mr-2" />
                Aprovar
              </Button>
            )}
            {hasPermission('chefe') && !op.aprovada && (
              <Button onClick={() => navigate(`/op/${id}/editar`)}>
                <Edit size={20} className="inline mr-2" />
                Editar
              </Button>
            )}
            {hasPermission('chefe') && (
              <Button variant="danger" onClick={() => setShowExcluirModal(true)}>
                <Trash2 size={20} className="inline mr-2" />
                Excluir
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-1">Quantidade Total</p>
              <p className="text-4xl font-bold text-blue-600">{op.quantidade_total}</p>
              {op.unidade && <p className="text-xs text-gray-500">{op.unidade}</p>}
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-1">Operações</p>
              <p className="text-4xl font-bold text-green-600">{totalOperacoes}</p>
              <p className="text-xs text-gray-500">registradas</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold mb-1">Defeitos</p>
              <p className="text-4xl font-bold text-red-600">{totalDefeitos}</p>
            </div>
          </Card>
        </div>

        {op.aprovada && (
          <Card className="border-green-500 bg-green-50">
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-green-600" />
              <div>
                <p className="font-bold text-green-900">OP Aprovada</p>
                <p className="text-sm text-green-700">
                  Aprovada por {op.supervisor_nome} em {formatDateStr(op.supervisor_data_aprovacao)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Card de todas as informações da OP */}
        <Card>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Informações da OP</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tipo</p>
              <p className="text-gray-900 font-medium mt-0.5">{op.tipo === 'encomenda' ? 'Encomenda' : 'Estoque'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Data de Início</p>
              <p className="text-gray-900 font-medium mt-0.5">{formatDateStr(op.data_inicio)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Data de Término</p>
              <p className="text-gray-900 font-medium mt-0.5">{formatDateStr(op.data_termino)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cliente</p>
              <p className="text-gray-900 font-medium mt-0.5">{op.cliente}</p>
            </div>
            {op.cnpj_cliente && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">CNPJ do Cliente</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.cnpj_cliente}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Peça</p>
              <p className="text-gray-900 font-medium mt-0.5">{op.nome_peca}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Quantidade Total</p>
              <p className="text-gray-900 font-medium mt-0.5">{op.quantidade_total} {op.unidade || 'unid.'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Preço do Serviço</p>
              <p className="text-gray-900 font-medium mt-0.5">
                {op.preco_servico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            {op.preco_material != null && op.preco_material > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Preço do Material</p>
                <p className="text-gray-900 font-medium mt-0.5">
                  {op.preco_material.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            )}
            {op.maquina_utilizada && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Máquina</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.maquina_utilizada}</p>
              </div>
            )}
            {op.operador_responsavel && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Operador Responsável</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.operador_responsavel}</p>
              </div>
            )}
            {op.material && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Material</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.material}</p>
              </div>
            )}
            {op.codigo_descricao_material && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Código / Descrição</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.codigo_descricao_material}</p>
              </div>
            )}
            {op.quantidade_material != null && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Qtd. Material</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.quantidade_material}</p>
              </div>
            )}
            {op.lote && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Lote</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.lote}</p>
              </div>
            )}
            {op.fornecedor && (
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Fornecedor</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.fornecedor}</p>
              </div>
            )}
            {op.observacoes_material && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Obs. Material</p>
                <p className="text-gray-900 font-medium mt-0.5">{op.observacoes_material}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Planta / Desenho da Peça */}
        {op.imagem_planta_url && (
          <Card>
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ImageIcon size={20} className="text-blue-600" />
              Planta / Desenho da Peça
            </h3>
            <div className="flex justify-center">
              <a href={op.imagem_planta_url} target="_blank" rel="noreferrer" title="Abrir em nova aba">
                <img
                  src={op.imagem_planta_url}
                  alt="Planta da peça"
                  className="max-w-full max-h-[600px] rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                />
              </a>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">Clique na imagem para abrir em tamanho completo</p>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Timer size={24} />
              Preparação da Máquina
            </h3>
          </div>
          <div className="flex items-center gap-6 bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
            <div className={`text-5xl font-mono font-bold tabular-nums ${timerRunning ? 'text-green-600' : 'text-gray-800'}`}>
              {formatTimer(elapsedSeconds)}
            </div>
            <div className="flex gap-3">
              {!timerRunning ? (
                <Button variant="success" onClick={handleStartTimer}>
                  <Play size={20} className="mr-2" />
                  Iniciar
                </Button>
              ) : (
                <Button variant="danger" onClick={handlePauseTimer}>
                  <Pause size={20} className="mr-2" />
                  Pausar
                </Button>
              )}
            </div>
            {elapsedSeconds > 0 && !timerRunning && (
              <span className="text-sm text-gray-500">
                Tempo acumulado
              </span>
            )}
            {timerRunning && (
              <span className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Em andamento
              </span>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Produção Diária</h3>
            <Button onClick={() => setShowProducaoModal(true)}>
              <Plus size={20} className="inline mr-2" />
              Registrar Produção
            </Button>
          </div>

          {producaoDiaria.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Nenhuma produção registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-left font-semibold">Turno</th>
                    <th className="px-4 py-3 text-left font-semibold">Horário</th>
                    <th className="px-4 py-3 text-left font-semibold">Máquina</th>
                    <th className="px-4 py-3 text-left font-semibold">Operação Realizada</th>
                    <th className="px-4 py-3 text-right font-semibold">Defeitos</th>
                    <th className="px-4 py-3 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {producaoDiaria.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">{formatDateStr(p.data)}</td>
                      <td className="px-4 py-3">{p.turno}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.hora_inicio && p.hora_fim
                          ? `${p.hora_inicio} - ${p.hora_fim}`
                          : p.hora_inicio || p.hora_fim || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.maquina_utilizada || '-'}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.descricao_operacao || '-'}</p>
                        {p.observacoes && (
                          <p className="text-sm text-gray-500 mt-1">{p.observacoes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{p.pecas_defeituosas || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" variant="secondary" onClick={() => handleEditarProducao(p)}>
                          <Edit size={14} className="mr-1" />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Peças Defeituosas</h3>
            <Button variant="danger" onClick={() => setShowDefeitoModal(true)}>
              <AlertTriangle size={20} className="inline mr-2" />
              Registrar Defeito
            </Button>
          </div>

          {pecasDefeituosas.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Nenhum defeito registrado</p>
          ) : (
            <div className="space-y-3">
              {pecasDefeituosas.map((d) => (
                <div key={d.id} className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-red-900">
                      {d.quantidade} peça(s) - {formatDateStr(d.data)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-red-800">Tipo de Defeito:</p>
                      <p className="text-red-900">{d.tipo_defeito}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-800">Causa Provável:</p>
                      <p className="text-red-900">{d.causa_provavel}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-800">Ação Corretiva:</p>
                      <p className="text-red-900">{d.acao_corretiva}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={showProducaoModal}
        onClose={() => { setShowProducaoModal(false); resetProducaoForm() }}
        title={editingProducaoId ? 'Editar Produção' : 'Registrar Produção'}
      >
        <form onSubmit={handleRegistrarProducao} className="space-y-4">
          <Input
            label="Data"
            type="date"
            value={producaoForm.data}
            onChange={(e) => setProducaoForm({ ...producaoForm, data: e.target.value })}
            required
          />
          <Input
            label="Turno"
            value={producaoForm.turno}
            onChange={(e) => setProducaoForm({ ...producaoForm, turno: e.target.value })}
            placeholder="Ex: Manhã, Tarde, Noite"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Hora Início"
              type="time"
              value={producaoForm.hora_inicio}
              onChange={(e) => setProducaoForm({ ...producaoForm, hora_inicio: e.target.value })}
            />
            <Input
              label="Hora Fim"
              type="time"
              value={producaoForm.hora_fim}
              onChange={(e) => setProducaoForm({ ...producaoForm, hora_fim: e.target.value })}
            />
          </div>
          <Textarea
            label="Descrição da Operação *"
            value={producaoForm.descricao_operacao}
            onChange={(e) => setProducaoForm({ ...producaoForm, descricao_operacao: e.target.value })}
            placeholder="Ex: Fiz 50 peças lado direito (2 furos) / Virei as peças e fiz o lado esquerdo (1 furo)"
            required
          />
          <Input
            label="Máquina Utilizada"
            value={producaoForm.maquina_utilizada}
            onChange={(e) => setProducaoForm({ ...producaoForm, maquina_utilizada: e.target.value })}
            placeholder="Ex: Torno CNC, Fresa, Centro de Usinagem"
          />
          <Input
            label="Peças Defeituosas"
            type="number"
            value={producaoForm.pecas_defeituosas}
            onChange={(e) => setProducaoForm({ ...producaoForm, pecas_defeituosas: e.target.value })}
          />
          <Textarea
            label="Observações"
            value={producaoForm.observacoes}
            onChange={(e) => setProducaoForm({ ...producaoForm, observacoes: e.target.value })}
          />
          <Button type="submit" fullWidth>{editingProducaoId ? 'Salvar Alterações' : 'Registrar'}</Button>
        </form>
      </Modal>

      <Modal
        isOpen={showDefeitoModal}
        onClose={() => setShowDefeitoModal(false)}
        title="Registrar Peça Defeituosa"
      >
        <form onSubmit={handleRegistrarDefeito} className="space-y-4">
          <Input
            label="Data"
            type="date"
            value={defeitoForm.data}
            onChange={(e) => setDefeitoForm({ ...defeitoForm, data: e.target.value })}
            required
          />
          <Input
            label="Quantidade"
            type="number"
            value={defeitoForm.quantidade}
            onChange={(e) => setDefeitoForm({ ...defeitoForm, quantidade: e.target.value })}
            required
          />
          <Input
            label="Tipo de Defeito"
            value={defeitoForm.tipo_defeito}
            onChange={(e) => setDefeitoForm({ ...defeitoForm, tipo_defeito: e.target.value })}
            required
          />
          <Textarea
            label="Causa Provável"
            value={defeitoForm.causa_provavel}
            onChange={(e) => setDefeitoForm({ ...defeitoForm, causa_provavel: e.target.value })}
            required
          />
          <Textarea
            label="Ação Corretiva"
            value={defeitoForm.acao_corretiva}
            onChange={(e) => setDefeitoForm({ ...defeitoForm, acao_corretiva: e.target.value })}
            required
          />
          <Button type="submit" variant="danger" fullWidth>Registrar Defeito</Button>
        </form>
      </Modal>

      <Modal
        isOpen={showAprovarModal}
        onClose={() => setShowAprovarModal(false)}
        title="Aprovar Ordem de Produção"
        size="sm"
      >
        <form onSubmit={handleAprovar} className="space-y-4">
          <p className="text-gray-700">
            Após a aprovação, dados financeiros e de cliente não poderão ser alterados.
          </p>
          <Input
            label="Nome do Supervisor"
            value={supervisorNome}
            onChange={(e) => setSupervisorNome(e.target.value)}
            required
          />
          <Button type="submit" variant="success" fullWidth>Aprovar OP</Button>
        </form>
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal
        isOpen={showExcluirModal}
        onClose={() => setShowExcluirModal(false)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              Tem certeza que deseja excluir a OP {op?.codigo}?
            </p>
            <p className="text-red-600 text-sm mt-2">
              Esta ação não pode ser desfeita. Todos os dados de produção e financeiros associados serão excluídos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowExcluirModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setShowExcluirModal(false)
                handleExcluir()
              }}
            >
              Excluir OP
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
