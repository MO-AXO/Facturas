import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '../../lib/api'

function AlertDot() {
  const { data } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => catalogApi.alerts().then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
  const count = data?.data?.length ?? 0
  if (count === 0) return null
  return (
    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full">
      {count > 9 ? '9+' : count}
    </span>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-100 text-blue-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar */}
      <header className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 text-base tracking-tight">
          Facturas
          <span className="ml-1.5 text-xs font-normal text-gray-400">PB Control</span>
        </span>
        <nav className="flex items-center gap-1">
          <NavLink to="/invoices" className={navLinkClass}>
            Facturas
          </NavLink>
          <NavLink to="/suppliers" className={navLinkClass}>
            Proveedores
          </NavLink>
          <NavLink to="/catalog" className={navLinkClass}>
            Catálogo
          </NavLink>
          <NavLink to="/alerts" className={navLinkClass}>
            Alertas
            <AlertDot />
          </NavLink>
          <NavLink to="/catalog" className={navLinkClass}>
            Cat\u00e1logo
          </NavLink>
          <NavLink to="/alerts" className={navLinkClass}>
            Alertas
            <AlertDot />
          </NavLink>
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
