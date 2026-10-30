-- El sistema de citas de la Clínica se mudó de apps.mupa.gob.pa/app/clinica/ a
-- clinica.mupa.gob.pa/formulario (sep-2026). Corrige las bases ya cargadas; el seed
-- ya trae la dirección nueva. Solo toca los valores viejos exactos: si alguien ya
-- lo cambió a mano, no se pisa.
UPDATE "applications" SET "url" = 'https://clinica.mupa.gob.pa/formulario'
WHERE "url" = 'https://apps.mupa.gob.pa/app/clinica/'
  AND NOT EXISTS (SELECT 1 FROM "applications" WHERE "url" = 'https://clinica.mupa.gob.pa/formulario');
--> statement-breakpoint
UPDATE "applications" SET "description" = 'Sistema interno de la Clínica (recepción, médicos, recetas). Para pedir cita: «Agendar cita médica».'
WHERE "slug" = 'clinica-sistema' AND "description" = 'Sistema de la Clínica Municipal. Confirmar si reemplaza a «Agendar cita médica».';
--> statement-breakpoint
UPDATE "home_settings"
SET "value" = replace("value"::text, '"https://apps.mupa.gob.pa/app/clinica/"', '"https://clinica.mupa.gob.pa/formulario"')::jsonb
WHERE "key" = 'content' AND "value"::text LIKE '%"https://apps.mupa.gob.pa/app/clinica/"%';
