-- Accesos rápidos por defecto (las aplicaciones destacadas), en las bases ya cargadas:
-- entran las solicitudes de WIFI y de código de llamadas, como en el Inicio de la
-- intranet actual, y sale el formulario de pago por ACH (sigue en el catálogo y en RRHH).
UPDATE "applications" SET "featured" = true WHERE "slug" IN ('cdr', 'wifi');
--> statement-breakpoint
UPDATE "applications" SET "featured" = false WHERE "slug" = 'ach';
--> statement-breakpoint
-- El PDF del ACH ya está copiado en la intranet: nada de enlaces a la intranet vieja.
-- (La URL es única: si ya existe la copia local, se deja como está.)
UPDATE "applications" SET "url" = '/sitio/2023/01/Afiliacion_a_Pagos_por_ACH_Funcionarios.pdf', "external" = false
WHERE "slug" = 'ach' AND "url" LIKE '%intranet.mupa.gob.pa/wp-content/uploads/2023/01/Afiliacion_a_Pagos_por_ACH_Funcionarios.pdf'
  AND NOT EXISTS (SELECT 1 FROM "applications" AS "otra" WHERE "otra"."url" = '/sitio/2023/01/Afiliacion_a_Pagos_por_ACH_Funcionarios.pdf');
--> statement-breakpoint
-- Soporte ISTMO abre la página de la intranet (guías, video y contacto), que lleva al portal del MEF.
UPDATE "applications" SET "url" = '/sap-istmo', "external" = false
WHERE "slug" = 'istmo' AND "url" = 'https://caudnc.mef.gob.pa'
  AND NOT EXISTS (SELECT 1 FROM "applications" AS "otra" WHERE "otra"."url" = '/sap-istmo');
