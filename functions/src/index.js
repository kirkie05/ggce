const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onRequest } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret, defineString } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { FieldValue, getFirestore, Timestamp } = require('firebase-admin/firestore')
const crypto = require('node:crypto')
const { escapeHtml, passes, statusForPass, text, ticketId, ticketReference } = require('./domain')

initializeApp()
const db = getFirestore()
const resendKey = defineSecret('RESEND_API_KEY')
const publicSiteUrl = defineString('PUBLIC_SITE_URL', { default: 'https://example.com' })
const monitorAlertEmail = defineString('MONITOR_ALERT_EMAIL', { default: 'admin@example.com' })
const region = 'us-central1'
const analyticsEvents = new Set(['page_view', 'registration_view', 'form_started', 'details_completed', 'pass_selected', 'registration_completed'])

function requireAdmin(request) {
  if (!request.auth?.token?.admin) throw new HttpsError('permission-denied', 'Administrator access required.')
}
function requireTicketReference(value) {
  const id = ticketReference(value)
  if (!id) throw new HttpsError('invalid-argument', 'A valid ticket reference is required.')
  return id
}
function auditEntry(action, request, ticketIdValue = null, metadata = {}) {
  return {
    action,
    actorUid: request.auth.uid,
    actorEmail: text(request.auth.token.email, 180).toLowerCase(),
    ticketId: ticketIdValue,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 400 * 86400000),
  }
}
async function rateLimit(request, scope = 'registration', maximum = 8) {
  const ip = request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || 'unknown'
  const bucket = Math.floor(Date.now() / 60000)
  const key = crypto.createHash('sha256').update(`${scope}:${ip}:${bucket}`).digest('hex')
  const ref = db.collection('rateLimits').doc(key)
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const count = snap.exists ? snap.data().count : 0
    if (count >= maximum) throw new HttpsError('resource-exhausted', 'Too many requests. Try again shortly.')
    tx.set(ref, { count: count + 1, scope, expiresAt: Timestamp.fromMillis(Date.now() + 120000) }, { merge: true })
  })
}

async function sendEmail(to, subject, html) {
  const key = resendKey.value()
  if (!key || !to) return
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'GGCE <tickets@yourdomain.com>', to: [to], subject, html }),
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error('Email delivery failed', response.status, detail)
    return false
  }
  return true
}

exports.createRegistration = onCall({ region, secrets: [resendKey], enforceAppCheck: true }, async request => {
  await rateLimit(request, 'registration', 8)
  const data = request.data || {}; const pass = passes[text(data.passId, 40)]
  if (!pass) throw new HttpsError('invalid-argument', 'Select a valid pass.')
  const firstName = text(data.firstName, 60), lastName = text(data.lastName, 60), email = text(data.email, 180).toLowerCase()
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'Valid name and email are required.')
  if (data.consent !== true) throw new HttpsError('failed-precondition', 'Consent to essential event communications is required.')
  const id = ticketId(), status = statusForPass(text(data.passId, 40))
  const registration = {
    id, firstName, lastName, email, phone: text(data.phone, 40), country: text(data.country, 80),
    organisation: text(data.organisation, 120), role: text(data.role, 120), passId: text(data.passId, 40),
    passName: pass.name, amount: pass.price, status, sessionId: text(data.sessionId, 80),
    source: text(data.source, 100), campaign: text(data.campaign, 120),
    consent: true, consentVersion: '2026-10-30-v1.0', consentedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }
  const batch = db.batch(); batch.create(db.collection('registrations').doc(id), registration)
  if (status === 'valid') batch.create(db.collection('tickets').doc(id), { id, registrationId: id, status: 'valid', scannedAt: null, createdAt: FieldValue.serverTimestamp() })
  await batch.commit()
  const safeFirstName = escapeHtml(firstName)
  if (status === 'valid') await sendEmail(email, 'Your GGCE 2026 entry pass', `<h1>Registration confirmed</h1><p>Hello ${safeFirstName}, your ticket reference is <strong>${id}</strong>.</p><p>Open ${publicSiteUrl.value()}/?ticket=${id} to view your registration.</p>`)
  else await sendEmail(email, 'Your GGCE 2026 reservation', `<h1>Your place is reserved</h1><p>Hello ${safeFirstName}, use <strong>${id}</strong> as your payment reference. The GGCE team will send payment details shortly.</p>`)
  return { ...registration, createdAt: new Date().toISOString() }
})

