const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const fs = require('node:fs')
const path = require('node:path')

initializeApp()
const db = getFirestore()
const resendKey = defineSecret('RESEND_API_KEY')
const region = 'us-central1'
const bookPath = path.join(__dirname, 'assets', 'The Million Naira Opportunity.pdf')
const filename = 'The Million Naira Opportunity - GGCE Lagos 2026.pdf'

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
}

function validRegistrationId(value = '') {
  const id = String(value).trim().toUpperCase()
  return /^GGCE26-[A-F0-9]{14}$/.test(id) ? id : null
}

async function sendBook(registration, registrationId) {
  const key = resendKey.value()
  if (!key) throw new Error('RESEND_API_KEY is unavailable.')
  const book = fs.readFileSync(bookPath).toString('base64')
  const firstName = escapeHtml(registration.firstName)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `ggce-book-${registrationId}`,
    },
    body: JSON.stringify({
      from: 'GGCE Lagos <tickets@ggcelagos.com>',
      to: [registration.email],
      subject: 'Your complimentary GGCE book is here',
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17140d"><p style="color:#9a7427;font-weight:700;letter-spacing:2px">GGCE LAGOS 2026</p><h1>The Million Naira Opportunity</h1><p>Hello ${firstName},</p><p>Thank you for registering for GGCE Lagos 2026. Your complimentary digital publication is attached to this email.</p><p>It explores practical opportunities across Nigeria's gold, gemstone and jewellery economy, whether or not you own a mine.</p><p><strong>Registration reference:</strong> ${registrationId}</p><p>We look forward to welcoming you in Lagos.</p></div>`,
      attachments: [{ filename, content: book }],
    }),
  })
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`)
  return response.json()
}

exports.sendRegistrationBook = onDocumentCreated({
  document: 'registrations/{registrationId}', region, secrets: [resendKey], retry: true,
}, async event => {
  const registration = event.data?.data()
  const registrationId = validRegistrationId(event.params.registrationId)
  if (!registrationId || !registration?.email) return
  const deliveryRef = db.collection('bookDeliveries').doc(registrationId)
  const existing = await deliveryRef.get()
  if (existing.data()?.status === 'sent') return
  try {
    const result = await sendBook(registration, registrationId)
    await deliveryRef.set({ status: 'sent', emailId: result.id || null, sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  } catch (error) {
    await deliveryRef.set({ status: 'failed', error: String(error.message).slice(0, 500), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    throw error
  }
})

exports.downloadBook = onRequest({ region, invoker: 'public', cors: false, timeoutSeconds: 30, memory: '256MiB' }, async (request, response) => {
  response.set('X-Content-Type-Options', 'nosniff')
  response.set('Cache-Control', 'private, no-store, max-age=0')
  if (request.method !== 'GET') return response.status(405).send('Method not allowed.')
  const registrationId = validRegistrationId(request.query.registration)
  if (!registrationId) return response.status(400).send('A valid registration reference is required.')
  const registration = await db.collection('registrations').doc(registrationId).get()
  if (!registration.exists) return response.status(404).send('Registration not found.')
  response.set('Content-Type', 'application/pdf')
  response.set('Content-Disposition', `attachment; filename="${filename}"`)
  return fs.createReadStream(bookPath).pipe(response)
})

exports._test = { escapeHtml, validRegistrationId }
