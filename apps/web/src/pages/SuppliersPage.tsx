import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { catalogApi, type Supplier } from '../lib/api'

// ── Colores para el pie chart ──────────────────────────────────────────────
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(1)}k`
  : `$${n.toFixed(0)}`

// ── Tooltip personalizado ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ── Panel de detalle de un proveedor ──────────────────────────────────────
function SupplierDetail({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: supplier.name, rfc: supplier.rfc ?? '', email: supplier.email ?? '', phone: supplier.phone ?? '', notes: supplier.notes ?? '' })
  const [saving, setSaving] = useState(false)
  const [days, setDays] = useState(90)

  const { data: spendData } = useQuery({
    queryKey: ['spend-over-time', supplier.id, days],
    queryFn: () => catalogApi.spendOverTime(days * 4, supplier.id).then(r => r.data.data),
  })

  const { data: topSkusData } = useQuery({
    queryKey: ['top-skus', supplier.id, days],
    queryFn: () => catalogApi.topSkus(days, supplier.id, 8).then(r => r.data.data),
  })

  async function handleSave() {
    setSaving(true)
    try {
      await catalogApi.updateSupplier(supplier.id, {
        name:  form.name  || undefined,
        rfc:   form.rfc   || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const spendChartData = spendData?.map(d => ({
    ...d,
    month: d.month.slice(0, 7), // YYYY-MM
  })) ?? []

  const topSkusChartData = topSkusData?.map(d => ({
    name: d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name,
    fullName: d.name,
    gasto: d.total_spend,
    precio_prom: d.avg_price,
  })) ?? []

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel deslizable */}
      <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            {editing ? (
              <input
                className="text-lg font-bold border-b border-blue-400 outline-none w-full"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            ) : (
              <h2 className="text-lg font-bold text-gray-900">{supplier.name}</h2>
            )}
            <p className="text-sm text-gray-400 mt-0.5">RFC: {supplier.rfc ?? '—'}</p>
          </div>
          <div className="flex gap-2 ml-4">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-3 py-1.5 border rounded text-sm">
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">
                Editar
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Datos de contacto */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {(['email','phone','notes'] as const).map(field => (
              <div key={field} className={field === 'notes' ? 'col-span-2' : ''}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  {field === 'email' ? 'Email' : field === 'phone' ? 'Teléfono' : 'Notas'}
                </p>
                {editing ? (
                  field === 'notes'
                    ? <textarea rows={2} className="w-full border rounded px-2 py-1 text-sm"
                        value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                    : <input className="w-full border rounded px-2 py-1 text-sm"
                        value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                ) : (
                  <p className="text-gray-700">{(supplier as any)[field] ?? <span className="text-gray-300 italic">—</span>}</p>
                )}
              </div>
            ))}
          </div>

          {/* Selector de periodo */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Periodo:</span>
            {[30, 90, 180, 365].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  days === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                {d === 30 ? '1 mes' : d === 90 ? '3 meses' : d === 180 ? '6 meses' : '1 año'}
              </button>
            ))}
          </div>

          {/* Gráfica: gasto mensual */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Gasto mensual</h3>
            {spendChartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Sin datos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={spendChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_spend" name="Gasto" fill="#3b82f6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gráfica: top SKUs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Top productos comprados</h3>
            {topSkusChartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Sin datos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topSkusChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-white border rounded-lg shadow-lg px-3 py-2 text-sm max-w-xs">
                          <p className="font-medium mb-1">{d.fullName}</p>
                          <p className="text-blue-600">Gasto total: <span className="font-mono">{fmt(d.gasto)}</span></p>
                          <p className="text-gray-500">Precio prom: <span className="font-mono">${Number(d.precio_prom).toFixed(2)}</span></p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="gasto" name="Gasto" fill="#10b981" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export function SuppliersPage() {
  const qc = useQueryClient()
  const [days, setDays] = useState(90)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', rfc: '', email: '', phone: '' })
  const [creating, setCreating] = useState(false)

  const { data: suppliersData, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => catalogApi.listSuppliers().then(r => r.data.data),
  })

  const { data: spendData, isLoading: loadingSpend } = useQuery({
    queryKey: ['spend-by-supplier', days],
    queryFn: () => catalogApi.spendBySupplier(days).then(r => r.data.data),
  })

  const { data: timelineData } = useQuery({
    queryKey: ['spend-over-time-global', days],
    queryFn: () => catalogApi.spendOverTime(days).then(r => r.data.data),
  })

  const { data: topSkusGlobal } = useQuery({
    queryKey: ['top-skus-global', days],
    queryFn: () => catalogApi.topSkus(days, undefined, 8).then(r => r.data.data),
  })

  const suppliers: Supplier[] = suppliersData ?? []
  const spend = spendData ?? []
  const timeline = timelineData ?? []

  // Enriquecer tabla de proveedores con datos de gasto
  const spendMap = Object.fromEntries(spend.map(s => [s.id, s]))

  const totalGasto = spend.reduce((a, s) => a + s.total_spend, 0)

  // Datos para pie chart
  const pieData = spend.slice(0, 7).map(s => ({
    name: s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name,
    value: s.total_spend,
  }))
  if (spend.length > 7) {
    const resto = spend.slice(7).reduce((a, s) => a + s.total_spend, 0)
    pieData.push({ name: 'Otros', value: resto })
  }

  async function handleCreate() {
    if (!newForm.name) return
    setCreating(true)
    try {
      await catalogApi.createSupplier({
        name:  newForm.name,
        rfc:   newForm.rfc   || undefined,
        email: newForm.email || undefined,
        phone: newForm.phone || undefined,
      })
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setShowForm(false)
      setNewForm({ name: '', rfc: '', email: '', phone: '' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-500 text-sm mt-1">
            {suppliers.length} proveedores · Gasto total:{' '}
            <span className="font-semibold text-gray-700">{fmt(totalGasto)}</span>
            {' '}en los últimos {days} días
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de periodo */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[30, 90, 180, 365].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === d ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {d === 30 ? '1M' : d === 90 ? '3M' : d === 180 ? '6M' : '1A'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Nuevo proveedor
          </button>
        </div>
      </div>

      {/* Form nuevo proveedor */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Nuevo proveedor</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { key: 'name',  label: 'Nombre *', placeholder: 'Nombre del proveedor' },
              { key: 'rfc',   label: 'RFC',       placeholder: 'RFC' },
              { key: 'email', label: 'Email',     placeholder: 'correo@ejemplo.com' },
              { key: 'phone', label: 'Teléfono',  placeholder: '+52 ...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder={placeholder}
                  value={(newForm as any)[key]}
                  onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={creating || !newForm.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {creating ? 'Guardando…' : 'Crear proveedor'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Gráficas — fila superior */}
      {!loadingSpend && spend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie: distribución de gasto */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribución de gasto por proveedor</h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                  paddingAngle={2}
                  label={({ percent }) => percent ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line: gasto en el tiempo */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Gasto mensual total</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400 py-16 text-center">Sin datos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="total_spend" name="Gasto"
                    stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Top SKUs global */}
      {topSkusGlobal && topSkusGlobal.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top productos por gasto (todos los proveedores)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topSkusGlobal.map(s => ({
              name: s.name.length > 24 ? s.name.slice(0, 22) + '…' : s.name,
              fullName: s.name,
              gasto: s.total_spend,
              avg: s.avg_price,
            }))} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={55} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white border rounded-lg shadow px-3 py-2 text-sm">
                      <p className="font-medium">{d.fullName}</p>
                      <p className="text-blue-600">Gasto: <span className="font-mono">{fmt(d.gasto)}</span></p>
                      <p className="text-gray-500">Precio prom: <span className="font-mono">${Number(d.avg).toFixed(2)}</span></p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="gasto" name="Gasto" fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla de proveedores */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Todos los proveedores</h2>
        </div>
        {loadingSuppliers ? (
          <p className="text-sm text-gray-400 text-center py-12">Cargando…</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Sin proveedores registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">RFC</th>
                <th className="px-4 py-3 text-right">Gasto ({days}d)</th>
                <th className="px-4 py-3 text-right">Facturas</th>
                <th className="px-4 py-3 text-right">Última compra</th>
                <th className="px-4 py-3 text-right">% del total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => {
                const sd = spendMap[s.id]
                const pct = totalGasto > 0 && sd ? (sd.total_spend / totalGasto) * 100 : 0
                return (
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.rfc ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {sd ? fmt(sd.total_spend) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {sd?.invoice_count ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {sd?.last_invoice_date
                        ? new Date(sd.last_invoice_date).toLocaleDateString('es-MX')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sd ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(s)}
                        className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 text-blue-600"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel de detalle */}
      {selected && (
        <SupplierDetail
          supplier={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
