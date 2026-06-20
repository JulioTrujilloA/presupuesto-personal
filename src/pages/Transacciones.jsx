import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'

const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ANIO_INICIO = 2026

// Campos editables de una transacción.
const camposEditables = (r) => ({
  fecha: r.fecha,
  tipo: r.tipo,
  cuenta_id: r.cuenta_id,
  categoria_id: r.categoria_id ?? '',
  monto: String(r.monto),
  detalle: r.detalle ?? '',
})

const buildDraft = (rows) => Object.fromEntries(rows.map((r) => [r.id, camposEditables(r)]))

export default function Transacciones() {
  const hoy = new Date()
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [rows, setRows] = useState([])
  const [draft, setDraft] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const [cuentaFiltro, setCuentaFiltro] = useState('todas')
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(0) // 0 = todo el año
  const [reload, setReload] = useState(0)

  const [pdfUrl, setPdfUrl] = useState(null)

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
        .select('id, fecha, tipo, monto, detalle, cuenta_id, categoria_id, cuentas(nombre, banco), categorias(nombre)')
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
      if (error) { setError(error.message) }
      else { setRows(data); setDraft(buildDraft(data)); setError(null); setAviso(null) }
      setCargando(false)
    }
    run()
    return () => { activo = false }
  }, [cuentaFiltro, anio, mes, reload])

  // Limpieza del object URL del PDF.
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const elegirPdf = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(URL.createObjectURL(file))
  }

  const setCampo = (id, campo, valor) => {
    setDraft((prev) => {
      const fila = { ...prev[id], [campo]: valor }
      if (campo === 'tipo') fila.categoria_id = '' // la categoría depende del tipo
      return { ...prev, [id]: fila }
    })
  }

  const esDirty = (row) => {
    const d = draft[row.id]
    if (!d) return false
    const o = camposEditables(row)
    return Object.keys(o).some((k) => String(d[k]) !== String(o[k]))
  }

  const sucios = rows.filter(esDirty)

  const guardarTodo = async () => {
    setError(null); setAviso(null)
    for (const row of sucios) {
      const d = draft[row.id]
      if (!d.categoria_id) { setError(`Falta categoría en "${d.detalle || row.fecha}"`); return }
      const { error } = await supabase
        .from('transacciones')
        .update({
          fecha: d.fecha,
          tipo: d.tipo,
          cuenta_id: d.cuenta_id,
          categoria_id: d.categoria_id,
          monto: Number(d.monto || 0),
          detalle: d.detalle,
        })
        .eq('id', row.id)
      if (error) { setError(error.message); return }
    }
    setAviso(`${sucios.length} cambio${sucios.length > 1 ? 's' : ''} guardado${sucios.length > 1 ? 's' : ''}.`)
    setReload((n) => n + 1)
  }

  const cancelarTodo = () => { setDraft(buildDraft(rows)); setError(null); setAviso(null) }

  const borrar = async (row) => {
    if (!window.confirm(`¿Borrar esta transacción de ${formatAmount(row.monto)}?`)) return
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
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>)}
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
      {aviso && <div style={styles.ok}>{aviso}</div>}

      <div style={styles.split}>
        {/* Lista (scrollable) */}
        <div style={styles.listPane}>
          {cargando ? (
            <div style={styles.loading}>Cargando...</div>
          ) : rows.length === 0 ? (
            <p style={styles.vacio}>No hay transacciones con estos filtros.</p>
          ) : (
            rows.map((row) => {
              const d = draft[row.id] || camposEditables(row)
              const dirty = esDirty(row)
              return (
                <div key={row.id} style={dirty ? { ...styles.card, ...styles.cardDirty } : styles.card}>
                  <div style={styles.rowLine}>
                    <input type="date" value={d.fecha} onChange={(e) => setCampo(row.id, 'fecha', e.target.value)} style={styles.input} />
                    <input type="number" value={d.monto} onChange={(e) => setCampo(row.id, 'monto', e.target.value)} style={{ ...styles.input, maxWidth: '100px', textAlign: 'right' }} />
                  </div>
                  <input value={d.detalle} onChange={(e) => setCampo(row.id, 'detalle', e.target.value)} placeholder="Detalle" style={styles.input} />
                  <div style={styles.rowLine}>
                    <select value={d.tipo} onChange={(e) => setCampo(row.id, 'tipo', e.target.value)} style={styles.input}>
                      <option value="gasto">gasto</option>
                      <option value="ingreso">ingreso</option>
                    </select>
                    <select value={d.cuenta_id} onChange={(e) => setCampo(row.id, 'cuenta_id', e.target.value)} style={styles.input}>
                      {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div style={styles.rowLine}>
                    <select value={d.categoria_id} onChange={(e) => setCampo(row.id, 'categoria_id', e.target.value)} style={styles.input}>
                      <option value="">Categoría...</option>
                      {categorias.filter((c) => c.tipo === d.tipo).map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    <button onClick={() => borrar(row)} style={styles.delBtn}>Borrar</button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Visor de PDF local */}
        <div style={styles.pdfPane}>
          <label style={styles.fileLabel}>
            {pdfUrl ? 'Cambiar PDF' : 'Abrir PDF'}
            <input type="file" accept="application/pdf" onChange={elegirPdf} style={{ display: 'none' }} />
          </label>
          {pdfUrl ? (
            <iframe src={pdfUrl} title="PDF" style={styles.iframe} />
          ) : (
            <div style={styles.pdfEmpty}>Abre un PDF para cotejarlo con las transacciones.</div>
          )}
        </div>
      </div>

      {/* Barra de acciones general */}
      <div style={styles.bottomBar}>
        <span style={styles.dirtyCount}>
          {sucios.length > 0 ? `${sucios.length} sin guardar` : 'Sin cambios'}
        </span>
        <button onClick={cancelarTodo} disabled={sucios.length === 0} style={sucios.length ? styles.cancelBtn : styles.btnDisabled}>
          Cancelar
        </button>
        <button onClick={guardarTodo} disabled={sucios.length === 0} style={sucios.length ? styles.saveBtn : styles.btnDisabled}>
          Guardar{sucios.length ? ` (${sucios.length})` : ''}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', color: '#f8fafc', margin: '0 0 12px 0' },
  filtros: { display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' },
  select: { flex: 1, minWidth: '120px', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  resumen: { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px', color: '#94a3b8', marginBottom: '10px', padding: '8px 10px', background: '#1e293b', borderRadius: '8px' },
  ingreso: { color: '#4ade80', fontWeight: 600 },
  gasto: { color: '#f87171', fontWeight: 600 },
  neto: { color: '#e2e8f0', fontWeight: 600, marginLeft: 'auto' },
  split: { display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' },
  listPane: { flex: '1 1 360px', minWidth: '320px', height: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' },
  pdfPane: { flex: '1 1 360px', minWidth: '320px', height: '70vh', display: 'flex', flexDirection: 'column', gap: '8px', background: '#1e293b', borderRadius: '10px', padding: '10px' },
  fileLabel: { display: 'inline-block', textAlign: 'center', padding: '8px', borderRadius: '6px', border: '1px dashed #475569', color: '#60a5fa', cursor: 'pointer', fontSize: '13px' },
  iframe: { flex: 1, width: '100%', border: 'none', borderRadius: '8px', background: '#fff' },
  pdfEmpty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' },
  card: { background: '#1e293b', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  cardDirty: { border: '1px solid #2563eb' },
  rowLine: { display: 'flex', gap: '6px' },
  input: { flex: 1, padding: '7px 8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px', minWidth: 0 },
  delBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#f87171', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  bottomBar: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #1e293b' },
  dirtyCount: { fontSize: '12px', color: '#94a3b8', marginRight: 'auto' },
  cancelBtn: { padding: '9px 16px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' },
  saveBtn: { padding: '9px 16px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  btnDisabled: { padding: '9px 16px', borderRadius: '6px', border: '1px solid #1e293b', background: 'transparent', color: '#475569', fontSize: '13px', cursor: 'not-allowed' },
  loading: { padding: '30px', textAlign: 'center', color: '#94a3b8' },
  vacio: { fontSize: '13px', color: '#64748b' },
  error: { background: '#7f1d1d', color: '#fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
  ok: { background: '#14532d', color: '#bbf7d0', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
}
