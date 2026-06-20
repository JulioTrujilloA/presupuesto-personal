import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'

const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ANIO_INICIO = 2026

export default function Transacciones() {
  const hoy = new Date()
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [rows, setRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [cuentaFiltro, setCuentaFiltro] = useState('todas')
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(0) // 0 = todos los meses del año
  const [reload, setReload] = useState(0)

  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})

  const anioMax = Math.max(hoy.getFullYear(), ANIO_INICIO)
  const anios = []
  for (let a = ANIO_INICIO; a <= anioMax; a++) anios.push(a)

  // Catálogos (una vez).
  useEffect(() => {
    let activo = true
    const run = async () => {
      const [cuRes, caRes] = await Promise.all([
        supabase.from('cuentas').select('id, nombre, banco').order('nombre'),
        supabase.from('categorias').select('id, nombre, tipo').order('tipo').order('nombre'),
      ])
      if (!activo) return
      if (cuRes.error) setError(cuRes.error.message); else setCuentas(cuRes.data)
      if (caRes.error) setError(caRes.error.message); else setCategorias(caRes.data)
    }
    run()
    return () => { activo = false }
  }, [])

  // Listado filtrado.
  useEffect(() => {
    let activo = true
    const run = async () => {
      setCargando(true)
      let q = supabase
        .from('transacciones')
        .select('id, fecha, tipo, monto, detalle, origen, cuenta_id, categoria_id, cuentas(nombre, banco), categorias(nombre)')
        .order('fecha', { ascending: false })

      if (cuentaFiltro !== 'todas') q = q.eq('cuenta_id', cuentaFiltro)

      if (mes === 0) {
        q = q.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
      } else {
        const ini = `${anio}-${String(mes).padStart(2, '0')}-01`
        const fin = new Date(anio, mes, 0).toISOString().slice(0, 10)
        q = q.gte('fecha', ini).lte('fecha', fin)
      }

      const { data, error } = await q
      if (!activo) return
      if (error) setError(error.message)
      else { setRows(data); setError(null) }
      setCargando(false)
    }
    run()
    return () => { activo = false }
  }, [cuentaFiltro, anio, mes, reload])

  const empezarEdicion = (row) => {
    setEditId(row.id)
    setForm({
      fecha: row.fecha,
      tipo: row.tipo,
      cuenta_id: row.cuenta_id,
      categoria_id: row.categoria_id ?? '',
      monto: String(row.monto),
      detalle: row.detalle ?? '',
    })
  }

  const guardar = async () => {
    if (!form.categoria_id) { setError('Selecciona una categoría'); return }
    const { error } = await supabase
      .from('transacciones')
      .update({
        fecha: form.fecha,
        tipo: form.tipo,
        cuenta_id: form.cuenta_id,
        categoria_id: form.categoria_id,
        monto: Number(form.monto || 0),
        detalle: form.detalle,
      })
      .eq('id', editId)
    if (error) { setError(error.message); return }
    setEditId(null)
    setReload((n) => n + 1)
  }

  const borrar = async (row) => {
    if (!window.confirm(`¿Borrar esta transacción de ${formatAmount(row.monto)}?`)) return
    // Si vino de importación, suelta el enlace del staging (FK) y márcalo descartado.
    await supabase
      .from('transacciones_importadas')
      .update({ transaccion_id: null, estado: 'descartada' })
      .eq('transaccion_id', row.id)
    const { error } = await supabase.from('transacciones').delete().eq('id', row.id)
    if (error) { setError(error.message); return }
    setReload((n) => n + 1)
  }

  const ingresos = rows.filter((r) => r.tipo === 'ingreso').reduce((s, r) => s + Number(r.monto), 0)
  const gastos = rows.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + Number(r.monto), 0)

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Transacciones</h2>

      <div style={styles.filtros}>
        <select value={cuentaFiltro} onChange={(e) => setCuentaFiltro(e.target.value)} style={styles.select}>
          <option value="todas">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>
          ))}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={styles.select}>
          <option value={0}>Todo el año</option>
          {nombresMes.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={styles.select}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={styles.resumen}>
        <span>{rows.length} mov.</span>
        <span style={styles.ingreso}>+{formatAmount(ingresos)}</span>
        <span style={styles.gasto}>-{formatAmount(gastos)}</span>
        <span style={styles.neto}>neto {formatAmount(ingresos - gastos)}</span>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {cargando ? (
        <div style={styles.loading}>Cargando...</div>
      ) : rows.length === 0 ? (
        <p style={styles.vacio}>No hay transacciones con estos filtros.</p>
      ) : (
        <div style={styles.list}>
          {rows.map((row) => (
            <div key={row.id} style={styles.card}>
              {editId === row.id ? (
                <div style={styles.editForm}>
                  <div style={styles.editRow}>
                    <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} style={styles.input} />
                    <input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} style={{ ...styles.input, maxWidth: '110px', textAlign: 'right' }} />
                  </div>
                  <input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder="Detalle" style={styles.input} />
                  <div style={styles.editRow}>
                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, categoria_id: '' })} style={styles.input}>
                      <option value="gasto">gasto</option>
                      <option value="ingreso">ingreso</option>
                    </select>
                    <select value={form.cuenta_id} onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })} style={styles.input}>
                      {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} style={styles.input}>
                    <option value="">Categoría...</option>
                    {categorias.filter((c) => c.tipo === form.tipo).map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <div style={styles.actions}>
                    <button onClick={() => setEditId(null)} style={styles.cancelBtn}>Cancelar</button>
                    <button onClick={guardar} style={styles.saveBtn}>Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.cardHeader}>
                    <span style={styles.fecha}>{row.fecha}</span>
                    <span style={row.tipo === 'ingreso' ? styles.ingreso : styles.gasto}>
                      {row.tipo === 'ingreso' ? '+' : '-'}{formatAmount(row.monto)}
                    </span>
                  </div>
                  <p style={styles.detalle}>{row.detalle}</p>
                  <div style={styles.metaRow}>
                    <span style={styles.meta}>{row.cuentas?.nombre} · {row.categorias?.nombre ?? 'sin categoría'}</span>
                  </div>
                  <div style={styles.actions}>
                    <button onClick={() => borrar(row)} style={styles.delBtn}>Borrar</button>
                    <button onClick={() => empezarEdicion(row)} style={styles.editBtn}>Editar</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { maxWidth: '520px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', color: '#f8fafc', margin: '0 0 12px 0' },
  filtros: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  select: { flex: 1, minWidth: '120px', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  resumen: { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: '#94a3b8', marginBottom: '12px', padding: '8px 10px', background: '#1e293b', borderRadius: '8px' },
  ingreso: { color: '#4ade80', fontWeight: 600 },
  gasto: { color: '#f87171', fontWeight: 600 },
  neto: { color: '#e2e8f0', fontWeight: 600, marginLeft: 'auto' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  card: { background: '#1e293b', borderRadius: '10px', padding: '12px 14px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  fecha: { fontSize: '12px', color: '#94a3b8' },
  detalle: { fontSize: '13px', color: '#f8fafc', margin: '0 0 4px 0' },
  metaRow: { marginBottom: '8px' },
  meta: { fontSize: '12px', color: '#64748b' },
  actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  editBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' },
  delBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#f87171', fontSize: '12px', cursor: 'pointer' },
  editForm: { display: 'flex', flexDirection: 'column', gap: '8px' },
  editRow: { display: 'flex', gap: '8px' },
  input: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  cancelBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' },
  saveBtn: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '12px', cursor: 'pointer' },
  loading: { padding: '30px', textAlign: 'center', color: '#94a3b8' },
  vacio: { fontSize: '13px', color: '#64748b' },
  error: { background: '#7f1d1d', color: '#fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
}
