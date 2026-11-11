import { expect, test } from '@playwright/test'

test('conversion landing page presents free access, date, venue and contact-first registration', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Discover opportunities in Africa/ })).toBeVisible()
  await expect(page.getByText('Free exhibition access available')).toBeVisible()
  await expect(page.getByText('24–28 November 2026', { exact: true })).toBeVisible()
  await expect(page.getByText('Lagos Oriental Hotel')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register in minutes.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible()
})

test('registration communications consent is explicit and initially unchecked', async ({ page }) => {
  await page.goto('/#register')
  await page.getByLabel('First name *').fill('Automated')
  await page.getByLabel('Last name *').fill('Test')
  await page.getByLabel(/Email address/).fill('automation@example.com')
  await page.getByLabel('Phone with country code *').fill('+2348001234567')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const consent = page.getByLabel(/I agree to receive my complimentary event publication/)
  await expect(consent).not.toBeChecked()
  await expect(page.getByText(/essential registration, payment and ticket updates/)).toBeVisible()
})

test('book offer is visible and gated behind event registration', async ({ page }) => {
  await page.goto('/#book')
  await expect(page.getByRole('heading', { name: /million-naira opportunity/ })).toBeVisible()
  await expect(page.getByAltText(/The Million Naira Opportunity/)).toBeVisible()
  await expect(page.getByText('Available to registered attendees')).toBeVisible()
  await page.getByRole('link', { name: /Register and get the free book/ }).click()
  await expect(page.locator('#register')).toBeInViewport()
  await expect(page.getByRole('heading', { name: 'Register in minutes.' })).toBeVisible()
})

test('campaign landing pages preserve focused messaging and registration route', async ({ page }) => {
  await page.goto('/masterclasses')
  await expect(page.getByRole('heading', { name: /practical learning opportunities/ })).toBeVisible()
  await page.locator('.hero-actions').getByRole('link', { name: /Register for GGCE 2026/ }).click()
  await expect(page.locator('#register')).toBeInViewport()
})

test('contact form fits without horizontal page overflow', async ({ page }) => {
  await page.goto('/#register')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  await expect(page.getByLabel('First name *')).toBeVisible()
})

test('invalid ticket reference is rejected without exposing attendee data', async ({ page }) => {
  await page.goto('/?ticket=GGCE26-00000000000000')
  await expect(page.getByText('Pass not found')).toBeVisible()
  await expect(page.getByAltText('Scannable ticket QR code')).toHaveCount(0)
})

test('admin route presents administrator authentication', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect(page.getByText(/Enter the development PIN|Sign in with your authorised Firebase/)).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
