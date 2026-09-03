import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from './firebase'

export const AREAS = [
  { key: 'analitica', label: 'Analítica' },
  { key: 'macro', label: 'Macro' },
  { key: 'commodities', label: 'Commodities' },
  { key: 'capitales', label: 'Capitales' },
]

export const etiquetaArea = (key) => AREAS.find((a) => a.key === key)?.label ?? key

/** session/main en vivo. Si el documento no existe todavía, devuelve estado "esperando". */
export function useSession() {
  const [session, setSession] = useState(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'session', 'main'),
        (snap) =>
          setSession(snap.exists() ? snap.data() : { game_status: 'esperando', bull_run_expires_at: null }),
        (err) => {
          console.error('session listener', err)
          setSession({ game_status: 'esperando', bull_run_expires_at: null })
        },
      ),
    [],
  )

  return session
}

/** Todos los participantes en vivo. El cliente los tiene en memoria para armar los quizzes. */
export function useParticipants() {
  const [participants, setParticipants] = useState([])
  const [cargado, setCargado] = useState(false)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'participants'),
        (snap) => {
          setParticipants(snap.docs.map((d) => ({ ticker: d.id, ...d.data() })))
          setCargado(true)
        },
        (err) => {
          console.error('participants listener', err)
          setCargado(true)
        },
      ),
    [],
  )

  return { participants, cargado }
}

/** Últimas entradas del log, más reciente primero. `max = 0` trae todo. */
export function useLogs(max = 10) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const base = [collection(db, 'logs'), orderBy('timestamp', 'desc')]
    const q = max > 0 ? query(...base, fsLimit(max)) : query(...base)
    return onSnapshot(
      q,
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('logs listener', err),
    )
  }, [max])

  return logs
}

/** true si hay bull run vigente según session. */
export function bullRunActivo(session, ahora = Date.now()) {
  const ts = session?.bull_run_expires_at
  if (!ts) return false
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime()
  return Number.isFinite(ms) && ms > ahora
}

/** Milisegundos restantes de bull run (0 si no hay). */
export function msRestantesBullRun(session, ahora = Date.now()) {
  const ts = session?.bull_run_expires_at
  if (!ts) return 0
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime()
  return Number.isFinite(ms) ? Math.max(0, ms - ahora) : 0
}

export function formatearCuentaRegresiva(ms) {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
