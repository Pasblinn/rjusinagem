import { OPStatus, PaymentStatus, StatusProducao, StatusFinanceiro } from '@/types'

interface StatusBadgeProps {
  status: OPStatus | PaymentStatus | StatusProducao | StatusFinanceiro | string
  type?: 'op' | 'payment' | 'producao' | 'financeiro'
}

export function StatusBadge({ status, type = 'op' }: StatusBadgeProps) {
  const getStatusConfig = () => {
    // Novo tipo: Status de Produção (V3)
    if (type === 'producao') {
      switch (status) {
        case 'criada':
          return { color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700', label: 'Criada' }
        case 'em_producao':
          return { color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800', label: 'Em Produção' }
        case 'pausada':
          return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800', label: 'Pausada' }
        case 'finalizada':
          return { color: 'bg-green-100 text-green-800 border-green-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800', label: 'Finalizada' }
        case 'cancelada':
          return { color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800', label: 'Cancelada' }
        default:
          return { color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700', label: status }
      }
    }

    // Novo tipo: Status Financeiro (V3)
    if (type === 'financeiro') {
      switch (status) {
        case 'pendente':
          return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800', label: 'Pendente' }
        case 'parcial':
          return { color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800', label: 'Parcial' }
        case 'pago':
          return { color: 'bg-green-100 text-green-800 border-green-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800', label: 'Pago' }
        case 'atrasado':
          return { color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800', label: 'Atrasado' }
        case 'cancelado':
          return { color: 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700', label: 'Cancelado' }
        default:
          return { color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700', label: status }
      }
    }

    // Legado: Payment status
    if (type === 'payment') {
      switch (status) {
        case 'pago':
          return { color: 'bg-green-100 text-green-800 border-green-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800', label: 'PAGO' }
        case 'nao_pago':
          return { color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800', label: 'NÃO PAGO' }
        case 'pendente':
          return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800', label: 'PENDENTE' }
        case 'parcial':
          return { color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800', label: 'PARCIAL' }
        case 'atrasado':
          return { color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800', label: 'ATRASADO' }
        default:
          return { color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700', label: status }
      }
    }

    // Legado: OP status
    switch (status) {
      case 'criada':
        return { color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700', label: 'Criada' }
      case 'em_producao':
        return { color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800', label: 'Em Produção' }
      case 'finalizada':
        return { color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800', label: 'Finalizada' }
      case 'faturada':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800', label: 'Faturada' }
      case 'nota_emitida':
        return { color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800', label: 'Nota Emitida' }
      case 'paga':
        return { color: 'bg-green-100 text-green-800 border-green-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800', label: 'Paga' }
      // Novos status (fallback quando type='op' mas recebe status V3)
      case 'pausada':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800', label: 'Pausada' }
      case 'cancelada':
        return { color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800', label: 'Cancelada' }
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700', label: status }
    }
  }

  const config = getStatusConfig()

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium text-xs border ${config.color}`}
    >
      {config.label}
    </span>
  )
}
