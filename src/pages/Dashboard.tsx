import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, RefreshCw, FileText, Bell } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { StatusBadge } from '@/components/StatusBadge'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { OrdemProducao, DashboardStats, Orcamento } from '@/types'
import { format } from 'date-fns'

// Intervalo de atualização automática (30 segundos)
const POLLING_INTERVAL = 30000

export function Dashboard() {
  const [ops, setOps] = useState<OrdemProducao[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orcamentosRecentes, setOrcamentosRecentes] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Carrega dados iniciais e configura polling
  useEffect(() => {
    loadData()

    // Configura polling automático
    pollingRef.current = setInterval(() => {
      loadDataSilent()
    }, POLLING_INTERVAL)

    // Limpa o intervalo quando o componente desmonta
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [statusFilter])

  async function loadData() {
    try {
      setLoading(true)
      const [opsData, statsData, orcamentosData] = await Promise.all([
        // V3: Usar statusProducao para filtrar
        api.listOrdensProducao({ statusProducao: statusFilter || undefined }),
        api.getDashboardStats(),
        // Carregar orçamentos recentes (aprovados ou enviados)
        api.listOrcamentos().catch(() => [])
      ])
      setOps(opsData)
      setStats(statsData)
      // Filtrar apenas orçamentos aprovados ou recentes (últimos 7 dias)
      const seteDiasAtras = new Date()
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
      const orcamentosFiltrados = (orcamentosData || []).filter((o: Orcamento) => {
        const dataOrcamento = new Date(o.created_at)
        return o.status === 'aprovado' || (o.status === 'enviado' && dataOrcamento >= seteDiasAtras)
      })
      setOrcamentosRecentes(orcamentosFiltrados.slice(0, 5)) // Mostrar no máximo 5
      setLastUpdate(new Date())
    } catch (error: any) {
      setToast({ message: 'Erro ao carregar dados', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Atualização silenciosa (sem loading)
  async function loadDataSilent() {
    try {
      const [opsData, statsData, orcamentosData] = await Promise.all([
        // V3: Usar statusProducao para filtrar
        api.listOrdensProducao({ statusProducao: statusFilter || undefined }),
        api.getDashboardStats(),
        api.listOrcamentos().catch(() => [])
      ])
      setOps(opsData)
      setStats(statsData)
      const seteDiasAtras = new Date()
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
      const orcamentosFiltrados = (orcamentosData || []).filter((o: Orcamento) => {
        const dataOrcamento = new Date(o.created_at)
        return o.status === 'aprovado' || (o.status === 'enviado' && dataOrcamento >= seteDiasAtras)
      })
      setOrcamentosRecentes(orcamentosFiltrados.slice(0, 5))
      setLastUpdate(new Date())
    } catch (error: any) {
      // Silencioso - não mostra erro
      console.warn('Erro na atualização automática:', error)
    }
  }

  // Atualização manual com indicador
  async function handleRefresh() {
    setIsRefreshing(true)
    await loadDataSilent()
    setIsRefreshing(false)
  }

  const filteredOps = ops.filter(op =>
    op.codigo.toLowerCase().includes(search.toLowerCase()) ||
    op.cliente.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-neutral-100">Ordens de Produção</h2>
            <p className="text-gray-600 dark:text-neutral-400 mt-1">Gerencie todas as ordens de produção</p>
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
              <span>Atualizado: {format(lastUpdate, 'HH:mm:ss')}</span>
            </div>
            {hasPermission('chefe') && (
              <Button
                size="lg"
                onClick={() => navigate('/op/nova')}
              >
                <Plus size={24} className="inline mr-2" />
                Nova OP
              </Button>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="text-center">
                <p className="text-gray-600 dark:text-neutral-400 text-sm font-semibold mb-1">Total de OPs</p>
                <p className="text-4xl font-bold text-blue-600">{stats.total_ops}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-gray-600 dark:text-neutral-400 text-sm font-semibold mb-1">Em Produção</p>
                <p className="text-4xl font-bold text-orange-600">{stats.ops_em_producao}</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-gray-600 dark:text-neutral-400 text-sm font-semibold mb-1">Finalizadas (mês)</p>
                <p className="text-4xl font-bold text-green-600">{stats.ops_finalizadas_mes}</p>
              </div>
            </Card>
            {hasPermission('financeiro') && (
              <Card>
                <div className="text-center">
                  <p className="text-gray-600 dark:text-neutral-400 text-sm font-semibold mb-1">A Receber</p>
                  <p className="text-4xl font-bold text-purple-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(stats.valor_a_receber)}
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Seção de Orçamentos Recentes - Visível para produção */}
        {orcamentosRecentes.length > 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Novos Orçamentos</h3>
                <p className="text-sm text-gray-600 dark:text-neutral-400">Trabalhos aguardando produção</p>
              </div>
            </div>
            <div className="space-y-3">
              {orcamentosRecentes.map((orc) => (
                <div
                  key={orc.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-blue-100 dark:border-neutral-800"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-neutral-100">{orc.nome_peca}</p>
                      <p className="text-sm text-gray-600 dark:text-neutral-400">
                        {orc.cliente} • {orc.quantidade} unid.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      orc.status === 'aprovado'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {orc.status === 'aprovado' ? 'Aprovado' : 'Enviado'}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                      {format(new Date(orc.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {hasPermission('financeiro') && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/financeiro')}
                >
                  Ver todos os orçamentos
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar por código ou cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-3 w-full border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <Select
                options={[
                  { value: '', label: 'Todos os Status' },
                  { value: 'criada', label: 'Criada' },
                  { value: 'em_producao', label: 'Em Produção' },
                  { value: 'pausada', label: 'Pausada' },
                  { value: 'finalizada', label: 'Finalizada' },
                  { value: 'cancelada', label: 'Cancelada' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-neutral-400 text-lg">Carregando...</p>
              </div>
            ) : filteredOps.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-neutral-400 text-lg">Nenhuma ordem de produção encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOps.map((op) => (
                  <div
                    key={op.id}
                    onClick={() => navigate(`/op/${op.id}`)}
                    className="p-4 border border-gray-200 dark:border-neutral-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-sm dark:hover:bg-neutral-800/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-sm font-mono font-semibold px-2.5 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{op.codigo}</h3>
                          <StatusBadge status={op.status_producao || op.status} type="producao" />
                          {op.status_financeiro && op.status_financeiro !== 'pendente' && (
                            <StatusBadge status={op.status_financeiro} type="financeiro" />
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-neutral-400 font-semibold">Cliente</p>
                            <p className="text-gray-900 dark:text-neutral-100">{op.cliente}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-neutral-400 font-semibold">Peça</p>
                            <p className="text-gray-900 dark:text-neutral-100">{op.nome_peca}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-neutral-400 font-semibold">Quantidade</p>
                            <p className="text-gray-900 dark:text-neutral-100">{op.quantidade_total}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-neutral-400 font-semibold">Data Início</p>
                            <p className="text-gray-900 dark:text-neutral-100">{format(new Date(op.data_inicio), 'dd/MM/yyyy')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  )
}
