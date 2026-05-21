import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../lib/api'

// ── Tipos ─────────────────────────────────────────────────────────────────
type PaymentMethod = 'cash' | 'transfer'

type Expense = {
  id: string
  expense_date: string
  description: string
  amount: number
  method: PaymentMethod
  category: string
  notes: string | null
  created_at: string
}

type ExpenseSummary = {
  total_count: number
  total_amount: number
  cash_amount: number
  transfer_amount: number
}

// ── Constantes ────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Insumos cocina', 'Limpieza', 'Mantenimiento',
  'Personal', 'Marketing', 'Servicios', 'Varios',
]

const CATEGORY_COLORS: Record<string, string> = {
  'Insumos cocina': '#ef4444',
  'Limpieza':       '#3b82f6',
  'Mantenimiento':  '#f59e0b',
  'Personal':       '#10b981',
  'Marketing':      '#8b5cf6',
  'Servicios':      '#06b6d4',
  'Varios':         '#6b7280',
}

const fmt = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Genera lista de meses recientes para el selector
function recentMonths(n = 6) {
  const months = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return months
}

const MONTHS = recentMonths()
const THIS_MONTH = MONTHS[0].value

// ── Formulario de nuevo gasto ─────────────────────────────────────────────
function ExpenseForm({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    expense_date: today,
    description:  '',
    amount:       '',
    method:       'cash' as PaymentMethod,
    category:     'Varios',
    notes:        '',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.post('/api/cash/expenses', {
      ...form,
      amount: parseFloat(form.amount),
    }),
    onSuccess: () => {
      setForm({ expense_date: today, description: '', amount: '', method: 'cash', category: 'Varios', notes: '' })
      setError(null)
      onSaved()
    },
    onError: (e: any) => setError(e?.response?.data?.error ?? 'Error guardando'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.amount || isNaN(parseFloat(form.amount))) {
      setError('Descripción y monto son requeridos')
      return
    }
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-5">
      <h2 className="font-semibold text-gray-800 mb-4">Registrar gasto</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Fecha */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha</label>
          <input type="date" className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.expense_date}
            onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
        </div>

        {/* Descripción */}
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Descripción *</label>
          <input type="text" className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="Ej: Gas para cocina"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        {/* Monto */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Monto *</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" min="0" className="w-full border rounded pl-5 pr-2 py-1.5 text-sm"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
        </div>

        {/* Método */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Método</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.method}
            onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
            <option value="cash">💵 Efectivo</option>
            <option value="transfer">📲 Transferencia</option>
          </select>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Categoría</label>
          <select className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Notas (colapsable) */}
      <div className="mt-3">
        <input type="text" className="w-full border rounded px-2 py-1.5 text-sm text-gray-500"
          placeholder="Notas adicionales (opcional)"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      <div className="mt-4">
        <button type="submit" disabled={mutation.isPending}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? 'Guardando…' : '+ Registrar gasto'}
        </button>
      </div>
    </form>
  )
}

