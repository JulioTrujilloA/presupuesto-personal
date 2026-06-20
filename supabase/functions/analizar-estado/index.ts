import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

// Edge Function: analizar-estado
// El cliente sube el PDF a Storage (bucket 'estados-cuenta') y llama aquí con
// { path, cuenta_id, documento_origen }. La función descarga el PDF del lado
// servidor (sin el límite de tamaño del request), lo manda a Claude (API key
// del lado servidor), inserta en transacciones_importadas (estado 'pendiente'),
// aplica reglas_categorizacion y devuelve las filas. Borra el PDF al terminar.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";
const BUCKET = "estados-cuenta";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Analiza este estado de cuenta bancario y extrae TODAS las transacciones. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin preámbulo) con esta estructura exacta:

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
- Responde SOLO con el JSON, nada más`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function aplicarReglas(supabase: any, filas: Array<{ id: string; descripcion_original: string; cuenta_id: string }>) {
  const { data: reglas } = await supabase
    .from("reglas_categorizacion")
    .select("*")
    .order("prioridad", { ascending: false });
  if (!reglas || reglas.length === 0) return;

  for (const fila of filas) {
    const desc = (fila.descripcion_original ?? "").toLowerCase();
    // deno-lint-ignore no-explicit-any
    const match = reglas.find((r: any) => {
      const patronMatch = desc.includes((r.patron_texto ?? "").toLowerCase());
      const cuentaMatch = !r.cuenta_id || r.cuenta_id === fila.cuenta_id;
      return patronMatch && cuentaMatch;
    });
    if (match) {
      await supabase
        .from("transacciones_importadas")
        .update({ categoria_sugerida_id: match.categoria_id })
        .eq("id", fila.id);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY no está configurada" }, 500);
  }

  let path: string | undefined;
  let cuenta_id: string | undefined;
  let documento_origen: string | undefined;
  try {
    ({ path, cuenta_id, documento_origen } = await req.json());
  } catch {
    return json({ error: "El cuerpo debe ser JSON válido" }, 400);
  }
  if (!path) return json({ error: "Falta 'path' en el cuerpo" }, 400);
  if (!cuenta_id) return json({ error: "Falta 'cuenta_id' en el cuerpo" }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  // Cliente con JWT del usuario para inserts (respeta RLS).
  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  // Cliente service-role solo para descargar/borrar el PDF de Storage.
  const admin = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Descargar el PDF de Storage (server-side, sin límite de request).
  const { data: blob, error: dlError } = await admin.storage
    .from(BUCKET)
    .download(path);
  if (dlError || !blob) {
    return json({ error: `No se pudo descargar el PDF: ${dlError?.message}` }, 400);
  }
  const pdf_base64 = encodeBase64(await blob.arrayBuffer());

  // 2. Extraer transacciones con Claude.
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf_base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return json({ error: data?.error?.message || "Error al analizar el PDF" }, resp.status);
  }

  const texto: string = (data.content ?? [])
    .filter((item: { type: string }) => item.type === "text")
    .map((item: { text: string }) => item.text)
    .join("\n");
  const limpio = texto.replace(/```json|```/g, "").trim();

  let parsed: { transacciones?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(limpio);
  } catch {
    return json({ error: "La respuesta del modelo no es JSON válido", raw: limpio }, 502);
  }

  const transacciones = parsed.transacciones ?? [];

  // Limpieza: borra el PDF de Storage (ya no se necesita).
  await admin.storage.from(BUCKET).remove([path]);

  if (transacciones.length === 0) return json({ filas: [] }, 200);

  // 3. Insertar en staging con estado 'pendiente'.
  const filas = transacciones.map((t) => ({
    cuenta_id,
    fecha: t.fecha,
    descripcion_original: t.descripcion,
    monto: t.monto,
    tipo: t.tipo,
    documento_origen: documento_origen ?? null,
    estado: "pendiente",
  }));

  const { data: insertadas, error } = await supabase
    .from("transacciones_importadas")
    .insert(filas)
    .select();
  if (error || !insertadas) {
    return json({ error: `Error al guardar en staging: ${error?.message}` }, 500);
  }

  // 4. Categorizar según reglas.
  await aplicarReglas(supabase, insertadas);

  return json({ filas: insertadas }, 200);
});
