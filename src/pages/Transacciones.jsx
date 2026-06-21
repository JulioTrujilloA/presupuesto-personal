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

  const selectCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div className="max-w-3xl mx-auto animate-slide-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Transacciones</h2>

      <div className="flex gap-2 flex-wrap mb-3">
        <select value={cuentaFiltro} onChange={(e) => setCuentaFiltro(e.target.value)} className={`${selectCls} flex-1 min-w-[160px]`}>
          <option value="todas">Todas las cuentas</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={selectCls}>
          <option value={0}>Todo el año</option>
          {nombresMes.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={selectCls}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="flex gap-4 flex-wrap text-sm bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 shadow-sm">
        <span className="text-gray-500">{rows.length} mov.</span>
        <span className="text-success-600 font-semibold">+{formatAmount(ingresos)}</span>
        <span className="text-danger-600 font-semibold">-{formatAmount(gastos)}</span>
        <span className="text-gray-900 font-semibold ml-auto">neto {formatAmount(ingresos - gastos)}</span>
      </div>

      {error && <div className="alert-danger text-sm mb-3">{error}</div>}

      {cargando ? (
        <div className="py-10 text-center text-gray-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No hay transacciones con estos filtros.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="card !p-4">
              {editId === row.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
                    <input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={`${inputCls} max-w-[120px] text-right`} />
                  </div>
                  <input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder="Detalle" className={inputCls} />
                  <div className="flex gap-2">
                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, categoria_id: '' })} className={inputCls}>
                      <option value="gasto">gasto</option>
                      <option value="ingreso">ingreso</option>
                    </select>
                    <select value={form.cuenta_id} onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })} className={inputCls}>
                      {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className={inputCls}>
                    <option value="">Categoría...</option>
                    {categorias.filter((c) => c.tipo === form.tipo).map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditId(null)} className="btn-secondary text-sm">Cancelar</button>
                    <button onClick={guardar} className="btn-primary text-sm">Guardar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">{row.fecha}</span>
                    <span className={`text-sm font-semibold ${row.tipo === 'ingreso' ? 'text-success-600' : 'text-danger-600'}`}>
                      {row.tipo === 'ingreso' ? '+' : '-'}{formatAmount(row.monto)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mb-1">{row.detalle}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{row.cuentas?.nombre} · {row.categorias?.nombre ?? 'sin categoría'}</span>
                    <div className="flex gap-2">
                      <button onClick={() => borrar(row)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-danger-200 text-danger-600 hover:bg-danger-50 transition-colors">Borrar</button>
                      <button onClick={() => empezarEdicion(row)} className="btn-secondary text-xs py-1.5 px-3">Editar</button>
                    </div>
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
