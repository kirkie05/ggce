import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  getMultiFactorResolver, multiFactor, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  TotpMultiFactorGenerator,
} from 'firebase/auth'
import { approveRegistration, auth, createRegistration, getAdminAnalytics, listRegistrations, markTicketUsed, revokeTicket, updateRegistration, useLocalDevelopmentBackend, verifyRegistration } from './registrationService'
import { analyticsContext, trackJourney } from './analytics'
import { metaCustomEvent, metaEvent, newEventId } from './meta'
import CookieConsent, { privacySettingsEvent } from './CookieConsent'
import LegalCentre from './LegalCentre'
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  Download, FileSpreadsheet, Gem, Globe2, LogOut, Mail, MapPin, Menu, QrCode, Search, ShieldCheck,
  Share2, Sparkles, Users, X
} from 'lucide-react'

const PASSES = [
  { id: 'general', name: 'General Admission', price: 'Free', note: 'Free entry to visit the exhibition', accent: 'Entry', features: ['Exhibition floor access','Live product showcases','Marketplace access'] },
  { id: 'delegate', name: 'Standard Networking', price: '₦150,000', note: 'Per person · All event days', accent: 'Popular', features: ['Full conference registration','Plenary sessions & materials','Tea, lunch & networking'] },
  { id: 'vip', name: 'Premium VIP', price: '₦250,000', note: 'Per person · All event days', accent: 'Exclusive', features: ['All main and VIP sessions','Gala dinner & fusion show','Private viewing & VIP cocktail'] },
  { id: 'gala', name: 'Gala Dinner', price: '₦75,000', note: 'Per person', accent: 'Evening', features: ['Gala dinner admission','Jewellery & fashion showcase','Premium evening experience'] },
  { id: 'gala-standard-table', name: 'Gala Table · Standard', price: '₦1,000,000', note: 'One table · 10 guests', accent: 'Group', features: ['10 reserved guest seats','Dedicated standard table','Gala dinner admission'] },
  { id: 'gala-premium-table', name: 'Gala Table · Premium', price: '₦1,500,000', note: 'One premium table · 10 guests', accent: 'Premium group', features: ['10 premium guest seats','Priority table placement','Premium gala experience'] }
]

const PROFESSIONAL_CATEGORIES = ['Student / Job Seeker','Entrepreneur','Jewelry Designer','Gemstone Trader','Gold Dealer','Miner','Manufacturer','Retailer','Investor','Industry Professional','Other']
const EVENT_INTERESTS = ['General Exhibition Attendance','Conference','Masterclasses','Investment Forum','Jewelry Design Competition','Gala Night']
const PASS_INTEREST = { general:'General Exhibition Attendance', delegate:'Conference', vip:'Conference', gala:'Gala Night', 'gala-standard-table':'Gala Night', 'gala-premium-table':'Gala Night' }
const LEAD_STATUSES = ['New','Contacted','Qualified','Follow-up Required','Payment Pending','Payment Confirmed','Closed / Not Interested']
const EXPERIENCES = [
  ['Exhibition','Products, businesses and opportunities across the value chain.','general'],['Conference','Industry conversations, plenaries and professional networking.','delegate'],['Masterclasses','Practical learning opportunities led by industry professionals.','delegate'],['Investment Forum','Meet stakeholders exploring trade, finance and responsible growth.','delegate'],['Jewelry Design Competition','Discover African design talent and exceptional craft.','general'],['Awards & Gala Night','A premium evening experience with awards and showcases.','gala'],
]
const CAMPAIGNS = {
  '/opportunities': { eyebrow:'OPPORTUNITIES AT GGCE', title:"Discover opportunities in Africa’s gold, gemstone and jewelry industry.", lead:'Explore businesses, careers, trade, skills and partnerships across the value chain.', pass:'general' },
  '/masterclasses': { eyebrow:'PRACTICAL LEARNING', title:'Explore practical learning opportunities at GGCE Lagos 2026.', lead:'Build relevant knowledge and connect with professionals working across the industry.', pass:'delegate' },
  '/industry-networking': { eyebrow:'INDUSTRY NETWORKING', title:'Meet the people and businesses shaping the industry.', lead:'Connect with traders, manufacturers, designers, exhibitors, investors and decision-makers.', pass:'delegate' },
}
const initialForm = { firstName: '', lastName: '', email: '', phone: '', organisation: '', role: '', country: 'Nigeria', professionalCategory: '', interests: [], pass: 'general', consent: false, marketingConsent: false }
const adminSessionKey = 'ggce-admin-session'
const requireAdminMfa = import.meta.env.VITE_REQUIRE_ADMIN_MFA === 'true'

function Logo() {
  return <a className="brand" href="#top" aria-label="GGCE home"><img src="/Logo.png" alt="Gold & Gemstones Conference & Exhibition (GGCE)"/></a>
}

const funnelLabels = { page_view: 'Opened site', registration_view: 'Viewed registration', pass_selected: 'Selected pass', form_started: 'Started details', details_completed: 'Completed details', registration_completed: 'Registered' }

function Breakdown({ title, rows = [] }) {
  const max = Math.max(...rows.map(row => row.value), 1)
  return <article className="analytics-breakdown"><h3>{title}</h3>{rows.length ? rows.map(row => <div className="breakdown-row" key={row.label}><div><span>{row.label}</span><b>{row.value}</b></div><i><em style={{width:`${row.value/max*100}%`}}/></i></div>) : <p>No traffic recorded yet.</p>}</article>
}

