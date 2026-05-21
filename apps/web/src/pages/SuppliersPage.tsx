import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { catalogApi, type Supplier } from '../lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

const CASH_CATEGORY_COLORS: Record<string, string> = {
  'Insumos cocina': '#ef4444', 'Limpieza': '#3b82f6', 'Mantenimiento': '#f59e0b',
  'Personal': '#10b981', 'Marketing': '#8b5cf6', 'Servicios': '#06b6d4', 'Varios': '#6b7280',
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(1)}k`
  : `$${Number(n).toFixed(0)}`

const fmtFull = (n: number) =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function recentMonths(n = 12) {
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

// ── Tooltip ────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ── Panel de detalle de proveedor ──────────────────────────────────────────
function SupplierDetail({ supplier, onClose }: { supplier: Supplier; month?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: supplier.name, rfc: supplier.rfc ?? '',
    email: supplier.email ?? '', phone: supplier.phone ?? '', notes: supplier.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Historial de facturas de este proveedor (últimos 12 meses)
  const { data: timelineData } = useQuery({
    queryKey: ['spend-over-time', supplier.id],
    queryFn: () => catalogApi.spendOverTime(365, supplier.id).then(r => r.data.data),
  })

  const { data: topSkusData } = useQuery({
    queryKey: ['top-skus', supplier.id],
    queryFn: () => catalogApi.topSkus(365, supplier.id, 8).then(r => r.data.data),
  })

  async function handleSave() {
    setSaving(true)
    try {
      await catalogApi.updateSupplier(supplier.id, {
        name: form.name || undefined, rfc: form.rfc || undefined,
        email: form.email || undefined, phone: form.phone || undefined, notes: form.notes || undefined,
      })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setEditing(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            {editing
              ? <input className="text-lg font-bold border-b border-blue-400 outline-none w-full"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              : <h2 className="text-lg font-bold text-gray-900">{supplier.name}</h2>
            }
            <p className="text-sm text-gray-400 mt-0.5">RFC: {supplier.rfc ?? '—'}</p>
          </div>
          <div className="flex gap-2 ml-4">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">Editar</button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Contacto */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {(['email','phone','notes'] as const).map(field => (
              <div key={field} className={field === 'notes' ? 'col-span-2' : ''}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  {field === 'email' ? 'Email' : field === 'phone' ? 'Teléfono' : 'Notas'}
                </p>
                {editing
                  ? field === 'notes'
                    ? <textarea rows={2} className="w-full border rounded px-2 py-1 text-sm"
                        value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    : <input className="w-full border rounded px-2 py-1 text-sm"
                        value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                  : <p className="text-gray-700">{(supplier as any)[field] ?? <span className="text-gray-300 italic">—</span>}</p>
                }
              </div>
            ))}
          </div>

          {/* Gráfica mensual */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Historial de gasto mensual</h3>
            {!timelineData?.length ? (
              <p className="text-sm text-gray-400 py-6 text-center">Sin facturas registradas aún</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={timelineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_spend" name="Gasto" fill="#3b82f6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top productos */}
          {topSkusData && topSkusData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Productos más comprados</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart layout="vertical"
                  data={topSkusData.map(s => ({
                    name: s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name,
                    fullName: s.name, gasto: s.total_spend, avg: s.avg_price,
                  }))}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-white border rounded-lg shadow px-3 py-2 text-sm">
                        <p className="font-medium mb-1">{d.fullName}</p>
                        <p className="text-blue-600">Gasto: <span className="font-mono">{fmt(d.gasto)}</span></p>
                        <p className="text-gray-500">Precio prom: <span className="font-mono">${Number(d.avg).toFixed(2)}</span></p>
                      </div>
                    )
                  }} />
                  <Bar dataKey="gasto" name="Gasto" fill="#10b981" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export function SuppliersPage() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(MONTHS[0].value)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', rfc: '', email: '', phone: '' })
  const [creating, setCreating] = useState(false)

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['monthly-summary', month],
    queryFn: () => catalogApi.monthlySummary(month).then(r => r.data),
  })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => catalogApi.listSuppliers().then(r => r.data.data),
  })

  const suppliers: Supplier[] = suppliersData ?? []
  const summary = summaryData

  // Mapa supplier_id → datos de gasto del mes
  const spendMap = Object.fromEntries(
    (summary?.invoices.by_supplier ?? []).map(s => [s.supplier_id, s])
  )

  // Datos pie facturas por proveedor
  const invoicePieData = (summary?.invoices.by_supplier ?? []).slice(0, 7).map(s => ({
    name: s.supplier_name.length > 22 ? s.supplier_name.slice(0, 20) + '…' : s.supplier_name,
    value: s.total_spend,
  }))
  if ((summary?.invoices.by_supplier.length ?? 0) > 7) {
    const resto = summary!.invoices.by_supplier.slice(7).reduce((a, s) => a + s.total_spend, 0)
    invoicePieData.push({ name: 'Otros', value: resto })
  }

  // Datos pie caja chica por categoría
  const cashByCategory = (summary?.cash.expenses ?? []).reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {} as Record<string, number>)
  const cashPieData = Object.entries(cashByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // Gasto diario para el área chart
  const dailyData = summary?.daily_spend ?? []

  async function handleCreate() {
    if (!newForm.name) return
    setCreating(true)
    try {
      await catalogApi.createSupplier({ name: newForm.name, rfc: newForm.rfc || undefined, email: newForm.email || undefined, phone: newForm.phone || undefined })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['monthly-summary'] })
      setShowForm(false)
      setNewForm({ name: '', rfc: '', email: '', phone: '' })
    } finally { setCreating(false) }
  }

  const monthLabel = MONTHS.find(m => m.value === month)?.label ?? month

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resumen mensual</h1>
          <p className="text-gray-500 text-sm mt-1">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Nuevo proveedor
          </button>
        </div>
      </div>

      {/* ── Form nuevo proveedor ── */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Nuevo proveedor</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'name',  label: 'Nombre *',  placeholder: 'Nombre del proveedor' },
              { key: 'rfc',   label: 'RFC',        placeholder: 'RFC' },
              { key: 'email', label: 'Email',      placeholder: 'correo@ejemplo.com' },
              { key: 'phone', label: 'Teléfono',   placeholder: '+52 ...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder={placeholder}
                  value={(newForm as any)[key]}
                  onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={creating || !newForm.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {creating ? 'Guardando…' : 'Crear proveedor'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-white">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Tarjetas resumen ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total del mes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(summary.grand_total)}</p>
            <p className="text-xs text-gray-400 mt-1">Facturas + Caja chica</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Facturas</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(summary.invoices.total_amount)}</p>
            <p className="text-xs text-gray-400 mt-1">{summary.invoices.invoice_count} factura{summary.invoices.invoice_count !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Caja chica</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{fmt(summary.cash.total_amount)}</p>
            <p className="text-xs text-gray-400 mt-1">{summary.cash.expense_count} gasto{summary.cash.expense_count !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Proveedores activos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.invoices.by_supplier.length}</p>
            <p className="text-xs text-gray-400 mt-1">con facturas este mes</p>
          </div>
        </div>
      )}

      {/* ── Gráfica diaria ── */}
      {dailyData.length > 1 && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Gasto diario del mes</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={dailyData.map(d => ({
              day: new Date(d.day + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
              total: d.total,
            }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Gasto" stroke="#3b82f6" fill="url(#areaGrad)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Dos pies: facturas y caja chica ── */}
      {summary && (invoicePieData.length > 0 || cashPieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie facturas por proveedor */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Facturas por proveedor</h2>
            <p className="text-xs text-gray-400 mb-4">{monthLabel}</p>
            {invoicePieData.length === 0 ? (
              <p className="text-sm text-gray-400 py-12 text-center">Sin facturas registradas este mes</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={invoicePieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}
                    label={({ percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                    {invoicePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtFull(Number(v))} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={v => <span className="text-xs text-gray-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie caja chica por categoría */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Caja chica por categoría</h2>
            <p className="text-xs text-gray-400 mb-4">{monthLabel}</p>
            {cashPieData.length === 0 ? (
              <p className="text-sm text-gray-400 py-12 text-center">Sin gastos de caja chica este mes</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={cashPieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}
                    label={({ percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                    {cashPieData.map((entry, i) => (
                      <Cell key={i} fill={CASH_CATEGORY_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtFull(Number(v))} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={v => <span className="text-xs text-gray-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Facturas del mes por proveedor ── */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Facturas del mes por proveedor</h2>
          {summary && <span className="text-xs text-gray-400">{summary.invoices.invoice_count} facturas · {fmtFull(summary.invoices.total_amount)}</span>}
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-10">Cargando…</p>
        ) : !summary?.invoices.by_supplier.length ? (
          <p className="text-sm text-gray-400 text-center py-10">Sin facturas registradas en {monthLabel}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right">Facturas</th>
                <th className="px-4 py-3 text-right">Total del mes</th>
                <th className="px-4 py-3 text-right">% del total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {summary.invoices.by_supplier.map((s) => {
                const pct = summary.invoices.total_amount > 0
                  ? (s.total_spend / summary.invoices.total_amount) * 100 : 0
                const sup = suppliers.find(x => x.id === s.supplier_id)
                return (
                  <tr key={s.supplier_id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.supplier_name}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{s.invoice_count}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmtFull(s.total_spend)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sup && (
                        <button onClick={() => setSelected(sup)}
                          className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 text-blue-600">
                          Ver historial
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Gastos de caja chica del mes ── */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Caja chica del mes</h2>
          {summary && (
            <span className="text-xs text-gray-400">
              {summary.cash.expense_count} gastos · {fmtFull(summary.cash.total_amount)}
              {' · '}💵 {fmtFull(summary.cash.cash_amount)}
              {' · '}📲 {fmtFull(summary.cash.transfer_amount)}
            </span>
          )}
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-10">Cargando…</p>
        ) : !summary?.cash.expenses.length ? (
          <p className="text-sm text-gray-400 text-center py-10">Sin gastos de caja chica en {monthLabel}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-left">Método</th>
                <th className="px-4 py-3 text-left">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {summary.cash.expenses.map(e => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(e.expense_date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900">{e.description}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{fmtFull(e.amount)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.method === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {e.method === 'cash' ? '💵 Efectivo' : '📲 Transferencia'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: (CASH_CATEGORY_COLORS[e.category] ?? '#6b7280') + '20', color: CASH_CATEGORY_COLORS[e.category] ?? '#6b7280' }}>
                      {e.category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">Total caja chica</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{fmtFull(summary.cash.total_amount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Tabla todos los proveedores ── */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Todos los proveedores</h2>
          <p className="text-xs text-gray-400 mt-0.5">{suppliers.length} registrados</p>
        </div>
        {suppliers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Sin proveedores registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">RFC</th>
                <th className="px-4 py-3 text-right">Este mes</th>
                <th className="px-4 py-3 text-right">Facturas este mes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => {
                const sd = spendMap[s.id]
                return (
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.rfc ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {sd ? fmtFull(sd.total_spend) : <span className="text-gray-300 text-xs">sin actividad</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {sd?.invoice_count ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(s)}
                        className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 text-blue-600">
                        Ver historial
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel lateral */}
      {selected && (
        <SupplierDetail supplier={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
