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

Copy every `VITE_FIREBASE_*` and `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` value from `.env.example` into Vercel project environment variables. Do not set `VITE_ADMIN_PIN` in Vercel.

## 3. Configure and deploy Firebase

```bash
cd functions
npm install
cd ..
firebase login
firebase use --add
firebase functions:secrets:set RESEND_API_KEY
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