exports.trackAnalyticsEvent = onCall({ region, enforceAppCheck: true }, async request => {
  await rateLimit(request, 'analytics', 120)
  const data = request.data || {}
  const name = text(data.name, 40), sessionId = text(data.sessionId, 80)
  if (!analyticsEvents.has(name) || !sessionId) throw new HttpsError('invalid-argument', 'Invalid analytics event.')
  await db.collection('analyticsEvents').add({
    name, sessionId, source: text(data.source, 100) || 'Direct', campaign: text(data.campaign, 120) || 'None',
    medium: text(data.medium, 80) || 'None', device: text(data.device, 30) || 'Unknown',
    path: text(data.path, 180), passId: text(data.passId, 40), createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 400 * 86400000),
  })
  return { tracked: true }
})

exports.adminGetAnalytics = onCall({ region, enforceAppCheck: true }, async request => {
  requireAdmin(request)
  const days = Math.min(Math.max(Number(request.data?.days) || 30, 1), 365)
  const cutoff = Timestamp.fromMillis(Date.now() - days * 86400000)
  const snap = await db.collection('analyticsEvents').where('createdAt', '>=', cutoff).limit(25000).get()
  const events = snap.docs.map(doc => doc.data())
  const unique = name => new Set(events.filter(event => !name || event.name === name).map(event => event.sessionId)).size
  const group = key => {
    const buckets = {}
    events.filter(event => event.name === 'page_view').forEach(event => { const label = event[key] || 'Unknown'; (buckets[label] ||= new Set()).add(event.sessionId) })
    return Object.entries(buckets).map(([label, sessions]) => ({ label, value: sessions.size })).sort((a, b) => b.value - a.value).slice(0, 8)
  }
  const funnel = ['page_view','registration_view','form_started','details_completed','pass_selected','registration_completed'].map(name => ({ name, sessions: unique(name) }))
  return { days, visitors: unique(), pageViews: events.filter(event => event.name === 'page_view').length, registrations: unique('registration_completed'), funnel, sources: group('source'), campaigns: group('campaign'), devices: group('device') }
})

exports.verifyTicket = onCall({ region, enforceAppCheck: true }, async request => {
  await rateLimit(request, request.auth?.token?.admin ? 'admin-verify' : 'public-verify', request.auth?.token?.admin ? 300 : 30)
  const id = requireTicketReference(request.data?.id)
  const registration = await db.collection('registrations').doc(id).get()
  if (!registration.exists) return { ticket: null }
  const row = registration.data()
  const isAdmin = Boolean(request.auth?.token?.admin)
  return { ticket: {
    id,
    firstName: isAdmin ? row.firstName : `${String(row.firstName || '').slice(0, 1)}.`,
    lastName: isAdmin ? row.lastName : `${String(row.lastName || '').slice(0, 1)}.`,
    passName: row.passName,
    status: row.status,
  } }
})

exports.adminListRegistrations = onCall({ region, enforceAppCheck: true }, async request => {
  requireAdmin(request)
  const snap = await db.collection('registrations').orderBy('createdAt', 'desc').limit(2000).get()
  return { registrations: snap.docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: doc.data().createdAt?.toDate?.().toISOString() || null })) }
})

exports.adminApprovePayment = onCall({ region, secrets: [resendKey], enforceAppCheck: true }, async request => {
  requireAdmin(request); const id = requireTicketReference(request.data?.id)
  const ref = db.collection('registrations').doc(id)
  const row = await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpsError('not-found', 'Registration not found.')
    const data = snap.data()
    if (data.status !== 'pending') throw new HttpsError('failed-precondition', 'Only pending reservations can be approved.')
    tx.update(ref, { status: 'valid', approvedAt: FieldValue.serverTimestamp(), approvedBy: request.auth.uid, updatedAt: FieldValue.serverTimestamp() })
    tx.set(db.collection('tickets').doc(id), { id, registrationId: id, status: 'valid', scannedAt: null, createdAt: FieldValue.serverTimestamp() }, { merge: true }); return data
  })
  await db.collection('adminAuditLogs').add(auditEntry('payment_approved', request, id, { previousStatus: row.status }))
  await sendEmail(row.email, 'Payment confirmed — your GGCE ticket is ready', `<h1>Your GGCE ticket is ready</h1><p>Hello ${escapeHtml(row.firstName)}, payment for <strong>${id}</strong> has been confirmed.</p><p>Open ${publicSiteUrl.value()}/?ticket=${id} to view your ticket.</p>`)
  return { id, status: 'valid' }
})

