// Reglas de puntaje del juego, sin dependencias de Firebase, para poder
// probarlas con `npm test` sin levantar nada.

export const PUNTOS_BASE = 2
export const BONO_CRUCE = 1
export const BONO_RACHA = 1
export const RACHA_CADA = 3

/** Inversiones recibidas a partir de las cuales una acción está sobrecomprada. */
export const UMBRAL_SOBRECOMPRA = 6
/** Lo que pierde cada inversor cuando su acción se sobrecalienta. */
export const CASTIGO_CORRECCION = 1
/** Lo que cuesta fallar el quiz habiendo apostado. */
export const CASTIGO_APUESTA = 2
/** Cuántas acciones suben y bajan en el cierre volátil, y por cuánto. */
export const CIERRE_CUANTAS = 3
export const CIERRE_PUNTOS = 2

/** Duración de un rumor de sector, en minutos. */
export const RUMOR_MINUTOS = 3
/** Lo que cuesta liquidar cuando el rumor resulta falso. */
export const COMISION_LIQUIDAR = 1
/** Mínimo de gente expuesta para que un rumor sobre un sector valga la pena. */
export const MIN_EXPUESTOS = 3
export const FRACCION_EXPUESTOS = 0.3
/**
 * Hitos de avance del mercado que arman un rumor automático. Se miden en
 * fracción del máximo teórico de inversiones, no en minutos: así el ritmo lo
 * marca la sala y no un reloj que no podemos adivinar.
 *
 * Son fracciones bajas a propósito. El máximo teórico —que todos inviertan en
 * todos— no se alcanza nunca: en una hora, con 35 personas, se llega a un 25-30%.
 * Y la ronda puede cerrarse antes, en cuanto alguien complete el mercado. Con
 * estos valores, en un evento típico salen tres rumores bien espaciados.
 */
export const HITOS_RUMOR = [0.06, 0.15, 0.28, 0.45]
/** Segundos de aviso antes de que el rumor automático salga al aire. */
export const AVISO_RUMOR_SEG = 20

/**
 * Puntaje de una inversión acertada.
 * Base 2 · +1 si el cruce es nuevo↔antiguo · +1 cuando la racha llega a
 * múltiplo de 3 · todo x2 si se apostó (venta en corto).
 */
export function calcularPuntos({ rachaPrevia = 0, seniorityInvestor, seniorityTarget, apuesta = false }) {
  const nuevaRacha = rachaPrevia + 1
  const cruce = seniorityInvestor !== seniorityTarget
  const bonoRacha = nuevaRacha % RACHA_CADA === 0

  let puntos = PUNTOS_BASE + (cruce ? BONO_CRUCE : 0) + (bonoRacha ? BONO_RACHA : 0)
  if (apuesta) puntos *= 2

  return { puntos, nuevaRacha, cruce, bonoRacha, apuesta }
}

/** Puntos que quedan tras fallar el quiz. Solo cuesta si se había apostado. */
export function puntosTrasFallo(puntos, apuesta) {
  return apuesta ? Math.max(0, puntos - CASTIGO_APUESTA) : puntos
}

/** Una acción con demasiadas inversiones recibidas está sobrevalorada. */
export function haySobrecompra(recibidas) {
  return (recibidas ?? 0) >= UMBRAL_SOBRECOMPRA
}

/**
 * Cierre volátil: las acciones más compradas se desinflan y las que nadie
 * buscó se revalorizan. Nadie puede estar en las dos listas, así que con poca
 * gente el ajuste se encoge en vez de contradecirse.
 */
export function ajusteDeCierre(participantes, cuantas = CIERRE_CUANTAS) {
  const porDemanda = [...participantes].sort(
    (a, b) => (b.received_count ?? 0) - (a.received_count ?? 0) || a.ticker.localeCompare(b.ticker),
  )
  const tope = Math.min(cuantas, Math.floor(porDemanda.length / 2))

  return {
    bajan: porDemanda.slice(0, tope),
    suben: porDemanda.slice(porDemanda.length - tope).reverse(),
  }
}

/** La ronda termina cuando alguien ya invirtió en todos menos en sí mismo. */
export function rondaCompletada(inversionesHechas, cuantosActivos) {
  return cuantosActivos > 1 && inversionesHechas >= cuantosActivos - 1
}


/** A cuánta gente de un sector le has invertido. `areaDe` es ticker → área. */
export function exposicionA(area, tickersInvertidos, areaDe) {
  return tickersInvertidos.filter((t) => areaDe[t] === area).length
}

/**
 * Puntos que suma o resta un rumor ya resuelto.
 *
 * Quien no eligió nada se considera que mantuvo: quedarse quieto es una
 * decisión. Sin exposición al sector, el rumor no toca a nadie —ni siquiera
 * con la comisión de liquidar—, porque no había nada que liquidar.
 */
export function efectoDelRumor({ postura, exposicion, cierto }) {
  if (!exposicion) return 0
  if (postura === 'liquidar') return cierto ? 0 : -COMISION_LIQUIDAR
  return cierto ? -exposicion : exposicion
}

/**
 * Cuánta gente debe tener exposición a un sector para que un rumor sobre él
 * mueva algo. Escala con la sala, pero nunca baja de MIN_EXPUESTOS: con tres
 * personas afectadas ya hay conversación.
 */
export function umbralExpuestos(cuantosActivos) {
  return Math.max(MIN_EXPUESTOS, Math.ceil(cuantosActivos * FRACCION_EXPUESTOS))
}

/**
 * Cuántas PERSONAS tienen exposición a cada sector. Ojo: cuenta personas, no
 * inversiones — quien invirtió en tres personas de Macro sigue siendo una sola
 * persona expuesta a Macro, y es eso lo que determina si el rumor mueve la sala.
 * `porInversor` es Map(ticker → [tickers en los que invirtió]).
 */
export function expuestosPorSector(porInversor, areaDe) {
  const cuenta = {}
  for (const objetivos of porInversor.values()) {
    const suyas = new Set(objetivos.map((t) => areaDe[t]).filter(Boolean))
    for (const area of suyas) cuenta[area] = (cuenta[area] ?? 0) + 1
  }
  return cuenta
}

/** Sectores sobre los que ya vale la pena lanzar un rumor, en orden alfabético. */
export function sectoresViables(expuestos, cuantosActivos) {
  const umbral = umbralExpuestos(cuantosActivos)
  return Object.entries(expuestos)
    .filter(([, cuantos]) => cuantos >= umbral)
    .map(([area]) => area)
    .sort()
}

/** Elige un elemento al azar. El azar se inyecta para poder probarlo. */
export function elegirAlAzar(lista, azar = Math.random()) {
  if (lista.length === 0) return null
  return lista[Math.min(lista.length - 1, Math.floor(azar * lista.length))]
}

/** Qué fracción del máximo de inversiones posibles lleva la ronda. */
export function progresoMercado(inversiones, cuantosActivos) {
  const maximo = cuantosActivos * (cuantosActivos - 1)
  if (maximo <= 0) return 0
  return Math.min(1, inversiones / maximo)
}

/** Cuántos rumores automáticos habilita el avance actual. */
export function hitoAlcanzado(progreso) {
  return HITOS_RUMOR.filter((h) => progreso >= h).length
}
