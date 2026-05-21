import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SkuSelector } from './SkuSelector';
import { invoicesApi } from '../../lib/api';
export function InvoiceLineRow({ line, invoiceId, onUpdated }) {
    const [editing, setEditing] = useState(false);
    const [selectedSku, setSelectedSku] = useState(line.skus ? { ...line.skus, description: null, category: null } : null);
    const [quantity, setQuantity] = useState(line.matched_quantity != null ? Number(line.matched_quantity)
        : line.raw_quantity != null ? Number(line.raw_quantity)
            : '');
    const [unitPrice, setUnitPrice] = useState(line.matched_unit_price != null ? Number(line.matched_unit_price)
        : line.raw_unit_price != null ? Number(line.raw_unit_price)
            : '');
    const [saving, setSaving] = useState(false);
    const isProblematic = line.match_status === 'manual' || line.match_status === 'new_sku';
    const needsReview = line.match_status === 'suggested';
    async function handleSave() {
        if (!selectedSku)
            return;
        setSaving(true);
        try {
            await invoicesApi.updateLine(invoiceId, line.id, {
                sku_id: selectedSku.id,
                matched_quantity: Number(quantity),
                matched_unit: selectedSku.unit,
                matched_unit_price: Number(unitPrice),
            });
            setEditing(false);
            onUpdated();
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("tr", { className: `border-b ${isProblematic ? 'bg-red-50' : needsReview ? 'bg-yellow-50' : 'bg-white'}`, children: [_jsx("td", { className: "px-3 py-2 text-gray-400 text-sm", children: line.line_number }), _jsxs("td", { className: "px-3 py-2", children: [_jsx("p", { className: "text-sm font-mono text-gray-700", children: line.raw_description }), _jsxs("p", { className: "text-xs text-gray-400", children: [line.raw_quantity, " ", line.raw_unit, " \u00D7 $", line.raw_unit_price] })] }), _jsx("td", { className: "px-3 py-2 min-w-[220px]", children: editing ? (_jsx(SkuSelector, { value: selectedSku, onChange: setSelectedSku })) : (_jsx("div", { children: selectedSku ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm font-medium", children: selectedSku.name }), _jsx("p", { className: "text-xs text-gray-400", children: selectedSku.code })] })) : (_jsx("span", { className: "text-sm text-red-400 italic", children: "Sin match" })) })) }), _jsx("td", { className: "px-3 py-2", children: editing ? (_jsx("input", { type: "number", value: quantity, onChange: (e) => setQuantity(e.target.value), className: "w-24 border rounded px-2 py-1 text-sm" })) : (_jsxs("span", { className: "text-sm", children: [line.matched_quantity != null ? Number(line.matched_quantity) : line.raw_quantity, ' ', line.matched_unit ?? line.raw_unit] })) }), _jsx("td", { className: "px-3 py-2", children: editing ? (_jsx("input", { type: "number", value: unitPrice, onChange: (e) => setUnitPrice(e.target.value), className: "w-28 border rounded px-2 py-1 text-sm" })) : (_jsxs("span", { className: "text-sm font-mono", children: ["$", Number(line.matched_unit_price ?? line.raw_unit_price ?? 0).toFixed(2)] })) }), _jsx("td", { className: "px-3 py-2", children: _jsx(ConfidenceBadge, { status: line.match_status, confidence: line.match_confidence }) }), _jsx("td", { className: "px-3 py-2", children: editing ? (_jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: handleSave, disabled: saving || !selectedSku, className: "px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50", children: saving ? '...' : 'Guardar' }), _jsx("button", { onClick: () => setEditing(false), className: "px-2 py-1 border rounded text-xs", children: "Cancelar" })] })) : (_jsx("button", { onClick: () => setEditing(true), className: "px-2 py-1 border rounded text-xs hover:bg-gray-50", children: "Editar" })) })] }));
}
