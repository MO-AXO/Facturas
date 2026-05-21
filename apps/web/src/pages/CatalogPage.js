import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, api } from '../lib/api';
function PriceHistoryPanel({ skuId }) {
    const { data, isLoading } = useQuery({
        queryKey: ['price-history', skuId],
        queryFn: () => catalogApi.priceHistory(skuId, 90).then((r) => r.data),
    });
    const entries = data?.data ?? [];
    if (isLoading)
        return _jsx("p", { className: "text-sm text-gray-400 py-4", children: "Cargando..." });
    if (entries.length === 0)
        return _jsx("p", { className: "text-sm text-gray-400 py-4", children: "Sin historial de precios" });
    return (_jsxs("table", { className: "w-full text-sm mt-2", children: [_jsx("thead", { className: "text-xs text-gray-500 uppercase", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-1", children: "Fecha" }), _jsx("th", { className: "text-left py-1", children: "Proveedor" }), _jsxs("th", { className: "text-right py-1", children: ["Precio/", entries[0]?.unit] })] }) }), _jsx("tbody", { children: entries.map((e, i) => (_jsxs("tr", { className: "border-t", children: [_jsx("td", { className: "py-1.5 text-gray-600", children: e.invoice_date }), _jsx("td", { className: "py-1.5 text-gray-500", children: e.suppliers?.name ?? '—' }), _jsxs("td", { className: "py-1.5 font-mono text-right", children: ["$", Number(e.unit_price).toFixed(4)] })] }, i))) })] }));
}
export function CatalogPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ code: '', name: '', category: '', unit: 'kg', description: '' });
    const [saving, setSaving] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ['skus', search],
        queryFn: () => catalogApi.searchSkus(search).then((r) => r.data),
        staleTime: 10000,
    });
    const skus = data?.data ?? [];
    async function handleCreate() {
        setSaving(true);
        try {
            await api.post('/api/skus', form);
            qc.invalidateQueries({ queryKey: ['skus'] });
            setShowForm(false);
            setForm({ code: '', name: '', category: '', unit: 'kg', description: '' });
        }
        catch {
            alert('Error creando SKU');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "max-w-4xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Cat\\u00e1logo de SKUs" }), _jsx("p", { className: "text-gray-500 text-sm mt-1", children: "Productos internos con unidad can\\u00f3nica" })] }), _jsx("button", { onClick: () => setShowForm(!showForm), className: "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700", children: "+ Nuevo SKU" })] }), showForm && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6", children: [_jsx("h2", { className: "font-semibold text-gray-800 mb-3", children: "Nuevo SKU" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-500 mb-1", children: "C\\u00f3digo interno *" }), _jsx("input", { value: form.code, onChange: (e) => setForm((f) => ({ ...f, code: e.target.value })), placeholder: "CARNE-RES-MOLIDA", className: "w-full border rounded px-2 py-1.5 text-sm font-mono" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-500 mb-1", children: "Nombre *" }), _jsx("input", { value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })), placeholder: "Carne de res molida", className: "w-full border rounded px-2 py-1.5 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-500 mb-1", children: "Categor\\u00eda" }), _jsx("input", { value: form.category, onChange: (e) => setForm((f) => ({ ...f, category: e.target.value })), placeholder: "Carnes", className: "w-full border rounded px-2 py-1.5 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-500 mb-1", children: "Unidad can\\u00f3nica *" }), _jsx("select", { value: form.unit, onChange: (e) => setForm((f) => ({ ...f, unit: e.target.value })), className: "w-full border rounded px-2 py-1.5 text-sm", children: ['kg', 'g', 'lt', 'ml', 'pza', 'cja', 'blt', 'cos', 'lta', 'bot', 'doc', 'por'].map((u) => (_jsx("option", { value: u, children: u }, u))) })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: "block text-xs text-gray-500 mb-1", children: "Descripci\\u00f3n" }), _jsx("input", { value: form.description, onChange: (e) => setForm((f) => ({ ...f, description: e.target.value })), placeholder: "Descripci\\u00f3n opcional", className: "w-full border rounded px-2 py-1.5 text-sm" })] })] }), _jsxs("div", { className: "flex gap-2 mt-3", children: [_jsx("button", { onClick: handleCreate, disabled: saving || !form.code || !form.name, className: "px-4 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50", children: saving ? 'Guardando...' : 'Guardar' }), _jsx("button", { onClick: () => setShowForm(false), className: "px-4 py-1.5 border rounded text-sm", children: "Cancelar" })] })] })), _jsx("div", { className: "mb-4", children: _jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Buscar por nombre...", className: "w-full border rounded-lg px-3 py-2 text-sm" }) }), isLoading ? (_jsx("p", { className: "text-gray-400 text-center py-12", children: "Cargando..." })) : (_jsxs("div", { className: "space-y-2", children: [skus.length === 0 && (_jsx("p", { className: "text-gray-400 text-center py-12", children: search ? 'Sin resultados' : 'No hay SKUs en el cat\u00e1logo' })), skus.map((sku) => (_jsxs("div", { className: "bg-white border rounded-xl overflow-hidden", children: [_jsxs("button", { onClick: () => setExpanded(expanded === sku.id ? null : sku.id), className: "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "font-medium text-gray-900", children: sku.name }), sku.category && (_jsx("span", { className: "text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded", children: sku.category }))] }), _jsxs("p", { className: "text-xs text-gray-400 font-mono mt-0.5", children: [sku.code, " \\u00b7 ", sku.unit] })] }), _jsx("span", { className: "text-gray-400 text-sm", children: expanded === sku.id ? '\u25b2' : '\u25bc' })] }), expanded === sku.id && (_jsxs("div", { className: "px-4 pb-4 border-t", children: [_jsx("p", { className: "text-sm text-gray-500 mt-3 mb-1", children: "Historial de precios (90 d\\u00edas)" }), _jsx(PriceHistoryPanel, { skuId: sku.id })] }))] }, sku.id)))] }))] }));
}
