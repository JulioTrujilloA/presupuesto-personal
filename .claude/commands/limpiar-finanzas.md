---
description: Limpia los datos de finanzas (tablas pp_) en el proyecto Supabase fiscal para empezar de cero
---

# Limpiar BD de finanzas

Limpia los datos de la app de finanzas personales (tablas con prefijo `pp_`) en el
proyecto Supabase **fiscal** `qruarpddhxqrsjamngmq`, usando el servidor MCP de Supabase
(`execute_sql`).

## Reglas de seguridad (OBLIGATORIAS)
- **Nunca borres sin confirmación explícita del usuario.** Primero muestra conteos.
- Opera **solo** sobre tablas con prefijo `pp_`. Jamás toques tablas fiscales
  (transacciones, declaraciones, activos_fijos, user_profiles, etc.).
- Respeta las FK: antes de borrar, anula las referencias cruzadas
  (`pp_transacciones.importacion_id` y `pp_transacciones_importadas.transaccion_id`).
- No intentes borrar objetos de Storage por SQL (está bloqueado); solo menciónalo.

## Pasos
1. Muestra el estado actual (conteos) de: `pp_transacciones`, `pp_transacciones_importadas`,
   `pp_presupuesto_mensual`, `pp_cuentas`, `pp_categorias`, `pp_grupos_categoria`,
   `pp_reglas_categorizacion`.
2. Pregunta el **alcance** (usa AskUserQuestion):
   - **Transaccional** (recomendado): borra `pp_transacciones` + `pp_transacciones_importadas`.
     Conserva catálogos (cuentas, categorías, grupos, reglas, presupuesto, saldos).
   - **Total**: además borra `pp_presupuesto_mensual` y, si el usuario lo confirma
     aparte, los catálogos (`pp_categorias`, `pp_grupos_categoria`, `pp_reglas_categorizacion`,
     `pp_cuentas`). Recuerda el impacto: borrar reglas quita la auto-categorización en
     futuras importaciones (no afecta movimientos ya guardados).
3. **Confirma** explícitamente lo que se va a borrar (lista + conteos) antes de ejecutar.
4. Ejecuta en una transacción, anulando FKs primero. Plantilla base (transaccional):

   ```sql
   begin;
   update public.pp_transacciones set importacion_id = null where importacion_id is not null;
   update public.pp_transacciones_importadas set transaccion_id = null where transaccion_id is not null;
   delete from public.pp_transacciones_importadas;
   delete from public.pp_transacciones;
   commit;
   ```

   Para borrar catálogos (si se eligió y confirmó), respeta el orden de dependencias:
   primero `pp_presupuesto_mensual` y `pp_reglas_categorizacion`, luego `pp_categorias`
   (las categorías referencian `pp_grupos_categoria`), luego `pp_grupos_categoria`, y al
   final `pp_cuentas`.
5. Muestra los conteos finales para verificar y recuerda que los PDFs viejos siguen en
   Storage (bucket `estados-cuenta`) pero no interfieren (se limpian desde el dashboard).
