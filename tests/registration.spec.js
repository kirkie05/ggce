import { expect, test } from '@playwright/test'

async function saveContact(page, path = '/#register') {
  await page.goto(path)
  const form = page.locator('#register, #investment-register')
  await form.getByLabel('First name *', { exact: true }).fill('Ada')
  await form.getByLabel('Last name *', { exact: true }).fill('Okafor')
  await form.getByLabel('Email address *', { exact: true }).fill('ada@example.com')
  await form.getByLabel('Phone with country code *', { exact: true }).fill('+2348001234567')
  await form.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(form.getByRole('status')).toHaveText('Your contact details have been saved.')
  return form
}
async function confirmRegistration(page, form) {
  await form.getByLabel('Professional category *').selectOption('Student / Job Seeker')
  await form.locator('label.check').filter({ hasText: 'I agree to receive my complimentary event publication' }).click()
  await expect(form.getByLabel(/I agree to receive my complimentary event publication/)).toBeChecked()
  await form.getByRole('button', { name: 'Confirm registration', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re on the list.' })).toBeVisible()
}

for (const path of ['/', '/masterclasses', '/opportunities', '/industry-networking', '/special-attendees/rccg', '/#investments']) {
  test(`${path} captures contact details before showing attendance prices`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('.pass-options')).toHaveCount(0)
    await expect(page.getByText(/₦[\d,]+/)).toHaveCount(0)
    await saveContact(page, path)
    const contacts = await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registration-contacts-v1')))
    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({ firstName: 'Ada', lastName: 'Okafor', email: 'ada@example.com', phone: '+2348001234567', status: 'incomplete' })
    await page.reload()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registration-contacts-v1'))[0].email)).toBe('ada@example.com')
  })
}

test('free attendance issues a ticket and completes the saved contact', async ({ page }) => {
  const form = await saveContact(page)
  await confirmRegistration(page, form)
  await expect(page.getByAltText('Scannable ticket QR code')).toBeVisible()
  const contact = await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registration-contacts-v1'))[0])
  expect(contact.status).toBe('completed')
  expect(contact.registrationId).toMatch(/^GGCE26-[A-F0-9]{14}$/)
})

test('paid attendance creates a reservation without issuing a QR ticket', async ({ page }) => {
  const form = await saveContact(page)
  await form.getByRole('button', { name: /Premium VIP/ }).click()
  await confirmRegistration(page, form)
  await expect(page.getByText('Reserved · Awaiting payment')).toBeVisible()
  await expect(page.getByAltText('Scannable ticket QR code')).toHaveCount(0)
  const registration = await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registrations-v1'))[0])
  expect(registration).toMatchObject({ passId: 'vip', amount: 250000, status: 'pending' })
})

for (const choice of ['Sponsored Masterclass', 'General Admission']) {
  test(`RCCG ${choice} is free and issues a valid pass`, async ({ page }) => {
    const form = await saveContact(page, '/special-attendees/rccg#register')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('.pass-options .pass-card')).toHaveCount(2)
    await form.getByRole('button', { name: new RegExp(choice) }).click()
    await confirmRegistration(page, form)
    await expect(page.getByAltText('Scannable ticket QR code')).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registrations-v1'))[0])).toMatchObject({ audience: 'rccg', amount: 0, status: 'valid' })
    await page.goto('/admin')
    await page.getByLabel('Development PIN').fill('2600')
    await page.getByRole('button', { name: /Access dashboard/ }).click()
    await expect(page.locator('.analytics-kpis article').filter({ hasText: 'Free registrations' }).locator('strong')).toHaveText('1')
    await expect(page.locator('.analytics-kpis article').filter({ hasText: 'Paid-program leads' }).locator('strong')).toHaveText('0')
  })
}

test('special attendees page is not linked on the public homepage', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href*="special-attendees"], a[href*="rccg"]')).toHaveCount(0)
})

test('editing contact details updates the original saved lead', async ({ page }) => {
  const form = await saveContact(page)
  await form.getByRole('button', { name: 'Edit', exact: true }).click()
  await form.getByLabel('First name *', { exact: true }).fill('Ada updated')
  await form.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(form.getByRole('status')).toBeVisible()
  const contacts = await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registration-contacts-v1')))
  expect(contacts).toHaveLength(1)
  expect(contacts[0].firstName).toBe('Ada updated')
})

test('admin can see captured contacts even when registration is abandoned', async ({ page }) => {
  await saveContact(page)
  await page.goto('/admin')
  await page.getByLabel('Development PIN').fill('2600')
  await page.getByRole('button', { name: /Access dashboard/ }).click()
  const contacts = page.locator('#contacts')
  await expect(contacts.getByText('ada@example.com')).toBeVisible()
  await expect(contacts.getByText('Contact saved', { exact: true })).toBeVisible()
})

test('investment registration also completes its saved contact', async ({ page }) => {
  const form = await saveContact(page, '/#investments')
  await form.getByLabel('Executive category *').selectOption('Investor')
  await form.locator('label.check').filter({ hasText: 'I agree to essential registration communications' }).click()
  await expect(form.getByLabel(/I agree to essential registration communications/)).toBeChecked()
  await form.getByRole('button', { name: 'Complete registration' }).click()
  await expect(form.getByRole('heading', { name: 'Your registration is confirmed.' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ggce-registration-contacts-v1'))[0].status)).toBe('completed')
})

test('a failed contact save keeps the first screen and offers a retry', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key === 'ggce-registration-contacts-v1') throw new Error('Unable to save contact. Please try again.')
      return original.call(this, key, value)
    }
  })
  await page.goto('/#register')
  await page.getByLabel('First name *', { exact: true }).fill('Ada')
  await page.getByLabel('Last name *', { exact: true }).fill('Okafor')
  await page.getByLabel('Email address *', { exact: true }).fill('ada@example.com')
  await page.getByLabel('Phone with country code *', { exact: true }).fill('+2348001234567')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Unable to save contact. Please try again.')
  await expect(page.locator('.pass-options')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
})
