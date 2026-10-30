import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit: `npm run db:generate` compara el esquema (src/database/schema)
 * con la última migración y escribe la siguiente en src/database/migrations.
 * Las migraciones se aplican con `npm run db:migrate` (o el servicio `migrate` de Docker).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  strict: true,
  verbose: true,
})
