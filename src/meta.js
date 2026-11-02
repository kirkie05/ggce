import { analyticsAllowed } from './analytics'

const pixelId = import.meta.env.VITE_META_PIXEL_ID
let loaded = false

function loadPixel() {
  if (!pixelId || !analyticsAllowed() || loaded) return false
  loaded = true
  if (!window.fbq) {
    const fbq = function(){ fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments) }
    fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; window.fbq = fbq
    const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script)
  }
  window.fbq('init', pixelId)
  return true
}

export function metaEvent(name, properties = {}, eventId) {
  if (!loadPixel()) return
  window.fbq('track', name, properties, eventId ? { eventID: eventId } : undefined)
}

export function metaCustomEvent(name, properties = {}) {
  if (!loadPixel()) return
  window.fbq('trackCustom', name, properties)
}

export function newEventId(prefix = 'event') { return `${prefix}-${crypto.randomUUID()}` }
