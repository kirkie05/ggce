import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'
import { getPrivacyChoice, setPrivacyChoice } from './analytics'

export const privacySettingsEvent = 'ggce-open-privacy-settings'

export default function CookieConsent() {
  const [open, setOpen] = useState(() => !getPrivacyChoice())
  useEffect(() => {
    const show = () => setOpen(true)
    addEventListener(privacySettingsEvent, show)
    return () => removeEventListener(privacySettingsEvent, show)
  }, [])
  if (!open) return null
  const choose = analytics => { setPrivacyChoice(analytics); setOpen(false) }
  return <section className="consent-banner" role="dialog" aria-modal="true" aria-labelledby="consent-title">
    <button className="consent-close" onClick={() => choose(false)} aria-label="Use essential storage only"><X/></button>
    <div className="consent-icon"><Cookie/></div><div><span className="kicker">YOUR PRIVACY CHOICE</span><h2 id="consent-title">Essential service. Optional analytics.</h2><p>We use essential browser storage for registration and security. With your permission, privacy-conscious journey analytics helps us understand where visitors leave registration. No advertising cookies.</p><a href="/legal/cookies">Read the Cookie & Storage Notice</a></div>
    <div className="consent-actions"><button onClick={() => choose(false)}>Essential only</button><button className="accept" onClick={() => choose(true)}>Accept analytics</button></div>
  </section>
}
