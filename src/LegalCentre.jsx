import { ArrowLeft, Cookie, FileText, Scale, ShieldCheck, TicketCheck, UserCheck } from 'lucide-react'

const EFFECTIVE_DATE = '30 October 2026'
const SUPPORT = 'ggcelagos@gmail.com'

const documents = {
  privacy: {
    title: 'Privacy Notice', icon: ShieldCheck,
    intro: 'How GGCE collects, uses, shares, protects and retains personal data for registration, ticketing, event access and optional journey analytics.',
    sections: [
      ['Who is responsible', <p key="p">The Gold & Gemstones Conference & Exhibition organising team (“GGCE”, “we”, “us”) is responsible for the personal data described in this notice. Contact us at <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>. Our principal operations for this event are in Lagos, Nigeria.</p>],
      ['Data we collect', <ul key="l"><li>Identity and contact data: name, email, phone number, country, organisation and role.</li><li>Registration data: selected pass, ticket reference, payment/approval status and check-in status.</li><li>Support and correspondence data you send to us.</li><li>Security data: authentication, audit, abuse-prevention and ticket-validation records.</li><li>Only with your analytics choice: session identifier, page/registration steps, first-touch source, campaign and broad device class. We do not place raw IP addresses in the journey analytics record.</li></ul>],
      ['Why we use it', <ul key="l"><li>To create and administer registrations, reservations and QR tickets.</li><li>To send essential registration, payment, event and safety messages.</li><li>To validate admission, prevent duplicate entry, fraud and misuse.</li><li>To respond to requests, operate the event and keep required records.</li><li>With consent, to understand aggregate visitor journeys and registration drop-off.</li></ul>],
      ['Legal grounds', <p key="p">We process data as necessary to provide the registration and event service you request, to meet legal obligations, for legitimate interests such as event security and fraud prevention, and on consent where required for optional analytics. You may withdraw analytics consent at any time through Cookie settings without affecting prior lawful processing.</p>],
      ['Who receives data', <p key="p">Access is limited to authorised GGCE event staff and service providers that help us operate the service, including Google Firebase/Cloud (database, authentication and abuse prevention), Vercel (hosting), Resend (transactional email), and domain/network providers. We do not sell personal data. A provider may process data outside Nigeria; where this occurs, we require appropriate contractual, technical and organisational safeguards.</p>],
      ['Public ticket checking', <p key="p">A person who possesses a valid ticket reference or QR code can retrieve a limited verification response, including the attendee name, pass type and ticket status. Treat your ticket reference and QR code as private and report loss or suspected misuse promptly.</p>],
      ['Retention', <p key="p">Journey analytics is scheduled for deletion after 400 days. Temporary rate-limit records expire automatically. Registration, transaction, ticket, check-in, support and security records are kept only as long as reasonably necessary for event delivery, accounting, legal claims, fraud prevention and regulatory duties, after which they are deleted or anonymised.</p>],
      ['Your rights', <p key="p">Subject to applicable law, you may request access, correction, deletion, restriction, objection, portability, or withdrawal of consent. Email <a href={`mailto:${SUPPORT}?subject=Data%20rights%20request`}>{SUPPORT}</a> with “Data rights request”. We may verify your identity before acting. You may also complain to the Nigeria Data Protection Commission.</p>],
      ['Children', <p key="p">Online registration is intended for adults. A person under 18 should register only with the involvement and consent of a parent or legal guardian.</p>],
      ['Security and changes', <p key="p">We use access controls, encryption in transit, abuse prevention, audit records and restricted administrative access. No online service can promise absolute security. We may update this notice when the service or law changes and will show the new effective date here.</p>],
    ],
  },
  terms: {
    title: 'Website Terms of Use', icon: Scale,
    intro: 'The rules governing use of ggcelagos.com, its registration service, ticket lookup and administrative interfaces.',
    sections: [
      ['Acceptance', <p key="p">By using this website you agree to these terms and the policies linked in this Legal Centre. If you do not agree, do not use the service. You must provide accurate information and have authority to register for yourself or another attendee.</p>],
      ['Permitted use', <p key="p">You may browse event information, register, reserve a pass, retrieve your own ticket and use authorised event services. Content, branding, photographs, video, software and ticket artwork remain the property of GGCE or their respective licensors and may not be commercially reused without written permission.</p>],
      ['Prohibited conduct', <ul key="l"><li>Do not submit false, unlawful or misleading information.</li><li>Do not copy, forge, sell, share or manipulate a QR code or ticket reference.</li><li>Do not scrape, probe, overload, reverse engineer, bypass access controls or attempt unauthorised access.</li><li>Do not introduce malware, automate abusive requests, impersonate another person or interfere with the website or event.</li></ul>],
      ['Availability and information', <p key="p">We aim to keep information accurate and the service available, but schedules, speakers, programme items and digital services may change. We may suspend access for maintenance, security or events outside reasonable control. Material ticket or event changes will be communicated using the details supplied at registration.</p>],
      ['Liability', <p key="p">Nothing in these terms excludes liability or consumer rights that cannot lawfully be excluded. To the extent permitted by law, GGCE is not responsible for indirect or consequential loss, third-party services, or loss caused by inaccurate information supplied by a user.</p>],
      ['Governing law and disputes', <p key="p">These terms are governed by the laws of the Federal Republic of Nigeria. Please first contact <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> so we can try to resolve a concern fairly. Unresolved disputes may be referred to an appropriate regulator, mediation or a court of competent jurisdiction in Nigeria.</p>],
    ],
  },
  event: {
    title: 'Registration & Event Terms', icon: TicketCheck,
    intro: 'Rules for reservations, tickets, admission, event conduct, programme changes and event-day operations.',
    sections: [
      ['Registration and paid reservations', <p key="p">A free registration becomes a ticket when a valid QR pass is issued. A paid registration is only a reservation until payment is received, verified and a valid ticket is issued. A reservation reference is not proof of admission. Prices are stated in Nigerian naira unless otherwise shown.</p>],
      ['Tickets and admission', <p key="p">Tickets are issued to the named attendee and may be checked against valid photo identification. Keep the QR code private. We may refuse or revoke entry for an invalid, duplicated, refunded, transferred without approval, fraudulently obtained or materially altered ticket. Re-entry and access to particular sessions may depend on pass type and venue rules.</p>],
      ['Changes and cancellation', <p key="p">Speakers, timings, sessions and venue arrangements may change for operational, safety or circumstances beyond reasonable control. If the whole event is cancelled or materially rescheduled, the remedies in the Refund & Cancellation Policy apply. Reasonable programme changes alone do not normally create a refund right, without limiting mandatory consumer rights.</p>],
      ['Conduct and safety', <p key="p">Attendees must follow lawful venue, health, safety and security instructions and behave respectfully. Harassment, discrimination, threats, violence, illegal activity, unsafe conduct and material disruption are prohibited. We may remove an attendee where reasonably necessary to protect people, property or the event, subject to applicable law.</p>],
      ['Photography and recording', <p key="p">General event photography and video may occur for reporting and promotion. We will use reasonable signage and respect lawful objections. If you require an accommodation or do not wish to be intentionally featured, contact the team before the event or notify the registration desk. Recording restricted sessions or other attendees in a manner that violates privacy, confidentiality or intellectual-property rights is prohibited.</p>],
      ['Accessibility and special requirements', <p key="p">Contact <a href={`mailto:${SUPPORT}?subject=Accessibility%20request`}>{SUPPORT}</a> as early as possible with accessibility, dietary or other participation requirements. We will make reasonable efforts to assist but cannot guarantee requests submitted too late or beyond the venue’s reasonable capability.</p>],
    ],
  },
  refunds: {
    title: 'Refund & Cancellation Policy', icon: FileText,
    intro: 'A transparent framework for paid reservations, attendee cancellations, event changes and approved refunds.',
    sections: [
      ['Before payment', <p key="p">Submitting a paid-pass registration creates a reservation only. You do not owe a fee until the GGCE team sends verified payment instructions. Review the pass, price and payment instructions before paying and quote only your official reservation reference.</p>],
      ['Attendee cancellation', <p key="p">Send cancellation requests to <a href={`mailto:${SUPPORT}?subject=Ticket%20cancellation%20request`}>{SUPPORT}</a> with the ticket reference. We will confirm any applicable refund, administrative deduction or substitution option before processing. Any material non-refundable condition must have been disclosed before payment. Your mandatory statutory consumer rights remain unaffected.</p>],
      ['Event cancellation or material reschedule', <p key="p">If GGCE cancels the whole paid event and does not offer a suitable replacement, the ticket holder may choose a refund of the amount paid for the affected GGCE ticket. If the event is materially rescheduled, the ticket will remain valid for the new date; attendees unable to attend may request the remedy stated in the reschedule notice within its stated response period.</p>],
      ['How refunds are paid', <p key="p">Approved refunds are normally returned through the original payment method or to the verified payer. Processing times depend on the payment provider. We may require proof of payment and identity to prevent fraud. Travel, accommodation, visa and third-party costs are not ticket fees and remain the attendee’s responsibility unless applicable law requires otherwise.</p>],
      ['Chargebacks and duplicate payments', <p key="p">Contact us first about duplicate, incorrect or unrecognised payments so we can investigate promptly. Starting a chargeback does not prevent us from providing evidence to the payment provider or taking proportionate action against a fraudulently disputed ticket.</p>],
    ],
  },
  cookies: {
    title: 'Cookie & Storage Notice', icon: Cookie,
    intro: 'The browser storage and similar technology used for essential operation, security and optional journey measurement.',
    sections: [
      ['Essential storage', <p key="p">The site uses session or local browser storage for security and functional needs such as administrator sessions, attribution preferences and remembering your privacy choice. Firebase App Check and Google reCAPTCHA/Fraud Defense may use browser signals or storage to distinguish legitimate requests from abuse. Essential technology cannot be switched off through our preference panel because the service may not work safely without it.</p>],
      ['Optional analytics', <p key="p">If you choose “Accept analytics”, we create a random session identifier and record page/registration milestones, source, campaign and broad device class to measure conversion and drop-off. We do not use this system for behavioural advertising and do not store raw IP addresses in the journey event. Choosing “Essential only” prevents these journey events from being sent.</p>],
      ['Managing choices', <p key="p">Use “Cookie settings” in the footer at any time to change your choice. Clearing browser storage will also remove the stored preference and the site will ask again. Browser controls can delete or block storage, but blocking essential storage may affect registration, authentication or ticket functions.</p>],
    ],
  },
  acceptable: {
    title: 'Acceptable Use & Security', icon: ShieldCheck,
    intro: 'Security rules that protect attendees, tickets, administrative accounts and service availability.',
    sections: [
      ['Responsible use', <p key="p">Use the service only for legitimate GGCE browsing, registration, ticket management or authorised administration. Do not attempt to discover another attendee’s data, defeat rate limits, reuse tokens, exploit errors, scan infrastructure without written permission or interfere with event operations.</p>],
      ['Ticket and account security', <p key="p">Keep ticket references, QR codes, passwords and multi-factor codes confidential. Administrators must use individual authorised accounts, multi-factor authentication where available, secure devices and prompt sign-out on shared equipment. Report loss, compromise or suspicious activity immediately.</p>],
      ['Vulnerability reporting', <p key="p">If you believe you found a security issue, email <a href={`mailto:${SUPPORT}?subject=Confidential%20security%20report`}>{SUPPORT}</a> with a clear description and steps to reproduce. Do not access unnecessary data, disrupt the service, publicly disclose the issue before remediation, or demand payment. We will acknowledge and assess good-faith reports.</p>],
      ['Enforcement', <p key="p">We may rate-limit, block, suspend, revoke tickets or accounts, preserve evidence and report suspected unlawful activity where proportionate and lawful. Good-faith security research is not authorised unless we have given written permission defining the scope.</p>],
    ],
  },
  requests: {
    title: 'Data Rights Request Process', icon: UserCheck,
    intro: 'How to request access, correction, deletion or another privacy right relating to GGCE data.',
    sections: [
      ['Submit a request', <ol key="l"><li>Email <a href={`mailto:${SUPPORT}?subject=Data%20rights%20request`}>{SUPPORT}</a> using the subject “Data rights request”.</li><li>State the right you want to exercise and identify the registration email or ticket reference.</li><li>Do not email passwords, payment-card details or a full identity document unless specifically and securely requested.</li></ol>],
      ['Identity checks', <p key="p">To protect personal data, we may ask for information reasonably necessary to confirm identity and authority. An authorised representative must show authority to act. We may decline to disclose data where identity cannot be verified or disclosure would adversely affect another person’s rights.</p>],
      ['Response and complaints', <p key="p">We will acknowledge the request and respond within the period required by applicable Nigerian law, or explain any lawful extension or refusal. If you remain dissatisfied, ask us to review the decision or submit a complaint to the Nigeria Data Protection Commission.</p>],
    ],
  },
}

