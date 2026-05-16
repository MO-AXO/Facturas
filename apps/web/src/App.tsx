import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

export default function App() {
  return (
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
  )
}