// ── Fila editable ─────────────────────────────────────────────────────────
function ExpenseRow({ expense, onUpdated }: { expense: Expense; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    description: expense.description,
    amount:      String(expense.amount),
    method:      expense.method,
    category:    expense.category,
    notes:       expense.notes ?? '',
    expense_date: expense.expense_date,
  })
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    await api.patch(`/api/cash/expenses/${expense.id}`, {
      ...form, amount: parseFloat(form.amount),
    })
    setEditing(false)
    onUpdated()
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este gasto?')) return
    setDeleting(true)
    await api.delete(`/api/cash/expenses/${expense.id}`)
    onUpdated()
  }

  if (editing) {
    return (
      <tr className="border-t bg-blue-50">
        <td className="px-3 py-2">
          <input type="date" className="border rounded px-2 py-1 text-xs w-32"
            value={form.expense_date}
            onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
        </td>
        <td className="px-3 py-2">
          <input type="text" className="border rounded px-2 py-1 text-sm w-full"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </td>
        <td className="px-3 py-2">
          <input type="number" step="0.01" className="border rounded px-2 py-1 text-sm w-24"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </td>
        <td className="px-3 py-2">
          <select className="border rounded px-1 py-1 text-xs"
            value={form.method}
            onChange={e => setForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
          </select>
        </td>
        <td className="px-3 py-2">
          <select className="border rounded px-1 py-1 text-xs"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </td>
        <td className="px-3 py-2" colSpan={2}>
          <div className="flex gap-1">
            <button onClick={handleSave} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Guardar</button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 border rounded text-xs">Cancelar</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t hover:bg-gray-50 group">
      <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
        {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-900">
        {expense.description}
        {expense.notes && <p className="text-xs text-gray-400">{expense.notes}</p>}
      </td>
      <td className="px-3 py-2.5 text-sm font-mono font-semibold text-right text-gray-900">
        {fmt(expense.amount)}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          expense.method === 'cash'
            ? 'bg-green-100 text-green-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {expense.method === 'cash' ? '💵 Efectivo' : '📲 Transferencia'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[expense.category] + '20', color: CATEGORY_COLORS[expense.category] }}>
          {expense.category}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline mr-2">Editar</button>
        <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-400 hover:underline">Eliminar</button>
      </td>
    </tr>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export function CashPage() {
  const qc = useQueryClient()
  const [month, setMonth]   = useState(THIS_MONTH)
  const [method, setMethod] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['cash', month, method],
    queryFn: () => api.get('/api/cash/expenses', {
      params: { month, method: method || undefined, limit: 100 },
    }).then(r => r.data as {
      data: Expense[]
      summary: ExpenseSummary
      by_category: { category: string; total: number }[]
    }),
  })

  function invalidate() { qc.invalidateQueries({ queryKey: ['cash'] }) }

  const expenses    = data?.data ?? []
  const summary     = data?.summary
  const byCategory  = data?.by_category ?? []

  const pieData = byCategory
    .filter(c => c.total > 0)
    .map(c => ({ name: c.category, value: c.total }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja Chica</h1>
          <p className="text-gray-500 text-sm mt-1">Gastos en efectivo y transferencia</p>
        </div>

        {/* Selector de mes */}
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          value={month}
          onChange={e => setMonth(e.target.value)}
        >
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Tarjetas resumen */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total del mes',    value: summary.total_amount,    color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Número de gastos', value: summary.total_count,     color: 'text-gray-700', bg: 'bg-white', isCnt: true },
            { label: '💵 Efectivo',       value: summary.cash_amount,     color: 'text-green-700', bg: 'bg-green-50' },
            { label: '📲 Transferencia',  value: summary.transfer_amount, color: 'text-blue-700',  bg: 'bg-blue-50' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} border rounded-xl p-4`}>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>
                {card.isCnt ? card.value : fmt(card.value as number)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Gráfica + filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pie por categoría */}
        {pieData.length > 0 && (
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Por categoría</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}
                  label={({ percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[entry.name] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend iconType="circle" iconSize={8}
                  formatter={v => <span className="text-xs text-gray-600">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Formulario ocupa 2/3 */}
        <div className={pieData.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <ExpenseForm onSaved={invalidate} />
        </div>
      </div>

      {/* Filtros de método */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filtrar:</span>
        {[
          { value: '',         label: 'Todos' },
          { value: 'cash',     label: '💵 Efectivo' },
          { value: 'transfer', label: '📲 Transferencia' },
        ].map(opt => (
          <button key={opt.value} onClick={() => setMethod(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              method === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}>
            {opt.label}
          </button>
        ))}
        {expenses.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{expenses.length} gastos</span>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-12">Cargando…</p>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-lg">Sin gastos registrados</p>
            <p className="text-gray-300 text-sm mt-1">Usa el formulario de arriba para registrar el primer gasto</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-3 text-left">Fecha</th>
                <th className="px-3 py-3 text-left">Descripción</th>
                <th className="px-3 py-3 text-right">Monto</th>
                <th className="px-3 py-3 text-left">Método</th>
                <th className="px-3 py-3 text-left">Categoría</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <ExpenseRow key={e.id} expense={e} onUpdated={invalidate} />
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={2} className="px-3 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-3 py-3 text-right text-sm font-mono font-bold text-gray-900">
                  {fmt(expenses.reduce((a, e) => a + Number(e.amount), 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
