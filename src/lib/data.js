import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { fusionarRoster, marcaMasReciente } from './participantes'

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
 * El listado de participantes PARA EL CELULAR. Hace lo mismo que
 * `useParticipants` de cara a quien lo usa, pero cuesta una fracción.
 *
 * `useParticipants` escucha la colección entera, así que cada vez que alguien
 * gana puntos Firestore reenvía su documento completo —nombre, área, respuestas
 * del quiz— a los 35 celulares, aunque el celular no muestre los puntos de
 * nadie más. Medido: ~2,17 lecturas por inversión y por celular, que con 35
 * personas se come la cuota diaria del plan gratuito.
 *
 * Aquí el celular:
 *   1. carga el listado una sola vez (los nombres y las respuestas no cambian),
 *   2. escucha EN VIVO solo su propio documento, que es lo único suyo que cambia,
 *   3. y pide solo a los que se registraron después cuando `activos_count`
 *      —que ya viene del listener de `session`, gratis— le avisa que subió.
 *
 * Si el contador baja es que el anfitrión sacó a alguien: una consulta por
 * fecha no puede ver un documento que cambió sin crearse, así que ahí sí toca
 * recargar entero. Es una acción manual y excepcional.
 *
 * Lo que en vivo se ve completo es el proyector (`/display`), que sigue
 * escuchando todo: es un solo cliente y su costo es despreciable.
 */
const REINTENTOS_ROSTER = 4
const ESPERA_REINTENTO = 800

export function useRoster(miTicker, activosCount) {
  const [roster, setRoster] = useState([])
  const [propio, setPropio] = useState(null)
  const [cargado, setCargado] = useState(false)
  const rosterRef = useRef([])
  const cuentaPrevia = useRef(undefined)

  const guardar = useCallback((lista) => {
    rosterRef.current = lista
    setRoster(lista)
  }, [])

  const comoObjetos = (snap) => snap.docs.map((d) => ({ ticker: d.id, ...d.data() }))

  // `getDocs` no reintenta solo, a diferencia de `onSnapshot`. Sin reintento, un
  // fallo de red al abrir dejaría el listado vacío para siempre, y como
  // Participant.jsx borra el localStorage cuando no encuentra el perfil, esa
  // persona acabaría registrándose por segunda vez. Por eso se reintenta, y por
  // eso `cargado` solo se marca cuando de verdad hubo respuesta.
  const cargarTodo = useCallback(async () => {
    for (let intento = 0; intento < REINTENTOS_ROSTER; intento++) {
      try {
        const snap = await getDocs(collection(db, 'participants'))
        marcarOk()
        guardar(fusionarRoster([], comoObjetos(snap)))
        setCargado(true)
        return
      } catch (err) {
        console.error(`roster: carga completa (intento ${intento + 1})`, err)
        marcarFallo()
        await new Promise((r) => setTimeout(r, ESPERA_REINTENTO * 2 ** intento))
      }
    }
    // Agotados los intentos: se deja `cargado` en falso a propósito, para que la
    // pantalla siga diciendo "Conectando…" en vez de ofrecer un registro que
    // duplicaría a alguien que ya existe.
  }, [guardar])

  const cargarDelta = useCallback(async () => {
    const marca = marcaMasReciente(rosterRef.current)
    if (!marca) return cargarTodo() // nadie tiene created_at: no hay cota posible
    try {
      const snap = await getDocs(
        query(collection(db, 'participants'), where('created_at', '>=', marca)),
      )
      marcarOk()
      guardar(fusionarRoster(rosterRef.current, comoObjetos(snap)))
    } catch (err) {
      console.error('roster: delta', err)
      marcarFallo()
    }
    return undefined
  }, [cargarTodo, guardar])

  useEffect(() => {
    cargarTodo()
  }, [cargarTodo])

  // El documento propio, en vivo: puntos, racha, inversiones recibidas, la
  // postura del rumor y el `activo` con el que el anfitrión puede sacarte.
  useEffect(() => {
    if (!miTicker) {
      setPropio(null)
      return undefined
    }
    return onSnapshot(
      doc(db, 'participants', miTicker),
      (snap) => {
        marcarOk()
        setPropio(snap.exists() ? { ticker: snap.id, ...snap.data() } : null)
      },
      (err) => {
        console.error('roster: documento propio', err)
        marcarFallo()
      },
    )
  }, [miTicker])

  // `activos_count` sube al registrarse alguien y baja al sacarlo del mercado,
  // así que sirve de aviso de "el listado cambió" sin costar un listener más.
  useEffect(() => {
    if (typeof activosCount !== 'number' || !cargado) return
    const previa = cuentaPrevia.current
    cuentaPrevia.current = activosCount
    if (previa === undefined || previa === activosCount) return
    if (activosCount > previa) cargarDelta()
    else cargarTodo()
  }, [activosCount, cargado, cargarDelta, cargarTodo])

  // El documento propio pisa a la copia del listado, que puede ser vieja.
  const participants = useMemo(
    () => (propio ? fusionarRoster(roster, [propio]) : roster),
    [roster, propio],
  )

  return { participants, cargado, recargar: cargarTodo }
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



