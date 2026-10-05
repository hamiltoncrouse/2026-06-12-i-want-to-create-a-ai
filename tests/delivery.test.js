import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliveryProfile, constrainAudioTags, constrainBreakDelivery, deliveryInstructions } from '../lib/character-delivery.js'
import { stripAudioTags } from '../lib/voice-config.js'

test('jazz stays restrained including imaging; disallowed/compound/nested tags cannot pass', () => {
  for (const speaker of ['dj', 'imaging']) {
    assert.equal(constrainAudioTags('[excited] Hello! [shouting] Yes. [warm] Welcome. [dryly] Nice.', 'dex-monroe', speaker), 'Hello! Yes. [warm] Welcome. Nice.')
  }
  assert.equal(constrainAudioTags('[[excited]] Hi [warm and excited] there [laughing\n loudly] yes [warm] Friend [unfinished', 'dex-monroe'), 'Hi there yes [warm] Friend')
  assert.match(deliveryInstructions('dex-monroe'), /Never hype/)
})
test('personality remains distinct for Rex, Roxie, Count, Dusty and unknown custom DJ', () => {
  assert.equal(constrainAudioTags('[excited] Hi [laughing] yes', 'blaze-morning-crew'), '[excited] Hi [laughing] yes')
  assert.equal(constrainAudioTags('[excited] Rex. [dryly] Really?', 'blaze-morning-crew', 'cohost'), 'Rex. [dryly] Really?')
  assert.equal(constrainAudioTags('[dramatic] Good evening', 'count-devinyl'), '[dramatic] Good evening')
  assert.equal(constrainAudioTags('[shouting] Hey [warm] neighbor', 'dusty-boone'), 'Hey [warm] neighbor')
  assert.equal(constrainAudioTags('[excited] Hey [warm] friend', 'custom'), 'Hey [warm] friend')
})
test('global tag budget and real caller transcript respected; script rebuilt', () => {
  const transcript = '[caller transcript] Please play my request.'
  const body = { dj: { id: 'dex-monroe' }, listenerCall: { text: transcript } }
  const plan = { script: 'stale [excited]', segments: [{ speaker: 'dj', text: '[warm] Hello.' }, { speaker: 'caller', text: '[excited] invented' }, { speaker: 'dj', text: '[dryly] Thanks.' }] }
  const out = constrainBreakDelivery(plan, body, true)
  assert.equal(out.script, `[warm] Hello. ${transcript} Thanks.`)
  assert.equal(constrainBreakDelivery(plan, body, false).segments[0].text, 'Hello.')
  assert.equal(stripAudioTags('[warm] Hello [excited\n loudly] there [unfinished'), 'Hello there')
  assert.equal(deliveryProfile('dex-monroe', 'reporter').tags.includes('excited'), false)
})
