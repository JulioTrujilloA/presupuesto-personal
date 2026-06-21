import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'
import { AlertTriangle } from 'lucide-react'

const BUCKET = 'estados-cuenta'

// Clave para comparar transacciones: cuenta + fecha + monto + descripción.
const claveTx = (cuentaId, fecha, monto, desc) =>
  `${cuentaId}|${fecha}|${Number(monto)}|${(desc ?? '').trim().toLowerCase()}`

// Marca cada fila pendiente con _dup=true si ya existe una transacción
// confirmada equivalente, o si se repite dentro del mismo lote pendiente.
const marcarDuplicados = async (pendientes) => {
  if (!pendientes || pendientes.length === 0) return pendientes ?? []

  const fechas = [...new Set(pendientes.map((p) => p.fecha))]
  const cuentaIds = [...new Set(pendientes.map((p) => p.cuenta_id))]

  const { data: confirmadas } = await supabase
    .from('transacciones')
    .select('cuenta_id, fecha, monto, detalle')
    .in('fecha', fechas)
    .in('cuenta_id', cuentaIds)

  const setConfirmadas = new Set(
    (confirmadas ?? []).map((c) => claveTx(c.cuenta_id, c.fecha, c.monto, c.detalle)),
  )

  const vistos = new Set()
  return pendientes.map((p) => {
    const k = claveTx(p.cuenta_id, p.fecha, p.monto, p.descripcion_original)
    const dup = setConfirmadas.has(k) || vistos.has(k)
    vistos.add(k)
    return { ...p, _dup: dup }
  })
}

