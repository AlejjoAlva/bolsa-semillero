import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { generarTicker, idInversion } from './ticker'
import {
  CASTIGO_CORRECCION,
  CIERRE_PUNTOS,
  RUMOR_MINUTOS,
  ajusteDeCierre,
  calcularPuntos,
  efectoDelRumor,
  elegirAlAzar,
  exposicionA,
  haySobrecompra,
  puntosTrasFallo,
  rondaCompletada,
} from './puntaje'

export {
  PUNTOS_BASE,
  BONO_CRUCE,
  BONO_RACHA,
  RACHA_CADA,
  UMBRAL_SOBRECOMPRA,
  CASTIGO_APUESTA,
  RUMOR_MINUTOS,
  COMISION_LIQUIDAR,
  calcularPuntos,
} from './puntaje'

/** Error con mensaje ya listo para mostrarle a un participante. */
export class ErrorAmable extends Error {}

const sessionRef = () => doc(db, 'session', 'main')

/** Número de ronda vigente. Cada reinicio de partida lo sube en uno. */
export async function rondaActual() {
  const snap = await getDoc(sessionRef())
  return snap.exists() ? (snap.data().ronda ?? 1) : 1
}

async function escribirLog(type, detail, ronda) {
  // El log es informativo: si falla no queremos tumbar la acción principal.
  try {
    await addDoc(collection(db, 'logs'), {
      timestamp: serverTimestamp(),
      type,
      detail,
      ronda: ronda ?? (await rondaActual()),
    })
  } catch (err) {
    console.error('log', type, err)
  }
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
    inversiones_hechas: 0,
    activo: true,
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
      // El contador de activos vive en la sesión para que comprobar el fin de
      // la ronda no cueste una lectura de toda la colección en cada inversión.
      await setDoc(sessionRef(), { activos_count: increment(1) }, { merge: true })
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
 * Devuelve { puntos, cruce, bonoRacha }.
 */
export async function invertir({ investorTicker, targetTicker, questionType, apuesta = false }) {
  if (investorTicker === targetTicker) throw new ErrorAmable('No puedes invertir en ti mismo.')

  // El id de la inversión depende de la ronda, así que hay que conocerla antes de
  // abrir la transacción. Adentro se vuelve a comprobar por si reiniciaron entre medias.
  const ronda = await rondaActual()

  const invRef = doc(db, 'investments', idInversion(investorTicker, targetTicker, ronda))
  const investorRef = doc(db, 'participants', investorTicker)
  const targetRef = doc(db, 'participants', targetTicker)

  const resultado = await runTransaction(db, async (tx) => {
    const [invSnap, investorSnap, targetSnap, sessionSnap] = await Promise.all([
      tx.get(invRef),
      tx.get(investorRef),
      tx.get(targetRef),
      tx.get(sessionRef()),
    ])

    if (invSnap.exists()) throw new ErrorAmable('Ya invertiste en esta persona.')
    if (!investorSnap.exists()) throw new ErrorAmable('No encontramos tu perfil. Recarga la página.')
    if (!targetSnap.exists()) throw new ErrorAmable('Esa persona ya no está en el mercado.')
    if (targetSnap.data().activo === false) throw new ErrorAmable('Esa persona ya no está en el mercado.')

    const session = sessionSnap.exists() ? sessionSnap.data() : {}
    if (session.game_status !== 'activo') throw new ErrorAmable('El mercado no está abierto en este momento.')
    if ((session.ronda ?? 1) !== ronda) throw new ErrorAmable('La partida se reinició. Vuelve a intentarlo.')

    const investor = investorSnap.data()
    const target = targetSnap.data()

    const { puntos, nuevaRacha, cruce, bonoRacha } = calcularPuntos({
      rachaPrevia: investor.streak ?? 0,
      seniorityInvestor: investor.seniority,
      seniorityTarget: target.seniority,
      apuesta,
    })

    const recibidasTrasEsta = (target.received_count ?? 0) + 1
    const hechasTrasEsta = (investor.inversiones_hechas ?? 0) + 1
    const cuantosActivos = session.activos_count
    const cierraLaRonda =
      typeof cuantosActivos === 'number' && rondaCompletada(hechasTrasEsta, cuantosActivos)

    tx.set(invRef, {
      investor: investorTicker,
      target: targetTicker,
      question_type: questionType,
      ronda,
      apuesta,
      created_at: serverTimestamp(),
    })
    tx.update(investorRef, {
      points: increment(puntos),
      streak: nuevaRacha,
      inversiones_hechas: increment(1),
    })
    tx.update(targetRef, { received_count: increment(1) })

    // Cerrar aquí mismo evita la carrera entre dos personas que terminan a la
    // vez, y no cuesta ni una lectura más.
    if (cierraLaRonda) {
      tx.set(
        sessionRef(),
        { game_status: 'cerrado', completada_por: investorTicker, completada_en: serverTimestamp() },
        { merge: true },
      )
    }

    return { puntos, cruce, bonoRacha, apuesta, recibidasTrasEsta, cierraLaRonda }
  })

  await escribirLog('inversion', `$${investorTicker} invirtió en $${targetTicker} (+${resultado.puntos})`, ronda)

  // Las dos consecuencias que no caben dentro de la transacción: necesitan
  // consultas, y Firestore no permite consultar desde dentro de una.
  const correccion = haySobrecompra(resultado.recibidasTrasEsta)
    ? await aplicarCorreccion(targetTicker, ronda)
    : null

  if (resultado.cierraLaRonda) {
    await escribirLog('fin', `🏁 $${investorTicker} invirtió en todo el mercado. Ronda cerrada.`, ronda)
  }

  return { ...resultado, correccion, rondaCompleta: resultado.cierraLaRonda }
}

/** Inversiones de una ronda que apuntan a alguien. */
async function inversionesHacia(targetTicker, ronda) {
  const snap = await getDocs(query(collection(db, 'investments'), where('target', '==', targetTicker)))
  return snap.docs.map((d) => d.data()).filter((d) => (d.ronda ?? 1) === ronda)
}

/**
 * Corrección por sobrecompra: cuando una acción pasa el umbral de inversiones
 * recibidas, todos los que ya invirtieron en ella pierden un punto.
 *
 * La marca `correccion_ronda` hace la operación idempotente: si dos personas
 * invierten a la vez y ambas cruzan el umbral, solo una llega a aplicarla.
 * Devuelve { ticker, afectados } o null si no tocaba hacer nada.
 */
export async function aplicarCorreccion(targetTicker, ronda) {
  const targetRef = doc(db, 'participants', targetTicker)

  const meToca = await runTransaction(db, async (tx) => {
    const snap = await tx.get(targetRef)
    if (!snap.exists()) return false
    const datos = snap.data()
    if (!haySobrecompra(datos.received_count) || datos.correccion_ronda === ronda) return false
    tx.update(targetRef, { correccion_ronda: ronda })
    return true
  })

  if (!meToca) return null

  const inversores = [...new Set((await inversionesHacia(targetTicker, ronda)).map((i) => i.investor))]
  if (inversores.length === 0) return { ticker: targetTicker, afectados: 0 }

  // Leemos antes de escribir para no dejar a nadie con puntos negativos.
  const docs = await Promise.all(
    inversores.map((t) => getDoc(doc(db, 'participants', t))),
  )
  const lote = writeBatch(db)
  let afectados = 0
  for (const d of docs) {
    if (!d.exists()) continue
    const puntos = d.data().points ?? 0
    lote.update(d.ref, { points: Math.max(0, puntos - CASTIGO_CORRECCION) })
    afectados++
  }

  // Misma guardia que en el rumor: si reiniciaron la partida mientras
  // calculábamos, el castigo ya no corresponde a esta ronda.
  const sesionAhora = await getDoc(sessionRef())
  if (!sesionAhora.exists() || (sesionAhora.data().ronda ?? 1) !== ronda) {
    console.warn('corrección descartada: la partida se reinició mientras se aplicaba')
    return null
  }

  await lote.commit()

  await escribirLog(
    'correccion',
    `📉 $${targetTicker} se sobrecalentó: ${afectados} inversores pierden ${CASTIGO_CORRECCION} punto`,
    ronda,
  )
  return { ticker: targetTicker, afectados }
}


/**
 * Falló el quiz: se pierde la racha y, si había apostado, también puntos.
 * No se crea la inversión, así que puede volver a intentarlo con esa persona.
 * Devuelve cuántos puntos perdió.
 */
export async function fallarInversion(investorTicker, apuesta = false) {
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, 'participants', investorTicker)
      const snap = await tx.get(ref)
      if (!snap.exists()) return 0

      const puntos = snap.data().points ?? 0
      const quedan = puntosTrasFallo(puntos, apuesta)
      tx.update(ref, { streak: 0, points: quedan })
      return puntos - quedan
    })
  } catch (err) {
    console.error('fallarInversion', err)
    return 0
  }
}

