import { supabase } from './supabaseClient'

const API_URL = 'https://api.anthropic.com/v1/messages'

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}

// Llama a la API de Anthropic para extraer transacciones del PDF.
// NOTA: en producción esta llamada debe vivir en una Supabase Edge Function
// para no exponer la API key de Anthropic en el cliente. Aquí se deja el
// placeholder de la llamada directa para que el flujo de revisión funcione
// de extremo a extremo; sustituir ANALYZE_ENDPOINT por la Edge Function.
const ANALYZE_ENDPOINT = import.meta.env.VITE_ANALYZE_ENDPOINT || API_URL

const analyzePDF = async (base64Data) => {
  const response = await fetch(ANALYZE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
            },
            {
              type: 'text',
              text: `Analiza este estado de cuenta bancario y extrae TODAS las transacciones. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin preámbulo) con esta estructura exacta:

{
  "transacciones": [
    {"fecha": "YYYY-MM-DD", "descripcion": "...", "monto": 0.00, "tipo": "ingreso" | "gasto"}
  ]
}

Reglas:
- tipo "ingreso" para depósitos, transferencias recibidas, abonos
- tipo "gasto" para retiros, pagos, cargos, comisiones
- fecha en formato YYYY-MM-DD
- montos siempre positivos
- Responde SOLO con el JSON, nada más`,
            },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || 'Error al analizar el PDF')
  }

  const textoRespuesta = data.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n')

  const cleanText = textoRespuesta.replace(/```json|```/g, '').trim()
  return JSON.parse(cleanText)
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
