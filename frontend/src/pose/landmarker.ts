import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

let instance: Promise<PoseLandmarker> | null = null

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  instance ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL)
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 2, // detect a second person so we can flag it
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    try {
      return await PoseLandmarker.createFromOptions(vision, options('GPU'))
    } catch {
      return await PoseLandmarker.createFromOptions(vision, options('CPU'))
    }
  })()
  instance.catch(() => (instance = null))
  return instance
}