// --- Controles del host -----------------------------------------------------

/**
 * Crea session/main la primera vez. NO pisa lo que ya haya: antes esto hacía un
 * merge de `game_status: 'esperando'` en cada carga de /host, así que recargar el
 * panel en mitad del juego cerraba el mercado.
 */
export async function asegurarSesion() {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef())
    if (snap.exists()) {
      // Sesiones creadas antes de las rondas no tienen el campo.
      if (snap.data().ronda === undefined) tx.update(sessionRef(), { ronda: 1 })
      return
    }
    tx.set(sessionRef(), { game_status: 'esperando', ronda: 1 })
  })
}

/**
 * Cierra la partida a mano. Mismo efecto que el cierre automático —el mercado
 * se bloquea en todos los celulares y la pantalla grande lo anuncia—, pero
 * queda registrado que lo cerró el anfitrión y no alguien que completó el
 * mercado, porque son dos finales distintos y la sala merece saber cuál fue.
 */
export async function finalizarPartida() {
  const snap = await getDoc(sessionRef())
  const ronda = snap.exists() ? (snap.data().ronda ?? 1) : 1
  await setDoc(
    sessionRef(),
    { game_status: 'cerrado', cerrada_por_host: true, completada_en: serverTimestamp() },
    { merge: true },
  )
  await escribirLog('fin', '🔔 El anfitrión cerró el mercado. Gana quien tenga más puntos.', ronda)
}

