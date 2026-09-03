import {
  Timestamp,
  addDoc,
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { generarTicker, idInversion } from './ticker'
import { BULL_RUN_MINUTOS, calcularPuntos } from './puntaje'

export {
  PUNTOS_BASE,
  BONO_CRUCE,
  BONO_RACHA,
  RACHA_CADA,
  BULL_RUN_MINUTOS,
  calcularPuntos,
} from './puntaje'

/** Error con mensaje ya listo para mostrarle a un participante. */
export class ErrorAmable extends Error {}

function escribirLog(type, detail) {
  // El log es informativo: si falla no queremos tumbar la acción principal.
  return addDoc(collection(db, 'logs'), {
    timestamp: serverTimestamp(),
    type,
    detail,
  }).catch((err) => console.error('log', type, err))
}

/** Crea el participante y devuelve su ticker. `tickersExistentes` es un Set. */
export async function registrarParticipante({ nombre, area, seniority, respuestas }, tickersExistentes) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new ErrorAmable('No hay sesión activa. Recarga la página e intenta de nuevo.')

  const datos = {
    uid,
    name: nombre.trim(),
    area,
    seniority,
    private_answers: {
      comida: respuestas.comida.trim(),
      superpoder: respuestas.superpoder.trim(),
      anecdota: respuestas.anecdota.trim(),
      ciudad: respuestas.ciudad.trim(),
    },
    points: 0,
    received_count: 0,
    streak: 0,
    created_at: serverTimestamp(),
  }

  // La lista de tickers en memoria puede estar desactualizada si dos personas se
  // registran a la vez, asi que la transaccion vuelve a verificar contra Firestore.
  const tomados = new Set(tickersExistentes)

  for (let intento = 0; intento < 5; intento++) {
    const ticker = generarTicker(nombre, tomados)
    if (!ticker) break

    const libre = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'participants', ticker)
      if ((await tx.get(ref)).exists()) return false
      tx.set(ref, datos)
      return true
    })

    if (libre) {
      await escribirLog('registro', `$${ticker} se unió 🎉`)
      return ticker
    }
    tomados.add(ticker)
  }

  throw new ErrorAmable('No pudimos generar un ticker para ese nombre. Prueba con otro nombre.')
}

/**
 * Registra una inversión acertada. Todo el conteo de puntos ocurre dentro de la
 * transacción, leyendo el estado real de Firestore (no el de la pantalla).
 * Devuelve { puntos, bullRun, cruce, bonoRacha }.
 */
export async function invertir({ investorTicker, targetTicker, questionType }) {
  if (investorTicker === targetTicker) throw new ErrorAmable('No puedes invertir en ti mismo.')

  const invRef = doc(db, 'investments', idInversion(investorTicker, targetTicker))
  const investorRef = doc(db, 'participants', investorTicker)
  const targetRef = doc(db, 'participants', targetTicker)
  const sessionRef = doc(db, 'session', 'main')

  const resultado = await runTransaction(db, async (tx) => {
    const [invSnap, investorSnap, targetSnap, sessionSnap] = await Promise.all([
      tx.get(invRef),
      tx.get(investorRef),
      tx.get(targetRef),
      tx.get(sessionRef),
    ])

    if (invSnap.exists()) throw new ErrorAmable('Ya invertiste en esta persona.')
    if (!investorSnap.exists()) throw new ErrorAmable('No encontramos tu perfil. Recarga la página.')
    if (!targetSnap.exists()) throw new ErrorAmable('Esa persona ya no está en el mercado.')

    const session = sessionSnap.exists() ? sessionSnap.data() : {}
    if (session.game_status !== 'activo') throw new ErrorAmable('El mercado no está abierto en este momento.')

    const investor = investorSnap.data()
    const target = targetSnap.data()

    const expira = session.bull_run_expires_at
    const bullRun = Boolean(expira) && expira.toMillis?.() > Date.now()

    const { puntos, nuevaRacha, cruce, bonoRacha } = calcularPuntos({
      rachaPrevia: investor.streak ?? 0,
      seniorityInvestor: investor.seniority,
      seniorityTarget: target.seniority,
      bullRun,
    })

    tx.set(invRef, {
      investor: investorTicker,
      target: targetTicker,
      question_type: questionType,
      created_at: serverTimestamp(),
    })
    tx.update(investorRef, { points: increment(puntos), streak: nuevaRacha })
    tx.update(targetRef, { received_count: increment(1) })

    return { puntos, bullRun, cruce, bonoRacha }
  })

  await escribirLog('inversion', `$${investorTicker} invirtió en $${targetTicker} (+${resultado.puntos})`)
  return resultado
}

/** Falló el quiz: se pierde la racha, pero no se crea la inversión (puede reintentar). */
export async function romperRacha(investorTicker) {
  try {
    await updateDoc(doc(db, 'participants', investorTicker), { streak: 0 })
  } catch (err) {
    console.error('romperRacha', err)
  }
}

// --- Controles del host -----------------------------------------------------

export function asegurarSesion() {
  return setDoc(
    doc(db, 'session', 'main'),
    { game_status: 'esperando', bull_run_expires_at: null },
    { merge: true },
  )
}

export function cambiarEstado(game_status) {
  return setDoc(doc(db, 'session', 'main'), { game_status }, { merge: true })
}

export async function activarBullRun(minutos = BULL_RUN_MINUTOS) {
  await setDoc(
    doc(db, 'session', 'main'),
    { bull_run_expires_at: Timestamp.fromMillis(Date.now() + minutos * 60 * 1000) },
    { merge: true },
  )
  await escribirLog('bull_run', `🚀 Bull Run activado — puntos dobles por ${minutos} minutos`)
}
