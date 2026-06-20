import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_CATEGORIA = ['ingreso', 'gasto', 'ahorro']
const TIPOS_CUENTA = ['debito', 'credito']
const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ANIO_INICIO = 2026

export default function Admin() {
  const [sub, setSub] = useState('categorias')
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Administración</h2>
      <div style={styles.subnav}>
        {[['categorias', 'Categorías'], ['cuentas', 'Cuentas'], ['presupuesto', 'Presupuesto']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            style={sub === k ? styles.subOn : styles.subOff}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'categorias' && <Categorias />}
      {sub === 'cuentas' && <Cuentas />}
      {sub === 'presupuesto' && <Presupuesto />}
    </div>
  )
}

// ---------- Categorías ----------
function Categorias() {
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('gasto')

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre, tipo, activa')
      .order('tipo')
      .order('nombre')
    if (error) setError(error.message)
    else setItems(data)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  const agregar = async () => {
    if (!nombre.trim()) return
    const { error } = await supabase.from('categorias').insert({ nombre: nombre.trim(), tipo })
    if (error) { setError(error.message); return }
    setNombre('')
    cargar()
  }

  const renombrar = async (id, valor) => {
    if (!valor.trim()) return
    const { error } = await supabase.from('categorias').update({ nombre: valor.trim() }).eq('id', id)
    if (error) setError(error.message)
  }

  const toggle = async (item) => {
    const { error } = await supabase.from('categorias').update({ activa: !item.activa }).eq('id', item.id)
    if (error) { setError(error.message); return }
    cargar()
  }

  return (
    <div>
      <div style={styles.addRow}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva categoría" style={styles.input} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={styles.select}>
          {TIPOS_CATEGORIA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={agregar} style={styles.addButton}>Agregar</button>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.list}>
        {items.map((item) => (
          <div key={item.id} style={styles.row}>
            <input
              defaultValue={item.nombre}
              onBlur={(e) => e.target.value.trim() !== item.nombre && renombrar(item.id, e.target.value)}
              style={{ ...styles.rowInput, opacity: item.activa ? 1 : 0.5 }}
            />
            <span style={styles.badge}>{item.tipo}</span>
            <button onClick={() => toggle(item)} style={item.activa ? styles.offBtn : styles.onBtn}>
              {item.activa ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Cuentas ----------
function Cuentas() {
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState('')
  const [banco, setBanco] = useState('')
  const [tipo, setTipo] = useState('debito')

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('cuentas')
      .select('id, nombre, banco, tipo, activa')
      .order('nombre')
    if (error) setError(error.message)
    else setItems(data)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  const agregar = async () => {
    if (!nombre.trim() || !banco.trim()) { setError('Nombre y banco son obligatorios'); return }
    const { error } = await supabase.from('cuentas').insert({ nombre: nombre.trim(), banco: banco.trim(), tipo })
    if (error) { setError(error.message); return }
    setNombre(''); setBanco('')
    cargar()
  }

  const renombrar = async (id, campo, valor) => {
    if (!valor.trim()) return
    const { error } = await supabase.from('cuentas').update({ [campo]: valor.trim() }).eq('id', id)
    if (error) setError(error.message)
  }

  const toggle = async (item) => {
    const { error } = await supabase.from('cuentas').update({ activa: !item.activa }).eq('id', item.id)
    if (error) { setError(error.message); return }
    cargar()
  }

  return (
    <div>
      <div style={styles.addRow}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" style={styles.input} />
        <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" style={styles.input} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={styles.select}>
          {TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={agregar} style={styles.addButton}>Agregar</button>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.list}>
        {items.map((item) => (
          <div key={item.id} style={styles.row}>
            <input
              defaultValue={item.nombre}
              onBlur={(e) => e.target.value.trim() !== item.nombre && renombrar(item.id, 'nombre', e.target.value)}
              style={{ ...styles.rowInput, opacity: item.activa ? 1 : 0.5 }}
            />
            <input
              defaultValue={item.banco}
              onBlur={(e) => e.target.value.trim() !== item.banco && renombrar(item.id, 'banco', e.target.value)}
              style={{ ...styles.rowInput, maxWidth: '110px', opacity: item.activa ? 1 : 0.5 }}
            />
            <span style={styles.badge}>{item.tipo}</span>
            <button onClick={() => toggle(item)} style={item.activa ? styles.offBtn : styles.onBtn}>
              {item.activa ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Presupuesto ----------
function Presupuesto() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [categorias, setCategorias] = useState([])
  const [montos, setMontos] = useState({}) // categoria_id -> string
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)

  const anioMax = Math.max(hoy.getFullYear(), ANIO_INICIO)
  const anios = []
  for (let a = ANIO_INICIO; a <= anioMax + 1; a++) anios.push(a)

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      const [catRes, presRes] = await Promise.all([
        supabase.from('categorias').select('id, nombre, tipo').eq('activa', true).order('tipo').order('nombre'),
        supabase.from('presupuesto_mensual').select('categoria_id, monto_planeado').eq('anio', anio).eq('mes', mes),
      ])
      if (!activo) return
      if (catRes.error) { setError(catRes.error.message); return }
      if (presRes.error) { setError(presRes.error.message); return }
      setCategorias(catRes.data)
      const map = {}
      presRes.data.forEach((p) => { map[p.categoria_id] = String(p.monto_planeado) })
      setMontos(map)
      setGuardado(false)
    }
    cargar()
    return () => { activo = false }
  }, [anio, mes])

  const guardar = async () => {
    setError(null)
    // Reemplaza el presupuesto del periodo: borra e inserta los > 0.
    const { error: delErr } = await supabase
      .from('presupuesto_mensual')
      .delete()
      .eq('anio', anio)
      .eq('mes', mes)
    if (delErr) { setError(delErr.message); return }

    const filas = categorias
      .map((c) => ({ categoria_id: c.id, anio, mes, monto_planeado: Number(montos[c.id] || 0) }))
      .filter((f) => f.monto_planeado > 0)

    if (filas.length > 0) {
      const { error: insErr } = await supabase.from('presupuesto_mensual').insert(filas)
      if (insErr) { setError(insErr.message); return }
    }
    setGuardado(true)
  }

  return (
    <div>
      <div style={styles.addRow}>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={styles.select}>
          {nombresMes.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={styles.select}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={guardar} style={styles.addButton}>Guardar</button>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      {guardado && <div style={styles.ok}>Presupuesto guardado.</div>}
      <div style={styles.list}>
        {categorias.map((c) => (
          <div key={c.id} style={styles.row}>
            <span style={{ flex: 1, color: '#e2e8f0', fontSize: '13px' }}>{c.nombre}</span>
            <span style={styles.badge}>{c.tipo}</span>
            <input
              type="number"
              inputMode="decimal"
              value={montos[c.id] ?? ''}
              onChange={(e) => setMontos((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder="0"
              style={{ ...styles.rowInput, maxWidth: '110px', textAlign: 'right' }}
            />
          </div>
        ))}
      </div>
      <p style={styles.nota}>Importes en MXN. Las categorías en 0 (o vacías) no se guardan.</p>
    </div>
  )
}

const styles = {
  container: { maxWidth: '560px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', color: '#f8fafc', margin: '0 0 12px 0' },
  subnav: { display: 'flex', gap: '4px', marginBottom: '16px' },
  subOn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' },
  subOff: { background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' },
  addRow: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '120px', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  select: { padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  addButton: { padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px' },
  row: { display: 'flex', alignItems: 'center', gap: '8px', background: '#1e293b', borderRadius: '8px', padding: '8px 10px' },
  rowInput: { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  badge: { fontSize: '11px', color: '#94a3b8', background: '#0f172a', borderRadius: '4px', padding: '2px 6px', textTransform: 'capitalize' },
  offBtn: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' },
  onBtn: { padding: '6px 10px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '12px', cursor: 'pointer' },
  error: { background: '#7f1d1d', color: '#fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
  ok: { background: '#14532d', color: '#bbf7d0', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
  nota: { fontSize: '12px', color: '#64748b', marginTop: '12px' },
}
