const crypto = require('node:crypto')

const passes = {
  general: { name: 'General Admission', price: 0 },
  delegate: { name: 'Standard Networking', price: 150000 },
  vip: { name: 'Premium VIP', price: 250000 },
  gala: { name: 'Gala Dinner', price: 75000 },
  'gala-standard-table': { name: 'Gala Table · Standard', price: 1000000 },
  'gala-premium-table': { name: 'Gala Table · Premium', price: 1500000 },
}

function text(value, max = 160) { return String(value || '').trim().slice(0, max) }
function normalizeEmail(value) { return text(value, 180).toLowerCase() }
function normalizePhone(value) { return text(value, 40).replace(/[^+\d]/g, '').replace(/^00/, '+') }
function lookupKey(type, value) { return crypto.createHash('sha256').update(`${type}:${value}`).digest('hex') }
function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character])
}
function ticketId() { return `GGCE26-${crypto.randomBytes(7).toString('hex').toUpperCase()}` }
function ticketReference(value) {
  const normalized = text(value, 32).toUpperCase()
  return /^GGCE26-[A-F0-9]{14}$/.test(normalized) ? normalized : null
}
function statusForPass(passId) { return passes[passId]?.price === 0 ? 'valid' : passes[passId] ? 'pending' : null }

function registrationPass(passId, audience) {
  if (audience === 'rccg') {
    if (passId === 'rccg-masterclass') return { name: 'RCCG Sponsored Masterclass', price: 0 }
    return passId === 'general' ? passes.general : null
  }
  return Object.hasOwn(passes, passId) ? passes[passId] : null
}

function contactDetails(data = {}) {
  const firstName = text(data.firstName, 60), lastName = text(data.lastName, 60)
  const email = normalizeEmail(data.email), phone = normalizePhone(data.phone)
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !/^\+?\d{8,15}$/.test(phone)) return null
  return { firstName, lastName, email, phone }
}

module.exports = { contactDetails, registrationPass, escapeHtml, lookupKey, normalizeEmail, normalizePhone, passes, statusForPass, text, ticketId, ticketReference }
