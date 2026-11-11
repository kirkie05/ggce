const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { createRequire } = require('node:module')
const { contactDetails, registrationPass } = require('../src/domain')

// Exercise the actual callables with an atomic Firestore transaction fake.
function backend() {
  const records = new Map()
  const db = {
    collection(name) { return {
      doc: id => ({ key: `${name}/${id}` }), orderBy() { return this }, limit() { return this },
      async get() { return { docs: [...records].filter(([key]) => key.startsWith(name + '/')).map(([key, value]) => ({ id: key.split('/')[1], data: () => value })) } },
    } },
    async runTransaction(fn) {
      const writes = []
      await fn({
        get: async r => ({ exists: records.has(r.key), data: () => records.get(r.key) }),
        set: (r, value, options) => writes.push(() => records.set(r.key, options?.merge ? { ...records.get(r.key), ...value } : value)),
        create: (r, value) => writes.push(() => { assert.equal(records.has(r.key), false); records.set(r.key, value) }),
        update: (r, value) => writes.push(() => { assert.ok(records.has(r.key)); records.set(r.key, { ...records.get(r.key), ...value }) }),
      })
      writes.forEach(write => write())
    },
  }
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
  const wrap = (options, handler) => Object.assign(handler, { options })
  const modules = {
    'firebase-functions/v2/https': { onCall: wrap, onRequest: wrap, HttpsError },
    'firebase-functions/v2/scheduler': { onSchedule: wrap },
    'firebase-functions/v2/firestore': { onDocumentCreated: wrap },
    'firebase-functions/params': { defineSecret: () => ({ value: () => '' }), defineString: (_, options) => ({ value: () => options.default }) },
    'firebase-admin/app': { initializeApp() {} }, 'firebase-admin/auth': { getAuth() {} },
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { serverTimestamp: () => ({ toDate: () => new Date() }) }, Timestamp: { fromMillis: value => new Date(value) } },
  }
  function load(filename) {
    const exports = {}, actualRequire = createRequire(filename)
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { exports, require: name => modules[name] || actualRequire(name), __dirname: path.dirname(filename), console, process, Date })
    return exports
  }
  return { api: load(path.resolve(__dirname, '../src/index.js')), books: load(path.resolve(__dirname, '../../functions-book/index.js')), records }
}
const contact = { firstName: 'Ada', lastName: 'Okafor', email: ' ADA@example.com ', phone: '+234 (800) 123-4567', contactId: 'GGCE26-ABCDEF12345678', contactToken: 'a'.repeat(64) }
const registration = { ...contact, email: 'ada@example.com', passId: 'general', consent: true, professionalCategory: 'Student / Job Seeker', interests: ['General Exhibition Attendance'] }
const request = data => ({ data, rawRequest: { ip: '127.0.0.1' } })

test('contact validation normalizes details and rejects invalid fields', () => {
  assert.equal(contactDetails(contact).email, 'ada@example.com')
  assert.equal(contactDetails(contact).phone, '+2348001234567')
  for (const change of [{ email: 'bad' }, { firstName: '' }, { phone: '123' }, { lastName: '' }]) assert.equal(contactDetails({ ...contact, ...change }), null)
})
test('sponsored pricing is server-defined and restricted to the invitation audience', () => {
  assert.equal(registrationPass('rccg-masterclass', 'rccg').price, 0)
  assert.equal(registrationPass('rccg-masterclass', 'public'), null)
  assert.equal(registrationPass('vip', 'rccg'), null)
  assert.equal(registrationPass('vip', 'public').price, 250000)
  assert.equal(registrationPass('__proto__', 'public'), null)
})
test('Next saves contact details idempotently without issuing a ticket or registration', async () => {
  const { api, records } = backend()
  assert.equal(api.saveRegistrationContact.options.enforceAppCheck, true)
  await api.saveRegistrationContact(request(contact))
  assert.equal(records.get(`registrationLeads/${contact.contactId}`).status, 'incomplete')
  assert.equal([...records.keys()].some(key => /^(registrations|tickets|registrationLookup)\//.test(key)), false)
  await api.saveRegistrationContact(request({ ...contact, firstName: 'Ada updated' }))
  assert.equal([...records.keys()].filter(key => key.startsWith('registrationLeads/')).length, 1)
  assert.equal(records.get(`registrationLeads/${contact.contactId}`).firstName, 'Ada updated')
  await assert.rejects(api.saveRegistrationContact(request({ ...contact, contactToken: 'b'.repeat(64) })), { code: 'permission-denied' })
})
test('saved contacts require admin access and do not expose ownership hashes', async () => {
  const { api } = backend()
  await api.saveRegistrationContact(request(contact))
  await assert.rejects(api.adminListRegistrationContacts(request({})), { code: 'permission-denied' })
  const result = await api.adminListRegistrationContacts({ auth: { token: { admin: true } } })
  assert.equal(result.contacts.length, 1)
  assert.equal(result.contacts[0].tokenHash, undefined)
})
for (const [passId, audience, amount, status] of [['general','public',0,'valid'], ['vip','public',250000,'pending'], ['rccg-masterclass','rccg',0,'valid'], ['general','rccg',0,'valid']]) {
  test(`${audience} ${passId} completes saved contact with the correct amount and ticket state`, async () => {
    const { api, records } = backend()
    await api.saveRegistrationContact(request({ ...contact, audience }))
    const result = await api.createRegistration(request({ ...registration, passId, audience, amount: 1 }))
    assert.equal(result.amount, amount); assert.equal(result.status, status)
    assert.equal(records.get(`registrationLeads/${contact.contactId}`).registrationId, result.id)
    assert.equal(records.get(`registrationLeads/${contact.contactId}`).status, 'completed')
    assert.equal(records.has(`tickets/${result.id}`), status === 'valid')
    await assert.rejects(api.createRegistration(request({ ...registration, passId, audience })), { code: 'already-exists' })
  })
}
test('a caller cannot complete another contact or claim a public sponsored pass', async () => {
  const { api, records } = backend()
  await api.saveRegistrationContact(request(contact))
  await assert.rejects(api.createRegistration(request({ ...registration, contactToken: 'b'.repeat(64) })), { code: 'permission-denied' })
  await assert.rejects(api.createRegistration(request({ ...registration, passId: 'rccg-masterclass' })), { code: 'invalid-argument' })
  assert.equal([...records.keys()].some(key => key.startsWith('tickets/')), false)
})


test('investment forum completes the contact saved by the shared first-step callable', async () => {
  const { api, books, records } = backend()
  await api.saveRegistrationContact(request({ ...contact, registrationFlow: 'investment' }))
  const result = await books.registerInvestmentForum(request({ ...registration, professionalCategory: 'Investor' }))
  assert.equal(result.status, 'valid')
  assert.equal(result.passId, 'investment')
  assert.equal(records.get(`registrationLeads/${contact.contactId}`).registrationId, result.id)
  assert.equal(records.get(`registrationLeads/${contact.contactId}`).status, 'completed')
  assert.equal(records.has(`tickets/${result.id}`), true)
})

test('investment completion rejects a different contact ownership token', async () => {
  const { api, books, records } = backend()
  await api.saveRegistrationContact(request(contact))
  await assert.rejects(books.registerInvestmentForum(request({ ...registration, professionalCategory: 'Investor', contactToken: 'b'.repeat(64) })), { code: 'permission-denied' })
  assert.equal(records.get(`registrationLeads/${contact.contactId}`).status, 'incomplete')
  assert.equal([...records.keys()].some(key => key.startsWith('tickets/')), false)
})
