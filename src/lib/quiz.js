export const CATEGORIAS = [
  { key: 'comida', pregunta: (t) => `¿Cuál es la comida favorita de $${t}?` },
  { key: 'superpoder', pregunta: (t) => `¿Qué superpoder querría tener $${t}?` },
  { key: 'anecdota', pregunta: (t) => `¿Cuál de estas anécdotas es de $${t}?` },
  { key: 'ciudad', pregunta: (t) => `¿De qué ciudad viene $${t}?` },
]

const limpio = (v) => (typeof v === 'string' ? v.trim() : '')
const clave = (v) => limpio(v).toLowerCase()

function barajar(arr) {
  const copia = [...arr]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/** Respuestas de los DEMÁS participantes para una categoría, sin repetir ni chocar con la correcta. */
function distractores(categoria, target, todos) {
  const correcta = clave(target.private_answers?.[categoria])
  const vistas = new Set([correcta])
  const pool = []

  for (const p of todos) {
    if (p.ticker === target.ticker) continue
    const valor = limpio(p.private_answers?.[categoria])
    if (!valor) continue
    if (vistas.has(clave(valor))) continue
    vistas.add(clave(valor))
    pool.push(valor)
  }

  return barajar(pool)
}

/**
 * Arma la pregunta de opción múltiple en memoria, sin tocar la red.
 * Elige al azar entre las categorías que tengan suficientes distractores.
 * Devuelve { categoria, pregunta, opciones, correcta } o null si no se pudo armar.
 */
export function armarQuiz(target, todos) {
  const candidatas = []

  for (const cat of CATEGORIAS) {
    const correcta = limpio(target.private_answers?.[cat.key])
    if (!correcta) continue
    const falsas = distractores(cat.key, target, todos)
    if (falsas.length < 1) continue
    candidatas.push({ cat, correcta, falsas })
  }

  if (candidatas.length === 0) return null

  // Preferimos categorías que alcancen para 3 opciones; si ninguna, usamos las de 2.
  const conDos = candidatas.filter((c) => c.falsas.length >= 2)
  const elegibles = conDos.length > 0 ? conDos : candidatas
  const { cat, correcta, falsas } = elegibles[Math.floor(Math.random() * elegibles.length)]

  return {
    categoria: cat.key,
    pregunta: cat.pregunta(target.ticker),
    opciones: barajar([correcta, ...falsas.slice(0, 2)]),
    correcta,
  }
}

export function esCorrecta(quiz, opcion) {
  return clave(opcion) === clave(quiz.correcta)
}