export function cambiarEstado(game_status) {
  // Reabrir el mercado borra las marcas de cierre: si no, la pantalla grande
  // seguiría anunciando un final que ya no es cierto.
  const extra = game_status === 'activo' ? { completada_por: null, cerrada_por_host: null } : {}
  return setDoc(sessionRef(), { game_status, ...extra }, { merge: true })
}




/**
 * Saca a alguien del mercado sin borrarlo (las reglas no permiten borrar):
 * queda con `activo: false` y desaparece de rankings, listas y quizzes.
 */
export async function sacarDelMercado(ticker) {
  await updateDoc(doc(db, 'participants', ticker), { activo: false })
  await setDoc(sessionRef(), { activos_count: increment(-1) }, { merge: true })
  await escribirLog('mercado', `$${ticker} salió del mercado`)
}

export async function devolverAlMercado(ticker) {
  await updateDoc(doc(db, 'participants', ticker), { activo: true })
  await setDoc(sessionRef(), { activos_count: increment(1) }, { merge: true })
  await escribirLog('mercado', `$${ticker} volvió al mercado`)
}

/**
 * Recalcula el contador de activos leyendo la colección una sola vez. El panel
 * lo llama al abrirse: si el contador se desincronizó (una escritura perdida,
 * o una sesión creada antes de que el campo existiera), aquí se cura solo.
 */
export async function sincronizarActivos() {
  const snap = await getDocs(collection(db, 'participants'))
  const activosCount = snap.docs.filter((d) => d.data().activo !== false).length
  await setDoc(sessionRef(), { activos_count: activosCount }, { merge: true })
  return activosCount
}

/**
 * Reinicia la partida conservando a la gente registrada: puntos, rachas e
 * inversiones recibidas vuelven a cero y la ronda sube en uno, lo que invalida
 * las inversiones anteriores sin borrar un solo documento.
 * Devuelve la ronda nueva.
 */
