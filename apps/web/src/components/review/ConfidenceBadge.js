import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const labels = {
    auto: 'Auto',
    suggested: 'Sugerido',
    manual: 'Manual',
    confirmed: 'Confirmado',
    new_sku: 'SKU nuevo',
};
export function ConfidenceBadge({ status, confidence }) {
    const color = status === 'auto' || status === 'confirmed'
        ? 'bg-green-100 text-green-800 border-green-300'
        : status === 'suggested'
            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
            : 'bg-red-100 text-red-800 border-red-300';
    return (_jsxs("span", { className: `inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${color}`, children: [_jsx("span", { className: `w-2 h-2 rounded-full ${status === 'auto' || status === 'confirmed'
                    ? 'bg-green-500'
                    : status === 'suggested'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'}` }), labels[status], confidence !== null && confidence < 1 && (_jsxs("span", { className: "opacity-70", children: ["(", Math.round(confidence * 100), "%)"] }))] }));
}
