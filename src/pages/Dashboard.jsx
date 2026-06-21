import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'
import { TrendingUp, TrendingDown, Scale } from 'lucide-react'

const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ANIO_INICIO = 2026 // el proyecto arranca en 2026

export default function Dashboard() {
  const hoy = new Date()
  const [modo, setModo] = useState('mes') // 'mes' | 'acumulado'
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const anioMax = Math.max(hoy.getFullYear(), ANIO_INICIO)
  const anios = []
  for (let a = ANIO_INICIO; a <= anioMax; a++) anios.push(a)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      setError(null)

      let q = supabase.from('transacciones').select('tipo, monto')
      if (modo === 'mes') {
        const inicioMes = `${anio}-${String(mes).padStart(2, '0')}-01`
        const finMes = new Date(anio, mes, 0).toISOString().slice(0, 10)
        q = q.gte('fecha', inicioMes).lte('fecha', finMes)
      }

      const presQuery = modo === 'mes'
        ? supabase
            .from('presupuesto_mensual')
            .select('monto_planeado, categorias(tipo)')
            .eq('anio', anio)
            .eq('mes', mes)
        : Promise.resolve({ data: [], error: null })

      const [transRes, presRes] = await Promise.all([q, presQuery])

      if (transRes.error) { setError(transRes.error.message); setCargando(false); return }
      if (presRes.error) { setError(presRes.error.message); setCargando(false); return }

      const ingresosReal = transRes.data.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
      const gastosReal = transRes.data.filter((t) => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0)
      const ingresosPlan = presRes.data.filter((p) => p.categorias?.tipo === 'ingreso').reduce((s, p) => s + Number(p.monto_planeado), 0)
      const gastosPlan = presRes.data.filter((p) => p.categorias?.tipo === 'gasto').reduce((s, p) => s + Number(p.monto_planeado), 0)

      setResumen({
        ingresosReal, gastosReal, ingresosPlan, gastosPlan,
        balance: ingresosReal - gastosReal,
        n: transRes.data.length,
      })
      setCargando(false)
    }
    cargar()
  }, [modo, anio, mes])

  const titulo = modo === 'acumulado' ? 'Acumulado (todo)' : `${nombresMes[mes - 1]} ${anio}`
  const selectCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div className="max-w-3xl mx-auto animate-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Resumen</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setModo('mes')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${modo === 'mes' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Mes
            </button>
            <button
              onClick={() => setModo('acumulado')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${modo === 'acumulado' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Acumulado
            </button>
          </div>
          {modo === 'mes' && (
            <>
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={selectCls}>
                {nombresMes.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
              </select>
              <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={selectCls}>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">{titulo}</p>

      {error && <div className="alert-danger text-sm mb-4">{error}</div>}

      {cargando ? (
        <div className="py-16 text-center text-gray-400">Cargando resumen...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <TrendingUp className="h-4 w-4 text-success-600" /> Ingresos
              </div>
              <p className="text-2xl font-bold text-success-600">{formatAmount(resumen.ingresosReal)}</p>
              {modo === 'mes' && <p className="text-xs text-gray-400 mt-1">plan: {formatAmount(resumen.ingresosPlan)}</p>}
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <TrendingDown className="h-4 w-4 text-danger-600" /> Gastos
              </div>
              <p className="text-2xl font-bold text-danger-600">{formatAmount(resumen.gastosReal)}</p>
              {modo === 'mes' && <p className="text-xs text-gray-400 mt-1">plan: {formatAmount(resumen.gastosPlan)}</p>}
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Scale className="h-4 w-4 text-primary-600" /> {modo === 'acumulado' ? 'Balance acumulado' : 'Balance del mes'}
              </div>
              <p className={`text-2xl font-bold ${resumen.balance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {formatAmount(resumen.balance)}
              </p>
            </div>
          </div>

          {resumen.n === 0 && (
            <p className="text-sm text-gray-400 mt-5">No hay transacciones confirmadas en este periodo.</p>
          )}
        </>
      )}
    </div>
  )
}
