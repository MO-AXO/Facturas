import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../lib/api';
export function AlertsPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => catalogApi.alerts().then((r) => r.data),
        refetchInterval: 30000,
    });
    const alerts = data?.data ?? [];
    async function handleAcknowledge(id) {
        await catalogApi.acknowledgeAlert(id);
        qc.invalidateQueries({ queryKey: ['alerts'] });
        qc.invalidateQueries({ queryKey: ['alerts-count'] });
    }
    return (_jsxs("div", { className: "max-w-4xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Alertas de precio" }), _jsx("p", { className: "text-gray-500 text-sm mt-1", children: "Variaciones de precio detectadas en facturas aprobadas" })] }), isLoading ? (_jsx("p", { className: "text-gray-400 text-center py-12", children: "Cargando..." })) : alerts.length === 0 ? (_jsxs("div", { className: "bg-white border rounded-xl p-12 text-center", children: [_jsx("p", { className: "text-gray-400 text-lg", children: "Sin alertas activas" }), _jsx("p", { className: "text-gray-300 text-sm mt-1", children: "Las alertas aparecen cuando un precio sube o baja m\\u00e1s del 15%" })] })) : (_jsx("div", { className: "space-y-3", children: alerts.map((alert) => {
                    const isIncrease = alert.change_pct > 0;
                    return (_jsxs("div", { className: "bg-white border rounded-xl p-4 flex items-start gap-4", children: [_jsx("div", { className: `mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${isIncrease ? 'bg-red-100' : 'bg-green-100'}`, children: isIncrease ? '\u2191' : '\u2193' }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("p", { className: "font-semibold text-gray-900 truncate", children: alert.skus?.name ?? 'SKU desconocido' }), _jsx("span", { className: "text-xs text-gray-400", children: alert.skus?.code })] }), _jsx("p", { className: "text-sm text-gray-500", children: alert.suppliers?.name ?? 'Proveedor desconocido' }), _jsxs("p", { className: "mt-1 text-sm", children: [_jsxs("span", { className: "font-mono text-gray-500", children: ["$", Number(alert.previous_price).toFixed(2)] }), _jsx("span", { className: "mx-2 text-gray-300", children: "\u2192" }), _jsxs("span", { className: `font-mono font-semibold ${isIncrease ? 'text-red-600' : 'text-green-600'}`, children: ["$", Number(alert.new_price).toFixed(2)] }), _jsxs("span", { className: `ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${isIncrease ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`, children: [isIncrease ? '+' : '', Number(alert.change_pct).toFixed(1), "%"] }), _jsxs("span", { className: `ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${isIncrease ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`, children: [isIncrease ? '+' : '', alert.change_pct?.toFixed(1), "%"] })] })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsx("p", { className: "text-xs text-gray-400", children: new Date(alert.created_at).toLocaleDateString('es-MX') }), _jsx("button", { onClick: () => handleAcknowledge(alert.id), className: "mt-2 text-xs text-blue-600 hover:underline", children: "Marcar vista" })] })] }, alert.id));
                }) }))] }));
}
