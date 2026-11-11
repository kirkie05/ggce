const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

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
  const investmentForum = registration.passId === 'investment'
  const forumDetails = investmentForum ? `<div style="margin:24px 0;padding:18px;background:#f7f0dc;border-left:4px solid #bd963d"><strong>GGCE Investment Forum</strong><br>Wednesday, 25 November 2026 · 4:00 PM<br>Ballroom, Lagos Oriental Hotel, Lekki</div>` : ''
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
      subject: investmentForum ? 'Your GGCE Investment Forum registration' : 'Your complimentary GGCE book is here',
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17140d"><p style="color:#9a7427;font-weight:700;letter-spacing:2px">GGCE LAGOS 2026</p><h1>${investmentForum ? 'Investment Forum registration confirmed' : 'The Million Naira Opportunity'}</h1><p>Hello ${firstName},</p><p>${investmentForum ? 'Your registration for the GGCE Investment Forum has been confirmed.' : 'Thank you for registering for GGCE Lagos 2026.'} Your complimentary digital publication is attached to this email.</p>${forumDetails}<p>It explores practical opportunities across Nigeria's gold, gemstone and jewellery economy, whether or not you own a mine.</p><p><strong>Registration reference:</strong> ${registrationId}</p><p>We look forward to welcoming you in Lagos.</p></div>`,
      attachments: [{ filename, content: book }],
    }),
  })
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`)
  return response.json()
}

function cleanText(value, max = 120) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max)
}

function normalizeEmail(value) { return cleanText(value, 180).toLowerCase() }
function normalizePhone(value) { return cleanText(value, 40).replace(/[^\d+]/g, '') }
function lookupHash(type, value) { return crypto.createHash('sha256').update(`${type}:${value}`).digest('hex') }
function newRegistrationId() { return `GGCE26-${crypto.randomBytes(7).toString('hex').toUpperCase()}` }

async function enforceRegistrationRateLimit(request) {
  const forwarded = request.rawRequest?.headers?.['x-forwarded-for']
  const ip = cleanText(Array.isArray(forwarded) ? forwarded[0] : String(forwarded || request.rawRequest?.ip || 'unknown').split(',')[0], 80)
  const window = Math.floor(Date.now() / 60000)
  const ref = db.collection('rateLimits').doc(lookupHash('investment', `${ip}:${window}`))
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref)
    const count = Number(snapshot.data()?.count || 0)
    if (count >= 8) throw new HttpsError('resource-exhausted', 'Too many attempts. Please wait a minute and try again.')
    transaction.set(ref, { count:count + 1, expiresAt:new Date(Date.now() + 10 * 60000), updatedAt:FieldValue.serverTimestamp() }, { merge:true })
  })
}

exports.registerInvestmentForum = onCall({ region, invoker:'public', enforceAppCheck:true }, async request => {
  await enforceRegistrationRateLimit(request)
  const data = request.data || {}
  const firstName = cleanText(data.firstName, 70)
  const lastName = cleanText(data.lastName, 70)
  const email = normalizeEmail(data.email)
  const phone = normalizePhone(data.phone)
  const professionalCategory = cleanText(data.professionalCategory, 80)
  if (!firstName || !lastName) throw new HttpsError('invalid-argument', 'First and last name are required.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.')
  if (!/^\+?\d{8,16}$/.test(phone)) throw new HttpsError('invalid-argument', 'Enter a valid phone number with country code.')
  if (!professionalCategory) throw new HttpsError('invalid-argument', 'Select a professional category.')
  if (data.consent !== true) throw new HttpsError('failed-precondition', 'Registration consent is required.')

  const emailLookup = db.collection('registrationLookup').doc(lookupHash('email', email))
  const phoneLookup = db.collection('registrationLookup').doc(lookupHash('phone', phone))
  const id = newRegistrationId()
  const registrationRef = db.collection('registrations').doc(id)
  const ticketRef = db.collection('tickets').doc(id)
  const contactId = validRegistrationId(data.contactId)
  const contactRef = contactId ? db.collection('registrationLeads').doc(contactId) : null
  const contactHash = crypto.createHash('sha256').update(cleanText(data.contactToken, 80)).digest('hex')
  const createdAt = new Date().toISOString()
  const registration = {
    id, firstName, lastName, email, phone,
    organisation:cleanText(data.organisation, 140), role:cleanText(data.role, 100), country:cleanText(data.country, 80) || 'Nigeria', professionalCategory,
    interests:['Investment Forum'], passId:'investment', passName:'Investment Forum Invitation', amount:0, status:'valid', leadStatus:'New',
    consent:true, consentVersion:'2026-11-03', consentAt:FieldValue.serverTimestamp(), marketingConsent:data.marketingConsent === true,
    source:cleanText(data.source, 120), medium:cleanText(data.medium, 120), campaign:cleanText(data.campaign, 120), referrer:cleanText(data.referrer, 500), landingPage:cleanText(data.landingPage, 500),
    createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(), eventId:cleanText(data.eventId, 120), registrationType:'investment-forum', eventDate:'2026-11-25T16:00:00+01:00',
  }
  await db.runTransaction(async transaction => {
    const [emailMatch, phoneMatch] = await Promise.all([transaction.get(emailLookup), transaction.get(phoneLookup)])
    const contact = contactRef ? await transaction.get(contactRef) : null
    if (contactRef && (!contact.exists || contact.data().tokenHash !== contactHash || contact.data().email !== email)) throw new HttpsError('permission-denied', 'Save your contact details again before registering.')
    if (emailMatch.exists || phoneMatch.exists) throw new HttpsError('already-exists', 'A registration already exists for this email address or phone number.')
    transaction.create(registrationRef, registration)
    if (contactRef) transaction.update(contactRef, { status:'completed', registrationId:id, updatedAt:FieldValue.serverTimestamp() })
    transaction.create(ticketRef, { registrationId:id, status:'valid', passId:'investment', createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() })
    transaction.create(emailLookup, { registrationId:id, type:'email', createdAt:FieldValue.serverTimestamp() })
    transaction.create(phoneLookup, { registrationId:id, type:'phone', createdAt:FieldValue.serverTimestamp() })
  })
  return { ...registration, consentAt:createdAt, createdAt, updatedAt:createdAt }
})

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

exports._test = { cleanText, escapeHtml, newRegistrationId, normalizeEmail, normalizePhone, validRegistrationId }
