import { OPStatus, PaymentStatus, StatusProducao, StatusFinanceiro } from '@/types'

interface StatusBadgeProps {
  status: OPStatus | PaymentStatus | StatusProducao | StatusFinanceiro | string
  type?: 'op' | 'payment' | 'producao' | 'financeiro'
}

const NEUTRAL = 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
const BLUE    = 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800'
const YELLOW  = 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800'
const GREEN   = 'bg-green-100 text-green-800 border-green-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800'
const RED     = 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800'
const PURPLE  = 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800'
const ORANGE  = 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800'
const MUTED   = 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'

export function StatusBadge({ status, type = 'op' }: StatusBadgeProps) {
  const getStatusConfig = () => {
    if (type === 'producao') {
      switch (status) {
        case 'criada':      return { color: NEUTRAL, label: 'Criada' }
        case 'em_producao': return { color: BLUE,    label: 'Em Produção' }
        case 'pausada':     return { color: YELLOW,  label: 'Pausada' }
        case 'finalizada':  return { color: GREEN,   label: 'Finalizada' }
        case 'cancelada':   return { color: RED,     label: 'Cancelada' }
        default:            return { color: NEUTRAL, label: status }
      }
    }

    if (type === 'financeiro') {
      switch (status) {
        case 'pendente':   return { color: YELLOW,  label: 'Pendente' }
        case 'parcial':    return { color: BLUE,    label: 'Parcial' }
        case 'pago':       return { color: GREEN,   label: 'Pago' }
        case 'atrasado':   return { color: RED,     label: 'Atrasado' }
        case 'cancelado':  return { color: MUTED,   label: 'Cancelado' }
        default:           return { color: NEUTRAL, label: status }
      }
    }

    if (type === 'payment') {
      switch (status) {
        case 'pago':      return { color: GREEN,  label: 'PAGO' }
        case 'nao_pago':  return { color: RED,    label: 'NÃO PAGO' }
        case 'pendente':  return { color: YELLOW, label: 'PENDENTE' }
        case 'parcial':   return { color: BLUE,   label: 'PARCIAL' }
        case 'atrasado':  return { color: RED,    label: 'ATRASADO' }
        default:          return { color: NEUTRAL, label: status }
      }
    }

    switch (status) {
      case 'criada':       return { color: NEUTRAL, label: 'Criada' }
      case 'em_producao':  return { color: BLUE,    label: 'Em Produção' }
      case 'finalizada':   return { color: PURPLE,  label: 'Finalizada' }
      case 'faturada':     return { color: YELLOW,  label: 'Faturada' }
      case 'nota_emitida': return { color: ORANGE,  label: 'Nota Emitida' }
      case 'paga':         return { color: GREEN,   label: 'Paga' }
      case 'pausada':      return { color: YELLOW,  label: 'Pausada' }
      case 'cancelada':    return { color: RED,     label: 'Cancelada' }
      default:             return { color: NEUTRAL, label: status }
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
