import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { catalogApi } from '../../lib/api';
export function SkuSelector({ value, onChange }) {
    const [query, setQuery] = useState(value?.name ?? '');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await catalogApi.searchSkus(query);
                setResults(data.data);
                setOpen(true);
            }
            finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);
    return (_jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), onFocus: () => results.length > 0 && setOpen(true), placeholder: "Buscar SKU...", className: "w-full border rounded px-2 py-1 text-sm" }), loading && (_jsx("span", { className: "absolute right-2 top-1.5 text-gray-400 text-xs", children: "..." })), open && results.length > 0 && (_jsx("ul", { className: "absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto", children: results.map((sku) => (_jsxs("li", { onClick: () => {
                        onChange(sku);
                        setQuery(sku.name);
                        setOpen(false);
                    }, className: "px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm", children: [_jsx("span", { className: "font-medium", children: sku.name }), _jsxs("span", { className: "text-gray-400 ml-2 text-xs", children: [sku.code, " \u00B7 ", sku.unit] })] }, sku.id))) }))] }));
}
