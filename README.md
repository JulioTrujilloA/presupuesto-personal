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
`analizar-estado` (`supabase/functions/analizar-estado/`), que el frontend
consume con `supabase.functions.invoke`. El cliente solo envía el PDF en base64.

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

## Notas

- El `.env` con credenciales reales está en `.gitignore`; no lo subas al repo.
