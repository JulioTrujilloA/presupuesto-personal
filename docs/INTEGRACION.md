# Plan de integración: Presupuesto + Declaraciones

Fusionar **presupuesto-personal** con
[declaraciones-fiscales](https://github.com/JulioTrujilloA/declaraciones-fiscales)
en **un solo producto**.

## Decisiones tomadas
1. **Una sola SPA** (merge en un repo/app), no monorepo.
2. **Proyecto Supabase nuevo unificado** (migrar ambos esquemas + datos).
3. **Presupuesto pasa a multi-usuario** (`user_id` + RLS `auth.uid()`).

## Estado actual
- Diseño **ya unificado**: presupuesto usa el mismo Tailwind/tema claro,
  `tailwind.config.js` + `index.css`, sidebar, react-router y lucide.
- Falta la integración funcional (datos, auth, shell único).

## Diferencias y choques a resolver
| Tema | Presupuesto | Declaraciones |
|---|---|---|
| Identidad | mono-usuario (sin `user_id`) | multi-usuario (`user_id`, RLS `auth.uid()`) |
| React / Router | 19 / v7 | 18 / v6 |
| Supabase | proyecto propio | proyecto propio |
| Tabla `transacciones` | cuenta/categoría/detalle | **fiscal** (mes/anio_declaracion, RFC) → **colisión** |

**Aislamiento:** las tablas de presupuesto irán a un schema Postgres
`presupuesto.*` (o con prefijo) para no chocar con las fiscales en `public.*`.

## Fases

### F0 — Alinear stacks
- Subir Declaraciones a **React 19 + react-router v7** (o, en su defecto, fijar
  ambos a la misma versión). Igualar `@supabase/supabase-js`.
- Unificar ESLint/Vite config.

### F1 — Consolidar Supabase (proyecto nuevo)
- Crear proyecto unificado (ver *Prerequisitos*: límite de 2 free).
- Aplicar esquema **fiscal** en `public` y esquema **presupuesto** en `presupuesto`.
- Migrar **auth users** y **datos**, mapeando `user_id`.
- Recrear bucket `estados-cuenta` + políticas, secret `ANTHROPIC_API_KEY`, y
  desplegar la Edge Function `analizar-estado`.

### F2 — Presupuesto multi-usuario
- Agregar `user_id` (default `auth.uid()`) a las tablas de presupuesto.
- RLS por usuario (reemplazar "authenticated full access").
- Backfill de datos existentes con el `user_id` de Julio.
- Ajustar Edge Function y queries del cliente para el nuevo scoping.
- **Reprobar la importación end-to-end.**

### F3 — Shell unificado
- Una sola app: sidebar con secciones **Finanzas** (`/finanzas/*`) y
  **Fiscal** (`/fiscal/*`), una sola sesión/login.
- Migrar las pantallas de Declaraciones al shell común.

### F4 — UI compartida y limpieza
- Centralizar tokens/clases (ya idénticos) y componentes primitivos.
- Eliminar duplicación.

### F5 — (Opcional, antes CONGELADO) Cruce fiscal 612
- Ligar movimientos de presupuesto con lo deducible/fiscal.
- **Solo si Julio lo aprueba explícitamente.**

## Riesgos / prerequisitos
- **Límite free de 2 proyectos activos:** crear el unificado requiere liberar un
  slot (pausar/borrar tras migrar). Mantener las fuentes activas durante la
  migración.
- Migración de `auth.users` entre proyectos (mapeo de `user_id`).
- No romper la importación (EF) al cambiar esquema/scoping.
- Decidir nombre/repo del producto unificado (¿repo nuevo o uno de estos?).

## Pendiente de definir antes de F0
- Nombre y repositorio del producto integrado.
- ¿Migrar datos reales de Declaraciones o empezar limpio ahí también?
