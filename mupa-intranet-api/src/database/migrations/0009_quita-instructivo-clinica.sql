-- El instructivo en PDF era del sistema de citas viejo (apps.mupa.gob.pa/app/clinica/),
-- que ya no se usa: se quita del bloque "Clínica Municipal" del Inicio en las bases ya
-- cargadas (el seed ya no lo trae), y la descripción de la plataforma "apps" deja de
-- mencionar la dirección vieja.
UPDATE "home_settings"
SET "value" = jsonb_set(
  "value",
  '{clinica,items}',
  (SELECT coalesce(jsonb_agg(i), '[]'::jsonb) FROM jsonb_array_elements("value" -> 'clinica' -> 'items') AS i WHERE coalesce(i ->> 'h', '') NOT LIKE '%Instructivo-del-sistema-de-clinica%')
)
WHERE "key" = 'content' AND jsonb_typeof("value" -> 'clinica' -> 'items') = 'array' AND ("value" -> 'clinica' -> 'items')::text LIKE '%Instructivo-del-sistema-de-clinica%';
--> statement-breakpoint
UPDATE "applications" SET "description" = 'Plataforma que aloja otras aplicaciones.'
WHERE "slug" = 'apps' AND "description" LIKE '%apps.mupa.gob.pa/app/clinica%';
