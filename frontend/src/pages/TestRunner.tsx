import { DrawingUtils, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { analyzeFrame, FormMonitor, type FrameAnalysis } from '../pose/formChecks'
import { dist, LM } from '../pose/geometry'
import { getPoseLandmarker } from '../pose/landmarker'
import { RepCounter, THRESHOLDS } from '../pose/repCounter'
import { speak, speakThrottled, stopSpeaking } from '../voice/speech'

type Phase = 'loading' | 'error' | 'setup' | 'countdown' | 'running' | 'saving'

const TEST_SECONDS = 30
const READY_HOLD_MS = 1500
const HINT_DELAY_MS = 4000

const SETUP_INSTRUCTIONS =
  'Place your chair against a wall. Sit in the middle of the chair with your feet flat on the floor. ' +
  'Cross your arms over your chest, with your hands on the opposite shoulders. ' +
  'Turn your side towards the camera so your whole body can be seen.'

interface Checks {
  visible: boolean
  sideOn: boolean
  armsCrossed: boolean
  seated: boolean
}

const NO_CHECKS: Checks = { visible: false, sideOn: false, armsCrossed: false, seated: false }

const HINTS: Record<keyof Checks, string> = {
  visible: 'Please move so your whole body, from your shoulders to your feet, is on the screen.',
  sideOn: 'Please turn your side towards the camera.',
  armsCrossed: 'Please cross your arms over your chest.',
  seated: 'Please sit down in the middle of the chair.',
}

/** With several people in view, track the one who appears largest (closest). */
function primaryPose(poses: NormalizedLandmark[][]): NormalizedLandmark[] | null {
  if (poses.length === 0) return null
  const size = (p: NormalizedLandmark[]) => dist(p[LM.leftShoulder], p[LM.leftAnkle]) + dist(p[LM.rightShoulder], p[LM.rightAnkle])
  return poses.reduce((a, b) => (size(b) > size(a) ? b : a))
}

export default function TestRunner() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Checks>(NO_CHECKS)
  const [ready, setReady] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [remaining, setRemaining] = useState(TEST_SECONDS)
  const [count, setCount] = useState(0)
  const [showCount, setShowCount] = useState(true)
  const [liveIssue, setLiveIssue] = useState<string | null>(null)

  // Mutable state read inside the animation loop.
  const phaseRef = useRef<Phase>('loading')
  const run = useRef({
    counter: new RepCounter(),
    monitor: new FormMonitor(),
    startPerf: 0,
    startedAt: new Date(),
    lastFrame: 0,
    cues: new Set<string>(),
  })
  const countdownTimer = useRef<number | undefined>(undefined)
  const readySince = useRef<number | null>(null)
  const failingSince = useRef<Partial<Record<keyof Checks, number>>>({})

  const goto = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const finish = useCallback(async () => {
    goto('saving')
    const r = run.current
    const t = (performance.now() - r.startPerf) / 1000
    r.counter.finish(t)
    speak('Stop. Well done. You can relax now.', { interrupt: true })
    const flags = r.monitor.summary()
    try {
      const saved = await api.createSession({
        started_at: r.startedAt.toISOString(),
        raw_reps: r.counter.count,
        used_arms: flags.used_arms,
        quality_flags: flags,
        metrics: {},
        rep_events: r.counter.events,
      })
      navigate(`/results/${saved.id}`)
    } catch (e) {
      setError(`Could not save your result: ${(e as Error).message}`)
      goto('error')
    }
  }, [goto, navigate])

  const onSetupFrame = useCallback((now: number, frame: FrameAnalysis | null) => {
    const c: Checks = frame
      ? {
          visible: frame.bodyVisible,
          sideOn: frame.sideOn,
          armsCrossed: frame.armsCrossed,
          seated: frame.bodyVisible && frame.extension <= THRESHOLDS.sitEnter + 10,
        }
      : NO_CHECKS
    setChecks((prev) => (Object.keys(c) as (keyof Checks)[]).some((k) => prev[k] !== c[k]) ? c : prev)

    // Speak the first failing check once it has been failing for a while.
    for (const key of Object.keys(HINTS) as (keyof Checks)[]) {
      if (c[key]) {
        delete failingSince.current[key]
        continue
      }
      failingSince.current[key] ??= now
      if (now - failingSince.current[key]! > HINT_DELAY_MS) speakThrottled(HINTS[key], 8000)
      break
    }

    const allOk = Object.values(c).every(Boolean)
    if (!allOk) readySince.current = null
    else readySince.current ??= now
    const isReady = readySince.current !== null && now - readySince.current >= READY_HOLD_MS
    setReady((prev) => (prev === isReady ? prev : isReady))
  }, [])

  const onRunFrame = useCallback(
    (now: number, poseCount: number, frame: FrameAnalysis | null) => {
      const r = run.current
      const t = (now - r.startPerf) / 1000
      const dt = r.lastFrame ? (now - r.lastFrame) / 1000 : 0
      r.lastFrame = now

      const issue = r.monitor.update(dt, poseCount, frame)
      if (frame?.bodyVisible && r.counter.update(t, frame.extension)) setCount(r.counter.count)

      if (issue === 'out_of_frame') speakThrottled('Please stay in view of the camera.')
      else if (issue === 'arms') speakThrottled('Please keep your arms crossed.')
      setLiveIssue(
        issue === 'out_of_frame' ? 'Stay in view of the camera' : issue === 'arms' ? 'Keep your arms crossed' : null,
      )

      if (t >= 15 && !r.cues.has('half')) {
        r.cues.add('half')
        speak('Halfway. Keep going.')
      }
      if (t >= TEST_SECONDS - 5 && !r.cues.has('five')) {
        r.cues.add('five')
        speak('Five seconds left.')
      }
      setRemaining(Math.max(0, Math.ceil(TEST_SECONDS - t)))
      if (t >= TEST_SECONDS) finish()
    },
    [finish],
  )

  // The loop reads the latest handlers through a ref so the camera effect runs only once.
  const handlers = useRef({ onSetupFrame, onRunFrame })
  useEffect(() => {
    handlers.current = { onSetupFrame, onRunFrame }
  })

  // Camera + model setup, then a single animation loop for the page's lifetime.
  useEffect(() => {
    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null
    let landmarker: PoseLandmarker | null = null
    let lastVideoTime = -1

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      const now = performance.now()
      const result = landmarker.detectForVideo(video, now)
      const pose = primaryPose(result.landmarks)
      const frame = pose ? analyzeFrame(pose) : null

      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (pose) {
        const draw = new DrawingUtils(ctx)
        const color = frame?.bodyVisible ? '#22c55e' : '#f59e0b'
        draw.drawConnectors(pose, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 4 })
        draw.drawLandmarks(pose, { color: '#ffffff', radius: 3 })
      }

      if (phaseRef.current === 'setup') handlers.current.onSetupFrame(now, frame)
      else if (phaseRef.current === 'running') handlers.current.onRunFrame(now, result.landmarks.length, frame)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        landmarker = await getPoseLandmarker()
        if (cancelled) return
        goto('setup')
        speak(SETUP_INSTRUCTIONS)
        raf = requestAnimationFrame(loop)
      } catch (e) {
        if (cancelled) return
        const name = (e as DOMException).name
        setError(
          name === 'NotAllowedError'
            ? 'KeepUp needs permission to use your camera. Please allow camera access and reload the page.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : `Could not start the camera or pose model: ${(e as Error).message}`,
        )
        goto('error')
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearInterval(countdownTimer.current)
      stream?.getTracks().forEach((t) => t.stop())
      stopSpeaking()
    }
  }, [goto])

  function start() {
    goto('countdown')
    let n = 3
    setCountdown(n)
    speak('Get ready. Three', { interrupt: true })
    const id = (countdownTimer.current = window.setInterval(() => {
      n -= 1
      if (n > 0) {
        setCountdown(n)
        speak(String(n), { interrupt: true })
        return
      }
      window.clearInterval(id)
      speak('Go!', { interrupt: true })
      run.current = {
        counter: new RepCounter(),
        monitor: new FormMonitor(),
        startPerf: performance.now(),
        startedAt: new Date(),
        lastFrame: 0,
        cues: new Set(),
      }
      setCount(0)
      setRemaining(TEST_SECONDS)
      goto('running')
    }, 1000))
  }

  function abort() {
    stopSpeaking()
    readySince.current = null
    setReady(false)
    setLiveIssue(null)
    goto('setup')
  }

  return (
    <section className="runner">
      <div className="stage">
        <video ref={videoRef} playsInline muted className="mirror" />
        <canvas ref={canvasRef} className="mirror overlay" />

        {phase === 'loading' && <div className="stage-msg">Starting camera…</div>}
        {phase === 'countdown' && <div className="stage-msg huge">{countdown}</div>}
        {phase === 'running' && (
          <>
            <div className="timer">{remaining}</div>
            {showCount && <div className="live-count">{count}</div>}
            {liveIssue && <div className="live-issue">{liveIssue}</div>}
          </>
        )}
        {phase === 'saving' && <div className="stage-msg">Saving your result…</div>}
      </div>

      <aside className="panel">
        {phase === 'error' && (
          <>
            <p className="error">{error}</p>
            <button className="primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </>
        )}

        {phase === 'setup' && (
          <>
            <h2>Get into position</h2>
            <ul className="checks">
              <li className={checks.visible ? 'ok' : ''}>Whole body in view</li>
              <li className={checks.sideOn ? 'ok' : ''}>Side facing the camera</li>
              <li className={checks.armsCrossed ? 'ok' : ''}>Arms crossed on chest</li>
              <li className={checks.seated ? 'ok' : ''}>Sitting on the chair</li>
            </ul>
            <button className="primary big" disabled={!ready} onClick={start}>
              {ready ? 'Start' : 'Waiting for position…'}
            </button>
            <button className="link" onClick={() => speak(SETUP_INSTRUCTIONS, { interrupt: true })}>
              Hear the instructions again
            </button>
            <label className="toggle">
              <input type="checkbox" checked={showCount} onChange={(e) => setShowCount(e.target.checked)} />
              Show the count during the test
            </label>
          </>
        )}

        {phase === 'running' && (
          <>
            <p className="lead">Stand up fully, then sit all the way down. Repeat as many times as you can.</p>
            <button onClick={abort}>Stop test</button>
          </>
        )}
      </aside>
    </section>
  )
}
