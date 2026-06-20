import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'

export default function Dashboard() {
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      const hoy = new Date()
      const anio = hoy.getFullYear()
      const mes = hoy.getMonth() + 1
      const inicioMes = `${anio}-${String(mes).padStart(2, '0')}-01`
      const finMes = new Date(anio, mes, 0).toISOString().slice(0, 10)

      const [transRes, presRes] = await Promise.all([
        supabase
          .from('transacciones')
          .select('tipo, monto, categoria_id, categorias(nombre)')
          .gte('fecha', inicioMes)
          .lte('fecha', finMes),
        supabase
          .from('presupuesto_mensual')
          .select('monto_planeado, categoria_id, categorias(nombre, tipo)')
          .eq('anio', anio)
          .eq('mes', mes),
      ])

      if (transRes.error) { setError(transRes.error.message); setCargando(false); return }
      if (presRes.error) { setError(presRes.error.message); setCargando(false); return }

      const ingresosReal = transRes.data.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
      const gastosReal = transRes.data.filter((t) => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0)

      const ingresosPlan = presRes.data.filter((p) => p.categorias?.tipo === 'ingreso').reduce((s, p) => s + Number(p.monto_planeado), 0)
      const gastosPlan = presRes.data.filter((p) => p.categorias?.tipo === 'gasto').reduce((s, p) => s + Number(p.monto_planeado), 0)

      setResumen({
        anio, mes,
        ingresosReal, gastosReal,
        ingresosPlan, gastosPlan,
        balance: ingresosReal - gastosReal,
      })
      setCargando(false)
    }

    cargar()
  }, [])

  if (cargando) return <div style={styles.loading}>Cargando resumen...</div>
  if (error) return <div style={styles.error}>{error}</div>

  const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{nombresMes[resumen.mes - 1]} {resumen.anio}</h2>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.label}>Ingresos</p>
          <p style={styles.valorIngreso}>{formatAmount(resumen.ingresosReal)}</p>
          <p style={styles.planeado}>plan: {formatAmount(resumen.ingresosPlan)}</p>
        </div>

        <div style={styles.card}>
          <p style={styles.label}>Gastos</p>
          <p style={styles.valorGasto}>{formatAmount(resumen.gastosReal)}</p>
          <p style={styles.planeado}>plan: {formatAmount(resumen.gastosPlan)}</p>
        </div>

        <div style={styles.cardBalance}>
          <p style={styles.label}>Balance del mes</p>
          <p style={resumen.balance >= 0 ? styles.valorIngreso : styles.valorGasto}>
            {formatAmount(resumen.balance)}
          </p>
        </div>
      </div>

      <p style={styles.nota}>
        Este dashboard muestra el mes actual. El selector de año/periodo y el desglose por
        categoría se agregan en la siguiente iteración.
      </p>
    </div>
  )
}

const styles = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', color: '#f8fafc', margin: '0 0 16px 0' },
  grid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { background: '#1e293b', borderRadius: '10px', padding: '16px' },
  cardBalance: { background: '#1e293b', borderRadius: '10px', padding: '16px', border: '1px solid #334155' },
  label: { fontSize: '12px', color: '#94a3b8', margin: '0 0 4px 0' },
  valorIngreso: { fontSize: '22px', color: '#4ade80', fontWeight: 700, margin: '0' },
  valorGasto: { fontSize: '22px', color: '#f87171', fontWeight: 700, margin: '0' },
  planeado: { fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' },
  loading: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  error: { padding: '20px', color: '#fecaca', background: '#7f1d1d', borderRadius: '8px', margin: '24px' },
  nota: { fontSize: '12px', color: '#64748b', marginTop: '20px', lineHeight: 1.5 },
}
