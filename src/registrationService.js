import { httpsCallable } from 'firebase/functions'
import { auth, firebaseConfigured, functions } from './firebase'

const storageKey = 'ggce-registrations-v1'
const analyticsKey = 'ggce-analytics-v1'
const devFallback = import.meta.env.DEV && !firebaseConfigured

function localRows() { return JSON.parse(localStorage.getItem(storageKey) || '[]') }
function saveLocal(rows) { localStorage.setItem(storageKey, JSON.stringify(rows)); window.dispatchEvent(new Event('ggce-local-update')) }

export async function createRegistration(payload) {
  if (functions) return (await httpsCallable(functions, 'createRegistration')(payload)).data
  if (!devFallback) throw new Error('Registration service is not configured.')
  const id = `GGCE26-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
  const entry = { ...payload, id, status: payload.passId === 'general' ? 'valid' : 'pending', createdAt: new Date().toISOString() }
  saveLocal([entry, ...localRows()]); return entry
}

export async function listRegistrations() {
  if (functions) return (await httpsCallable(functions, 'adminListRegistrations')({})).data.registrations
  if (!devFallback) throw new Error('Admin service is not configured.')
  return localRows()
}

export async function approveRegistration(id) {
  if (functions) return (await httpsCallable(functions, 'adminApprovePayment')({ id })).data
  if (!devFallback) throw new Error('Admin service is not configured.')
  const rows = localRows().map(row => row.id === id ? { ...row, status: 'valid', approvedAt: new Date().toISOString() } : row)
  saveLocal(rows); return rows.find(row => row.id === id)
}

export async function verifyRegistration(raw) {
  const id = raw.includes('ticket=') ? new URL(raw).searchParams.get('ticket') : raw.trim()
  if (functions) return (await httpsCallable(functions, 'verifyTicket')({ id })).data.ticket
  if (!devFallback) throw new Error('Verification service is not configured.')
  return localRows().find(row => row.id.toLowerCase() === String(id || '').toLowerCase()) || null
}

export async function markTicketUsed(id) {
  if (functions) return (await httpsCallable(functions, 'adminMarkTicketUsed')({ id })).data
  if (!devFallback) throw new Error('Check-in service is not configured.')
  const rows = localRows().map(row => row.id === id ? { ...row, status: 'used', scannedAt: new Date().toISOString() } : row)
  saveLocal(rows); return rows.find(row => row.id === id)
}

export async function revokeTicket(id) {
  if (functions) return (await httpsCallable(functions, 'adminRevokeTicket')({ id })).data
  if (!devFallback) throw new Error('Ticket service is not configured.')
  const rows = localRows().map(row => row.id === id ? { ...row, status: 'revoked', revokedAt: new Date().toISOString() } : row)
  saveLocal(rows); return rows.find(row => row.id === id)
}

export async function trackAnalyticsEvent(payload) {
  if (functions) return (await httpsCallable(functions, 'trackAnalyticsEvent')(payload)).data
  if (!devFallback) return
  const events = JSON.parse(localStorage.getItem(analyticsKey) || '[]')
  events.push({ ...payload, createdAt: new Date().toISOString() })
  localStorage.setItem(analyticsKey, JSON.stringify(events.slice(-5000)))
}

export async function getAdminAnalytics(days = 30) {
  if (functions) return (await httpsCallable(functions, 'adminGetAnalytics')({ days })).data
  if (!devFallback) throw new Error('Analytics service is not configured.')
  const cutoff = Date.now() - days * 86400000
  const events = JSON.parse(localStorage.getItem(analyticsKey) || '[]').filter(event => new Date(event.createdAt).getTime() >= cutoff)
  const unique = name => new Set(events.filter(event => !name || event.name === name).map(event => event.sessionId)).size
  const group = key => {
    const buckets = {}
    events.filter(event => event.name === 'page_view').forEach(event => { const label = event[key] || 'Unknown'; (buckets[label] ||= new Set()).add(event.sessionId) })
    return Object.entries(buckets).map(([label, sessions]) => ({ label, value: sessions.size })).sort((a,b) => b.value-a.value).slice(0, 8)
  }
  const funnel = ['page_view','registration_view','form_started','details_completed','pass_selected','registration_completed'].map(name => ({ name, sessions: unique(name) }))
  return { days, visitors: unique(), pageViews: events.filter(e => e.name === 'page_view').length, registrations: unique('registration_completed'), funnel, sources: group('source'), campaigns: group('campaign'), devices: group('device') }
}

export function useLocalDevelopmentBackend() { return devFallback }
export { auth }
