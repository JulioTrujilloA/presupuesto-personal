import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Edge Function: analizar-estado
// Recibe un PDF de estado de cuenta (base64) + cuenta_id, extrae las
// transacciones con Claude (API key del lado servidor) e inserta directo en
// transacciones_importadas con estado 'pendiente'. Devuelve las filas insertadas
// para que el cliente aplique reglas_categorizacion sobre ellas.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json(
      { error: "ANTHROPIC_API_KEY no está configurada en la Edge Function" },
      500,
    );
  }

  let pdf_base64: string | undefined;
  let cuenta_id: string | undefined;
  let documento_origen: string | undefined;
  try {
    ({ pdf_base64, cuenta_id, documento_origen } = await req.json());
  } catch {
    return json({ error: "El cuerpo debe ser JSON válido" }, 400);
  }

  if (!pdf_base64) return json({ error: "Falta 'pdf_base64' en el cuerpo" }, 400);
  if (!cuenta_id) return json({ error: "Falta 'cuenta_id' en el cuerpo" }, 400);

  // Cliente Supabase con el JWT del usuario que llamó — respeta RLS.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // 1. Extraer transacciones con Claude.
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf_base64,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return json(
      { error: data?.error?.message || "Error al analizar el PDF" },
      resp.status,
    );
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
    return json(
      { error: "La respuesta del modelo no es JSON válido", raw: limpio },
      502,
    );
  }

  const transacciones = parsed.transacciones ?? [];
  if (transacciones.length === 0) {
    return json({ filas: [] }, 200);
  }

  // 2. Insertar en staging con estado 'pendiente'.
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

  if (error) {
    return json({ error: `Error al guardar en staging: ${error.message}` }, 500);
  }

  return json({ filas: insertadas }, 200);
});
