import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from './firebase'

// --- Estado de conexión -----------------------------------------------------
// Los listeners de Firestore no avisan al usuario cuando fallan: se quedan con
// el último dato y la pantalla parece viva aunque esté congelada. Este pequeño
// registro compartido deja que la app lo diga en voz alta.

let hayFallo = false
const suscriptores = new Set()

function anunciar(valor) {
  if (hayFallo === valor) return
  hayFallo = valor
  for (const fn of suscriptores) fn(valor)
}

const marcarFallo = () => anunciar(true)
const marcarOk = () => anunciar(false)

/** true cuando la app perdió el hilo con Firestore o el navegador está sin red. */
export function useConexion() {
  const [caido, setCaido] = useState(() => hayFallo || (typeof navigator !== 'undefined' && !navigator.onLine))

  useEffect(() => {
    const fn = (valor) => setCaido(valor || !navigator.onLine)
    suscriptores.add(fn)
    const offline = () => setCaido(true)
    const online = () => setCaido(hayFallo)
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      suscriptores.delete(fn)
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
    }
  }, [])

  return caido
}

export { AREAS, etiquetaArea, nombreCortoArea, claseArea, siglaArea } from './areas'

/** session/main en vivo. Si el documento no existe todavía, devuelve estado "esperando". */
export function useSession() {
  const [session, setSession] = useState(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'session', 'main'),
        (snap) => {
          marcarOk()
          setSession(snap.exists() ? snap.data() : { game_status: 'esperando' })
        },
        (err) => {
          console.error('session listener', err)
          marcarFallo()
          setSession({ game_status: 'esperando' })
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
          marcarOk()
          setParticipants(snap.docs.map((d) => ({ ticker: d.id, ...d.data() })))
          setCargado(true)
        },
        (err) => {
          console.error('participants listener', err)
          marcarFallo()
          setCargado(true)
        },
      ),
    [],
  )

  return { participants, cargado }
}

/**
 * Últimas entradas del log de la ronda indicada, más reciente primero.
 * `max = 0` trae todas. Mientras no se sepa la ronda (session cargando) no se
 * suscribe, para no mostrar por un instante el log de la partida anterior.
 */
export function useLogs(max = 10, ronda) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    if (ronda === undefined || ronda === null) return undefined
    const base = [collection(db, 'logs'), where('ronda', '==', ronda), orderBy('timestamp', 'desc')]
    const q = max > 0 ? query(...base, fsLimit(max)) : query(...base)
    return onSnapshot(
      q,
      (snap) => {
        marcarOk()
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (err) => {
        console.error('logs listener', err)
        marcarFallo()
      },
    )
  }, [max, ronda])

  return logs
}

/**
 * Inversiones de la ronda en curso. Se filtra en memoria en vez de en la
 * consulta para no depender de un índice compuesto: son unas pocas decenas.
 */
export function useInversiones(ronda) {
  const [inversiones, setInversiones] = useState([])

  useEffect(() => {
    if (ronda === undefined || ronda === null) return undefined
    // El filtro va en la CONSULTA, no en memoria: si no, cada carga del panel
    // se descargaría también las inversiones de todas las rondas anteriores, y
    // en Firestore cada documento entregado es una lectura que se cobra.
    return onSnapshot(
      query(collection(db, 'investments'), where('ronda', '==', ronda)),
      (snap) => {
        marcarOk()
        setInversiones(snap.docs.map((d) => d.data()))
      },
      (err) => {
        console.error('investments listener', err)
        marcarFallo()
      },
    )
  }, [ronda])

  return inversiones
}

/** Milisegundos que faltan para un Timestamp de Firestore (0 si ya pasó). */
export function msHasta(ts, ahora = Date.now()) {
  const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : NaN
  return Number.isFinite(ms) ? Math.max(0, ms - ahora) : 0
}

export function formatearCuentaRegresiva(ms) {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** El rumor vigente, si lo hay y todavía no se ha resuelto el sorteo. */
export function rumorDe(session) {
  return session?.rumor ?? null
}

/** Ronda vigente según session. Las sesiones viejas sin el campo son la 1. */
export function rondaDe(session) {
  return session?.ronda ?? (session ? 1 : undefined)
}



