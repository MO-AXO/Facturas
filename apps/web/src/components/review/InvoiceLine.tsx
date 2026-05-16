import { useState } from 'react'
import { ConfidenceBadge } from './ConfidenceBadge'
import { SkuSelector } from './SkuSelector'
import { invoicesApi, type InvoiceLine as ILine, type Sku } from '../../lib/api'

type Props = {
  line: ILine
  invoiceId: string
  onUpdated: () => void
}

export function InvoiceLineRow({ line, invoiceId, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [selectedSku, setSelectedSku] = useState<Sku | null>(
    line.skus ? { ...line.skus, description: null, category: null } : null
  )
  const [quantity, setQuantity] = useState(line.matched_quantity ?? line.raw_quantity ?? '')
  const [unitPrice, setUnitPrice] = useState(line.matched_unit_price ?? line.raw_unit_price ?? '')
  const [saving, setSaving] = useState(false)

  const isProblematic = line.match_status === 'manual' || line.match_status === 'new_sku'
  const needsReview = line.match_status === 'suggested'

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

  return (
    <tr className={`border-b ${isProblematic ? 'bg-red-50' : needsReview ? 'bg-yellow-50' : 'bg-white'}`}>
      {/* # */}
      <td className="px-3 py-2 text-gray-400 text-sm">{line.line_number}</td>

      {/* Descripción cruda */}
      <td className="px-3 py-2">
        <p className="text-sm font-mono text-gray-700">{line.raw_description}</p>
        <p className="text-xs text-gray-400">
          {line.raw_quantity} {line.raw_unit} × ${line.raw_unit_price}
        </p>
      </td>

      {/* SKU matcheado */}
      <td className="px-3 py-2 min-w-[220px]">
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
              <span className="text-sm text-red-400 italic">Sin match</span>
            )}
          </div>
        )}
      </td>

      {/* Cantidad normalizada */}
      <td className="px-3 py-2">
        {editing ? (
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 border rounded px-2 py-1 text-sm"
          />
        ) : (
          <span className="text-sm">
            {line.matched_quantity ?? line.raw_quantity} {line.matched_unit ?? line.raw_unit}
          </span>
        )}
      </td>

      {/* Precio unitario */}
      <td className="px-3 py-2">
        {editing ? (
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="w-28 border rounded px-2 py-1 text-sm"
          />
        ) : (
          <span className="text-sm font-mono">
            ${(line.matched_unit_price ?? line.raw_unit_price ?? 0).toFixed(2)}
          </span>
        )}
      </td>

      {/* Badge de confianza */}
      <td className="px-3 py-2">
        <ConfidenceBadge status={line.match_status} confidence={line.match_confidence} />
      </td>

      {/* Acciones */}
      <td className="px-3 py-2">
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
  )
}
