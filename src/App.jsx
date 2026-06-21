import { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { Home, Upload, ClipboardCheck, Receipt, Settings, LogOut, Menu, X, Wallet } from 'lucide-react'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Importar from './pages/Importar'
import Pendientes from './pages/Pendientes'
import Transacciones from './pages/Transacciones'
import Admin from './pages/Admin'

const navItems = [
  { to: '/', icon: Home, label: 'Resumen', end: true },
  { to: '/importar', icon: Upload, label: 'Importar' },
  { to: '/pendientes', icon: ClipboardCheck, label: 'Pendientes' },
  { to: '/transacciones', icon: Receipt, label: 'Transacciones' },
  { to: '/admin', icon: Settings, label: 'Admin' },
]

function ImportarRoute() {
  const navigate = useNavigate()
  return <Importar onImportado={() => navigate('/pendientes')} />
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando, null = sin sesión
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut() }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                  <Wallet className="h-5 w-5" />
                </div>
                <h1 className="text-lg font-bold text-gray-900">Presupuesto</h1>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
          <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="flex items-center justify-between px-6 py-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100">
                <Menu className="h-5 w-5" />
              </button>
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString('es-MX', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </div>
            </div>
          </header>

          <main className="p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/importar" element={<ImportarRoute />} />
              <Route path="/pendientes" element={<Pendientes />} />
              <Route path="/transacciones" element={<Transacciones />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}
