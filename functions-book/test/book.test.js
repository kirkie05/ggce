const test = require('node:test')
const assert = require('node:assert/strict')
const { _test } = require('../index')

test('accepts only a complete GGCE registration reference', () => {
  assert.equal(_test.validRegistrationId('ggce26-abcdef12345678'), 'GGCE26-ABCDEF12345678')
  assert.equal(_test.validRegistrationId('GGCE26-A1B2'), null)
  assert.equal(_test.validRegistrationId('../book.pdf'), null)
})

test('escapes attendee names before email rendering', () => {
  assert.equal(_test.escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;')
})

test('normalizes investment registration contact details', () => {
  assert.equal(_test.normalizeEmail('  Ada@Example.COM '), 'ada@example.com')
  assert.equal(_test.normalizePhone('+234 (800) 123-4567'), '+2348001234567')
})

test('creates verification-compatible registration references', () => {
  const id = _test.newRegistrationId()
  assert.match(id, /^GGCE26-[A-F0-9]{14}$/)
  assert.equal(_test.validRegistrationId(id), id)
})
