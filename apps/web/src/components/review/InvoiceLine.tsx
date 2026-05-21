import { useState } from 'react'
import { ConfidenceBadge } from './ConfidenceBadge'
import { SkuSelector } from './SkuSelector'
import { invoicesApi, type InvoiceLine as ILine, type Sku } from '../../lib/api'

type Props = {
  line: ILine
  invoiceId: string
  onUpdated: () => void
}

// Parsea la sugerencia de SKU guardada en override_notes
function parseSuggestion(notes: string | null): { suggested_sku_name: string; suggested_sku_code: string | null; suggested_sku_unit: string | null } | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes)
    if (parsed?.suggested_sku_name) return parsed
  } catch {}
  return null
}

// ── Sub-componente: panel de autorización para SKU nuevo ──────────────────
function NewSkuPanel({
  line,
  invoiceId,
  onCreated,
}: {
  line: ILine
  invoiceId: string
  onCreated: () => void
}) {
  const suggestion = parseSuggestion(line.override_notes ?? null)

  const [name, setName]   = useState(suggestion?.suggested_sku_name ?? line.raw_description ?? '')
  const [code, setCode]   = useState(suggestion?.suggested_sku_code ?? '')
  const [unit, setUnit]   = useState(suggestion?.suggested_sku_unit ?? line.raw_unit ?? 'pza')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function handleCreate() {
    if (!name || !code || !unit) return
    setSaving(true)
    setError(null)
    try {
      await invoicesApi.createSkuFromLine(invoiceId, line.id, { name, code, unit, category: category || undefined })
      onCreated()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Error creando SKU')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
          <span>✦</span> SKU nuevo detectado — revisa y confirma
        </p>
        <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 text-xs">
          Ignorar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="col-span-2">
          <label className="block text-amber-700 mb-0.5">Nombre del SKU</label>
          <input
            className="w-full border border-amber-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-amber-400"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Tomate bola"
          />
        </div>
        <div>
          <label className="block text-amber-700 mb-0.5">Código</label>
          <input
            className="w-full border border-amber-200 rounded px-2 py-1 text-sm bg-white uppercase focus:outline-none focus:border-amber-400"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g, '-').slice(0, 16))}
            placeholder="TOMATE-BOLA"
          />
        </div>
        <div>
          <label className="block text-amber-700 mb-0.5">Unidad</label>
          <select
            className="w-full border border-amber-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-amber-400"
            value={unit}
            onChange={e => setUnit(e.target.value)}
          >
            {['kg','g','lt','ml','pza','cja','blt','cos','lta','bot','doc','por'].map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-amber-700 mb-0.5">Categoría <span className="text-amber-400">(opcional)</span></label>
          <input
            className="w-full border border-amber-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-amber-400"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Ej: Verduras, Lácteos, Carnes…"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCreate}
          disabled={saving || !name || !code || !unit}
          className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
        >
          {saving ? 'Creando…' : '✓ Crear SKU y confirmar'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-3 py-1.5 border border-amber-200 rounded text-xs text-amber-700 hover:bg-amber-100"
        >
          Asignar a SKU existente
        </button>
      </div>
    </div>
  )
}

// ── Fila principal ────────────────────────────────────────────────────────
export function InvoiceLineRow({ line, invoiceId, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [selectedSku, setSelectedSku] = useState<Sku | null>(
    line.skus ? { ...line.skus, description: null, category: null } : null
  )
  const [quantity, setQuantity] = useState<string | number>(
    line.matched_quantity != null ? Number(line.matched_quantity)
    : line.raw_quantity != null   ? Number(line.raw_quantity)
    : ''
  )
  const [unitPrice, setUnitPrice] = useState<string | number>(
    line.matched_unit_price != null ? Number(line.matched_unit_price)
    : line.raw_unit_price != null   ? Number(line.raw_unit_price)
    : ''
  )
  const [saving, setSaving] = useState(false)

  const isUnmatched  = line.match_status === 'manual' && !line.sku_id
  const isProblematic = line.match_status === 'manual' || line.match_status === 'new_sku'
  const needsReview   = line.match_status === 'suggested'
  const hasSuggestion = isUnmatched && parseSuggestion(line.override_notes ?? null) !== null

  async function handleSave() {
    if (!selectedSku) return
    setSaving(true)
    try {
      await invoicesApi.updateLine(invoiceId, line.id, {
        sku_id: selectedSku.id,
        matched_quantity: Number(quantity),
        matched_unit: selectedSku.unit,
        matched_unit_price: Number(unitPrice),
      })
      setEditing(false)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const rowBg = isProblematic ? 'bg-red-50' : needsReview ? 'bg-yellow-50' : 'bg-white'

  return (
    <>
      <tr className={`border-b ${rowBg}`}>
        {/* # */}
        <td className="px-3 py-2 text-gray-400 text-sm align-top">{line.line_number}</td>

        {/* Descripción cruda */}
        <td className="px-3 py-2 align-top">
          <p className="text-sm font-mono text-gray-700">{line.raw_description}</p>
          <p className="text-xs text-gray-400">
            {line.raw_quantity} {line.raw_unit} × ${Number(line.raw_unit_price ?? 0).toFixed(2)}
          </p>
        </td>

        {/* SKU matcheado */}
        <td className="px-3 py-2 min-w-[220px] align-top">
          {editing ? (
            <SkuSelector value={selectedSku} onChange={setSelectedSku} />
          ) : (
            <div>
              {selectedSku ? (
                <>
                  <p className="text-sm font-medium">{selectedSku.name}</p>
                  <p className="text-xs text-gray-400">{selectedSku.code}</p>
                </>
              ) : (
                <span className="text-sm text-red-400 italic">
                  {hasSuggestion ? 'Pendiente de autorización' : 'Sin match'}
                </span>
              )}
            </div>
          )}
        </td>

        {/* Cantidad normalizada */}
        <td className="px-3 py-2 align-top">
          {editing ? (
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-24 border rounded px-2 py-1 text-sm"
            />
          ) : (
            <span className="text-sm">
              {line.matched_quantity != null ? Number(line.matched_quantity) : line.raw_quantity}{' '}
              {line.matched_unit ?? line.raw_unit}
            </span>
          )}
        </td>

        {/* Precio unitario */}
        <td className="px-3 py-2 align-top">
          {editing ? (
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-28 border rounded px-2 py-1 text-sm"
            />
          ) : (
            <span className="text-sm font-mono">
              ${Number(line.matched_unit_price ?? line.raw_unit_price ?? 0).toFixed(2)}
            </span>
          )}
        </td>

        {/* Badge */}
        <td className="px-3 py-2 align-top">
          <ConfidenceBadge status={line.match_status} confidence={line.match_confidence} />
        </td>

        {/* Acciones */}
        <td className="px-3 py-2 align-top">
          {editing ? (
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                disabled={saving || !selectedSku}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
              >
                {saving ? '...' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-2 py-1 border rounded text-xs"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
            >
              Editar
            </button>
          )}
        </td>
      </tr>

      {/* Fila extra: panel de autorización de SKU nuevo */}
      {isUnmatched && !editing && (
        <tr className={`${rowBg} border-b`}>
          <td />
          <td colSpan={6} className="px-3 pb-3">
            <NewSkuPanel
              line={line}
              invoiceId={invoiceId}
              onCreated={onUpdated}
            />
          </td>
        </tr>
      )}
    </>
  )
}