export async function reiniciarPartida() {
  const [participantesSnap, sessionSnap] = await Promise.all([
    getDocs(collection(db, 'participants')),
    getDoc(sessionRef()),
  ])
  const nuevaRonda = (sessionSnap.exists() ? (sessionSnap.data().ronda ?? 1) : 1) + 1

  const lote = writeBatch(db)
  for (const d of participantesSnap.docs) {
    lote.update(d.ref, { points: 0, received_count: 0, streak: 0, inversiones_hechas: 0 })
  }
  lote.set(
    sessionRef(),
    {
      game_status: 'esperando',
      ronda: nuevaRonda,
      completada_por: null,
      completada_en: null,
      cerrada_por_host: null,
      rumor: null,
      rumores_lanzados: 0,
      hito_cancelado: null,
      activos_count: participantesSnap.docs.filter((d) => d.data().activo !== false).length,
    },
    { merge: true },
  )
  await lote.commit()

  await escribirLog(
    'reinicio',
    `♻️ Partida reiniciada — ronda ${nuevaRonda} (${participantesSnap.size} participantes en cero)`,
    nuevaRonda,
  )
  return nuevaRonda
}

/**
 * Cierre volátil: el ajuste final del anfitrión. Las acciones más compradas se
 * desinflan y las que nadie buscó se revalorizan. Se aplica una sola vez por
 * ronda; devuelve a quiénes tocó.
 */
export async function cierreVolatil() {
  const [participantesSnap, sessionSnap] = await Promise.all([
    getDocs(collection(db, 'participants')),
    getDoc(sessionRef()),
  ])
  const ronda = sessionSnap.exists() ? (sessionSnap.data().ronda ?? 1) : 1
  if (sessionSnap.exists() && sessionSnap.data().cierre_ronda === ronda) {
    throw new ErrorAmable('El cierre volátil ya se aplicó en esta ronda.')
  }

  const gente = participantesSnap.docs
    .filter((d) => d.data().activo !== false)
    .map((d) => ({ ticker: d.id, ref: d.ref, ...d.data() }))

  const { bajan, suben } = ajusteDeCierre(gente)
  if (bajan.length === 0) throw new ErrorAmable('Hace falta más gente en el mercado para el cierre.')

  const lote = writeBatch(db)
  for (const p of bajan) lote.update(p.ref, { points: Math.max(0, (p.points ?? 0) - CIERRE_PUNTOS) })
  for (const p of suben) lote.update(p.ref, { points: (p.points ?? 0) + CIERRE_PUNTOS })
  lote.set(sessionRef(), { cierre_ronda: ronda }, { merge: true })
  await lote.commit()

  await escribirLog(
    'ajuste',
    `⚖️ Cierre volátil: bajan ${bajan.map((p) => '$' + p.ticker).join(', ')} · suben ${suben
      .map((p) => '$' + p.ticker)
      .join(', ')}`,
    ronda,
  )
  return { bajan: bajan.map((p) => p.ticker), suben: suben.map((p) => p.ticker) }
}

// --- Rumor de sector --------------------------------------------------------

/**
 * Lanza un rumor sobre un sector. Dura unos minutos y al vencer el proyector
 * sortea si era cierto. Cada rumor lleva su propio id, así que las posturas de
 * uno anterior no cuentan y no hace falta limpiar los 40 documentos.
 */
export async function lanzarRumor(area, minutos = RUMOR_MINUTOS) {
  const snap = await getDoc(sessionRef())
  const ronda = snap.exists() ? (snap.data().ronda ?? 1) : 1
  const vigente = snap.exists() ? snap.data().rumor : null
  if (vigente && !vigente.resuelto) throw new ErrorAmable('Ya hay un rumor en curso.')

  const rumor = {
    id: `${ronda}-${Date.now()}`,
    area,
    expira_at: Timestamp.fromMillis(Date.now() + minutos * 60 * 1000),
    resuelto: null,
  }
  await setDoc(
    sessionRef(),
    { rumor, rumores_lanzados: increment(1), hito_cancelado: null },
    { merge: true },
  )
  await escribirLog('rumor', `📰 Se rumorea que ${area} se va a desplomar — ${minutos} minutos`, ronda)
  return rumor
}

/** La postura de una persona ante el rumor vigente. */
export function fijarPostura(ticker, rumorId, postura) {
  return updateDoc(doc(db, 'participants', ticker), {
    postura_rumor: postura,
    postura_rumor_id: rumorId,
  })
}

