import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { invoicesApi } from '../lib/api'
import { InvoiceLineRow } from '../components/review/InvoiceLine'

const statusLabel: Record<string, string> = {
  pending:    'En cola',
  extracting: 'Leyendo factura con IA...',
  review:     'Por revisar',
  approved:   'Registrada',
  rejected:   'Rechazada',
  error:      'Error',
}

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id!).then((r) => r.data),
    refetchInterval: (query) => {
      const d = query.state.data
      return d?.status === 'pending' || d?.status === 'extracting' ? 3000 : false
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (!invoice) return <p className="p-8 text-gray-400">Factura no encontrada</p>

  const isPending  = invoice.status === 'pending' || invoice.status === 'extracting'
  const canApprove = invoice.status === 'review'
  const allLines   = invoice.invoice_lines ?? []
  const greenCount = allLines.filter(l => l.match_status === 'auto' || l.match_status === 'confirmed').length
  const allGreen   = allLines.length > 0 && greenCount === allLines.length

  async function handleApprove() {
    setApproving(true)
    try {
      await invoicesApi.approve(id!)
      navigate('/invoices')
    } finally {
      setApproving(false)
    }
  }

  async function handleReject() {
    const reason = window.prompt('Motivo de rechazo (opcional):') ?? undefined
    setRejecting(true)
    try {
      await invoicesApi.reject(id!, reason)
      navigate('/invoices')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/invoices')}
            className="text-sm text-gray-400 hover:text-gray-600 mb-1 block"
          >
            ← Volver
          </button>
          <h1 className="text-lg font-semibold">
            Revisión de factura
            {invoice.folio && <span className="text-gray-400 ml-2 font-normal">#{invoice.folio}</span>}
          </h1>
          <p className="text-sm text-gray-500">
            {invoice.suppliers?.name ?? 'Proveedor sin identificar'} ·{' '}
            {invoice.invoice_date ?? 'Fecha no extraída'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {allGreen && canApprove && (
            <span className="text-sm text-green-600 font-medium">Todo en verde ✓</span>
          )}
          <button
            onClick={handleReject}
            disabled={!canApprove || rejecting}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 text-sm"
          >
            Rechazar
          </button>
          <button
            onClick={handleApprove}
            disabled={!canApprove || approving}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 text-sm font-medium"
          >
            {approving ? 'Registrando...' : 'Registrar factura'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Estado / spinner cuando está procesando */}
        {isPending && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-center gap-4">
            <svg className="animate-spin w-6 h-6 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <div>
              <p className="font-medium text-blue-800">{statusLabel[invoice.status]}</p>
              <p className="text-sm text-blue-600">
                {invoice.file_name} — La IA está leyendo la factura, esto toma unos segundos.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {invoice.status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-medium text-red-700">Error en extracción</p>
            <p className="text-sm text-red-600 mt-1">{invoice.error_message}</p>
          </div>
        )}

        {/* Resumen numérico */}
        {!isPending && invoice.status !== 'error' && (
          <div className="bg-white border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Proveedor</p>
              <p className="font-medium mt-0.5">{invoice.suppliers?.name ?? '—'}</p>
              {invoice.suppliers?.rfc && (
                <p className="text-xs text-gray-400">{invoice.suppliers.rfc}</p>
              )}
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Folio</p>
              <p className="font-medium mt-0.5">{invoice.folio ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Fecha</p>
              <p className="font-medium mt-0.5">{invoice.invoice_date ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Total</p>
              <p className="font-mono font-semibold text-base mt-0.5">
                {invoice.total != null ? `$${Number(invoice.total).toFixed(2)}` : '—'}
                {invoice.currency && invoice.total != null && (
                  <span className="text-xs text-gray-400 ml-1">{invoice.currency}</span>
                )}
              </p>
              {invoice.subtotal != null && (
                <p className="text-xs text-gray-400">
                  Sub ${Number(invoice.subtotal).toFixed(2)} + IVA ${Number(invoice.tax_amount ?? 0).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Progress de líneas */}
        {!isPending && allLines.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${(greenCount / allLines.length) * 100}%` }}
              />
            </div>
            <span className="text-gray-500 whitespace-nowrap">
              {greenCount}/{allLines.length} líneas confirmadas
            </span>
          </div>
        )}

        {/* Tabla de líneas */}
        {!isPending && invoice.status !== 'error' && (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Descripción (factura)</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Cantidad</th>
                  <th className="px-3 py-2 text-left">Precio/u</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {allLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      Sin líneas extraídas
                    </td>
                  </tr>
                ) : (
                  allLines.map((line) => (
                    <InvoiceLineRow
                      key={line.id}
                      line={line}
                      invoiceId={invoice.id}
                      onUpdated={() => qc.invalidateQueries({ queryKey: ['invoice', id] })}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
