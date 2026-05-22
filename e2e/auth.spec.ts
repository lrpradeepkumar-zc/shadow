import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Shadow')).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/')
    await page.fill('[placeholder="you@example.com"]', 'bad@email.com')
    await page.fill('[placeholder="••••••••"]', 'wrongpass')
    await page.click('button[type="submit"]')
    await expect(page.locator('.text-red-500')).toBeVisible({ timeout: 5000 })
  })
})
