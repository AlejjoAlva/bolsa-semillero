import { useEffect, useRef, useState } from 'react'

const sinMovimiento = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Número que cuenta hasta su valor nuevo en vez de saltar de golpe.
 * Si el sistema pide menos movimiento, devuelve el valor tal cual.
 */
export function useContador(valor, duracion = 600) {
  const [mostrado, setMostrado] = useState(valor)
  const anterior = useRef(valor)

  useEffect(() => {
    const desde = anterior.current
    anterior.current = valor

    if (desde === valor || sinMovimiento()) {
      setMostrado(valor)
      return undefined
    }

    let cuadro
    const inicio = performance.now()
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      const suave = 1 - (1 - t) ** 3 // desacelera al final
      setMostrado(Math.round(desde + (valor - desde) * suave))
      if (t < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [valor, duracion])

  return mostrado
}

/**
 * Tickers cuyo valor acaba de subir, para encenderles la fila un momento.
 * Devuelve un Set que se vacía solo pasado `ms`.
 */
export function useSubidas(participants, campo, ms = 1200) {
  const [subieron, setSubieron] = useState(() => new Set())
  const previos = useRef(null)

  useEffect(() => {
    const actuales = new Map(participants.map((p) => [p.ticker, p[campo] ?? 0]))

    // El primer render no es un cambio: nadie debería destellar al abrir la pantalla.
    if (previos.current === null) {
      previos.current = actuales
      return undefined
    }

    const nuevos = new Set()
    for (const [ticker, valor] of actuales) {
      const antes = previos.current.get(ticker)
      if (antes !== undefined && valor > antes) nuevos.add(ticker)
    }
    previos.current = actuales

    if (nuevos.size === 0) return undefined
    setSubieron(nuevos)
    const id = setTimeout(() => setSubieron(new Set()), ms)
    return () => clearTimeout(id)
  }, [participants, campo, ms])

  return subieron
}


/**
 * Verdadero durante `ms` justo cuando `valor` acaba de convertirse en `objetivo`.
 * Sirve para disparar un momento único (la campana de apertura) sin repetirlo
 * en cada render ni al abrir la pantalla con el mercado ya abierto.
 */
export function useTransicionA(valor, objetivo, ms = 2000) {
  const [activo, setActivo] = useState(false)
  const previo = useRef(null)

  useEffect(() => {
    const antes = previo.current
    previo.current = valor
    // `antes == null` cubre el primer render y el instante en que session aún no
    // ha cargado: abrir /display con el mercado ya abierto no debe tocar campana.
    if (antes == null || antes === valor || valor !== objetivo) return undefined
    if (sinMovimiento()) return undefined

    setActivo(true)
    const id = setTimeout(() => setActivo(false), ms)
    return () => clearTimeout(id)
  }, [valor, objetivo, ms])

  return activo
}

/**
 * Quién subió o bajó de puesto en el ranking, para marcarlo con ▲ o ▼ un
 * momento. `orden` es la lista de tickers ya ordenada.
 */
export function useCambiosDePosicion(orden, ms = 4000) {
  const [movidos, setMovidos] = useState(() => new Map())
  const previo = useRef(null)

  useEffect(() => {
    const posiciones = new Map(orden.map((t, i) => [t, i]))

    if (previo.current === null) {
      previo.current = posiciones
      return undefined
    }

    const cambios = new Map()
    for (const [ticker, pos] of posiciones) {
      const antes = previo.current.get(ticker)
      if (antes === undefined || antes === pos) continue
      cambios.set(ticker, pos < antes ? 'sube' : 'baja')
    }
    previo.current = posiciones

    if (cambios.size === 0) return undefined
    setMovidos(cambios)
    const id = setTimeout(() => setMovidos(new Map()), ms)
    return () => clearTimeout(id)
  }, [orden, ms])

  return movidos
}
