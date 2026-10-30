-- SIGEX y Legal y Justicia solo abren dentro de la Alcaldía: llevan su enlace de la intranet actual,
-- con la etiqueta «Solo red interna» (acceso "todos" para que el enlace llegue; la API no lo oculta).
-- Solo si todavía no tienen enlace: no pisa lo que administración ya haya puesto desde el panel.
UPDATE "applications"
SET "url" = 'http://192.0.2.5/vigilanciaFiscal/', "access" = 'todos', "status" = 'solo-red-interna', "external" = true
WHERE "slug" = 'sigex' AND "url" IS NULL;--> statement-breakpoint
UPDATE "applications"
SET "url" = 'http://192.0.2.14/tramites/index.php?signIn=1', "access" = 'todos', "status" = 'solo-red-interna', "external" = true
WHERE "slug" = 'legal' AND "url" IS NULL;
