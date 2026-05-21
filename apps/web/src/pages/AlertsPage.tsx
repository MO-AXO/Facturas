import { useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogApi } from '../lib/api'

type Alert = {
  id: string
  alert_type: string
  status: string
  change_pct: number
  previous_price: number
  new_price: number
  message: string
  created_at: string
  skus: { id: string; code: string; name: string } | null
  suppliers: { id: string; name: string } | null
}

export function AlertsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => catalogApi.alerts().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const alerts: Alert[] = data?.data ?? []

  async function handleAcknowledge(id: string) {
    await catalogApi.acknowledgeAlert(id)
    qc.invalidateQueries({ queryKey: ['alerts'] })
    qc.invalidateQueries({ queryKey: ['alerts-count'] })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alertas de precio</h1>
        <p className="text-gray-500 text-sm mt-1">
          Variaciones de precio detectadas en facturas aprobadas
        </p>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-center py-12">Cargando...</p>
      ) : alerts.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <p className="text-gray-400 text-lg">Sin alertas activas</p>
          <p className="text-gray-300 text-sm mt-1">
            Las alertas aparecen cuando un precio sube o baja m\u00e1s del 15%
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isIncrease = alert.change_pct > 0
            return (
              <div
                key={alert.id}
                className="bg-white border rounded-xl p-4 flex items-start gap-4"
              >
                {/* Indicador de direcci\u00f3n */}
                <div
                  className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                    isIncrease ? 'bg-red-100' : 'bg-green-100'
                  }`}
                >
                  {isIncrease ? '\u2191' : '\u2193'}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="font-semibold text-gray-900 truncate">
                      {alert.skus?.name ?? 'SKU desconocido'}
                    </p>
                    <span className="text-xs text-gray-400">{alert.skus?.code}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {alert.suppliers?.name ?? 'Proveedor desconocido'}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-mono text-gray-500">${Number(alert.previous_price).toFixed(2)}</span>
                    <span className="mx-2 text-gray-300">→</span>
                    <span className={`font-mono font-semibold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                      ${Number(alert.new_price).toFixed(2)}
                    </span>
                    <span
                      className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${
                        isIncrease ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {isIncrease ? '+' : ''}{Number(alert.change_pct).toFixed(1)}%
                    </span>
                  </p>
                </div>

                {/* Fecha + acci\u00f3n */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">
                    {new Date(alert.created_at).toLocaleDateString('es-MX')}
                  </p>
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Marcar vista
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
