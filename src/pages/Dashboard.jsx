import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'

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

      // Transacciones: filtra por mes salvo en modo acumulado.
      let q = supabase.from('transacciones').select('tipo, monto')
      if (modo === 'mes') {
        const inicioMes = `${anio}-${String(mes).padStart(2, '0')}-01`
        const finMes = new Date(anio, mes, 0).toISOString().slice(0, 10)
        q = q.gte('fecha', inicioMes).lte('fecha', finMes)
      }

      // Presupuesto: solo aplica en modo mes.
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
        ingresosReal, gastosReal,
        ingresosPlan, gastosPlan,
        balance: ingresosReal - gastosReal,
        n: transRes.data.length,
      })
      setCargando(false)
    }

    cargar()
  }, [modo, anio, mes])

  const titulo = modo === 'acumulado' ? 'Acumulado (todo)' : `${nombresMes[mes - 1]} ${anio}`

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.toggle}>
          <button
            onClick={() => setModo('mes')}
            style={modo === 'mes' ? styles.toggleOn : styles.toggleOff}
          >
            Mes
          </button>
          <button
            onClick={() => setModo('acumulado')}
            style={modo === 'acumulado' ? styles.toggleOn : styles.toggleOff}
          >
            Acumulado
          </button>
        </div>

        {modo === 'mes' && (
          <div style={styles.selects}>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={styles.select}>
              {nombresMes.map((nm, i) => (
                <option key={i} value={i + 1}>{nm}</option>
              ))}
            </select>
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={styles.select}>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <h2 style={styles.title}>{titulo}</h2>

      {cargando ? (
        <div style={styles.loading}>Cargando resumen...</div>
      ) : error ? (
        <div style={styles.error}>{error}</div>
      ) : (
        <>
          <div style={styles.grid}>
            <div style={styles.card}>
              <p style={styles.label}>Ingresos</p>
              <p style={styles.valorIngreso}>{formatAmount(resumen.ingresosReal)}</p>
              {modo === 'mes' && <p style={styles.planeado}>plan: {formatAmount(resumen.ingresosPlan)}</p>}
            </div>

            <div style={styles.card}>
              <p style={styles.label}>Gastos</p>
              <p style={styles.valorGasto}>{formatAmount(resumen.gastosReal)}</p>
              {modo === 'mes' && <p style={styles.planeado}>plan: {formatAmount(resumen.gastosPlan)}</p>}
            </div>

            <div style={styles.cardBalance}>
              <p style={styles.label}>{modo === 'acumulado' ? 'Balance acumulado' : 'Balance del mes'}</p>
              <p style={resumen.balance >= 0 ? styles.valorIngreso : styles.valorGasto}>
                {formatAmount(resumen.balance)}
              </p>
            </div>
          </div>

          {resumen.n === 0 && (
            <p style={styles.nota}>No hay transacciones confirmadas en este periodo.</p>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '24px' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  toggle: { display: 'flex', background: '#0f172a', borderRadius: '8px', padding: '2px', border: '1px solid #334155' },
  toggleOn: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', cursor: 'pointer' },
  toggleOff: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' },
  selects: { display: 'flex', gap: '8px' },
  select: { padding: '6px 8px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  title: { fontSize: '20px', color: '#f8fafc', margin: '0 0 16px 0' },
  grid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { background: '#1e293b', borderRadius: '10px', padding: '16px' },
  cardBalance: { background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155' },
  label: { fontSize: '12px', color: '#94a3b8', margin: '0 0 4px 0' },
  valorIngreso: { fontSize: '22px', color: '#4ade80', fontWeight: 700, margin: '0' },
  valorGasto: { fontSize: '22px', color: '#f87171', fontWeight: 700, margin: '0' },
  planeado: { fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' },
  loading: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  error: { padding: '20px', color: '#fecaca', background: '#7f1d1d', borderRadius: '8px' },
  nota: { fontSize: '12px', color: '#64748b', marginTop: '20px', lineHeight: 1.5 },
}
