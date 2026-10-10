// Text-to-speech with the browser's built-in speechSynthesis and whatever
// Japanese voices the device provides. Nothing is downloaded or installed.
import { state, save } from './srs.js'

const synth = window.speechSynthesis

// Voices installed on the device come first; ones the browser streams follow.
export function japaneseVoices() {
  if (!synth) return []
  return synth
    .getVoices()
    .filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'))
    .sort((a, b) => Number(b.localService) - Number(a.localService))
}

export function currentVoice() {
  const voices = japaneseVoices()
  return voices.find((v) => v.voiceURI === state.voice) ?? voices[0] ?? null
}

export function setVoice(voiceURI) {
  state.voice = voiceURI
  save()
}

export function speak(text) {
  const voice = currentVoice()
  if (!voice) return
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 0.9
  synth.speak(utterance)
}

// Voices load asynchronously in most browsers, so callers re-check when they arrive.
export function onVoicesChanged(callback) {
  synth?.addEventListener?.('voiceschanged', callback)
}
