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
nunca debe vivir en el cliente.** La llamada se hace desde una Supabase Edge
Function, y el frontend la consume vía `VITE_ANALYZE_ENDPOINT`. Si esa variable
no está definida, `importacion.js` cae a un placeholder que apunta directo a
`api.anthropic.com` — solo para desarrollo, nunca en producción.

## Notas

- El `.env` con credenciales reales está en `.gitignore`; no lo subas al repo.
