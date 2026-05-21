import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component } from 'react';
import { Layout } from './components/ui/Layout';
import { InvoicesPage } from './pages/InvoicesPage';
import { ReviewPage } from './pages/ReviewPage';
import { AlertsPage } from './pages/AlertsPage';
import { CatalogPage } from './pages/CatalogPage';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 10000, retry: 1 },
    },
});
class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) {
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 p-8", children: _jsxs("div", { className: "bg-white border border-red-200 rounded-xl p-6 max-w-lg w-full", children: [_jsx("h1", { className: "text-red-600 font-semibold text-lg mb-2", children: "Error inesperado" }), _jsx("pre", { className: "text-xs text-gray-600 bg-gray-50 rounded p-3 overflow-auto whitespace-pre-wrap", children: this.state.error.message }), _jsx("button", { onClick: () => window.location.reload(), className: "mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm", children: "Recargar" })] }) }));
        }
        return this.props.children;
    }
}
export default function App() {
    return (_jsx(ErrorBoundary, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/invoices", replace: true }) }), _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/invoices", element: _jsx(InvoicesPage, {}) }), _jsx(Route, { path: "/catalog", element: _jsx(CatalogPage, {}) }), _jsx(Route, { path: "/alerts", element: _jsx(AlertsPage, {}) })] }), _jsx(Route, { path: "/invoices/:id", element: _jsx(ReviewPage, {}) })] }) }) }) }));
}
