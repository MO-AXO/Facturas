import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogApi, api } from '../lib/api'

type Sku = {
  id: string
  code: string
  name: string
  description: string | null
  category: string | null
  unit: string
  active: boolean
}

type PriceEntry = {
  invoice_date: string
  unit_price: number
  unit: string
  suppliers: { name: string } | null
}

function PriceHistoryPanel({ skuId }: { skuId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['price-history', skuId],
    queryFn: () => catalogApi.priceHistory(skuId, 90).then((r) => r.data),
  })

  const entries: PriceEntry[] = (data as any)?.data ?? []

  if (isLoading) return <p className="text-sm text-gray-400 py-4">Cargando...</p>
  if (entries.length === 0) return <p className="text-sm text-gray-400 py-4">Sin historial de precios</p>

  return (
    <table className="w-full text-sm mt-2">
      <thead className="text-xs text-gray-500 uppercase">
        <tr>
          <th className="text-left py-1">Fecha</th>
          <th className="text-left py-1">Proveedor</th>
          <th className="text-right py-1">Precio/{entries[0]?.unit}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i} className="border-t">
            <td className="py-1.5 text-gray-600">{e.invoice_date}</td>
            <td className="py-1.5 text-gray-500">{e.suppliers?.name ?? '—'}</td>
            <td className="py-1.5 font-mono text-right">${Number(e.unit_price).toFixed(4)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function CatalogPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', category: '', unit: 'kg', description: '' })
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['skus', search],
    queryFn: () => catalogApi.searchSkus(search).then((r) => r.data),
    staleTime: 10_000,
  })

  const skus: Sku[] = (data as any)?.data ?? []

  async function handleCreate() {
    setSaving(true)
    try {
      await api.post('/api/skus', form)
      qc.invalidateQueries({ queryKey: ['skus'] })
      setShowForm(false)
      setForm({ code: '', name: '', category: '', unit: 'kg', description: '' })
    } catch {
      alert('Error creando SKU')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cat\u00e1logo de SKUs</h1>
          <p className="text-gray-500 text-sm mt-1">Productos internos con unidad can\u00f3nica</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nuevo SKU
        </button>
      </div>

      {/* Formulario nuevo SKU */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Nuevo SKU</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">C\u00f3digo interno *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="CARNE-RES-MOLIDA"
                className="w-full border rounded px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Carne de res molida"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categor\u00eda</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Carnes"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unidad can\u00f3nica *</label>
              <select
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm"
              >
                {['kg', 'g', 'lt', 'ml', 'pza', 'cja', 'blt', 'cos', 'lta', 'bot', 'doc', 'por'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Descripci\u00f3n</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descripci\u00f3n opcional"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={saving || !form.code || !form.name}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border rounded text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* B\u00fasqueda */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-12">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {skus.length === 0 && (
            <p className="text-gray-400 text-center py-12">
              {search ? 'Sin resultados' : 'No hay SKUs en el cat\u00e1logo'}
            </p>
          )}
          {skus.map((sku) => (
            <div key={sku.id} className="bg-white border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === sku.id ? null : sku.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-gray-900">{sku.name}</span>
                    {sku.category && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {sku.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{sku.code} \u00b7 {sku.unit}</p>
                </div>
                <span className="text-gray-400 text-sm">{expanded === sku.id ? '\u25b2' : '\u25bc'}</span>
              </button>

              {expanded === sku.id && (
                <div className="px-4 pb-4 border-t">
                  <p className="text-sm text-gray-500 mt-3 mb-1">Historial de precios (90 d\u00edas)</p>
                  <PriceHistoryPanel skuId={sku.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
