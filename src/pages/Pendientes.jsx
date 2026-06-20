import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatAmount } from '../lib/importacion'

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
  // Documento activo: el elegido, o el primero disponible.
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

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Transacciones por revisar</h2>
      <p style={styles.subtitle}>
        {pendientes.length === 0
          ? 'No hay transacciones pendientes de revisión.'
          : `${pendientes.length} por revisar. El PDF importado se muestra al lado para cotejar.`}
      </p>

      {error && <div style={styles.error}>{error}</div>}
      {aviso && <div style={styles.ok}>{aviso}</div>}

      <div style={styles.split}>
        {/* Lista de pendientes (scrollable) */}
        <div style={styles.listPane}>
          {cargando ? (
            <div style={styles.loading}>Cargando pendientes...</div>
          ) : pendientes.length === 0 ? (
            <p style={styles.vacio}>Nada pendiente.</p>
          ) : (
            pendientes.map((fila) => (
              <div key={fila.id} style={fila._dup ? { ...styles.card, ...styles.cardDup } : styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.fecha}>{fila.fecha}</span>
                  <span style={fila.tipo === 'ingreso' ? styles.tipoIngreso : styles.tipoGasto}>
                    {fila.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                  </span>
                </div>

                {fila._dup && (
                  <div style={styles.dupBadge}>⚠ Posible duplicado — revisa antes de confirmar</div>
                )}

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
                    .map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>

                <div style={styles.actions}>
                  <button onClick={() => handleDescartar(fila)} style={styles.descartarButton}>
                    Descartar
                  </button>
                  {fila._dup && (
                    <button onClick={() => confirmarUno(fila)} style={styles.confirmarUnoButton}>
                      Confirmar igual
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Visor de PDF */}
        <div style={styles.pdfPane}>
          {documentos.length > 1 && (
            <select
              value={docActivo ?? ''}
              onChange={(e) => setDocPath(e.target.value)}
              style={styles.docSelect}
            >
              {documentos.map((d) => <option key={d.path} value={d.path}>{d.nombre}</option>)}
            </select>
          )}
          {storageUrl ? (
            <iframe src={storageUrl} title="PDF" style={styles.iframe} />
          ) : (
            <div style={styles.pdfEmpty}>
              {documentos.length > 0 ? 'Cargando PDF...' : 'El PDF importado aparecerá aquí al revisar.'}
            </div>
          )}
        </div>
      </div>

      {/* Barra de acciones general */}
      <div style={styles.bottomBar}>
        <span style={styles.dirtyCount}>
          {listas.length > 0 ? `${listas.length} con categoría, listas` : 'Asigna categorías para confirmar'}
        </span>
        <button onClick={cancelar} disabled={Object.keys(seleccionCategoria).length === 0} style={Object.keys(seleccionCategoria).length ? styles.cancelBtn : styles.btnDisabled}>
          Cancelar
        </button>
        <button onClick={confirmarMasivo} disabled={listas.length === 0} style={listas.length ? styles.saveBtn : styles.btnDisabled}>
          Confirmar{listas.length ? ` (${listas.length})` : ''}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', margin: '0 0 4px 0', color: '#f8fafc' },
  subtitle: { fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0' },
  split: { display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' },
  listPane: { flex: '1 1 360px', minWidth: '320px', height: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' },
  pdfPane: { flex: '1 1 360px', minWidth: '320px', height: '70vh', display: 'flex', flexDirection: 'column', gap: '8px', background: '#1e293b', borderRadius: '10px', padding: '10px' },
  docSelect: { padding: '7px 8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px' },
  iframe: { flex: 1, width: '100%', border: 'none', borderRadius: '8px', background: '#fff' },
  pdfEmpty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' },
  loading: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  vacio: { fontSize: '13px', color: '#64748b' },
  card: { background: '#1e293b', borderRadius: '10px', padding: '14px' },
  cardDup: { border: '1px solid #b45309' },
  dupBadge: { fontSize: '12px', color: '#fdba74', background: '#7c2d12', borderRadius: '6px', padding: '4px 8px', margin: '0 0 8px 0', display: 'inline-block' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  fecha: { fontSize: '12px', color: '#94a3b8' },
  tipoIngreso: { fontSize: '11px', color: '#4ade80', fontWeight: 600 },
  tipoGasto: { fontSize: '11px', color: '#f87171', fontWeight: 600 },
  descripcion: { fontSize: '14px', color: '#f8fafc', margin: '0 0 8px 0' },
  metaRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  meta: { fontSize: '12px', color: '#64748b' },
  monto: { fontSize: '15px', color: '#f8fafc', fontWeight: 600 },
  select: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '13px', marginBottom: '10px' },
  actions: { display: 'flex', gap: '8px' },
  descartarButton: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' },
  confirmarUnoButton: { flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#b45309', color: '#0f172a', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  bottomBar: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #1e293b' },
  dirtyCount: { fontSize: '12px', color: '#94a3b8', marginRight: 'auto' },
  cancelBtn: { padding: '9px 16px', borderRadius: '6px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' },
  saveBtn: { padding: '9px 16px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '13px', cursor: 'pointer' },
  btnDisabled: { padding: '9px 16px', borderRadius: '6px', border: '1px solid #1e293b', background: 'transparent', color: '#475569', fontSize: '13px', cursor: 'not-allowed' },
  error: { marginBottom: '12px', background: '#7f1d1d', color: '#fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '13px' },
  ok: { marginBottom: '12px', background: '#14532d', color: '#bbf7d0', padding: '8px 10px', borderRadius: '6px', fontSize: '13px' },
}
