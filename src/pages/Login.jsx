import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState('login') // 'login' | 'signup'
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setCargando(true)

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMensaje('Cuenta creada. Si tu proyecto requiere confirmación de correo, revisa tu bandeja antes de iniciar sesión.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Presupuesto Personal</h1>
        <p style={styles.subtitle}>
          {modo === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}
          {mensaje && <div style={styles.mensaje}>{mensaje}</div>}

          <button type="submit" disabled={cargando} style={styles.button}>
            {cargando ? 'Procesando...' : modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <button
          onClick={() => { setModo(modo === 'login' ? 'signup' : 'login'); setError(null); setMensaje(null) }}
          style={styles.linkButton}
        >
          {modo === 'login' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  title: {
    color: '#f8fafc',
    fontSize: '22px',
    margin: '0 0 4px 0',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '14px',
    margin: '0 0 24px 0',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    background: '#22c55e',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#0f172a',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '16px',
    width: '100%',
    textAlign: 'center',
  },
  error: {
    background: '#7f1d1d',
    color: '#fecaca',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '6px',
  },
  mensaje: {
    background: '#14532d',
    color: '#bbf7d0',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '6px',
  },
}
