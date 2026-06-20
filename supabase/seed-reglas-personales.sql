-- Reglas de categorización PERSONALES de Julio, derivadas de descripciones
-- reales de sus estados de cuenta. Prioridad alta (120+) para ganar a las
-- genéricas de seed-reglas.sql. Globales (cuenta_id null). Idempotente.
delete from reglas_categorizacion
where cuenta_id is null
  and patron_texto in (
    'abono/nomina','mandato 744792','alvarado tamayo','frinsa',
    'nrf mexico','mp agregador','5288439150328195','camarena'
  );

insert into reglas_categorizacion (patron_texto, categoria_id, prioridad, cuenta_id)
select v.patron, c.id, v.prioridad, null
from (values
  ('abono/nomina',      'icorp',                            120), -- nómina
  ('mandato 744792',    'CONAFOR',                          120),
  ('alvarado tamayo',   'Renta locales',                    120), -- inquilino
  ('frinsa',            'Bono trimestral',                  120),
  ('nrf mexico',        'Vehículos',                        120), -- crédito auto
  ('mp agregador',      'Transferencias (cuentas propias)', 120),
  ('5288439150328195',  'Deudas tarjeta de crédito',        125), -- nº de TC
  ('camarena',          'Contador',                         120)
) as v(patron, categoria_nombre, prioridad)
join categorias c on c.nombre = v.categoria_nombre;
