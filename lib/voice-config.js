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
  return text.replace(/\[[^\]\r\n]*\]/g, '').replace(/ {2,}/g, ' ').trim()
}

export const audioTagInstructions =
  'Use sparse ElevenLabs audio tags inside segment text to direct the voice: at most one or two short square-bracket delivery cues per segment, such as [excited], [curious], [whispering], or [laughing], only when natural for the speaker and content. Keep news measured and callers conversational. No SSML, sound-effect cues, or other stage directions. Never add tags to a real listenerCall transcript; preserve it verbatim.'
