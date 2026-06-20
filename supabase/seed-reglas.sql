-- Seed de reglas_categorizacion (núcleo genérico de alta confianza).
-- El matching en src/lib/importacion.js usa includes() de substring en
-- minúsculas, ordenado por prioridad desc — la primera coincidencia gana.
-- Idempotente: borra solo las reglas sin cuenta específica antes de reinsertar.
-- Las reglas personales (nómina, rentas, transferencias propias) se agregan
-- aparte porque dependen de los bancos y descripciones reales del usuario.

delete from reglas_categorizacion where cuenta_id is null;

insert into reglas_categorizacion (patron_texto, categoria_id, prioridad)
select v.patron, c.id, v.prioridad
from (values
  -- Vehículos / gasolina (alta prioridad para ganar sobre 'oxxo' de Comida)
  ('oxxo gas', 'Vehículos', 100),
  ('pemex', 'Vehículos', 90),
  ('gasolin', 'Vehículos', 90),
  ('g500', 'Vehículos', 90),
  ('estacionamiento', 'Vehículos', 80),
  ('iave', 'Vehículos', 80),
  ('telepeaje', 'Vehículos', 80),
  -- Internet
  ('telmex', 'Internet', 60),
  ('infinitum', 'Internet', 60),
  ('totalplay', 'Internet', 60),
  ('izzi', 'Internet', 60),
  ('megacable', 'Internet', 60),
  -- Telefonía
  ('telcel', 'Telefonía', 60),
  ('at&t', 'Telefonía', 60),
  ('movistar', 'Telefonía', 60),
  ('bait', 'Telefonía', 60),
  -- Energía
  ('cfe', 'Energía', 60),
  ('comision federal', 'Energía', 60),
  -- Entretenimiento
  ('netflix', 'Entretenimiento', 60),
  ('spotify', 'Entretenimiento', 60),
  ('disney', 'Entretenimiento', 60),
  ('hbo', 'Entretenimiento', 60),
  ('cinepolis', 'Entretenimiento', 60),
  ('cinemex', 'Entretenimiento', 60),
  -- Salud
  ('farmacia', 'Salud', 50),
  ('benavides', 'Salud', 50),
  ('similares', 'Salud', 50),
  ('hospital', 'Salud', 50),
  -- Ropa
  ('liverpool', 'Ropa', 50),
  ('coppel', 'Ropa', 50),
  ('zara', 'Ropa', 50),
  ('shein', 'Ropa', 50),
  -- Hogar
  ('home depot', 'Hogar', 50),
  ('ikea', 'Hogar', 50),
  -- Comida (genéricos, prioridad baja)
  ('oxxo', 'Comida', 20),
  ('walmart', 'Comida', 20),
  ('soriana', 'Comida', 20),
  ('chedraui', 'Comida', 20),
  ('la comer', 'Comida', 20),
  ('costco', 'Comida', 20),
  ('sam''s', 'Comida', 20),
  ('rappi', 'Comida', 20),
  ('uber eats', 'Comida', 20),
  ('didi food', 'Comida', 20),
  ('starbucks', 'Comida', 20),
  ('restaurante', 'Comida', 15)
) as v(patron, categoria_nombre, prioridad)
join categorias c on c.nombre = v.categoria_nombre and c.tipo = 'gasto';
