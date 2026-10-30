import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pruebas de las reglas compartidas (lib/): no necesitan navegador ni backend.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