const order = ['privacy', 'terms', 'event', 'refunds', 'cookies', 'acceptable', 'requests']

function LegalHeader() {
  return <header className="legal-nav"><a href="/" className="legal-brand"><img src="/Logo.png" alt="GGCE"/></a><nav><a href="/legal">Legal centre</a><a href={`mailto:${SUPPORT}`}>Contact</a><a className="legal-home" href="/"><ArrowLeft/> Website</a></nav></header>
}

function LegalFooter() {
  return <footer className="legal-footer"><img src="/Logo.png" alt="GGCE"/><p>Effective {EFFECTIVE_DATE} · Version 1.0</p><div><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a><a href={`mailto:${SUPPORT}`}>Contact</a></div></footer>
}

export default function LegalCentre() {
  const slug = location.pathname.split('/').filter(Boolean)[1]
  const doc = documents[slug]
  if (!doc) return <><LegalHeader/><main className="legal-index"><span className="kicker">GGCE LEGAL CENTRE</span><h1>Clear terms.<br/><em>Respectful data use.</em></h1><p className="legal-lead">Everything you need to know about registration, tickets, privacy, refunds and responsible use of GGCE digital services.</p><div className="legal-grid">{order.map(key => { const item=documents[key]; const Icon=item.icon; return <a href={`/legal/${key}`} key={key}><Icon/><span><b>{item.title}</b><small>{item.intro}</small></span><strong>→</strong></a> })}</div><aside className="legal-note"><ShieldCheck/><div><b>Questions or rights requests?</b><p>Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>. We will route your request to the appropriate event or privacy contact.</p></div></aside></main><LegalFooter/></>
  const Icon = doc.icon
  return <><LegalHeader/><main className="legal-document"><aside><a href="/legal"><ArrowLeft/> All legal documents</a><nav>{order.map(key=><a className={key===slug?'active':''} href={`/legal/${key}`} key={key}>{documents[key].title}</a>)}</nav></aside><article><header><Icon/><span className="kicker">LEGAL · VERSION 1.0</span><h1>{doc.title}</h1><p>{doc.intro}</p><small>Effective date: {EFFECTIVE_DATE}</small></header>{doc.sections.map(([heading,body])=><section key={heading}><h2>{heading}</h2>{body}</section>)}<section className="legal-sources"><h2>Regulatory references</h2><p>This framework is designed around the Nigeria Data Protection Act 2023 and Nigerian consumer-protection requirements. Official guidance is available from the <a href="https://ndpc.gov.ng/faqs/" target="_blank" rel="noreferrer">Nigeria Data Protection Commission</a> and the <a href="https://fccpc.gov.ng/businesses/business-obligations/" target="_blank" rel="noreferrer">Federal Competition and Consumer Protection Commission</a>.</p></section></article></main><LegalFooter/></>
}