// Borra de Storage los PDFs cuyos documentos ya no tienen filas pendientes.
const limpiarDocs = async (paths) => {
  const unique = [...new Set((paths ?? []).filter(Boolean))]
  for (const p of unique) {
    const { count } = await supabase
      .from('transacciones_importadas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .eq('documento_path', p)
    if (!count) await supabase.storage.from(BUCKET).remove([p])
  }
}

export default function Pendientes() {
  const [pendientes, setPendientes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [seleccionCategoria, setSeleccionCategoria] = useState({})

  const [docPath, setDocPath] = useState(null) // documento de Storage elegido
  const [storageUrl, setStorageUrl] = useState(null)

  const cargarDatos = useCallback(async () => {
    const [pendRes, catRes] = await Promise.all([
      supabase
        .from('transacciones_importadas')
        .select('*, cuentas(nombre)')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: false }),
      supabase.from('categorias').select('id, nombre, tipo').eq('activa', true).order('nombre'),
    ])

    if (catRes.error) setError(catRes.error.message)
    else setCategorias(catRes.data)

    if (pendRes.error) {
      setError(pendRes.error.message)
      setCargando(false)
      return
    }

    setPendientes(await marcarDuplicados(pendRes.data))
    setCargando(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarDatos()
  }, [cargarDatos])

  // Documentos (PDF) presentes en las filas pendientes.
  const documentos = []
  const vistosDoc = new Set()
  for (const p of pendientes) {
    if (p.documento_path && !vistosDoc.has(p.documento_path)) {
      vistosDoc.add(p.documento_path)
      documentos.push({ path: p.documento_path, nombre: p.documento_origen || p.documento_path.split('/').pop() })
    }
  }
  const docActivo = documentos.find((d) => d.path === docPath)?.path ?? documentos[0]?.path ?? null

  // Genera URL firmada del documento activo de Storage.
  useEffect(() => {
    let activo = true
    const gen = async () => {
      if (!docActivo) { setStorageUrl(null); return }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(docActivo, 3600)
      if (!activo) return
      setStorageUrl(error ? null : data.signedUrl)
    }
    gen()
    return () => { activo = false }
  }, [docActivo])

  const categoriaSeleccionada = (fila) =>
    seleccionCategoria[fila.id] ?? fila.categoria_sugerida_id ?? ''

  const handleCategoriaChange = (filaId, categoriaId) => {
    setSeleccionCategoria((prev) => ({ ...prev, [filaId]: categoriaId }))
  }

  // Inserta la confirmada y marca el staging. Devuelve mensaje de error o null.
  const confirmarFila = async (fila) => {
    const categoriaId = categoriaSeleccionada(fila)
    if (!categoriaId) return 'Falta categoría'

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
    if (errorInsert) return errorInsert.message

    const { error: errorUpdate } = await supabase
      .from('transacciones_importadas')
      .update({ estado: 'confirmada', transaccion_id: transaccion.id })
      .eq('id', fila.id)
    return errorUpdate ? errorUpdate.message : null
  }

  const confirmarUno = async (fila) => {
    setError(null); setAviso(null)
    const err = await confirmarFila(fila)
    if (err) { setError(err); return }
    await limpiarDocs([fila.documento_path])
    await cargarDatos()
  }

  // Filas listas para el confirmar masivo: con categoría y NO duplicadas.
  const listas = pendientes.filter((f) => !f._dup && categoriaSeleccionada(f))

  const confirmarMasivo = async () => {
    setError(null); setAviso(null)
    let n = 0
    for (const fila of listas) {
      const err = await confirmarFila(fila)
      if (err) { setError(`Error al confirmar (${n} ya guardadas): ${err}`); await cargarDatos(); return }
      n++
    }
    await limpiarDocs(listas.map((f) => f.documento_path))
    setAviso(`${n} transacción${n !== 1 ? 'es' : ''} confirmada${n !== 1 ? 's' : ''}.`)
    setSeleccionCategoria({})
    await cargarDatos()
  }

  const cancelar = () => { setSeleccionCategoria({}); setError(null); setAviso(null) }

  const handleDescartar = async (fila) => {
    setError(null)
    const { error } = await supabase
      .from('transacciones_importadas')
      .update({ estado: 'descartada' })
      .eq('id', fila.id)
    if (error) { setError(error.message); return }
    await limpiarDocs([fila.documento_path])
    setPendientes((prev) => prev.filter((p) => p.id !== fila.id))
  }

  const tieneSeleccion = Object.keys(seleccionCategoria).length > 0
  const selectCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div className="max-w-6xl mx-auto animate-slide-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Transacciones por revisar</h2>
      <p className="text-sm text-gray-500 mb-4">
        {pendientes.length === 0
          ? 'No hay transacciones pendientes de revisión.'
          : `${pendientes.length} por revisar. El PDF importado se muestra al lado para cotejar.`}
      </p>

      {error && <div className="alert-danger text-sm mb-3">{error}</div>}
      {aviso && <div className="alert-success text-sm mb-3">{aviso}</div>}

      <div className="flex gap-3 items-stretch flex-wrap">
        {/* Lista de pendientes (scrollable) */}
        <div className="flex-1 min-w-[320px] h-[70vh] overflow-y-auto flex flex-col gap-3 pr-1">
          {cargando ? (
            <div className="py-10 text-center text-gray-400">Cargando pendientes...</div>
          ) : pendientes.length === 0 ? (
            <p className="text-sm text-gray-400">Nada pendiente.</p>
          ) : (
            pendientes.map((fila) => (
              <div key={fila.id} className={`card !p-4 ${fila._dup ? 'border-warning-400 ring-1 ring-warning-200' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{fila.fecha}</span>
                  <span className={`text-xs font-semibold ${fila.tipo === 'ingreso' ? 'text-success-600' : 'text-danger-600'}`}>
                    {fila.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                  </span>
                </div>

                {fila._dup && (
                  <div className="alert-warning text-xs flex items-center gap-1.5 mb-2 !p-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Posible duplicado — revisa antes de confirmar
                  </div>
                )}

                <p className="text-sm text-gray-900 mb-2">{fila.descripcion_original}</p>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">{fila.cuentas?.nombre}</span>
                  <span className="text-sm font-semibold text-gray-900">{formatAmount(fila.monto)}</span>
                </div>

                <select
                  value={categoriaSeleccionada(fila)}
                  onChange={(e) => handleCategoriaChange(fila.id, e.target.value)}
                  className={`${selectCls} mb-3`}
                >
                  <option value="">Selecciona categoría...</option>
                  {categorias
                    .filter((c) => c.tipo === fila.tipo)
                    .map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>

                <div className="flex gap-2">
                  <button onClick={() => handleDescartar(fila)} className="btn-secondary flex-1 text-sm">
                    Descartar
                  </button>
                  {fila._dup && (
                    <button onClick={() => confirmarUno(fila)} className="flex-1 text-sm font-medium px-4 py-2 rounded-lg bg-warning-600 hover:bg-warning-700 text-white transition-colors">
                      Confirmar igual
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Visor de PDF */}
        <div className="flex-1 min-w-[320px] h-[70vh] flex flex-col gap-2 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          {documentos.length > 1 && (
            <select value={docActivo ?? ''} onChange={(e) => setDocPath(e.target.value)} className={selectCls}>
              {documentos.map((d) => <option key={d.path} value={d.path}>{d.nombre}</option>)}
            </select>
          )}
          {storageUrl ? (
            <iframe src={storageUrl} title="PDF" className="flex-1 w-full rounded-lg border border-gray-200" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 text-center px-5">
              {documentos.length > 0 ? 'Cargando PDF...' : 'El PDF importado aparecerá aquí al revisar.'}
            </div>
          )}
        </div>
      </div>

      {/* Barra de acciones general */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
        <span className="text-sm text-gray-500 mr-auto">
          {listas.length > 0 ? `${listas.length} con categoría, listas` : 'Asigna categorías para confirmar'}
        </span>
        <button onClick={cancelar} disabled={!tieneSeleccion} className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
          Cancelar
        </button>
        <button onClick={confirmarMasivo} disabled={listas.length === 0} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          Confirmar{listas.length ? ` (${listas.length})` : ''}
        </button>
      </div>
    </div>
  )
}
