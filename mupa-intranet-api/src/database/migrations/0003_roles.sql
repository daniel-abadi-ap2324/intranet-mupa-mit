-- El rol "editorApps" se fusiona con admin: solo administración edita el catálogo.
-- Quien lo tenía pierde ese rol; si se queda sin ninguno, queda como funcionario (menor privilegio).
UPDATE "users" SET "roles" = array_remove("roles", 'editorApps') WHERE 'editorApps' = ANY("roles");--> statement-breakpoint
UPDATE "users" SET "roles" = ARRAY['funcionario']::text[] WHERE cardinality("roles") = 0;--> statement-breakpoint
-- La cuenta ficticia de ese rol ya no existe en el seed.
DELETE FROM "users" WHERE "email" = 'apps@ejemplo.test' AND "identity_sub" IS NULL;
