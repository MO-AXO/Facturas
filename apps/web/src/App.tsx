import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Component, type ReactNode } from 'react'
import { Layout } from './components/ui/Layout'
import { InvoicesPage } from './pages/InvoicesPage'
import { ReviewPage } from './pages/ReviewPage'
import { AlertsPage } from './pages/AlertsPage'
import { CatalogPage } from './pages/CatalogPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
})

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="bg-white border border-red-200 rounded-xl p-6 max-w-lg w-full">
            <h1 className="text-red-600 font-semibold text-lg mb-2">Error inesperado</h1>
            <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 overflow-auto whitespace-pre-wrap">
              {(this.state.error as Error).message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/invoices" replace />} />
            {/* Páginas con layout (navbar) */}
            <Route element={<Layout />}>
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
            </Route>
            {/* Review ocupa pantalla completa sin navbar */}
            <Route path="/invoices/:id" element={<ReviewPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
