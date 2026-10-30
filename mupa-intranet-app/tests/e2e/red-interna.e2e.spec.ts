/**
 * Aplicaciones «Solo red interna» (SIGEX y Legal y Justicia): muestran su enlace de la intranet
 * actual junto a la etiqueta que avisa que solo abren dentro de la Alcaldía. Faro Interno no tiene
 * dirección conocida: sigue sin enlace.
 */
import { expect, test } from '@playwright/test'

test('SIGEX y Legal y Justicia llevan su enlace y la etiqueta «Solo red interna»', async ({ page }) => {
  await page.goto('/aplicaciones')
  const sigex = page.locator('.app-tile', { hasText: 'SIGEX' })
  await expect(sigex).toContainText('Solo red interna')
  await expect(sigex.getByRole('link')).toHaveAttribute('href', 'http://192.0.2.5/vigilanciaFiscal/')
  const legal = page.locator('.app-tile', { hasText: 'Legal y Justicia' })
  await expect(legal).toContainText('Solo red interna')
  await expect(legal.getByRole('link')).toHaveAttribute('href', 'http://192.0.2.14/tramites/index.php?signIn=1')
})
