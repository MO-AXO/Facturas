import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { invoicesApi } from '../lib/api'
import { InvoiceLineRow } from '../components/review/InvoiceLine'

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
        <p className="text-gray-400">Cargando factura...</p>
      </div>
    )
  }

  if (!invoice) return <p>Factura no encontrada</p>

  const isPending = invoice.status === 'pending' || invoice.status === 'extracting'
  const canApprove = invoice.status === 'review'

  const allLines = invoice.invoice_lines ?? []
  const greenLines = allLines.filter((l) => l.match_status === 'auto' || l.match_status === 'confirmed')
  const allGreen = allLines.length > 0 && greenLines.length === allLines.length

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
          <button onClick={() => navigate('/invoices')} className="text-sm text-gray-400 hover:text-gray-600 mb-1">
            ← Volver a facturas
          </button>
          <h1 className="text-lg font-semibold">
            Revisión de factura
            {invoice.folio && <span className="text-gray-400 ml-2">#{invoice.folio}</span>}
          </h1>
          <p className="text-sm text-gray-500">
            {invoice.suppliers?.name ?? 'Proveedor sin identificar'} ·{' '}
            {invoice.invoice_date ?? 'Fecha no extraída'}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {allGreen && canApprove && (
            <span className="text-sm text-green-600 font-medium">Todo en verde ✓</span>
          )}
          <button
            onClick={handleReject}
            disabled={!canApprove || rejecting}
            className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-40 text-sm"
          >
            Rechazar
          </button>
          <button
            onClick={handleApprove}
            disabled={!canApprove || approving}
            className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 text-sm font-medium"
          >
            {approving ? 'Aprobando...' : 'Aprobar todo'}
          </button>
        </div>
      </div>

      {/* Body: split view */}
      <div className="flex h-[calc(100vh-72px)]">
        {/* Panel izquierdo: imagen/PDF */}
        <div className="w-1/2 border-r bg-white overflow-auto p-4">
          {isPending ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p>
                {invoice.status === 'pending' ? 'En cola de procesamiento...' : 'Extrayendo datos con IA...'}
              </p>
            </div>
          ) : invoice.signed_url ? (
            invoice.file_type?.startsWith('image') ? (
              <img src={invoice.signed_url} alt="Factura" className="max-w-full mx-auto" />
            ) : (
              <iframe src={invoice.signed_url} className="w-full h-full" title="Factura PDF" />
            )
          ) : (
            <p className="text-gray-400 text-center mt-20">Sin vista previa disponible</p>
          )}
        </div>

        {/* Panel derecho: líneas extraídas */}
        <div className="w-1/2 overflow-auto">
          {isPending ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Esperando extracción...</p>
            </div>
          ) : (
            <>
              {/* Resumen de factura */}
              <div className="bg-white border-b px-4 py-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Subtotal</p>
                  <p className="font-mono">${invoice.subtotal?.toFixed(2) ?? '--'}</p>
                </div>
                <div>
                  <p className="text-gray-400">IVA</p>
                  <p className="font-mono">${invoice.tax_amount?.toFixed(2) ?? '--'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Total</p>
                  <p className="font-mono font-semibold">${invoice.total?.toFixed(2) ?? '--'} {invoice.currency}</p>
                </div>
              </div>

              {/* Tabla de líneas */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
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
                          {invoice.status === 'error'
                            ? `Error: ${invoice.error_message}`
                            : 'Sin líneas extraídas'}
                        </td>
                      </tr>
                    ) : (
                      allLines
                        .sort((a, b) => a.line_number - b.line_number)
                        .map((line) => (
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
