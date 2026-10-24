const lastSpoken = new Map<string, number>()

/** Speak text aloud. `interrupt` cancels anything already queued (use for countdowns). */
export function speak(text: string, { interrupt = false, rate = 0.9 } = {}): void {
  if (!('speechSynthesis' in window)) return
  if (interrupt) window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = rate
  u.lang = 'en-US'
  window.speechSynthesis.speak(u)
}

/** Speak a correction at most once every `cooldownMs`, so cues don't nag. */
export function speakThrottled(text: string, cooldownMs = 5000): void {
  const now = Date.now()
  if (now - (lastSpoken.get(text) ?? 0) < cooldownMs) return
  lastSpoken.set(text, now)
  speak(text)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
