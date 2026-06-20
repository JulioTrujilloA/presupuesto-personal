import { supabase } from './supabaseClient'

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}

// Extrae las transacciones del PDF llamando a la Edge Function 'analizar-estado'.
// La función vive en Supabase y guarda ahí la API key de Anthropic; el cliente
// solo envía el PDF en base64. functions.invoke añade el JWT del usuario.
const analyzePDF = async (base64Data) => {
  const { data, error } = await supabase.functions.invoke('analizar-estado', {
    body: { pdf_base64: base64Data },
  })

  if (error) {
    // Los errores HTTP de la función llegan envueltos; intenta leer el mensaje real.
    let mensaje = error.message
    try {
      const detalle = await error.context?.json?.()
      if (detalle?.error) mensaje = detalle.error
    } catch {
      // Si no se puede parsear el cuerpo, se queda el mensaje genérico.
    }
    throw new Error(mensaje || 'Error al analizar el PDF')
  }

  return data
}

// Procesa varios PDFs para una cuenta específica y guarda los resultados
// en transacciones_importadas con estado 'pendiente'.
export const importarEstadosCuenta = async (files, cuentaId, setProgreso) => {
  setProgreso({ actual: 0, total: files.length })
  const filasInsertadas = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    setProgreso({ actual: i + 1, total: files.length })

    const base64Data = await fileToBase64(file)
    const parsed = await analyzePDF(base64Data)

    const filas = parsed.transacciones.map((t) => ({
      cuenta_id: cuentaId,
      fecha: t.fecha,
      descripcion_original: t.descripcion,
      monto: t.monto,
      tipo: t.tipo,
      documento_origen: file.name,
      estado: 'pendiente',
    }))

    if (filas.length > 0) {
      const { data, error } = await supabase
        .from('transacciones_importadas')
        .insert(filas)
        .select()

      if (error) throw error
      filasInsertadas.push(...data)
    }
  }

  // Aplica reglas de categorización después de insertar
  await aplicarReglasCategorizacion(filasInsertadas.map((f) => f.id))

  return filasInsertadas
}

// Busca coincidencias de texto en reglas_categorizacion y asigna
// categoria_sugerida_id a las filas pendientes que coincidan.
const aplicarReglasCategorizacion = async (importacionIds) => {
  if (importacionIds.length === 0) return

  const { data: reglas, error: errorReglas } = await supabase
    .from('reglas_categorizacion')
    .select('*')
    .order('prioridad', { ascending: false })

  if (errorReglas || !reglas || reglas.length === 0) return

  const { data: pendientes, error: errorPendientes } = await supabase
    .from('transacciones_importadas')
    .select('id, descripcion_original, cuenta_id')
    .in('id', importacionIds)

  if (errorPendientes || !pendientes) return

  for (const fila of pendientes) {
    const descripcionLower = fila.descripcion_original.toLowerCase()
    const reglaMatch = reglas.find((r) => {
      const patronMatch = descripcionLower.includes(r.patron_texto.toLowerCase())
      const cuentaMatch = !r.cuenta_id || r.cuenta_id === fila.cuenta_id
      return patronMatch && cuentaMatch
    })

    if (reglaMatch) {
      await supabase
        .from('transacciones_importadas')
        .update({ categoria_sugerida_id: reglaMatch.categoria_id })
        .eq('id', fila.id)
    }
  }
}

export const formatAmount = (monto) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}
