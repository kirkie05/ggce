const { applicationDefault, initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

initializeApp({ credential: applicationDefault() })
const email = process.argv[2]
if (!email) throw new Error('Usage: npm run set-admin -- admin@example.com')

getAuth().getUserByEmail(email)
  .then(user => getAuth().setCustomUserClaims(user.uid, { admin: true }).then(() => console.log(`Admin claim granted to ${email}`)))
  .catch(error => { console.error(error); process.exitCode = 1 })
