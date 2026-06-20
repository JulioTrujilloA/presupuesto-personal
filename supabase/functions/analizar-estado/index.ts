import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Edge Function: analizar-estado
// Recibe un PDF de estado de cuenta (base64) y devuelve las transacciones
// extraídas como JSON. La API key de Anthropic vive aquí, en el servidor —
// nunca se expone al cliente.

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
  try {
    ({ pdf_base64 } = await req.json());
  } catch {
    return json({ error: "El cuerpo debe ser JSON válido" }, 400);
  }

  if (!pdf_base64) {
    return json({ error: "Falta 'pdf_base64' en el cuerpo" }, 400);
  }

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

  try {
    return json(JSON.parse(limpio), 200);
  } catch {
    return json(
      { error: "La respuesta del modelo no es JSON válido", raw: limpio },
      502,
    );
  }
});
