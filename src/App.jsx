import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Importar from './pages/Importar'
import Pendientes from './pages/Pendientes'
import Transacciones from './pages/Transacciones'
import Admin from './pages/Admin'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando, null = sin sesión
  const [vista, setVista] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (session === undefined) {
    return <div style={styles.loading}>Cargando...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.brand}>Presupuesto</span>
        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
      </header>

      <nav style={styles.nav}>
        <button
          onClick={() => setVista('dashboard')}
          style={vista === 'dashboard' ? styles.navButtonActive : styles.navButton}
        >
          Resumen
        </button>
        <button
          onClick={() => setVista('importar')}
          style={vista === 'importar' ? styles.navButtonActive : styles.navButton}
        >
          Importar
        </button>
        <button
          onClick={() => setVista('pendientes')}
          style={vista === 'pendientes' ? styles.navButtonActive : styles.navButton}
        >
          Pendientes
        </button>
        <button
          onClick={() => setVista('transacciones')}
          style={vista === 'transacciones' ? styles.navButtonActive : styles.navButton}
        >
          Transacciones
        </button>
        <button
          onClick={() => setVista('admin')}
          style={vista === 'admin' ? styles.navButtonActive : styles.navButton}
        >
          Admin
        </button>
      </nav>

      <main>
        {vista === 'dashboard' && <Dashboard />}
        {vista === 'importar' && <Importar onImportado={() => setVista('pendientes')} />}
        {vista === 'pendientes' && <Pendientes />}
        {vista === 'transacciones' && <Transacciones />}
        {vista === 'admin' && <Admin />}
      </main>
    </div>
  )
}

const styles = {
  app: { minHeight: '100vh', background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#0f172a' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px', borderBottom: '1px solid #1e293b',
  },
  brand: { color: '#f8fafc', fontWeight: 700, fontSize: '16px' },
  logoutButton: {
    background: 'none', border: '1px solid #334155', color: '#cbd5e1',
    borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
  },
  nav: { display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '12px 24px', borderBottom: '1px solid #1e293b' },
  navButton: {
    background: 'none', border: 'none', color: '#94a3b8', padding: '8px 14px',
    borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
  },
  navButtonActive: {
    background: '#1e293b', border: 'none', color: '#f8fafc', padding: '8px 14px',
    borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600,
  },
}
