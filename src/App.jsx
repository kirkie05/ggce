import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  getMultiFactorResolver, multiFactor, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  TotpMultiFactorGenerator,
} from 'firebase/auth'
import { approveRegistration, auth, createRegistration, getAdminAnalytics, listRegistrations, markTicketUsed, useLocalDevelopmentBackend, verifyRegistration } from './registrationService'
import { analyticsContext, trackJourney } from './analytics'
import {
  Activity, ArrowRight, BadgeCheck, BarChart3, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  Download, FileSpreadsheet, Gem, Globe2, LogOut, Mail, MapPin, Menu, QrCode, Search, ShieldCheck,
  Sparkles, Users, X
} from 'lucide-react'

const PASSES = [
  { id: 'general', name: 'General Admission', price: 'Free', note: 'Free entry to visit the exhibition', accent: 'Entry', features: ['Exhibition floor access','Live product showcases','Marketplace access'] },
  { id: 'delegate', name: 'Standard Networking', price: '₦150,000', note: 'Per person · All event days', accent: 'Popular', features: ['Full conference registration','Plenary sessions & materials','Tea, lunch & networking'] },
  { id: 'vip', name: 'Premium VIP', price: '₦250,000', note: 'Per person · All event days', accent: 'Exclusive', features: ['All main and VIP sessions','Gala dinner & fusion show','Private viewing & VIP cocktail'] },
  { id: 'gala', name: 'Gala Dinner', price: '₦75,000', note: 'Per person', accent: 'Evening', features: ['Gala dinner admission','Jewellery & fashion showcase','Premium evening experience'] },
  { id: 'gala-standard-table', name: 'Gala Table · Standard', price: '₦1,000,000', note: 'One table · 10 guests', accent: 'Group', features: ['10 reserved guest seats','Dedicated standard table','Gala dinner admission'] },
  { id: 'gala-premium-table', name: 'Gala Table · Premium', price: '₦1,500,000', note: 'One premium table · 10 guests', accent: 'Premium group', features: ['10 premium guest seats','Priority table placement','Premium gala experience'] }
]

const initialForm = { firstName: '', lastName: '', email: '', phone: '', organisation: '', role: '', country: 'Nigeria', pass: 'delegate', consent: false }
const adminSessionKey = 'ggce-admin-session'
const requireAdminMfa = import.meta.env.VITE_REQUIRE_ADMIN_MFA === 'true'

function Logo() {
  return <a className="brand" href="#top" aria-label="GGCE home"><img src="/Logo.png" alt="Gold & Gemstones Conference & Exhibition (GGCE)"/></a>
}

const funnelLabels = { page_view: 'Opened site', registration_view: 'Viewed registration', form_started: 'Started details', details_completed: 'Completed details', pass_selected: 'Selected pass', registration_completed: 'Registered' }

function Breakdown({ title, rows = [] }) {
  const max = Math.max(...rows.map(row => row.value), 1)
  return <article className="analytics-breakdown"><h3>{title}</h3>{rows.length ? rows.map(row => <div className="breakdown-row" key={row.label}><div><span>{row.label}</span><b>{row.value}</b></div><i><em style={{width:`${row.value/max*100}%`}}/></i></div>) : <p>No traffic recorded yet.</p>}</article>
}

