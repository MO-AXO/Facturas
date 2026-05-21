import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { invoicesApi, type InvoiceStatus } from '../lib/api'

const statusLabel: Record<InvoiceStatus, string> = {
  pending: 'En cola',
  extracting: 'Extrayendo',
  review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  error: 'Error',
}

const statusColor: Record<InvoiceStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  extracting: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', filter],
    queryFn: () => invoicesApi.list({ status: filter || undefined }).then((r) => r.data),
    refetchInterval: 5000,
  })

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const { data: result } = await invoicesApi.upload(file)
      await refetch()
      navigate(`/invoices/${result.invoiceId}`)
    } catch (err) {
      alert('Error subiendo archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-gray-500 text-sm mt-1">Procesamiento de facturas de proveedores</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
          >
            {uploading ? 'Subiendo...' : '+ Subir factura'}
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-6 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) handleFileUpload(file)
        }}
      >
        <p className="text-gray-400 text-sm">Arrastra una foto o PDF de factura aquí, o haz clic para seleccionar</p>
        <p className="text-gray-300 text-xs mt-1">JPG, PNG, WEBP, PDF · Máx 20MB</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['', 'review', 'approved', 'pending', 'error'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s === '' ? 'Todas' : statusLabel[s as InvoiceStatus]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-12">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-left">Folio</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Subida</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No hay facturas aún
                  </td>
                </tr>
              )}
              {data?.data?.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-sm">
                    {invoice.suppliers?.name ?? <span className="text-gray-400 italic">Sin identificar</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{invoice.folio ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{invoice.invoice_date ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-right">
                    {invoice.total ? `$${Number(invoice.total).toFixed(2)} ${invoice.currency}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[invoice.status]}`}>
                      {statusLabel[invoice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(invoice.created_at).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
