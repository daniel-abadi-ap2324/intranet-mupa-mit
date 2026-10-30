-- El código de llamadas se pide en su propio sistema (cdr.mupa.gob.pa), no con un
-- formulario de la intranet: se quita el formulario en las bases ya cargadas (el seed
-- ya no lo trae). Si alguien alcanzó a enviar una solicitud con él, solo se oculta
-- (una solicitud no puede quedar sin su formulario).
UPDATE "forms" SET "published" = false, "accepting" = false WHERE "slug" = 'codigo-de-llamadas';
--> statement-breakpoint
DELETE FROM "forms" WHERE "slug" = 'codigo-de-llamadas' AND NOT EXISTS (SELECT 1 FROM "requests" WHERE "requests"."form_id" = "forms"."id");
--> statement-breakpoint
-- El sistema de códigos de llamadas va por https.
-- (la URL es única: si ya existe la versión https, se deja como está)
UPDATE "applications" SET "url" = replace("url", 'http://cdr.mupa.gob.pa', 'https://cdr.mupa.gob.pa')
WHERE "url" LIKE 'http://cdr.mupa.gob.pa%'
  AND NOT EXISTS (SELECT 1 FROM "applications" AS "otra" WHERE "otra"."url" = replace("applications"."url", 'http://cdr.mupa.gob.pa', 'https://cdr.mupa.gob.pa'));
--> statement-breakpoint
UPDATE "home_settings" SET "value" = replace("value"::text, 'http://cdr.mupa.gob.pa', 'https://cdr.mupa.gob.pa')::jsonb WHERE "value"::text LIKE '%http://cdr.mupa.gob.pa%';
