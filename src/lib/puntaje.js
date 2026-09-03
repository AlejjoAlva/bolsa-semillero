// Reglas de puntaje del juego, sin dependencias de Firebase, para poder
// probarlas con `npm test` sin levantar nada.

export const PUNTOS_BASE = 2
export const BONO_CRUCE = 1
export const BONO_RACHA = 1
export const RACHA_CADA = 3
export const BULL_RUN_MINUTOS = 5

/**
 * Puntaje de una inversión acertada.
 * Base 2 · +1 si el cruce es nuevo↔antiguo · +1 cuando la racha llega a
 * múltiplo de 3 · todo x2 si hay Bull Run vigente.
 */
export function calcularPuntos({ rachaPrevia = 0, seniorityInvestor, seniorityTarget, bullRun = false }) {
  const nuevaRacha = rachaPrevia + 1
  const cruce = seniorityInvestor !== seniorityTarget
  const bonoRacha = nuevaRacha % RACHA_CADA === 0

  let puntos = PUNTOS_BASE + (cruce ? BONO_CRUCE : 0) + (bonoRacha ? BONO_RACHA : 0)
  if (bullRun) puntos *= 2

  return { puntos, nuevaRacha, cruce, bonoRacha, bullRun }
}
