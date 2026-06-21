import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_CATEGORIA = ['ingreso', 'gasto', 'ahorro']
const TIPOS_CUENTA = ['debito', 'credito']
const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ANIO_INICIO = 2026

const fieldCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
const rowInputCls = 'flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

export default function Admin() {
  const [sub, setSub] = useState('categorias')
  const tabs = [['categorias', 'Categorías'], ['cuentas', 'Cuentas'], ['presupuesto', 'Presupuesto']]
  return (
    <div className="max-w-2xl mx-auto animate-slide-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Administración</h2>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 mb-5">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${sub === k ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
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
    <div className="card">
      <div className="flex gap-2 flex-wrap mb-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva categoría" className={`${fieldCls} flex-1 min-w-[140px]`} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={fieldCls}>
          {TIPOS_CATEGORIA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={agregar} className="btn-primary">Agregar</button>
      </div>
      {error && <div className="alert-danger text-sm mb-3">{error}</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input
              defaultValue={item.nombre}
              onBlur={(e) => e.target.value.trim() !== item.nombre && renombrar(item.id, e.target.value)}
              className={`${rowInputCls} ${item.activa ? '' : 'opacity-50'}`}
            />
            <span className="badge bg-gray-100 text-gray-600 capitalize">{item.tipo}</span>
            <button onClick={() => toggle(item)} className={item.activa ? 'btn-secondary text-xs py-1.5 px-3' : 'btn-primary text-xs py-1.5 px-3'}>
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
    <div className="card">
      <div className="flex gap-2 flex-wrap mb-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className={`${fieldCls} flex-1 min-w-[120px]`} />
        <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" className={`${fieldCls} flex-1 min-w-[120px]`} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={fieldCls}>
          {TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={agregar} className="btn-primary">Agregar</button>
      </div>
      {error && <div className="alert-danger text-sm mb-3">{error}</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <input
              defaultValue={item.nombre}
              onBlur={(e) => e.target.value.trim() !== item.nombre && renombrar(item.id, 'nombre', e.target.value)}
              className={`${rowInputCls} ${item.activa ? '' : 'opacity-50'}`}
            />
            <input
              defaultValue={item.banco}
              onBlur={(e) => e.target.value.trim() !== item.banco && renombrar(item.id, 'banco', e.target.value)}
              className={`${rowInputCls} max-w-[120px] ${item.activa ? '' : 'opacity-50'}`}
            />
            <span className="badge bg-gray-100 text-gray-600 capitalize">{item.tipo}</span>
            <button onClick={() => toggle(item)} className={item.activa ? 'btn-secondary text-xs py-1.5 px-3' : 'btn-primary text-xs py-1.5 px-3'}>
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
    <div className="card">
      <div className="flex gap-2 flex-wrap mb-3">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={fieldCls}>
          {nombresMes.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={fieldCls}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={guardar} className="btn-primary">Guardar</button>
      </div>
      {error && <div className="alert-danger text-sm mb-3">{error}</div>}
      {guardado && <div className="alert-success text-sm mb-3">Presupuesto guardado.</div>}
      <div className="space-y-2">
        {categorias.map((c) => (
          <div key={c.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="flex-1 text-sm text-gray-700">{c.nombre}</span>
            <span className="badge bg-gray-100 text-gray-600 capitalize">{c.tipo}</span>
            <input
              type="number"
              inputMode="decimal"
              value={montos[c.id] ?? ''}
              onChange={(e) => setMontos((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder="0"
              className={`${rowInputCls} max-w-[120px] text-right`}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">Importes en MXN. Las categorías en 0 (o vacías) no se guardan.</p>
    </div>
  )
}
