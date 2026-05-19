import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Circle } from 'lucide-react'
import { api } from '@/services/api'

type EventType = 'parcela' | 'conta_receber' | 'conta_pagar' | 'op'

interface CalendarEvent {
  id: string
  type: EventType
  label: string
  date: string
  valor?: number
  status?: string
}

const TYPE_COLORS: Record<EventType, { bg: string; text: string; dot: string; label: string }> = {
  parcela: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-900 dark:text-amber-200', dot: 'bg-amber-500', label: 'Parcela' },
  conta_receber: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-900 dark:text-emerald-200', dot: 'bg-emerald-500', label: 'A receber' },
  conta_pagar: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-900 dark:text-rose-200', dot: 'bg-rose-500', label: 'A pagar' },
  op: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-900 dark:text-sky-200', dot: 'bg-sky-500', label: 'OP prazo' },
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatCurrency(v: number | undefined): string {
  if (v === undefined || v === null) return ''
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarioTab() {
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filtros, setFiltros] = useState<Record<EventType, boolean>>({
    parcela: true,
    conta_receber: true,
    conta_pagar: true,
    op: true,
  })

  useEffect(() => {
    loadMonthEvents()
  }, [cursor])

  async function loadMonthEvents() {
    setLoading(true)
    try {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      const firstKey = toDateKey(first)
      const lastKey = toDateKey(last)

      const [parcelasRes, contasReceberRes, contasPagarRes, opsRes] = await Promise.all([
        api.listParcelasPeriodo?.(firstKey, lastKey).catch(() => []) ?? Promise.resolve([]),
        api.listContasReceberAvulsas?.().catch(() => []) ?? Promise.resolve([]),
        api.listContasPagar?.().catch(() => []) ?? Promise.resolve([]),
        api.listOrdensProducao?.().catch(() => []) ?? Promise.resolve([]),
      ])

      const evs: CalendarEvent[] = []

      for (const p of parcelasRes || []) {
        if (!p.data_vencimento) continue
        evs.push({
          id: `parcela-${p.id}`,
          type: 'parcela',
          label: `Parcela ${p.numero_parcela || ''}`,
          date: p.data_vencimento,
          valor: p.valor,
          status: p.status,
        })
      }

      for (const c of contasReceberRes || []) {
        if (!c.data_vencimento) continue
        if (c.data_vencimento < firstKey || c.data_vencimento > lastKey) continue
        evs.push({
          id: `cr-${c.id}`,
          type: 'conta_receber',
          label: c.descricao || 'Conta a receber',
          date: c.data_vencimento,
          valor: c.valor_total,
          status: c.status,
        })
      }

      for (const c of contasPagarRes || []) {
        if (!c.data_vencimento) continue
        if (c.data_vencimento < firstKey || c.data_vencimento > lastKey) continue
        evs.push({
          id: `cp-${c.id}`,
          type: 'conta_pagar',
          label: c.descricao || 'Conta a pagar',
          date: c.data_vencimento,
          valor: c.valor,
          status: c.status,
        })
      }

      for (const op of opsRes || []) {
        const prazo = op.data_termino
        if (!prazo) continue
        if (prazo < firstKey || prazo > lastKey) continue
        evs.push({
          id: `op-${op.id}`,
          type: 'op',
          label: `OP ${op.codigo || ''} - ${op.nome_peca || ''}`,
          date: prazo,
          status: op.status_producao || op.status,
        })
      }

      setEvents(evs)
    } catch (e) {
      console.error('Erro ao carregar calendário:', e)
    } finally {
      setLoading(false)
    }
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!filtros[e.type]) continue
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events, filtros])

  const weeks = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const firstWeekday = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (Date | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)

    const rows: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cursor])

  const totalsMonth = useMemo(() => {
    let receber = 0
    let pagar = 0
    for (const e of events) {
      if (!filtros[e.type]) continue
      if (e.status === 'pago') continue
      if ((e.type === 'parcela' || e.type === 'conta_receber') && e.valor) receber += e.valor
      if (e.type === 'conta_pagar' && e.valor) pagar += e.valor
    }
    return { receber, pagar, saldo: receber - pagar }
  }, [events, filtros])

  const today = new Date()
  const selectedEvents = selectedDate ? eventsByDate[toDateKey(selectedDate)] || [] : []

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-center min-w-[200px]">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {MONTHS_PT[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
          </div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            aria-label="Próximo mês"
          >
            <ChevronRight size={22} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 px-4 py-2 text-sm font-medium rounded-lg border-2 border-gray-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition"
          >
            Hoje
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(TYPE_COLORS) as EventType[]).map((t) => {
            const c = TYPE_COLORS[t]
            const on = filtros[t]
            return (
              <button
                key={t}
                onClick={() => setFiltros({ ...filtros, [t]: !on })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border-2 transition ${
                  on
                    ? 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                    : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 opacity-50'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">A receber no mês</p>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">{formatCurrency(totalsMonth.receber)}</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase">A pagar no mês</p>
          <p className="text-2xl font-bold text-rose-900 dark:text-rose-200 mt-1">{formatCurrency(totalsMonth.pagar)}</p>
        </div>
        <div className={`${totalsMonth.saldo >= 0
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'} border rounded-xl p-4`}>
          <p className="text-xs font-semibold uppercase text-gray-700 dark:text-slate-300">Saldo previsto</p>
          <p className={`text-2xl font-bold mt-1 ${totalsMonth.saldo >= 0
            ? 'text-blue-900 dark:text-blue-200'
            : 'text-orange-900 dark:text-orange-200'}`}>
            {formatCurrency(totalsMonth.saldo)}
          </p>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
          {WEEKDAYS.map((d) => (
            <div key={d} className="p-3 text-center text-sm font-semibold text-gray-600 dark:text-slate-400">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weeks.flat().map((day, idx) => {
            if (!day) return <div key={idx} className="aspect-square border-b border-r border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/40" />
            const key = toDateKey(day)
            const dayEvents = eventsByDate[key] || []
            const isToday = isSameDay(day, today)
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={`aspect-square md:aspect-auto md:min-h-[96px] text-left border-b border-r border-gray-100 dark:border-slate-800 p-2 transition relative ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-slate-800 ring-2 ring-blue-500 ring-inset'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">+{dayEvents.length - 3}</span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((e) => {
                    const c = TYPE_COLORS[e.type]
                    return (
                      <div
                        key={e.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${c.bg} ${c.text}`}
                        title={`${c.label}: ${e.label}${e.valor ? ' - ' + formatCurrency(e.valor) : ''}`}
                      >
                        {e.label}
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedDate && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={20} className="text-gray-600 dark:text-slate-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {selectedDate.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h3>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-gray-500 dark:text-slate-400 italic">Nenhum evento neste dia.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((e) => {
                const c = TYPE_COLORS[e.type]
                return (
                  <div
                    key={e.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${c.bg}`}
                  >
                    <div className="flex items-center gap-3">
                      <Circle size={10} className={`${c.dot} rounded-full`} fill="currentColor" />
                      <div>
                        <p className={`font-semibold ${c.text}`}>{c.label}</p>
                        <p className={`text-sm ${c.text} opacity-80`}>{e.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {e.valor !== undefined && (
                        <p className={`font-bold ${c.text}`}>{formatCurrency(e.valor)}</p>
                      )}
                      {e.status && (
                        <p className={`text-xs uppercase ${c.text} opacity-70`}>{e.status}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center text-sm text-gray-500 dark:text-slate-400">Carregando...</div>
      )}
    </div>
  )
}
