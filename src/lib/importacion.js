import { supabase } from './supabaseClient'

const BUCKET = 'estados-cuenta'

// Sube el PDF a Storage y llama a la Edge Function con la ruta. La función
// descarga el PDF del lado servidor (evita el límite de tamaño del request),
// lo extrae con Claude, inserta en transacciones_importadas (estado 'pendiente')
// y aplica reglas_categorizacion. Devuelve las filas insertadas.
const procesarDocumento = async (file, cuentaId) => {
  // Ruta única para evitar colisiones.
  const path = `${cuentaId}/${Date.now()}-${crypto.randomUUID()}.pdf`

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (upError) {
    throw new Error('No se pudo subir el PDF: ' + upError.message)
  }

  const { data, error } = await supabase.functions.invoke('analizar-estado', {
    body: { path, cuenta_id: cuentaId, documento_origen: file.name },
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

  return data.filas ?? []
}

// Procesa varios PDFs para una cuenta. Devuelve el total de transacciones
// insertadas en staging.
export const importarEstadosCuenta = async (files, cuentaId, setProgreso) => {
  setProgreso({ actual: 0, total: files.length })
  const filasInsertadas = []

  for (let i = 0; i < files.length; i++) {
    setProgreso({ actual: i + 1, total: files.length })
    const filas = await procesarDocumento(files[i], cuentaId)
    filasInsertadas.push(...filas)
  }

  return filasInsertadas
}

export const formatAmount = (monto) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
}
