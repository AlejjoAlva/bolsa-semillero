/** Quita tildes/enes y deja solo letras A-Z. */
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas de tilde
    .replace(/\u00f1/gi, 'N')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

/** Prefijo de 3 letras. Si el nombre tiene menos, rellena con X. */
export function prefijoDe(nombre) {
  return (normalizar(nombre) + 'XXX').slice(0, 3)
}

function dosDigitos() {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0')
}

/**
 * Genera un ticker único: 3 letras del nombre + 2 dígitos.
 * `existentes` es un Set con los tickers ya tomados.
 * Reintenta 5 veces con sufijo aleatorio; si todos chocan, recorre 00-99.
 * Devuelve null si absolutamente todos los sufijos están ocupados.
 */
export function generarTicker(nombre, existentes) {
  const prefijo = prefijoDe(nombre)

  for (let intento = 0; intento < 5; intento++) {
    const candidato = prefijo + dosDigitos()
    if (!existentes.has(candidato)) return candidato
  }

  for (let n = 0; n < 100; n++) {
    const candidato = prefijo + String(n).padStart(2, '0')
    if (!existentes.has(candidato)) return candidato
  }

  return null
}

/** ID compuesto y determinístico de una inversión. */
export function idInversion(investor, target) {
  return `${investor}_${target}`
}
