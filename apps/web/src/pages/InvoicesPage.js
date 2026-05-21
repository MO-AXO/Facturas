import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { invoicesApi } from '../lib/api';
const statusLabel = {
    pending: 'En cola',
    extracting: 'Extrayendo',
    review: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    error: 'Error',
};
const statusColor = {
    pending: 'bg-gray-100 text-gray-600',
    extracting: 'bg-blue-100 text-blue-700',
    review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
};
export function InvoicesPage() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['invoices', filter],
        queryFn: () => invoicesApi.list({ status: filter || undefined }).then((r) => r.data),
        refetchInterval: 5000,
    });
    async function handleFileUpload(file) {
        setUploading(true);
        try {
            const { data: result } = await invoicesApi.upload(file);
            await refetch();
            navigate(`/invoices/${result.invoiceId}`);
        }
        catch (err) {
            alert('Error subiendo archivo');
        }
        finally {
            setUploading(false);
        }
    }
    return (_jsxs("div", { className: "max-w-5xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Facturas" }), _jsx("p", { className: "text-gray-500 text-sm mt-1", children: "Procesamiento de facturas de proveedores" })] }), _jsxs("div", { children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*,.pdf", className: "hidden", onChange: (e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                        handleFileUpload(file);
                                } }), _jsx("button", { onClick: () => fileInputRef.current?.click(), disabled: uploading, className: "px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm", children: uploading ? 'Subiendo...' : '+ Subir factura' })] })] }), _jsxs("div", { className: "border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-6 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer", onClick: () => fileInputRef.current?.click(), onDragOver: (e) => e.preventDefault(), onDrop: (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file)
                        handleFileUpload(file);
                }, children: [_jsx("p", { className: "text-gray-400 text-sm", children: "Arrastra una foto o PDF de factura aqu\u00ED, o haz clic para seleccionar" }), _jsx("p", { className: "text-gray-300 text-xs mt-1", children: "JPG, PNG, WEBP, PDF \u00B7 M\u00E1x 20MB" })] }), _jsx("div", { className: "flex gap-2 mb-4", children: ['', 'review', 'approved', 'pending', 'error'].map((s) => (_jsx("button", { onClick: () => setFilter(s), className: `px-3 py-1.5 rounded-full text-sm border transition-colors ${filter === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`, children: s === '' ? 'Todas' : statusLabel[s] }, s))) }), isLoading ? (_jsx("p", { className: "text-gray-400 text-center py-12", children: "Cargando..." })) : (_jsx("div", { className: "bg-white rounded-xl border overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50 text-gray-500 text-xs uppercase", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left", children: "Proveedor" }), _jsx("th", { className: "px-4 py-3 text-left", children: "Folio" }), _jsx("th", { className: "px-4 py-3 text-left", children: "Fecha" }), _jsx("th", { className: "px-4 py-3 text-right", children: "Total" }), _jsx("th", { className: "px-4 py-3 text-left", children: "Estado" }), _jsx("th", { className: "px-4 py-3 text-left", children: "Subida" })] }) }), _jsxs("tbody", { children: [data?.data?.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-12 text-center text-gray-400", children: "No hay facturas a\u00FAn" }) })), data?.data?.map((invoice) => (_jsxs("tr", { onClick: () => navigate(`/invoices/${invoice.id}`), className: "border-t hover:bg-gray-50 cursor-pointer", children: [_jsx("td", { className: "px-4 py-3 font-medium text-sm", children: invoice.suppliers?.name ?? _jsx("span", { className: "text-gray-400 italic", children: "Sin identificar" }) }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-500", children: invoice.folio ?? '—' }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-500", children: invoice.invoice_date ?? '—' }), _jsx("td", { className: "px-4 py-3 text-sm font-mono text-right", children: invoice.total ? `$${invoice.total.toFixed(2)} ${invoice.currency}` : '—' }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[invoice.status]}`, children: statusLabel[invoice.status] }) }), _jsx("td", { className: "px-4 py-3 text-xs text-gray-400", children: new Date(invoice.created_at).toLocaleDateString('es-MX') })] }, invoice.id)))] })] }) }))] }));
}