/**
 * Cierra el rumor: sortea el resultado y ajusta los puntos de todo el mundo
 * según su exposición al sector y la postura que tomó. Idempotente — solo el
 * primero que llega escribe el resultado.
 */
export async function resolverRumor() {
  const marca = await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef())
    const rumor = snap.exists() ? snap.data().rumor : null
    if (!rumor || rumor.resuelto) return null

    const cierto = Math.random() < 0.5
    tx.update(sessionRef(), { rumor: { ...rumor, resuelto: cierto ? 'cierto' : 'falso' } })
    return { rumor, cierto }
  })

  if (!marca) return null
  const { rumor, cierto } = marca
  const ronda = Number(rumor.id.split('-')[0])

  // El filtro por ronda va en la consulta: sin él, resolver un rumor leía todas
  // las inversiones de todas las rondas anteriores acumuladas en la base.
  const [participantesSnap, inversionesSnap] = await Promise.all([
    getDocs(collection(db, 'participants')),
    getDocs(query(collection(db, 'investments'), where('ronda', '==', ronda))),
  ])

  const areaDe = Object.fromEntries(participantesSnap.docs.map((d) => [d.id, d.data().area]))
  const porInversor = new Map()
  for (const d of inversionesSnap.docs) {
    const inv = d.data()
    if (!porInversor.has(inv.investor)) porInversor.set(inv.investor, [])
    porInversor.get(inv.investor).push(inv.target)
  }

  const lote = writeBatch(db)
  let ganadores = 0
  let perdedores = 0

  for (const d of participantesSnap.docs) {
    const datos = d.data()
    const exposicion = exposicionA(rumor.area, porInversor.get(d.id) ?? [], areaDe)
    const postura = datos.postura_rumor_id === rumor.id ? datos.postura_rumor : undefined
    const delta = efectoDelRumor({ postura, exposicion, cierto })
    if (delta === 0) continue

    lote.update(d.ref, { points: Math.max(0, (datos.points ?? 0) + delta) })
    if (delta > 0) ganadores++
    else perdedores++
  }

  // Guardia contra reinicios a mitad del cálculo: escribimos puntos absolutos
  // a partir de una lectura previa, así que si la partida se reinició entre
  // medias estaríamos resucitando puntos de una ronda que ya no existe.
  const ahora = await getDoc(sessionRef())
  if (!ahora.exists() || (ahora.data().ronda ?? 1) !== ronda) {
    console.warn('rumor descartado: la partida se reinició mientras se resolvía')
    return null
  }

  await lote.commit()

  await escribirLog(
    'rumor',
    cierto
      ? `📉 El rumor era CIERTO: ${rumor.area} se desploma. ${perdedores} pierden, ${ganadores} se salvaron.`
      : `📈 El rumor era FALSO: ${rumor.area} aguanta. ${ganadores} ganan, ${perdedores} pagan comisión.`,
    ronda,
  )

  return { cierto, area: rumor.area, ganadores, perdedores }
}


/**
 * Congela el rumor que estaba a punto de salir. No lo cancela para siempre: el
 * hito sigue alcanzado, así que el panel deja el botón armado y el anfitrión lo
 * lanza cuando le convenga. El siguiente automático llegará con el hito de
 * avance siguiente.
 */
export function congelarRumorArmado(hito) {
  return setDoc(sessionRef(), { hito_cancelado: hito }, { merge: true })
}

/**
 * Lanza el rumor armado por el avance del mercado, sorteando entre los sectores
 * que ya tienen gente expuesta. La transacción comprueba de nuevo el estado
 * para que dos pestañas de /host abiertas no lancen dos rumores.
 */
export async function lanzarRumorPorHito(viables, hito) {
  if (!viables || viables.length === 0) return null

  const permitido = await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef())
    if (!snap.exists()) return false
    const datos = snap.data()
    if (datos.game_status !== 'activo') return false
    if (datos.rumor && !datos.rumor.resuelto) return false
    if (hito <= (datos.rumores_lanzados ?? 0)) return false
    if (datos.hito_cancelado === hito) return false
    return true
  })

  if (!permitido) return null
  return lanzarRumor(elegirAlAzar(viables))
}
