import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Clock, LogIn, LogOut, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'

export function PontoMobile() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [funcionario, setFuncionario] = useState<{
    id: string
    nome: string
    cargo: string | null
    ativo: boolean
  } | null>(null)
  const [pontoAberto, setPontoAberto] = useState<{
    id: string
    hora_entrada: string
  } | null>(null)
  const [resultado, setResultado] = useState<{
    sucesso: boolean
    tipo: 'entrada' | 'saida' | 'erro'
    mensagem: string
    hora: string | null
    total_horas: string | null
  } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [horaAtual, setHoraAtual] = useState(new Date())

  // Atualizar hora a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraAtual(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Carregar dados do funcionário
  useEffect(() => {
    if (token) {
      carregarDados()
    }
  }, [token])

  async function carregarDados() {
    try {
      setLoading(true)
      setErro(null)

      // Buscar funcionário pelo token
      const func = await api.buscarFuncionarioPorToken(token!)

      if (!func) {
        setErro('Link inválido ou funcionário não encontrado')
        return
      }

      if (!func.ativo) {
        setErro('Este funcionário está inativo')
        return
      }

      setFuncionario(func)

      // Verificar se tem ponto aberto
      const ponto = await api.buscarPontoAberto(func.id)
      setPontoAberto(ponto)

    } catch (error: unknown) {
      setErro('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBaterPonto() {
    if (!token || processando) return

    try {
      setProcessando(true)
      setResultado(null)

      const res = await api.baterPonto(token)
      setResultado(res)

      // Recarregar dados após bater ponto
      if (res.sucesso) {
        await carregarDados()
      }

    } catch (error: unknown) {
      setResultado({
        sucesso: false,
        tipo: 'erro',
        mensagem: 'Erro ao bater ponto. Tente novamente.',
        hora: null,
        total_horas: null,
      })
    } finally {
      setProcessando(false)
    }
  }

  function formatarHora(data: Date): string {
    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function formatarData(data: Date): string {
    return data.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  function formatarHoraRegistro(isoString: string): string {
    return new Date(isoString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Tela de loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Clock className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-xl">Carregando...</p>
        </div>
      </div>
    )
  }

  // Tela de erro
  if (erro) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-600 to-red-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <XCircle className="w-20 h-20 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Erro</h1>
          <p className="text-gray-600 text-lg">{erro}</p>
        </div>
      </div>
    )
  }

  // Tela principal
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col items-center justify-center p-4">
      {/* Cabeçalho com hora */}
      <div className="text-center text-white mb-8">
        <p className="text-lg opacity-80 capitalize">{formatarData(horaAtual)}</p>
        <p className="text-6xl font-bold tracking-wider mt-2">
          {formatarHora(horaAtual)}
        </p>
      </div>

      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        {/* Nome do funcionário */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{funcionario?.nome}</h1>
          {funcionario?.cargo && (
            <p className="text-gray-500 mt-1">{funcionario.cargo}</p>
          )}
        </div>

        {/* Status atual */}
        {pontoAberto && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Ponto aberto</span>
            </div>
            <p className="text-center text-green-600 mt-2">
              Entrada: {formatarHoraRegistro(pontoAberto.hora_entrada)}
            </p>
          </div>
        )}

        {!pontoAberto && !resultado && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Nenhum ponto aberto</span>
            </div>
          </div>
        )}

        {/* Resultado da última ação */}
        {resultado && (
          <div className={`rounded-lg p-4 mb-6 ${
            resultado.sucesso
              ? resultado.tipo === 'entrada'
                ? 'bg-green-50 border border-green-200'
                : 'bg-blue-50 border border-blue-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className={`flex items-center justify-center gap-2 ${
              resultado.sucesso
                ? resultado.tipo === 'entrada' ? 'text-green-700' : 'text-blue-700'
                : 'text-red-700'
            }`}>
              {resultado.sucesso ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{resultado.mensagem}</span>
            </div>
            {resultado.hora && (
              <p className={`text-center mt-2 ${
                resultado.tipo === 'entrada' ? 'text-green-600' : 'text-blue-600'
              }`}>
                Horário: {formatarHoraRegistro(resultado.hora)}
              </p>
            )}
            {resultado.total_horas && (
              <p className="text-center text-blue-600 mt-1 font-bold">
                Total trabalhado: {resultado.total_horas}
              </p>
            )}
          </div>
        )}

        {/* Botão de bater ponto */}
        <button
          onClick={handleBaterPonto}
          disabled={processando}
          className={`w-full py-6 rounded-xl text-white font-bold text-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
            processando
              ? 'bg-gray-400 cursor-not-allowed'
              : pontoAberto
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          }`}
        >
          {processando ? (
            <>
              <Clock className="w-8 h-8 animate-spin" />
              Processando...
            </>
          ) : pontoAberto ? (
            <>
              <LogOut className="w-8 h-8" />
              REGISTRAR SAÍDA
            </>
          ) : (
            <>
              <LogIn className="w-8 h-8" />
              REGISTRAR ENTRADA
            </>
          )}
        </button>
      </div>

      {/* Rodapé */}
      <p className="text-white/60 text-sm mt-8 text-center">
        RJ Usinagem - Ponto Eletrônico
      </p>
    </div>
  )
}
