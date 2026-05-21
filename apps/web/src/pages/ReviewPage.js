import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { invoicesApi } from '../lib/api';
import { InvoiceLineRow } from '../components/review/InvoiceLine';
const statusLabel = {
    pending: 'En cola',
    extracting: 'Extrayendo con IA...',
    review: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    error: 'Error',
};
export function ReviewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const { data: invoice, isLoading } = useQuery({
        queryKey: ['invoice', id],
        queryFn: () => invoicesApi.get(id).then((r) => r.data),
        refetchInterval: (query) => {
            const d = query.state.data;
            return d?.status === 'pending' || d?.status === 'extracting' ? 3000 : false;
        },
    });
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("p", { className: "text-gray-400", children: "Cargando..." }) }));
    }
    if (!invoice)
        return _jsx("p", { className: "p-8 text-gray-400", children: "Factura no encontrada" });
    const isPending = invoice.status === 'pending' || invoice.status === 'extracting';
    const canApprove = invoice.status === 'review';
    const allLines = invoice.invoice_lines ?? [];
    const greenCount = allLines.filter(l => l.match_status === 'auto' || l.match_status === 'confirmed').length;
    const allGreen = allLines.length > 0 && greenCount === allLines.length;
    async function handleApprove() {
        setApproving(true);
        try {
            await invoicesApi.approve(id);
            navigate('/invoices');
        }
        finally {
            setApproving(false);
        }
    }
    async function handleReject() {
        const reason = window.prompt('Motivo de rechazo (opcional):') ?? undefined;
        setRejecting(true);
        try {
            await invoicesApi.reject(id, reason);
            navigate('/invoices');
        }
        finally {
            setRejecting(false);
        }
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsxs("div", { className: "bg-white border-b px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("button", { onClick: () => navigate('/invoices'), className: "text-sm text-gray-400 hover:text-gray-600 mb-1 block", children: "\u2190 Volver" }), _jsxs("h1", { className: "text-lg font-semibold", children: ["Revisi\u00F3n de factura", invoice.folio && _jsxs("span", { className: "text-gray-400 ml-2 font-normal", children: ["#", invoice.folio] })] }), _jsxs("p", { className: "text-sm text-gray-500", children: [invoice.suppliers?.name ?? 'Proveedor sin identificar', " \u00B7", ' ', invoice.invoice_date ?? 'Fecha no extraída'] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [allGreen && canApprove && (_jsx("span", { className: "text-sm text-green-600 font-medium", children: "Todo en verde \u2713" })), _jsx("button", { onClick: handleReject, disabled: !canApprove || rejecting, className: "px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 text-sm", children: "Rechazar" }), _jsx("button", { onClick: handleApprove, disabled: !canApprove || approving, className: "px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 text-sm font-medium", children: approving ? 'Aprobando...' : 'Aprobar todo' })] })] }), _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-6 space-y-6", children: [isPending && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-center gap-4", children: [_jsxs("svg", { className: "animate-spin w-6 h-6 text-blue-500 flex-shrink-0", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8v8H4z" })] }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-blue-800", children: statusLabel[invoice.status] }), _jsxs("p", { className: "text-sm text-blue-600", children: [invoice.file_name, " \u2014 Claude est\u00E1 leyendo la factura, esto toma unos segundos."] })] })] })), invoice.status === 'error' && (_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-xl p-4", children: [_jsx("p", { className: "font-medium text-red-700", children: "Error en extracci\u00F3n" }), _jsx("p", { className: "text-sm text-red-600 mt-1", children: invoice.error_message })] })), !isPending && invoice.status !== 'error' && (_jsxs("div", { className: "bg-white border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs uppercase tracking-wide", children: "Proveedor" }), _jsx("p", { className: "font-medium mt-0.5", children: invoice.suppliers?.name ?? '—' }), invoice.suppliers?.rfc && (_jsx("p", { className: "text-xs text-gray-400", children: invoice.suppliers.rfc }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs uppercase tracking-wide", children: "Folio" }), _jsx("p", { className: "font-medium mt-0.5", children: invoice.folio ?? '—' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs uppercase tracking-wide", children: "Fecha" }), _jsx("p", { className: "font-medium mt-0.5", children: invoice.invoice_date ?? '—' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs uppercase tracking-wide", children: "Total" }), _jsxs("p", { className: "font-mono font-semibold text-base mt-0.5", children: [invoice.total != null ? `$${Number(invoice.total).toFixed(2)}` : '—', invoice.currency && invoice.total != null && (_jsx("span", { className: "text-xs text-gray-400 ml-1", children: invoice.currency }))] }), invoice.subtotal != null && (_jsxs("p", { className: "text-xs text-gray-400", children: ["Sub $", Number(invoice.subtotal).toFixed(2), " + IVA $", Number(invoice.tax_amount ?? 0).toFixed(2)] }))] })] })), !isPending && allLines.length > 0 && (_jsxs("div", { className: "flex items-center gap-3 text-sm", children: [_jsx("div", { className: "flex-1 bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-green-500 h-2 rounded-full transition-all", style: { width: `${(greenCount / allLines.length) * 100}%` } }) }), _jsxs("span", { className: "text-gray-500 whitespace-nowrap", children: [greenCount, "/", allLines.length, " l\u00EDneas confirmadas"] })] })), !isPending && invoice.status !== 'error' && (_jsx("div", { className: "bg-white border rounded-xl overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-gray-50 text-gray-500 text-xs uppercase", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left", children: "#" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Descripci\u00F3n (factura)" }), _jsx("th", { className: "px-3 py-2 text-left", children: "SKU" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Cantidad" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Precio/u" }), _jsx("th", { className: "px-3 py-2 text-left", children: "Estado" }), _jsx("th", { className: "px-3 py-2" })] }) }), _jsx("tbody", { children: allLines.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-4 py-8 text-center text-gray-400", children: "Sin l\u00EDneas extra\u00EDdas" }) })) : (allLines.map((line) => (_jsx(InvoiceLineRow, { line: line, invoiceId: invoice.id, onUpdated: () => qc.invalidateQueries({ queryKey: ['invoice', id] }) }, line.id)))) })] }) }))] })] }));
}
