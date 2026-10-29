import { expect, test } from '@playwright/test'

test('landing page, registration form and privacy notice render', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Building Africa’s golden future.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register in minutes.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How registration and journey data is used.' })).toBeVisible()
})

test('registration communications consent is explicit and initially unchecked', async ({ page }) => {
  await page.goto('/#register')
  await page.getByLabel('First name *').fill('Automated')
  await page.getByLabel('Last name *').fill('Test')
  await page.getByLabel(/Email address/).fill('automation@example.com')
  await page.getByRole('button', { name: 'Choose your pass' }).click()
  const consent = page.locator('input[type="checkbox"]')
  await expect(consent).not.toBeChecked()
  await expect(page.getByText(/essential registration, payment and ticket updates/)).toBeVisible()
})

test('invalid ticket reference is rejected without exposing attendee data', async ({ page }) => {
  await page.goto('/?ticket=GGCE26-00000000000000')
  await expect(page.getByText('Pass not found')).toBeVisible()
  await expect(page.getByAltText('Scannable ticket QR code')).toHaveCount(0)
})

test('admin route presents Firebase administrator authentication', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
})
