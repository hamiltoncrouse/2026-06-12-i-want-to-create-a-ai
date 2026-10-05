export function voiceProvider() {
  return (process.env.VOICE_PROVIDER || 'elevenlabs').toLowerCase()
}

export function elevenModel() {
  return process.env.ELEVENLABS_MODEL || 'eleven_v4'
}

export function usesAudioTags() {
  return ['elevenlabs', '11labs'].includes(voiceProvider()) &&
    ['eleven_v4', 'eleven_v4_turbo'].includes(elevenModel())
}

export function stripAudioTags(text) {
  return text.replace(/\[[^\]]*(?:\]|$)/g, '').replace(/[\[\]]/g, '').replace(/ {2,}/g, ' ').trim()
}