exports.adminMarkTicketUsed = onCall({ region, enforceAppCheck: true }, async request => {
  requireAdmin(request); const id = requireTicketReference(request.data?.id)
  const ticketRef = db.collection('tickets').doc(id)
  const registrationRef = db.collection('registrations').doc(id)
  await db.runTransaction(async tx => {
    const [ticket, registration] = await Promise.all([tx.get(ticketRef), tx.get(registrationRef)])
    if (!ticket.exists || !registration.exists) throw new HttpsError('not-found', 'Ticket not found.')
    if (ticket.data().status === 'used' || ticket.data().scannedAt) throw new HttpsError('already-exists', 'Ticket has already been checked in.')
    if (ticket.data().status !== 'valid' || registration.data().status !== 'valid') throw new HttpsError('failed-precondition', 'Only valid tickets can be checked in.')
    tx.update(ticketRef, { scannedAt: FieldValue.serverTimestamp(), scannedBy: request.auth.uid, status: 'used' })
    tx.update(registrationRef, { status: 'used', updatedAt: FieldValue.serverTimestamp() })
    tx.set(db.collection('adminAuditLogs').doc(), auditEntry('ticket_checked_in', request, id))
  })
  return { id, status: 'used' }
})

exports.adminRevokeTicket = onCall({ region, enforceAppCheck: true }, async request => {
  requireAdmin(request)
  const id = requireTicketReference(request.data?.id)
  const registrationRef = db.collection('registrations').doc(id)
  const ticketRef = db.collection('tickets').doc(id)
  await db.runTransaction(async tx => {
    const registration = await tx.get(registrationRef)
    if (!registration.exists) throw new HttpsError('not-found', 'Registration not found.')
    tx.update(registrationRef, { status: 'revoked', revokedAt: FieldValue.serverTimestamp(), revokedBy: request.auth.uid, updatedAt: FieldValue.serverTimestamp() })
    tx.set(ticketRef, { id, registrationId: id, status: 'revoked', revokedAt: FieldValue.serverTimestamp(), revokedBy: request.auth.uid }, { merge: true })
    tx.set(db.collection('adminAuditLogs').doc(), auditEntry('ticket_revoked', request, id, { previousStatus: registration.data().status }))
  })
  return { id, status: 'revoked' }
})

exports.setAdminClaim = onCall({ region, enforceAppCheck: true }, async request => {
  // Bootstrap is allowed only for an existing admin; use the Firebase CLI/Admin SDK for the first administrator.
  requireAdmin(request); const uid = text(request.data?.uid, 128); if (!/^[A-Za-z0-9_-]{20,128}$/.test(uid)) throw new HttpsError('invalid-argument', 'Valid user UID required.')
  const user = await getAuth().getUser(uid)
  await getAuth().setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true })
  await db.collection('adminAuditLogs').add(auditEntry('admin_claim_granted', request, null, { targetUid: uid }))
  return { uid, admin: true }
})

exports.health = onRequest({ region }, async (_request, response) => {
  try {
    await db.collection('_system').doc('siteMonitor').get()
    response.status(200).json({ ok: true, service: 'ggce-registration', timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Health endpoint failed', error)
    response.status(503).json({ ok: false })
  }
})

exports.monitorSiteHealth = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Africa/Lagos', region, secrets: [resendKey] }, async () => {
  const url = publicSiteUrl.value().replace(/\/$/, '')
  const monitorRef = db.collection('_system').doc('siteMonitor')
  let ok = false, detail = ''
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'GGCE-Health-Monitor/1.0' } })
    const body = await response.text()
    ok = response.ok && /GGCE|Gold.{0,5}Gem/i.test(body)
    detail = ok ? `HTTP ${response.status}` : `Unexpected response: HTTP ${response.status}`
  } catch (error) { detail = error.message }

  const previous = (await monitorRef.get()).data() || {}
  const failures = ok ? 0 : (previous.consecutiveFailures || 0) + 1
  const status = ok ? 'up' : failures >= 2 ? 'down' : 'checking'
  await monitorRef.set({ status, consecutiveFailures: failures, detail, checkedAt: FieldValue.serverTimestamp(), url }, { merge: true })

  if (status === 'down' && previous.status !== 'down') {
    await sendEmail(monitorAlertEmail.value(), 'GGCE website outage detected', `<h1>GGCE website may be down</h1><p>Two consecutive checks failed for <strong>${url}</strong>.</p><p>${detail}</p><p>Detected at ${new Date().toISOString()}.</p>`)
  }
  if (ok && previous.status === 'down') {
    await sendEmail(monitorAlertEmail.value(), 'GGCE website has recovered', `<h1>GGCE website is back online</h1><p><strong>${url}</strong> responded successfully.</p><p>Recovered at ${new Date().toISOString()}.</p>`)
  }
})
