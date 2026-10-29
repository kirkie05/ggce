import { trackAnalyticsEvent } from './registrationService'

const sessionKey = 'ggce-visitor-session'
const attributionKey = 'ggce-visitor-attribution'

function sourceFromReferrer(referrer) {
  if (!referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(host)) return 'Search'
    if (/instagram\.|facebook\.|t\.co$|twitter\.|linkedin\.|tiktok\./.test(host)) return 'Social'
    if (/whatsapp\.|wa\.me$/.test(host)) return 'WhatsApp'
    if (host === location.hostname) return 'Internal'
    return host.replace(/^www\./, '')
  } catch { return 'Other' }
}

export function analyticsContext() {
  let sessionId = sessionStorage.getItem(sessionKey)
  if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(sessionKey, sessionId) }
  let attribution
  try { attribution = JSON.parse(localStorage.getItem(attributionKey) || 'null') } catch { attribution = null }
  if (!attribution) {
    const params = new URLSearchParams(location.search)
    attribution = {
      source: params.get('utm_source') || sourceFromReferrer(document.referrer),
      medium: params.get('utm_medium') || (document.referrer ? 'referral' : 'none'),
      campaign: params.get('utm_campaign') || 'None',
    }
    localStorage.setItem(attributionKey, JSON.stringify(attribution))
  }
  const device = matchMedia('(max-width: 680px)').matches ? 'Mobile' : matchMedia('(max-width: 1050px)').matches ? 'Tablet' : 'Desktop'
  return { sessionId, ...attribution, device, path: `${location.pathname}${location.hash}` }
}

export function trackJourney(name, properties = {}, once = true) {
  const context = analyticsContext()
  const marker = `ggce-event-${context.sessionId}-${name}`
  if (once && sessionStorage.getItem(marker)) return
  if (once) sessionStorage.setItem(marker, '1')
  trackAnalyticsEvent({ name, ...context, ...properties }).catch(() => {
    if (once) sessionStorage.removeItem(marker)
  })
}