function AnalyticsPanel({ data, days, setDays }) {
  if (!data) return <section className="analytics-panel" id="analytics"><div className="analytics-loading">Loading visitor analytics…</div></section>
  const conversion = data.visitors ? Math.round(data.registrations / data.visitors * 100) : 0
  return <section className="analytics-panel" id="analytics">
    <div className="analytics-head"><div><span className="kicker">VISITOR JOURNEY</span><h2>Traffic and conversion analytics</h2><p>Unique browser sessions and first-touch campaign attribution.</p></div><select value={days} onChange={e=>setDays(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></div>
    <div className="analytics-kpis"><article><Activity/><span>Unique visitors</span><strong>{data.visitors}</strong></article><article><BadgeCheck/><span>Total submitted</span><strong>{data.registrations}</strong></article><article><Users/><span>Free registrations</span><strong>{data.freeRegistrations || 0}</strong></article><article><ArrowRight/><span>Conversion rate</span><strong>{conversion}%</strong></article><article><Gem/><span>Paid-program leads</span><strong>{data.paidLeads || 0}</strong></article><article><Clock3/><span>Payment pending</span><strong>{data.paymentPending || 0}</strong></article><article><BadgeCheck/><span>Payment confirmed</span><strong>{data.paymentConfirmed || 0}</strong></article><article><BarChart3/><span>Page opens</span><strong>{data.pageViews}</strong></article></div>
    <div className="funnel-card"><div><h3>Registration funnel</h3><p>See exactly where visitors leave the journey.</p></div><div className="funnel-steps">{data.funnel.map((item,index) => { const previous = index ? data.funnel[index-1].sessions : item.sessions; const drop = previous ? Math.max(0, Math.round((previous-item.sessions)/previous*100)) : 0; const width = data.funnel[0]?.sessions ? Math.max(8,item.sessions/data.funnel[0].sessions*100) : 8; return <div className="funnel-step" key={item.name}><div><span>{funnelLabels[item.name]}</span><b>{item.sessions}</b>{index > 0 && <em>{drop}% drop</em>}</div><i><span style={{width:`${width}%`}}/></i></div>})}</div></div>
    <div className="analytics-grid"><Breakdown title="Traffic sources" rows={data.sources}/><Breakdown title="Campaigns" rows={data.campaigns}/><Breakdown title="Devices" rows={data.devices}/><Breakdown title="Event interests" rows={data.interests}/><Breakdown title="Professional categories" rows={data.categories}/><Breakdown title="Daily registrations" rows={data.daily}/></div>
  </section>
}

function AdminDashboard() {
  const localDev = useLocalDevelopmentBackend()
  const [authenticated, setAuthenticated] = useState(() => localDev && sessionStorage.getItem(adminSessionKey) === 'yes')
  const [adminEmail, setAdminEmail] = useState('')
  const [pin, setPin] = useState('')
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [scanValue, setScanValue] = useState('')
  const [scanResult, setScanResult] = useState(undefined)
  const [cameraOn, setCameraOn] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [mfaResolver, setMfaResolver] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSetup, setMfaSetup] = useState(null)
  const [mfaQr, setMfaQr] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsDays, setAnalyticsDays] = useState(30)
  const [revokeTarget, setRevokeTarget] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const refresh = async () => { try { setRows(await listRegistrations()) } catch (error) { setAdminError(error.message) } }
  const refreshAnalytics = async () => { try { setAnalytics(await getAdminAnalytics(analyticsDays)) } catch (error) { setAdminError(error.message) } }
  const filtered = rows.filter(r => `${r.firstName} ${r.lastName} ${r.email} ${r.id} ${r.passName}`.toLowerCase().includes(search.toLowerCase()))

  async function login(e) {
    e.preventDefault()
    setAdminError('')
    try {
      if (localDev) { if (pin !== (import.meta.env.VITE_ADMIN_PIN || '2600')) throw new Error('Invalid development PIN.'); sessionStorage.setItem(adminSessionKey, 'yes'); setAuthenticated(true); return }
      if (!auth) throw new Error('The administrator service is temporarily unavailable. Please refresh the page or contact support.')
      const credential = await signInWithEmailAndPassword(auth, adminEmail, pin)
      const token = await credential.user.getIdTokenResult(true)
      if (!token.claims.admin) { await signOut(auth); throw new Error('This account does not have administrator access.') }
      const enrolled = multiFactor(credential.user).enrolledFactors.length > 0
      setNeedsMfa(requireAdminMfa && !enrolled)
      setAuthenticated(!requireAdminMfa || enrolled)
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') {
        setMfaResolver(getMultiFactorResolver(auth, error))
        setAdminError('Enter the six-digit code from your authenticator app.')
        return
      }
      setAdminError(error.message)
    }
  }

  async function completeMfaSignIn(e) {
    e.preventDefault(); setAdminError('')
    try {
      const hint = mfaResolver.hints.find(item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID)
      if (!hint) throw new Error('No supported authenticator factor is enrolled.')
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode.trim())
      const credential = await mfaResolver.resolveSignIn(assertion)
      const token = await credential.user.getIdTokenResult(true)
      if (!token.claims.admin) throw new Error('This account does not have administrator access.')
      setMfaResolver(null); setMfaCode(''); setAuthenticated(true)
    } catch (error) { setAdminError(error.message) }
  }

  async function beginMfaEnrollment() {
    setAdminError('')
    try {
      const secret = await TotpMultiFactorGenerator.generateSecret(await multiFactor(auth.currentUser).getSession())
      const uri = secret.generateQrCodeUrl(auth.currentUser.email, 'GGCE Admin')
      setMfaSetup(secret); setMfaQr(await QRCode.toDataURL(uri, { width: 260, margin: 1 }))
    } catch (error) { setAdminError(error.message) }
  }

  async function completeMfaEnrollment(e) {
    e.preventDefault(); setAdminError('')
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(mfaSetup, mfaCode.trim())
      await multiFactor(auth.currentUser).enroll(assertion, 'GGCE Authenticator')
      setNeedsMfa(false); setMfaSetup(null); setMfaQr(''); setMfaCode(''); setAuthenticated(true)
    } catch (error) { setAdminError(error.message) }
  }

  function exportRegistrations() {
    const headers = ['Ticket ID','First name','Last name','Email','Phone','Organisation','Role','Professional category','Interests','Country','Pass','Ticket status','Lead status','Follow-up date','Notes','Source','Medium','Campaign','Registered at']
    const values = rows.map(r => [r.id,r.firstName,r.lastName,r.email,r.phone,r.organisation,r.role,r.professionalCategory,(r.interests||[]).join('; '),r.country,r.passName,r.status,r.leadStatus,r.followUpDate,r.adminNotes,r.source,r.medium,r.campaign,r.createdAt])
    const csv = [headers, ...values].map(row => row.map(v => `"${String(v || '').replaceAll('"','""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'ggce-registrations.csv'; a.click()
  }

  async function approve(id) {
    try { await approveRegistration(id); await refresh() } catch (error) { setAdminError(error.message) }
  }

  async function verifyScan(raw = scanValue) {
    try { setScanResult(await verifyRegistration(raw)) } catch (error) { setAdminError(error.message); setScanResult(null) }
  }
  async function checkIn() {
    try { const updated = await markTicketUsed(scanResult.id); setScanResult({ ...scanResult, ...updated }); await refresh() } catch (error) { setAdminError(error.message) }
  }
  async function revoke(id) {
    try { await revokeTicket(id); setRevokeTarget(''); await refresh() } catch (error) { setAdminError(error.message) }
  }
  async function manageLead(row) {
    const leadStatus = prompt(`Lead status:\n${LEAD_STATUSES.join('\n')}`, row.leadStatus || (row.status === 'pending' ? 'Payment Pending' : 'New'))
    if (!leadStatus) return
    if (!LEAD_STATUSES.includes(leadStatus)) return setAdminError('Use one of the listed lead statuses exactly.')
    const adminNotes = prompt('Admin notes', row.adminNotes || '') ?? (row.adminNotes || '')
    const followUpDate = prompt('Follow-up date (YYYY-MM-DD) or leave blank', row.followUpDate || '') ?? (row.followUpDate || '')
    try { await updateRegistration(row.id, { leadStatus, adminNotes, followUpDate }); await refresh() } catch (error) { setAdminError(error.message) }
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) { setCameraOn(false); return }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    streamRef.current = stream; videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraOn(true)
    const detector = new BarcodeDetector({ formats: ['qr_code'] })
    const read = async () => {
      if (!streamRef.current) return
      const codes = await detector.detect(videoRef.current).catch(() => [])
      if (codes[0]?.rawValue) { setScanValue(codes[0].rawValue); verifyScan(codes[0].rawValue); stopScanner(); return }
      requestAnimationFrame(read)
    }
    read()
  }

  function stopScanner() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOn(false) }
  useEffect(() => () => stopScanner(), [])
  useEffect(() => { if (authenticated) refresh() }, [authenticated])
  useEffect(() => { if (authenticated) refreshAnalytics() }, [authenticated, analyticsDays])
  useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, async user => {
    if (!user) { setAuthenticated(false); setNeedsMfa(false); return }
    const token = await user.getIdTokenResult()
    if (!token.claims.admin) return setAuthenticated(false)
    const enrolled = multiFactor(user).enrolledFactors.length > 0
    setNeedsMfa(requireAdminMfa && !enrolled); setAuthenticated(!requireAdminMfa || enrolled)
  }) }, [])
  useEffect(() => { window.addEventListener('ggce-local-update', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('ggce-local-update', refresh); window.removeEventListener('storage', refresh) } }, [])

  if (mfaResolver) return <main className="admin-login"><form onSubmit={completeMfaSignIn}><Logo/><span>SECURE SIGN-IN</span><h1>Verify it’s you.</h1><p>Enter the current six-digit code from your authenticator app.</p><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,''))} required autoFocus/></label>{adminError && <p className="admin-error">{adminError}</p>}<button>Verify and continue <ArrowRight/></button><a href="/">Return to website</a></form></main>

  if (needsMfa) return <main className="admin-login"><form onSubmit={mfaSetup ? completeMfaEnrollment : e => { e.preventDefault(); beginMfaEnrollment() }}><Logo/><span>ACCOUNT SECURITY</span><h1>Protect the dashboard.</h1>{mfaSetup ? <><p>Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app, then enter the six-digit code.</p><img className="mfa-qr" src={mfaQr} alt="Authenticator enrollment QR code"/><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,''))} required autoFocus/></label></> : <p>Multi-factor authentication is required for every GGCE administrator. Set up an authenticator app before accessing attendee and ticket data.</p>}{adminError && <p className="admin-error">{adminError}</p>}<button>{mfaSetup ? 'Enable MFA' : 'Set up authenticator'} <ArrowRight/></button><button type="button" className="admin-secondary" onClick={async()=>{ await signOut(auth); setNeedsMfa(false) }}>Sign out</button></form></main>

  if (!authenticated) return <main className="admin-login"><form onSubmit={login}><Logo/><span>ADMIN PORTAL</span><h1>Welcome back.</h1><p>{localDev ? 'Enter the development PIN.' : 'Sign in with your authorised Firebase administrator account.'}</p>{!localDev && <label>Email address<input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required autoFocus/></label>}<label>{localDev ? 'Development PIN' : 'Password'}<input type="password" value={pin} onChange={e => setPin(e.target.value)} required autoFocus={localDev}/></label>{adminError && <p className="admin-error">{adminError}</p>}<button>Access dashboard <ArrowRight/></button><a href="/">Return to website</a></form></main>

  return <main className="admin-dashboard">
    <aside><Logo/><nav><a href="#analytics"><BarChart3/> Analytics</a><a href="#registrations"><Users/> Registrations</a><a href="#scanner"><QrCode/> Ticket scanner</a></nav><a href="/">View public website</a><button onClick={async () => { sessionStorage.removeItem(adminSessionKey); if (auth) await signOut(auth); setAuthenticated(false) }}><LogOut/> Sign out</button></aside>
    <section className="admin-main"><header><div><span>GGCE 2026</span><h1>Registration desk</h1></div><button onClick={exportRegistrations}><FileSpreadsheet/> Export CSV</button></header>
      {adminError && <div className="admin-alert">{adminError}</div>}<div className="admin-stats"><article><span>Total registrations</span><strong>{rows.length}</strong></article><article><span>Valid tickets</span><strong>{rows.filter(r=>r.status==='valid').length}</strong></article><article><span>Awaiting payment</span><strong>{rows.filter(r=>r.status==='pending').length}</strong></article></div>
      <AnalyticsPanel data={analytics} days={analyticsDays} setDays={setAnalyticsDays}/>
      <section className="admin-panel" id="registrations"><div className="panel-head"><div><h2>Attendees and leads</h2><p>Manage registration, payment and follow-up status.</p></div><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search attendees"/></label></div><div className="admin-table"><div className="table-row table-labels"><span>Attendee</span><span>Pass</span><span>Reference</span><span>Status</span><span>Action</span></div>{filtered.map(r=><div className="table-row" key={r.id}><span><b>{r.firstName} {r.lastName}</b><small>{r.email} · {r.professionalCategory || 'Category not set'}</small></span><span>{r.passName}<small className="lead-state">{r.leadStatus || 'New'}</small></span><code>{r.id}</code><span className={`status-pill ${r.status}`}>{r.status === 'valid' ? 'Valid' : r.status === 'pending' ? 'Awaiting payment' : r.status === 'used' ? 'Checked in' : r.status === 'revoked' ? 'Revoked' : 'Invalid'}</span><span className="row-actions"><button onClick={()=>manageLead(r)}>Manage</button>{r.status === 'pending' ? <button onClick={()=>approve(r.id)}>Mark paid</button> : r.status === 'revoked' ? <X aria-label="Revoked"/> : revokeTarget === r.id ? <button className="danger" onClick={()=>revoke(r.id)}>Confirm revoke</button> : <button className="danger ghost" onClick={()=>setRevokeTarget(r.id)}>Revoke</button>}</span></div>)}{!filtered.length&&<div className="empty-table">No registrations found.</div>}</div></section>
      <section className="scanner-panel" id="scanner"><div><span className="kicker">ENTRY VALIDATION</span><h2>Scan and verify tickets.</h2><p>Use the device camera or enter a ticket reference manually.</p>{!cameraOn ? <button className="camera-button" onClick={startScanner}><Camera/> Open QR scanner</button> : <button className="camera-button stop" onClick={stopScanner}>Stop camera</button>}</div><div className="scanner-box"><video ref={videoRef} className={cameraOn?'on':''} muted playsInline/><div className="manual-scan"><input value={scanValue} onChange={e=>setScanValue(e.target.value)} placeholder="GGCE26-A1B2C3"/><button onClick={()=>verifyScan()}><QrCode/> Verify</button></div>{scanResult !== undefined && <div className={`scan-result ${scanResult?.status || 'invalid'}`}>{scanResult ? <><BadgeCheck/><span><b>{scanResult.status === 'valid' ? 'Valid ticket' : scanResult.status === 'used' ? 'Already checked in' : scanResult.status === 'revoked' ? 'Revoked ticket' : 'Payment pending'}</b>{scanResult.firstName} {scanResult.lastName} · {scanResult.passName}</span>{scanResult.status === 'valid' && <button onClick={checkIn}>Check in attendee</button>}</> : <><X/><span><b>Ticket not found</b>Check the reference and try again.</span></>}</div>}</div></section>
    </section>
  </main>
}

function App() {
  if (location.pathname.startsWith('/legal')) return <LegalCentre />
  if (location.pathname.startsWith('/admin')) return <AdminDashboard />
  const campaignPage = CAMPAIGNS[location.pathname]
  const [form, setForm] = useState(() => ({ ...initialForm, pass: campaignPage?.pass || 'general' }))
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [qr, setQr] = useState('')
  const [lookup, setLookup] = useState('')
  const [lookupResult, setLookupResult] = useState(undefined)
  const [downloadMessage, setDownloadMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const passCarouselRef = useRef(null)
  const ticketRef = useRef(null)
  const registrationRef = useRef(null)
  const formStartedRef = useRef(false)
  const { scrollY } = useScroll()
  const heroScale = useTransform(scrollY, [0, 700], [1, 1.08])
  const heroOpacity = useTransform(scrollY, [0, 620], [1, 0.3])

  const selectedPass = useMemo(() => PASSES.find(p => p.id === form.pass), [form.pass])
  const update = (key, value) => { if (['firstName','lastName','email','phone'].includes(key) && !formStartedRef.current) { formStartedRef.current = true; trackJourney('form_started'); metaCustomEvent('FormStart') }; setErrors(prev => ({ ...prev, [key]: '' })); setForm(prev => ({ ...prev, [key]: value })) }
  const toggleInterest = value => update('interests', form.interests.includes(value) ? form.interests.filter(item => item !== value) : [...form.interests, value])
  function choosePass(passId) {
    const suggestedInterest = PASS_INTEREST[passId]
    setForm(prev => ({ ...prev, pass: passId, interests: prev.interests.length || !suggestedInterest ? prev.interests : [suggestedInterest] }))
    setErrors(prev => ({ ...prev, pass: '', interests: '' }))
    trackJourney('pass_selected', { passId }); setStep(2)
    metaEvent('ViewContent', { content_name: PASSES.find(item=>item.id===passId)?.name, content_ids:[passId], content_type:'product' })
  }

  function openRegistration(event) {
    event?.preventDefault()
    history.replaceState(null, '', '#register')
    requestAnimationFrame(() => document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    setMenuOpen(false)
  }

  function scrollPasses(direction) {
    const track = passCarouselRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    const trackPage = () => { trackJourney('page_view', {}, false); metaEvent('PageView') }
    trackPage()
    addEventListener('ggce-privacy-choice', trackPage)
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) trackJourney('registration_view') }, { threshold: .35 })
    if (registrationRef.current) observer.observe(registrationRef.current)
    return () => { observer.disconnect(); removeEventListener('ggce-privacy-choice', trackPage) }
  }, [])

  useEffect(() => {
    if (ticket?.status === 'valid') QRCode.toDataURL(`${location.origin}/?ticket=${ticket.id}`, { width: 320, margin: 1, color: { dark: '#061f18', light: '#ffffff' } }).then(setQr)
  }, [ticket])

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('ticket')
    if (id) {
      setLookup(id)
      verifyRegistration(id).then(result => { setLookupResult(result); if (result?.status === 'valid') { setTicket(result); setStep(3); requestAnimationFrame(() => document.getElementById('register')?.scrollIntoView()) } }).catch(() => setLookupResult(null))
    }
  }, [])

  useEffect(() => {
    if (location.hash === '#register') {
      const revealAnchor = requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById('register')?.scrollIntoView({ block: 'start' })
      }))
      return () => cancelAnimationFrame(revealAnchor)
    }
  }, [])

  function next(e) {
    e.preventDefault()
    if (step === 1) choosePass(form.pass)
  }

  async function register() {
    try {
      const nextErrors = {}
      if (!form.firstName.trim()) nextErrors.firstName = 'Enter your first name.'
      if (!form.lastName.trim()) nextErrors.lastName = 'Enter your last name.'
      if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
      if (!/^\+?[0-9][0-9\s()-]{7,}$/.test(form.phone)) nextErrors.phone = 'Include a valid phone number with country code.'
      if (!form.professionalCategory) nextErrors.professionalCategory = 'Select your professional category.'
      if (!form.interests.length) nextErrors.interests = 'Select at least one event interest.'
      if (Object.keys(nextErrors).length) { setErrors(nextErrors); trackJourney('form_error', { fields: Object.keys(nextErrors).join(',') }, false); return }
      if (!form.consent) throw new Error('Please agree to receive the essential registration and ticket communications.')
      setSubmitting(true); trackJourney('details_completed')
      const eventId = newEventId('registration')
      const entry = await createRegistration({ ...form, ...analyticsContext(), eventId, passId: selectedPass.id, passName: selectedPass.name })
      trackJourney('registration_completed', { passId: selectedPass.id })
      metaEvent('Lead', { content_name:selectedPass.name, value:selectedPass.id==='general'?0:Number(selectedPass.price.replace(/[^0-9]/g,'')), currency:'NGN' }, eventId)
      if (entry.status === 'valid') metaEvent('CompleteRegistration', { content_name:selectedPass.name, value:0, currency:'NGN' }, `${eventId}-complete`)
      setTicket(entry); setStep(3); document.querySelector('#register')?.scrollIntoView({ behavior: 'smooth' })
    } catch (error) { setErrors({ submit: error.message || 'Registration could not be completed. Please try again.' }) } finally { setSubmitting(false) }
  }

  function addToCalendar() {
    const dates='20261124/20261129', details=encodeURIComponent('Gold & Gemstone Conference & Exhibition, Lagos. Ticket: '+ticket.id)
    open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('GGCE Lagos 2026')}&dates=${dates}&details=${details}&location=${encodeURIComponent('Lagos Oriental Hotel, Lagos')}`,'_blank','noopener')
  }
  async function shareRegistration() {
    const share = { title:'GGCE Lagos 2026', text:'I’m attending GGCE Lagos 2026. Come meet the industry!', url:location.origin }
    if (navigator.share) await navigator.share(share).catch(()=>{})
    else open(`https://wa.me/?text=${encodeURIComponent(`${share.text} ${share.url}`)}`,'_blank','noopener')
  }

  async function downloadTicket(format) {
    if (!ticketRef.current) return
    setDownloadMessage(`Preparing ${format.toUpperCase()}…`)
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
      const dataUrl = await toPng(ticketRef.current, { pixelRatio: 3, backgroundColor: '#ffffff', skipFonts: true })
      if (format === 'png') { const a = document.createElement('a'); a.href = dataUrl; a.download = `${ticket.id}.png`; a.click() }
      else { const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [768, 1152] }); pdf.addImage(dataUrl, 'PNG', 0, 0, 768, 1152); pdf.save(`${ticket.id}.pdf`) }
      setDownloadMessage(`${format.toUpperCase()} download ready.`)
    } catch (error) {
      console.error('Ticket download failed', error)
      setDownloadMessage('Download failed. Please try again or print the ticket from your browser.')
    }
  }

  function downloadBook() {
    if (!ticket?.id) return
    const endpoint = import.meta.env.VITE_BOOK_DOWNLOAD_URL || 'https://us-central1-ggce-registration-c2d25.cloudfunctions.net/downloadBook'
    open(`${endpoint}?registration=${encodeURIComponent(ticket.id)}`, '_blank', 'noopener')
  }

  async function verify(value = lookup) {
    try { setLookupResult(await verifyRegistration(value)) } catch { setLookupResult(null) }
  }

  return <>
    <header className="nav"><Logo/><nav className={menuOpen ? 'open' : ''}>
      <a href="#experience">Experience</a><a href="#book">Free book</a><a href="#passes">Passes</a><a href="#verify">Verify ticket</a><a href="#faq">FAQ</a>
    </nav><div className="nav-actions"><a className="nav-cta" href="#register" onClick={openRegistration}>Register now</a><button className="menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button></div>
    </header>

    <main id="top">
      <section className="hero cinematic-hero">
        <motion.div className="hero-media" style={{ scale: heroScale }}>
          <video autoPlay muted loop playsInline preload="metadata">
            <source src="/vid1.mp4" type="video/mp4"/>
          </video>
        </motion.div>
        <div className="hero-shade"/>
        <div className="hero-frame"/>
        <motion.div className="hero-copy" style={{ opacity: heroOpacity }} initial={{opacity:0,y:36}} animate={{opacity:1,y:0}} transition={{duration:1,ease:[.2,.8,.2,1]}}>
          <div className="eyebrow"><span/> {campaignPage?.eyebrow || 'GGCE 2026 · REGISTRATION OPEN'}</div>
          <h1>{campaignPage ? campaignPage.title : <>Discover opportunities in Africa’s <em>gold, gemstone & jewelry industry.</em></>}</h1>
          <p className="lead">{campaignPage?.lead || 'Connect with industry professionals, discover business opportunities, explore valuable skills, and build meaningful partnerships at GGCE Lagos 2026.'}</p>
          <div className="free-access"><BadgeCheck/> Free exhibition access available</div>
          <div className="hero-actions"><a className="primary" href="#register" onClick={openRegistration}>Register for GGCE 2026 <ArrowRight size={18}/></a><a className="text-link" href="#experience">Explore the event <span>↓</span></a></div>
        </motion.div>
        <motion.div className="hero-details" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.7,duration:.8}}>
          <span><CalendarDays/> 24–28 November 2026</span><span><MapPin/> Lagos Oriental Hotel</span><span><Globe2/> Lagos, Nigeria</span>
        </motion.div>
        <div className="scroll-mark"><span>SCROLL TO EXPLORE</span><i/></div>
      </section>

      <section className="register-section">
        <motion.div className="register-story" initial={{opacity:0,x:-30}} whileInView={{opacity:1,x:0}} viewport={{once:true,amount:.3}} transition={{duration:.7}}>
          <span className="kicker">YOUR INVITATION</span>
          <h2>Your place at the centre of Africa’s <em>mineral economy.</em></h2>
          <p>Join policy makers, investors, miners, designers and global buyers for five days of ideas, opportunity and exceptional craft.</p>
          <div className="register-points"><div><strong>01</strong><span><b>Choose</b>Select the right experience</span></div><div><strong>02</strong><span><b>Register</b>Share only the essentials</span></div><div><strong>03</strong><span><b>Confirm</b>Free QR pass or paid reservation status</span></div></div>
          <div className="register-note"><ShieldCheck/><span><b>Clear confirmation</b>Free passes are issued instantly. Paid tickets follow payment verification.</span></div>
        </motion.div>
        <div className="registration-stage" id="register" ref={registrationRef}>
        <motion.div className="registration-shell" initial={{opacity:0,y:35,scale:.98}} whileInView={{opacity:1,y:0,scale:1}} viewport={{once:true,amount:.15}} transition={{duration:.55,ease:[.2,.8,.2,1]}}>
          <div className="reg-head"><div><span>YOUR ENTRY PASS</span><h2>{step === 3 ? 'You’re on the list.' : 'Register in minutes.'}</h2></div><div className="step">{step < 3 ? `${step} / 2` : <BadgeCheck/>}</div></div>
          {step === 1 && <form onSubmit={next} className="pass-step">
            <div className="mini-progress"><i className="active"/><i/></div>
            <p className="form-intro">Choose your access first. Free exhibition registration does not include paid conference, VIP or gala experiences.</p>
            <div className="pass-options">{PASSES.map(p => <button type="button" key={p.id} className={form.pass === p.id ? 'pass-card selected' : 'pass-card'} onClick={() => update('pass', p.id)}><span className="radio">{form.pass === p.id && <i/>}</span><span><b>{p.name}</b><small>{p.note}</small></span><strong>{p.price}</strong></button>)}</div>
            <button className="form-cta">Continue with {selectedPass.name} <ArrowRight/></button>
          </form>}
          {step === 2 && <div className="details-step">
            <div className="mini-progress"><i className="active"/><i className="active"/></div>
            <p className="selected-pass-summary"><span>Selected pass</span><b>{selectedPass.name}</b><strong>{selectedPass.price}</strong><button onClick={()=>setStep(1)}>Change</button></p>
            <div className="grid two"><label>First name *<input required value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Ada" aria-invalid={Boolean(errors.firstName)}/>{errors.firstName&&<small className="field-error">{errors.firstName}</small>}</label><label>Last name *<input required value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Okafor" aria-invalid={Boolean(errors.lastName)}/>{errors.lastName&&<small className="field-error">{errors.lastName}</small>}</label></div>
            <label>Email address *<input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="ada@company.com" aria-invalid={Boolean(errors.email)}/>{errors.email?<small className="field-error">{errors.email}</small>:<small>Your confirmation, pass or reservation, and complimentary book will be sent here.</small>}</label>
            <div className="grid two"><label>Phone with country code *<input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+234 800 000 0000" aria-invalid={Boolean(errors.phone)}/>{errors.phone&&<small className="field-error">{errors.phone}</small>}</label><label>Country<div className="select-wrap"><select value={form.country} onChange={e => update('country', e.target.value)}><option>Nigeria</option><option>Ghana</option><option>South Africa</option><option>United Kingdom</option><option>United States</option><option>Other</option></select><ChevronDown/></div></label></div>
            <div className="grid two"><label>Organisation or business <span className="optional">Optional</span><input value={form.organisation} onChange={e => update('organisation', e.target.value)} placeholder="Company name"/></label><label>Job title <span className="optional">Optional</span><input value={form.role} onChange={e => update('role', e.target.value)} placeholder="Your role"/></label></div>
            <label>Professional category *<div className="select-wrap"><select value={form.professionalCategory} onChange={e=>update('professionalCategory',e.target.value)} aria-invalid={Boolean(errors.professionalCategory)}><option value="">Select category</option>{PROFESSIONAL_CATEGORIES.map(item=><option key={item}>{item}</option>)}</select><ChevronDown/></div>{errors.professionalCategory&&<small className="field-error">{errors.professionalCategory}</small>}</label>
            <fieldset className="interest-options"><legend>Event interests *</legend>{EVENT_INTERESTS.map(item=><label key={item}><input type="checkbox" checked={form.interests.includes(item)} onChange={()=>toggleInterest(item)}/><span>{form.interests.includes(item)&&<Check/>}</span>{item}</label>)}{errors.interests&&<small className="field-error">{errors.interests}</small>}</fieldset>
            <label className="check"><input type="checkbox" checked={form.consent} onChange={e => update('consent', e.target.checked)} required/><span>{form.consent && <Check/>}</span>I agree to receive my complimentary event publication and essential registration, payment and ticket updates, and acknowledge the <a href="/legal/privacy" target="_blank">Privacy Notice</a> and <a href="/legal/event" target="_blank">Event Terms</a>.</label>
            <label className="check optional-consent"><input type="checkbox" checked={form.marketingConsent} onChange={e=>update('marketingConsent',e.target.checked)}/><span>{form.marketingConsent&&<Check/>}</span>Send me optional GGCE news, offers and future event updates.</label>
            {errors.submit&&<p className="form-error" role="alert">{errors.submit}</p>}
            <div className="form-actions"><button className="back" onClick={() => setStep(1)}>Back</button><button className="form-cta" onClick={register} disabled={submitting}>{submitting?'Submitting securely…':'Confirm registration'} <ArrowRight/></button></div>
          </div>}
          {step === 3 && ticket && <div className="success">
            {ticket.status === 'valid' ? <>
              <p>Your digital pass is ready. Keep the QR code available on your phone for entry.</p>
              <div className="luxury-ticket" ref={ticketRef} aria-label={`GGCE ticket for ${ticket.firstName} ${ticket.lastName}`}>
                <img className="ticket-art" src="/ticket-pass-template.png" alt=""/>
                <div className="ticket-name"><span>NAME</span><strong>{ticket.firstName} {ticket.lastName}</strong></div>
                <div className="ticket-type"><span>REGISTRATION TYPE</span><strong>{ticket.passName}</strong></div>
                <div className="ticket-id"><span>TICKET ID</span><strong>{ticket.id}</strong></div>
                <div className="ticket-qr">{qr && <img src={qr} alt="Scannable ticket QR code"/>}<span>SCAN TO VERIFY<br/>REGISTRATION</span></div>
              </div>
              <div className="book-delivery-note"><Mail/><span><b>Your complimentary book is on its way.</b> Check the email address used for registration, or download your copy below.</span></div>
              <div className="success-actions"><button onClick={downloadBook}><Download/> Download free book</button><button onClick={() => downloadTicket('pdf')}><Download/> Download ticket PDF</button><button onClick={() => downloadTicket('png')}><Download/> Download ticket PNG</button><button onClick={addToCalendar}><CalendarDays/> Add to calendar</button><button onClick={shareRegistration}><Share2/> Share or invite</button></div>
              {downloadMessage && <p className="download-message" role="status">{downloadMessage}</p>}
            </> : <div className="reservation-success"><span><Clock3/></span><small>RESERVATION RECEIVED</small><h3>Your place is being held.</h3><p>The GGCE admin team will send verified payment details to <b>{ticket.email}</b>. Your complimentary book will also be delivered to that address. This reference is not an entry ticket. Your scannable QR ticket will be issued only after payment is independently confirmed.</p><div><label>PAYMENT REFERENCE</label><strong>{ticket.id}</strong></div><em>Reserved · Awaiting payment</em><div className="reservation-actions"><button onClick={downloadBook}><Download/> Download free book</button><button onClick={addToCalendar}><CalendarDays/> Add event dates</button><a href={`mailto:ggcelagos@gmail.com?subject=${encodeURIComponent(`Reservation ${ticket.id}`)}`}><Mail/> Email enquiry</a></div></div>}
          </div>}
          <div className="secure"><ShieldCheck/> Your details are encrypted and never shared.</div>
        </motion.div>
        </div>
      </section>

      <section className="ticker" aria-label="GGCE industry sectors"><div className="ticker-track">{[0,1].map(copy => <div className="ticker-group" key={copy} aria-hidden={copy === 1}><span>MINING</span><Gem/><span>INVESTMENT</span><Gem/><span>JEWELLERY</span><Gem/><span>INNOVATION</span><Gem/><span>TRADE</span><Gem/><span>RESPONSIBLE SOURCING</span><Gem/></div>)}</div></section>

      <section className="why" id="experience"><div className="section-copy"><span className="kicker">WHY GGCE</span><h2>Five days.<br/>One powerful <em>network.</em></h2><p>Meet the decision-makers, discover new markets, and take part in conversations that will move Africa’s mineral economy forward.</p></div><div className="feature-grid">
        <article><span>01</span><Globe2/><h3>Discover opportunities</h3><p>Explore businesses, products, careers and possibilities across the value chain.</p></article>
        <article className="gold"><span>02</span><Sparkles/><h3>Learn from professionals</h3><p>Discover masterclasses, practical knowledge and industry expertise.</p></article>
        <article><span>03</span><Users/><h3>Meet the right people</h3><p>Connect with exhibitors, traders, designers, manufacturers, investors and stakeholders.</p></article>
      </div></section>

      <section className="experiences" aria-labelledby="experiences-title"><div className="section-heading"><span className="kicker">EVENT EXPERIENCES</span><h2 id="experiences-title">Choose where you want to participate.</h2><p>Each experience has its own access conditions. General exhibition registration does not include paid programmes.</p></div><div className="experience-grid">{EXPERIENCES.map(([name,description,passId])=><article key={name}><Gem/><h3>{name}</h3><p>{description}</p><a href="#register" onClick={e=>{e.preventDefault();choosePass(passId);openRegistration()}}>Register for {name} <ArrowRight/></a></article>)}</div><div className="section-cta"><a href="#register" onClick={openRegistration}>Register for GGCE 2026 <ArrowRight/></a></div></section>

      <section className="book-section" id="book" aria-labelledby="book-title"><motion.div className="book-visual" initial={{opacity:0,x:-35}} whileInView={{opacity:1,x:0}} viewport={{once:true,amount:.2}} transition={{duration:.7}}><img src="/million-naira-opportunity.png" alt="The Million Naira Opportunity — a GGCE Lagos 2026 digital publication"/></motion.div><motion.div className="book-copy" initial={{opacity:0,y:28}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.3}} transition={{duration:.65}}><span className="kicker light">COMPLIMENTARY DIGITAL BOOK</span><h2 id="book-title">Discover your place in Nigeria’s <em>million-naira opportunity.</em></h2><p>A practical introduction to earning possibilities across the gold, gemstone and jewellery economy — whether or not you own a mine.</p><ul><li><Check/> Explore opportunities across the value chain</li><li><Check/> Learn where skills, trade and enterprise meet</li><li><Check/> Receive the complete digital publication by email</li></ul><div className="book-gate"><ShieldCheck/><span><b>Available to registered attendees</b>Complete the GGCE registration form to receive and download your copy.</span></div><a href="#register" onClick={openRegistration}>Register and get the free book <ArrowRight/></a></motion.div></section>

      <section className="event-proof"><div><span className="kicker light">COME MEET THE INDUSTRY</span><h2>Built around real conversations and real opportunity.</h2><p>See the official GGCE event footage while you explore the programme. Speaker, exhibitor and partner details will only be published when verified.</p><a href="#register" onClick={openRegistration}>Choose your pass <ArrowRight/></a></div><video src="/vid1.mp4" muted loop autoPlay playsInline preload="metadata" aria-label="Official GGCE event footage"/></section>

      <section className="pass-section" id="passes"><div className="pass-heading-row"><div className="section-heading"><span className="kicker">CHOOSE YOUR EXPERIENCE</span><h2>A pass for every ambition.</h2></div><div className="carousel-controls" aria-label="Browse passes"><button onClick={() => scrollPasses(-1)} aria-label="Previous passes"><ChevronLeft/></button><button onClick={() => scrollPasses(1)} aria-label="Next passes"><ChevronRight/></button></div></div><div className="pricing" ref={passCarouselRef}>{PASSES.map((p, i) => <article key={p.id} className={i === 1 ? 'featured' : ''}><span className="tag">{p.accent}</span><h3>{p.name}</h3><strong>{p.price}</strong><p>{p.note}</p><ul>{p.features.map(x => <li key={x}><Check/> {x}</li>)}</ul><a href="#register" onClick={e => { e.preventDefault(); choosePass(p.id); openRegistration() }}>Register for {p.name} <ArrowRight/></a></article>)}</div><div className="carousel-hint"><span>Scroll to explore all passes</span><i/></div></section>

      <section className="verify" id="verify"><div><span className="kicker light">TICKET DESK</span><h2>Already registered?</h2><p>Enter your private ticket reference to view its current status.</p></div><div className="lookup"><label>Ticket reference</label><div><input value={lookup} onChange={e => setLookup(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()} placeholder="e.g. GGCE26-A1B2C3"/><button onClick={() => verify()}><QrCode/> Check pass</button></div>{lookupResult !== undefined && <div className={lookupResult ? (lookupResult.status === 'valid' ? 'result good' : 'result pending') : 'result bad'}>{lookupResult ? <><BadgeCheck/><span><b>{lookupResult.status === 'valid' ? 'Valid registration' : lookupResult.status === 'used' ? 'Already checked in' : 'Awaiting payment'}</b>{lookupResult.firstName} {lookupResult.lastName} · {lookupResult.passName}</span></> : <><X/><span><b>Pass not found</b>Check the ticket reference and try again.</span></>}</div>}</div></section>

      <section className="faq" id="faq"><div><span className="kicker">GOOD TO KNOW</span><h2>Questions,<br/>answered.</h2><p>Need help? Email <a href="mailto:ggcelagos@gmail.com">ggcelagos@gmail.com</a>.</p></div><div>{[['Is exhibition access really free?','Yes. General Admission provides free exhibition-floor access. It does not include paid conference, VIP, masterclass or gala experiences.'],['When will I receive my pass?','Free attendees receive a QR pass after successful registration. Paid registrations receive a reservation reference first; the QR ticket is issued only after payment is confirmed.'],['How are payments handled?','The GGCE team sends verified payment instructions for paid reservations. Do not treat a reservation reference as proof of entry.'],['Can I change or transfer my registration?','Contact the GGCE team with your ticket reference. Corrections and transfers are reviewed under the event and refund policies.'],['Can I register a group?','Yes. For groups and corporate bookings, contact the team for assisted registration.'],['What should I bring?','Bring the QR pass on your phone and a valid photo ID for verification.']].map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
      <section className="bottom-cta"><span className="kicker light">24–28 NOVEMBER 2026 · LAGOS</span><h2>Come meet the industry.</h2><p>Choose free exhibition access or reserve the paid GGCE experience that fits your goals.</p><a href="#register" onClick={openRegistration}>Register for GGCE 2026 <ArrowRight/></a></section>
      <section className="privacy" id="privacy"><span className="kicker">PRIVACY & TERMS</span><h2>Clear choices. Responsible registration.</h2><div><p>GGCE uses the details you submit to manage registration, reservations, tickets, essential event communication and secure entry. Optional journey analytics runs only if you accept it.</p><p>Our Legal Centre explains data use, ticket and event rules, refunds, browser storage, acceptable use and how to exercise your privacy rights.</p><p><a href="/legal">Open the Legal Centre →</a></p></div></section>
    </main>
    <footer><Logo/><p>Africa’s premier Gold & Gemstone Conference & Exhibition.</p><div><a href="/legal">Legal</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a><button onClick={() => dispatchEvent(new Event(privacySettingsEvent))}>Cookie settings</button><a href="mailto:ggcelagos@gmail.com">Contact</a><span>© 2026 GGCE</span></div></footer>
    <a className="mobile-register" href="#register" onClick={openRegistration}>Register for GGCE 2026 <ArrowRight/></a>
    <CookieConsent/>
  </>
}

export default App
