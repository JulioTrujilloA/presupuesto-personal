-- Bucket privado para estados de cuenta (idempotente).
-- El cliente sube aquí el PDF; la Edge Function lo descarga del lado servidor.
-- Esto evita mandar el PDF en el cuerpo del request (el gateway de Edge
-- Functions se cuelga con cuerpos >~0.5-1 MB).
insert into storage.buckets (id, name, public)
values ('estados-cuenta', 'estados-cuenta', false)
on conflict (id) do nothing;

-- Políticas: usuarios autenticados pueden subir/leer/borrar en este bucket
-- (app de un solo usuario).
drop policy if exists "auth_insert_estados" on storage.objects;
create policy "auth_insert_estados" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'estados-cuenta');

drop policy if exists "auth_select_estados" on storage.objects;
create policy "auth_select_estados" on storage.objects
  for select to authenticated
  using (bucket_id = 'estados-cuenta');

drop policy if exists "auth_delete_estados" on storage.objects;
create policy "auth_delete_estados" on storage.objects
  for delete to authenticated
  using (bucket_id = 'estados-cuenta');
