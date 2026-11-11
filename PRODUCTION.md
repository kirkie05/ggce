# GGCE production deployment

The public Vite application deploys to Vercel. Firebase provides Authentication, Firestore, App Check and trusted Cloud Functions. Registrations are never written directly from the browser.

## 1. Create the Firebase project

1. Create a Firebase project and a Web App.
2. Enable Firestore in production mode.
3. Enable Email/Password in Authentication.
4. Create the first administrator in Authentication.
5. Register the production domain in Authentication > Settings > Authorised domains.
6. Enable App Check for the Web App with reCAPTCHA Enterprise/Fraud Defense and enforce it for Cloud Functions after testing.

## 2. Configure the frontend

Copy every `VITE_FIREBASE_*` and `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` value from `.env.example` into Vercel project environment variables. Add `VITE_META_PIXEL_ID` only when a verified GGCE Meta Pixel is available. Do not set `VITE_ADMIN_PIN` in Vercel.

## 3. Configure and deploy Firebase

```bash
cd functions
npm install
cd ..
firebase login
firebase use --add
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set META_CAPI_TOKEN
firebase deploy --only firestore:rules,functions
```

During deployment, set `PUBLIC_SITE_URL` to the production HTTPS domain and
`MONITOR_ALERT_EMAIL` to the address that should receive outage notifications.
Set `EMAIL_FROM` in the Firebase/Google Cloud console. The sending domain must
be verified in Resend.

Grant the first administrator claim with Application Default Credentials configured:

```bash
cd functions
npm run set-admin -- admin@example.com
```

The administrator must sign out and back in after receiving a custom claim.

## 4. Deploy Vercel

Import the repository into Vercel. The included `vercel.json` builds `dist`, preserves `/admin` routing and applies baseline security headers. Deploy only after the Firebase Functions are live and Vercel environment variables are configured.

## 5. Production checks

- Submit every free and paid pass type.
- Confirm Firestore receives registrations without direct client access.
- Confirm reservation, approval and ticket emails arrive.
- Approve a paid pass and open the email ticket link on a different device.
- Download both PNG and PDF tickets.
- Scan a ticket, check it in, then confirm a second scan reports it as already used.
- Confirm non-admin Firebase users cannot open the dashboard.
- Confirm App Check rejects unverified requests.
- Test camera denial and manual ticket entry.
- Export registrations and reconcile totals.
- Configure Firestore scheduled backups, Cloud Logging alerts and Resend failure monitoring.

## Visitor analytics and uptime monitoring

The admin dashboard reports unique sessions, page opens, registrations, conversion,
traffic source, UTM campaign, device class, and drop-off at each registration step.
It does not store raw visitor IP addresses.

Meta Pixel and Conversions API events are emitted only after the visitor accepts analytics cookies. Browser and server events share event IDs for deduplication. Do not configure the Pixel or CAPI secret until the organisation has approved the tracking purpose and updated the privacy notice.

Create campaign links like:

```
https://your-domain.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch
```

The scheduled monitor checks the public website every five minutes. Two consecutive
failures send one outage email; recovery sends one follow-up email. Scheduled
Functions require the Firebase Blaze plan.

Configure a Firestore TTL policy on `analyticsEvents.expiresAt` so raw journey
events are removed after 400 days. Disclose analytics collection and retention in
the published privacy notice before launch.

## Secrets

Never commit `.env.local`, service-account JSON, Resend keys or Firebase Admin credentials. Firebase Web App configuration is public by design; security depends on App Check, Authentication, callable-function authorization and Firestore rules.

## Contact-first registration and special attendees

All registration routes collect first name, last name, email and phone before
showing ticket choices. **Next** saves a separate `registrationLeads` record;
this is not a completed registration and does not issue a ticket. The admin
registration desk lists these contacts and exports them as CSV, including
people who leave before selecting attendance. Completion links the contact to
its final registration. Contact records expire after 90 days and a daily
scheduled function removes them.

The unlisted route `/special-attendees/rccg` is for RCCG youth. It offers free
general admission or a sponsored masterclass. It has no public navigation link
and sends `noindex, nofollow, noarchive`; anyone with the URL can open it.
Sponsored pricing is set on the server and does not grant VIP or conference
access.

Deploy the Firebase backend **before** merging the frontend to `main`, because
`main` automatically deploys to Vercel. From the repository root, with Node 22
and authenticated access to `ggce-registration-c2d25`:

```bash
firebase deploy --project ggce-registration-c2d25 --only functions:default,functions:books,firestore:rules
```

Keep existing Firebase secrets and runtime parameters. The backend must include
`saveRegistrationContact`, `adminListRegistrationContacts`,
`purgeExpiredRegistrationContacts`, the updated `createRegistration`, and the
updated `registerInvestmentForum`. Verify the new contact-saving callable using
a valid App Check token before merging. Existing clients remain compatible
while the backend rolls out. Then merge the frontend change into `main`, wait
for Vercel to finish, and smoke-test both the main and RCCG routes on the live
site. Check that a first-step contact appears in the admin dashboard before
completing registration, that free/sponsored attendance issues a valid pass,
and that paid attendance issues only a pending reservation.

Local validation uses Node 24 for the frontend and Node 22 for Functions:

```bash
npm ci
npm run build
npm run test:e2e
(cd functions && npm ci && npm run lint && npm test)
(cd functions-book && npm ci && npm run lint && npm test)
```

Playwright starts the local app by default. Install its Chromium browser with
`npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an
existing Chromium executable (for example `/usr/bin/chromium` in Codex Cloud).
The browser tests use the local development backend; callable unit tests cover
server-side contact ownership, administrator access, duplicate prevention and
server-defined sponsored pricing. They do not validate production email delivery
or Firebase/App Check configuration.
