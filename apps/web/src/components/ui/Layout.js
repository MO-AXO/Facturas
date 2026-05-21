import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../lib/api';
function AlertDot() {
    const { data } = useQuery({
        queryKey: ['alerts-count'],
        queryFn: () => catalogApi.alerts().then((r) => r.data),
        refetchInterval: 30000,
        staleTime: 15000,
    });
    const count = data?.data?.length ?? 0;
    if (count === 0)
        return null;
    return (_jsx("span", { className: "ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full", children: count > 9 ? '9+' : count }));
}
const navLinkClass = ({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
    ? 'bg-blue-100 text-blue-700'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`;
export function Layout() {
    return (_jsxs("div", { className: "min-h-screen flex flex-col", children: [_jsxs("header", { className: "bg-white border-b px-6 py-3 flex items-center gap-6", children: [_jsxs("span", { className: "font-bold text-gray-900 text-base tracking-tight", children: ["Facturas", _jsx("span", { className: "ml-1.5 text-xs font-normal text-gray-400", children: "PB Control" })] }), _jsxs("nav", { className: "flex items-center gap-1", children: [_jsx(NavLink, { to: "/invoices", className: navLinkClass, children: "Facturas" }), _jsx(NavLink, { to: "/catalog", className: navLinkClass, children: "Cat\\u00e1logo" }), _jsxs(NavLink, { to: "/alerts", className: navLinkClass, children: ["Alertas", _jsx(AlertDot, {})] })] })] }), _jsx("main", { className: "flex-1", children: _jsx(Outlet, {}) })] }));
}
