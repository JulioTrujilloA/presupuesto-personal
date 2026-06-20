# Presupuesto Personal

App web para llevar el presupuesto personal: importa estados de cuenta en PDF,
extrae las transacciones con Claude, las categoriza con reglas y muestra un
resumen. React 19 + Vite, backend en Supabase.

## Requisitos

- Node 18+
- Un proyecto de Supabase con el esquema aplicado (tablas, RLS y seeds)

## Configuración

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env` y rellena tus credenciales de Supabase:

   ```bash
   cp .env.example .env
   ```

3. Levanta el entorno de desarrollo:

   ```bash
   npm run dev
   ```

## Scripts

| Comando           | Descripción                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Servidor de desarrollo (Vite + HMR)  |
| `npm run build`   | Build de producción                  |
| `npm run preview` | Sirve el build localmente            |
| `npm run lint`    | ESLint                               |

## Estructura

```
src/
  lib/
    supabaseClient.js   Cliente de Supabase (lee VITE_SUPABASE_*)
    importacion.js      Sube PDFs, llama al parser y categoriza
  pages/
    Login.jsx           Auth (email/password)
    Dashboard.jsx       Resumen de movimientos
    Importar.jsx        Subida de estados de cuenta
    Pendientes.jsx      Revisión y categorización de lo importado
```

## Parser de PDFs (Edge Function)

La extracción de transacciones usa la API de Claude. **La API key de Anthropic
nunca vive en el cliente.** La llamada corre en la Edge Function
`analizar-estado` (`supabase/functions/analizar-estado/`).

Flujo (importante: el PDF **no** se manda en el cuerpo del request — el gateway
de Edge Functions se cuelga con cuerpos grandes, >~0.5-1 MB):

1. El cliente sube el PDF al bucket de Storage `estados-cuenta` (privado).
2. Llama a `analizar-estado` con `{ path, cuenta_id, documento_origen }` —
   request diminuto.
3. La función descarga el PDF de Storage (service-role, lado servidor), lo manda
   a Claude (`thinking` off + `effort: low` para minimizar latencia), **inserta
   en `transacciones_importadas` con estado `pendiente`** (JWT del usuario,
   respeta RLS), aplica `reglas_categorizacion`, borra el PDF y devuelve las
   filas.

La API key se configura como **secreto** de la función (no en el `.env` del
frontend):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

También se puede setear desde el dashboard de Supabase →
Edge Functions → Secrets. Para redeployar tras cambios:

```bash
supabase functions deploy analizar-estado
```

El bucket y sus políticas RLS están versionados en `supabase/seed-storage.sql`.

## Notas

- El `.env` con credenciales reales está en `.gitignore`; no lo subas al repo.
- El Dashboard tiene selector de mes/año y modo **Acumulado** (todas las
  transacciones).