function AnalyticsPanel({ data, days, setDays }) {
  if (!data) return <section className="analytics-panel" id="analytics"><div className="analytics-loading">Loading visitor analytics…</div></section>
  const conversion = data.visitors ? Math.round(data.registrations / data.visitors * 100) : 0
  return <section className="analytics-panel" id="analytics">
    <div className="analytics-head"><div><span className="kicker">VISITOR JOURNEY</span><h2>Traffic and conversion analytics</h2><p>Unique browser sessions and first-touch campaign attribution.</p></div><select value={days} onChange={e=>setDays(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></div>
    <div className="analytics-kpis"><article><Activity/><span>Unique visitors</span><strong>{data.visitors}</strong></article><article><BarChart3/><span>Page opens</span><strong>{data.pageViews}</strong></article><article><BadgeCheck/><span>Registrations</span><strong>{data.registrations}</strong></article><article><ArrowRight/><span>Conversion rate</span><strong>{conversion}%</strong></article></div>
    <div className="funnel-card"><div><h3>Registration funnel</h3><p>See exactly where visitors leave the journey.</p></div><div className="funnel-steps">{data.funnel.map((item,index) => { const previous = index ? data.funnel[index-1].sessions : item.sessions; const drop = previous ? Math.max(0, Math.round((previous-item.sessions)/previous*100)) : 0; const width = data.funnel[0]?.sessions ? Math.max(8,item.sessions/data.funnel[0].sessions*100) : 8; return <div className="funnel-step" key={item.name}><div><span>{funnelLabels[item.name]}</span><b>{item.sessions}</b>{index > 0 && <em>{drop}% drop</em>}</div><i><span style={{width:`${width}%`}}/></i></div>})}</div></div>
    <div className="analytics-grid"><Breakdown title="Traffic sources" rows={data.sources}/><Breakdown title="Campaigns" rows={data.campaigns}/><Breakdown title="Devices" rows={data.devices}/></div>
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
    const headers = ['Ticket ID','First name','Last name','Email','Phone','Organisation','Role','Country','Pass','Status','Registered at']
    const values = rows.map(r => [r.id,r.firstName,r.lastName,r.email,r.phone,r.organisation,r.role,r.country,r.passName,r.status,r.createdAt])
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
      <section className="admin-panel" id="registrations"><div className="panel-head"><div><h2>Attendees</h2><p>View registrations and approve paid reservations.</p></div><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search attendees"/></label></div><div className="admin-table"><div className="table-row table-labels"><span>Attendee</span><span>Pass</span><span>Reference</span><span>Status</span><span>Action</span></div>{filtered.map(r=><div className="table-row" key={r.id}><span><b>{r.firstName} {r.lastName}</b><small>{r.email}</small></span><span>{r.passName}</span><code>{r.id}</code><span className={`status-pill ${r.status}`}>{r.status === 'valid' ? 'Valid' : 'Awaiting payment'}</span><span>{r.status === 'pending' ? <button onClick={()=>approve(r.id)}>Mark paid</button> : <BadgeCheck/>}</span></div>)}{!filtered.length&&<div className="empty-table">No registrations found.</div>}</div></section>
      <section className="scanner-panel" id="scanner"><div><span className="kicker">ENTRY VALIDATION</span><h2>Scan and verify tickets.</h2><p>Use the device camera or enter a ticket reference manually.</p>{!cameraOn ? <button className="camera-button" onClick={startScanner}><Camera/> Open QR scanner</button> : <button className="camera-button stop" onClick={stopScanner}>Stop camera</button>}</div><div className="scanner-box"><video ref={videoRef} className={cameraOn?'on':''} muted playsInline/><div className="manual-scan"><input value={scanValue} onChange={e=>setScanValue(e.target.value)} placeholder="GGCE26-A1B2C3"/><button onClick={()=>verifyScan()}><QrCode/> Verify</button></div>{scanResult !== undefined && <div className={`scan-result ${scanResult?.status || 'invalid'}`}>{scanResult ? <><BadgeCheck/><span><b>{scanResult.status === 'valid' ? 'Valid ticket' : scanResult.status === 'used' ? 'Already checked in' : 'Payment pending'}</b>{scanResult.firstName} {scanResult.lastName} · {scanResult.passName}</span>{scanResult.status === 'valid' && <button onClick={checkIn}>Check in attendee</button>}</> : <><X/><span><b>Ticket not found</b>Check the reference and try again.</span></>}</div>}</div></section>
    </section>
  </main>
}

function App() {
  if (location.pathname.startsWith('/admin')) return <AdminDashboard />
  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState(1)
  const [ticket, setTicket] = useState(null)
  const [qr, setQr] = useState('')
  const [lookup, setLookup] = useState('')
  const [lookupResult, setLookupResult] = useState(undefined)
  const [downloadMessage, setDownloadMessage] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const passCarouselRef = useRef(null)
  const ticketRef = useRef(null)
  const registrationRef = useRef(null)
  const { scrollY } = useScroll()
  const heroScale = useTransform(scrollY, [0, 700], [1, 1.08])
  const heroOpacity = useTransform(scrollY, [0, 620], [1, 0.3])

  const selectedPass = useMemo(() => PASSES.find(p => p.id === form.pass), [form.pass])
  const update = (key, value) => { if (['firstName','lastName','email','phone'].includes(key)) trackJourney('form_started'); setForm(prev => ({ ...prev, [key]: value })) }

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
    trackJourney('page_view', {}, false)
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) trackJourney('registration_view') }, { threshold: .35 })
    if (registrationRef.current) observer.observe(registrationRef.current)
    return () => observer.disconnect()
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
    if (step === 1 && form.firstName && form.lastName && form.email) { trackJourney('details_completed'); setStep(2) }
  }

  async function register() {
    try {
      if (!form.consent) throw new Error('Please agree to receive the essential registration and ticket communications.')
      trackJourney('pass_selected', { passId: selectedPass.id })
      const entry = await createRegistration({ ...form, ...analyticsContext(), passId: selectedPass.id, passName: selectedPass.name })
      trackJourney('registration_completed', { passId: selectedPass.id })
      setTicket(entry); setStep(3); document.querySelector('#register')?.scrollIntoView({ behavior: 'smooth' })
    } catch (error) { alert(error.message || 'Registration could not be completed. Please try again.') }
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

  async function verify(value = lookup) {
    try { setLookupResult(await verifyRegistration(value)) } catch { setLookupResult(null) }
  }

  return <>
    <header className="nav"><Logo/><nav className={menuOpen ? 'open' : ''}>
      <a href="#experience">Experience</a><a href="#passes">Passes</a><a href="#verify">Verify ticket</a><a href="#faq">FAQ</a>
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
          <div className="eyebrow"><span/> GGCE 2026 · REGISTRATION OPEN</div>
          <h1>Building Africa’s<br/><em>golden future.</em></h1>
          <p className="lead">Where leaders, makers and visionaries gather to shape the next chapter of Africa’s gold, gemstone and jewellery economy.</p>
          <div className="hero-actions"><a className="primary" href="#register" onClick={openRegistration}>Secure your pass <ArrowRight size={18}/></a><a className="text-link" href="#experience">Discover the experience <span>↓</span></a></div>
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
          <div className="register-points"><div><strong>01</strong><span><b>Register</b>Share only the essentials</span></div><div><strong>02</strong><span><b>Choose</b>Select the right experience</span></div><div><strong>03</strong><span><b>Enter</b>Receive your QR pass instantly</span></div></div>
          <div className="register-note"><ShieldCheck/><span><b>Fast, secure entry</b>Your unique QR pass is ready immediately.</span></div>
        </motion.div>
        <div className="registration-stage" id="register" ref={registrationRef}>
        <motion.div className="registration-shell" initial={{opacity:0,y:35,scale:.98}} whileInView={{opacity:1,y:0,scale:1}} viewport={{once:true,amount:.15}} transition={{duration:.55,ease:[.2,.8,.2,1]}}>
          <div className="reg-head"><div><span>YOUR ENTRY PASS</span><h2>{step === 3 ? 'You’re on the list.' : 'Register in minutes.'}</h2></div><div className="step">{step < 3 ? `${step} / 2` : <BadgeCheck/>}</div></div>
          {step === 1 && <form onSubmit={next}>
            <div className="mini-progress"><i className="active"/><i/></div>
            <p className="form-intro">Tell us who you are. We’ll use this on your pass.</p>
            <div className="grid two"><label>First name *<input required value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Ada"/></label><label>Last name *<input required value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Okafor"/></label></div>
            <label>Email address *<input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="ada@company.com"/><small>Your confirmation and pass will be sent here.</small></label>
            <div className="grid two"><label>Phone number<input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+234 800 000 0000"/></label><label>Country<div className="select-wrap"><select value={form.country} onChange={e => update('country', e.target.value)}><option>Nigeria</option><option>Ghana</option><option>South Africa</option><option>United Kingdom</option><option>United States</option><option>Other</option></select><ChevronDown/></div></label></div>
            <button className="form-cta">Choose your pass <ArrowRight/></button>
          </form>}
          {step === 2 && <div className="pass-step">
            <div className="mini-progress"><i className="active"/><i className="active"/></div>
            <p className="form-intro">Choose the experience that works for you.</p>
            <div className="pass-options">{PASSES.map(p => <button key={p.id} className={form.pass === p.id ? 'pass-card selected' : 'pass-card'} onClick={() => update('pass', p.id)}><span className="radio">{form.pass === p.id && <i/>}</span><span><b>{p.name}</b><small>{p.note}</small></span><strong>{p.price}</strong></button>)}</div>
            <details><summary>Add professional details <span>Optional</span></summary><div className="grid two details-grid"><label>Organisation<input value={form.organisation} onChange={e => update('organisation', e.target.value)} placeholder="Company name"/></label><label>Job title<input value={form.role} onChange={e => update('role', e.target.value)} placeholder="Your role"/></label></div></details>
            <label className="check"><input type="checkbox" checked={form.consent} onChange={e => update('consent', e.target.checked)} required/><span>{form.consent && <Check/>}</span>I agree to receive essential registration, payment and ticket updates. See the <a href="#privacy">privacy notice</a>.</label>
            <div className="form-actions"><button className="back" onClick={() => setStep(1)}>Back</button><button className="form-cta" onClick={register}>Confirm registration <ArrowRight/></button></div>
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
              <div className="success-actions"><button onClick={() => downloadTicket('pdf')}><Download/> Download PDF</button><button onClick={() => downloadTicket('png')}><Download/> Download PNG</button></div>
              {downloadMessage && <p className="download-message" role="status">{downloadMessage}</p>}
            </> : <div className="reservation-success"><span><Clock3/></span><small>RESERVATION RECEIVED</small><h3>Your place is being held.</h3><p>The GGCE admin team will send payment details to <b>{ticket.email}</b>. Pay using your reference number below. Your scannable ticket will be issued after payment is confirmed.</p><div><label>PAYMENT REFERENCE</label><strong>{ticket.id}</strong></div><em>Reserved · Awaiting payment</em></div>}
          </div>}
          <div className="secure"><ShieldCheck/> Your details are encrypted and never shared.</div>
        </motion.div>
        </div>
      </section>

      <section className="ticker" aria-label="GGCE industry sectors"><div className="ticker-track">{[0,1].map(copy => <div className="ticker-group" key={copy} aria-hidden={copy === 1}><span>MINING</span><Gem/><span>INVESTMENT</span><Gem/><span>JEWELLERY</span><Gem/><span>INNOVATION</span><Gem/><span>TRADE</span><Gem/><span>RESPONSIBLE SOURCING</span><Gem/></div>)}</div></section>

      <section className="why" id="experience"><div className="section-copy"><span className="kicker">WHY GGCE</span><h2>Five days.<br/>One powerful <em>network.</em></h2><p>Meet the decision-makers, discover new markets, and take part in conversations that will move Africa’s mineral economy forward.</p></div><div className="feature-grid">
        <article><span>01</span><Globe2/><h3>Global perspectives</h3><p>Hear from policy makers and industry leaders defining responsible growth.</p></article>
        <article className="gold"><span>02</span><Users/><h3>Meaningful connections</h3><p>Build high-value relationships across the entire value chain.</p></article>
        <article><span>03</span><Sparkles/><h3>African excellence</h3><p>Experience remarkable craftsmanship, talent and innovation.</p></article>
      </div></section>

      <section className="pass-section" id="passes"><div className="pass-heading-row"><div className="section-heading"><span className="kicker">CHOOSE YOUR EXPERIENCE</span><h2>A pass for every ambition.</h2></div><div className="carousel-controls" aria-label="Browse passes"><button onClick={() => scrollPasses(-1)} aria-label="Previous passes"><ChevronLeft/></button><button onClick={() => scrollPasses(1)} aria-label="Next passes"><ChevronRight/></button></div></div><div className="pricing" ref={passCarouselRef}>{PASSES.map((p, i) => <article key={p.id} className={i === 1 ? 'featured' : ''}><span className="tag">{p.accent}</span><h3>{p.name}</h3><strong>{p.price}</strong><p>{p.note}</p><ul>{p.features.map(x => <li key={x}><Check/> {x}</li>)}</ul><a href="#register" onClick={e => { update('pass', p.id); setStep(1); openRegistration(e) }}>Select pass <ArrowRight/></a></article>)}</div><div className="carousel-hint"><span>Scroll to explore all passes</span><i/></div></section>

      <section className="verify" id="verify"><div><span className="kicker light">TICKET DESK</span><h2>Already registered?</h2><p>Enter your private ticket reference to view its current status.</p></div><div className="lookup"><label>Ticket reference</label><div><input value={lookup} onChange={e => setLookup(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()} placeholder="e.g. GGCE26-A1B2C3"/><button onClick={() => verify()}><QrCode/> Check pass</button></div>{lookupResult !== undefined && <div className={lookupResult ? (lookupResult.status === 'valid' ? 'result good' : 'result pending') : 'result bad'}>{lookupResult ? <><BadgeCheck/><span><b>{lookupResult.status === 'valid' ? 'Valid registration' : lookupResult.status === 'used' ? 'Already checked in' : 'Awaiting payment'}</b>{lookupResult.firstName} {lookupResult.lastName} · {lookupResult.passName}</span></> : <><X/><span><b>Pass not found</b>Check the ticket reference and try again.</span></>}</div>}</div></section>

      <section className="faq" id="faq"><div><span className="kicker">GOOD TO KNOW</span><h2>Questions,<br/>answered.</h2></div><div>{[['When will I receive my pass?','Immediately after registration. Your pass includes a unique QR code for fast entry.'],['Can I change my registration?','Yes. Contact the GGCE team with your ticket ID and the details you would like updated.'],['Can I register a group?','Yes. For groups and corporate bookings, contact the team for assisted registration.'],['What should I bring?','Bring the QR pass on your phone and a valid photo ID for verification.']].map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
      <section className="privacy" id="privacy"><span className="kicker">PRIVACY NOTICE</span><h2>How registration and journey data is used.</h2><div><p>GGCE collects the details you submit to manage your registration, issue and verify tickets, communicate payment or event information, and support entry at the venue. Registration and ticket records are available only to authorised event administrators.</p><p>We also record privacy-conscious journey events such as page views, registration steps, campaign source and device class to understand where visitors leave the registration process. We do not store raw visitor IP addresses in analytics. Journey events are scheduled for deletion after 400 days.</p><p>Essential registration communications are required to deliver your reference and ticket. For access, correction or deletion requests, contact <a href="mailto:ggcelagos@gmail.com">ggcelagos@gmail.com</a>.</p></div></section>
    </main>
    <footer><Logo/><p>Africa’s premier Gold & Gemstone Conference & Exhibition.</p><div><a href="#privacy">Privacy</a><a href="mailto:ggcelagos@gmail.com">Contact</a><span>© 2026 GGCE</span></div></footer>
  </>
}

export default App
