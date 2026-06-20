import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'

export default function Pendientes() {
  const [pendientes, setPendientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionCategoria, setSeleccionCategoria] = useState({})

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError(null)

    const [pendRes, catRes] = await Promise.all([
      supabase
        .from('transacciones_importadas')
        .select('*, cuentas(nombre)')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: false }),
      supabase.from('categorias').select('id, nombre, tipo').eq('activa', true).order('nombre'),
    ])

    if (pendRes.error) setError(pendRes.error.message)
    else setPendientes(pendRes.data)

    if (catRes.error) setError(catRes.error.message)
    else setCategorias(catRes.data)

    setCargando(false)
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const categoriaSeleccionada = (fila) =>
    seleccionCategoria[fila.id] ?? fila.categoria_sugerida_id ?? ''

  const handleCategoriaChange = (filaId, categoriaId) => {
    setSeleccionCategoria((prev) => ({ ...prev, [filaId]: categoriaId }))
  }

  const handleConfirmar = async (fila) => {
    const categoriaId = categoriaSeleccionada(fila)
    if (!categoriaId) {
      setError('Selecciona una categoría antes de confirmar esta transacción')
      return
    }

    setError(null)

    const { data: transaccion, error: errorInsert } = await supabase
      .from('transacciones')
      .insert({
        fecha: fila.fecha,
        tipo: fila.tipo,
        cuenta_id: fila.cuenta_id,
        categoria_id: categoriaId,
        monto: fila.monto,
        detalle: fila.descripcion_original,
        origen: 'importado',
        importacion_id: fila.id,
      })
      .select()
      .single()

    if (errorInsert) {
      setError(errorInsert.message)
      return
    }

    const { error: errorUpdate } = await supabase
      .from('transacciones_importadas')
      .update({ estado: 'confirmada', transaccion_id: transaccion.id })
      .eq('id', fila.id)

    if (errorUpdate) {
      setError(errorUpdate.message)
      return
    }

    setPendientes((prev) => prev.filter((p) => p.id !== fila.id))
  }

  const handleDescartar = async (fila) => {
    const { error } = await supabase
      .from('transacciones_importadas')
      .update({ estado: 'descartada' })
      .eq('id', fila.id)

    if (error) {
      setError(error.message)
      return
    }

    setPendientes((prev) => prev.filter((p) => p.id !== fila.id))
  }

  if (cargando) {
    return <div style={styles.loading}>Cargando pendientes...</div>
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Transacciones por revisar</h2>
      <p style={styles.subtitle}>
        {pendientes.length === 0
          ? 'No hay transacciones pendientes de revisión.'
          : `${pendientes.length} transacción${pendientes.length > 1 ? 'es' : ''} esperando confirmación.`}
      </p>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.list}>
        {pendientes.map((fila) => (
          <div key={fila.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.fecha}>{fila.fecha}</span>
              <span style={fila.tipo === 'ingreso' ? styles.tipoIngreso : styles.tipoGasto}>
                {fila.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
              </span>
            </div>

            <p style={styles.descripcion}>{fila.descripcion_original}</p>

            <div style={styles.metaRow}>
              <span style={styles.meta}>{fila.cuentas?.nombre}</span>
              <span style={styles.monto}>{formatAmount(fila.monto)}</span>
            </div>

            <select
              value={categoriaSeleccionada(fila)}
              onChange={(e) => handleCategoriaChange(fila.id, e.target.value)}
              style={styles.select}
            >
              <option value="">Selecciona categoría...</option>
              {categorias
                .filter((c) => c.tipo === fila.tipo)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
            </select>

            <div style={styles.actions}>
              <button onClick={() => handleDescartar(fila)} style={styles.descartarButton}>
                Descartar
              </button>
              <button onClick={() => handleConfirmar(fila)} style={styles.confirmarButton}>
                Confirmar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', margin: '0 0 4px 0', color: '#f8fafc' },
  subtitle: { fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' },
  loading: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { background: '#1e293b', borderRadius: '10px', padding: '16px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  fecha: { fontSize: '12px', color: '#94a3b8' },
  tipoIngreso: { fontSize: '11px', color: '#4ade80', fontWeight: 600 },
  tipoGasto: { fontSize: '11px', color: '#f87171', fontWeight: 600 },
  descripcion: { fontSize: '14px', color: '#f8fafc', margin: '0 0 8px 0' },
  metaRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  meta: { fontSize: '12px', color: '#64748b' },
  monto: { fontSize: '15px', color: '#f8fafc', fontWeight: 600 },
  select: {
    width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155',
    background: '#0f172a', color: '#f8fafc', fontSize: '13px', marginBottom: '10px',
  },
  actions: { display: 'flex', gap: '8px' },
  descartarButton: {
    flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #475569',
    background: 'transparent', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer',
  },
  confirmarButton: {
    flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
    background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
  },
  error: {
    marginBottom: '12px', background: '#7f1d1d', color: '#fecaca', padding: '8px 10px',
    borderRadius: '6px', fontSize: '13px',
  },
}
