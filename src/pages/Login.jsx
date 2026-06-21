import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Wallet } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary-600 text-white flex items-center justify-center mb-3">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Presupuesto Personal</h1>
          <p className="text-sm text-gray-500">
            {modo === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Correo</label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Contraseña</label>
            <input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input-field"
            />
          </div>

          {error && <div className="alert-danger text-sm">{error}</div>}
          {mensaje && <div className="alert-success text-sm">{mensaje}</div>}

          <button type="submit" disabled={cargando} className="btn-primary w-full disabled:opacity-60">
            {cargando ? 'Procesando...' : modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <button
          onClick={() => { setModo(modo === 'login' ? 'signup' : 'login'); setError(null); setMensaje(null) }}
          className="mt-4 w-full text-center text-sm text-primary-600 hover:text-primary-700"
        >
          {modo === 'login' ? '¿No tienes cuenta? Créala' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  )
}
