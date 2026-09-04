import { useLayoutEffect, useMemo, useRef } from 'react'
import { useCambiosDePosicion, useContador, useSubidas } from '../lib/animacion'
import { claseArea, siglaArea } from '../lib/data'

/** Una fila: el valor cuenta hacia arriba en vez de saltar. */
function Fila({ p, campo, sufijo, posicion, destello, movimiento, registrar }) {
  const valor = useContador(p[campo] ?? 0)

  return (
    <li ref={(el) => registrar(p.ticker, el)} className={destello ? 'destello' : ''}>
      <span className="pos">{posicion}</span>
      <span className="tick">${p.ticker}</span>
      <span className="nom">{p.name}</span>
      <span className={claseArea(p.area)}>{siglaArea(p.area)}</span>
      <span className="val">
        {valor}
        {sufijo ? ` ${sufijo}` : ''}
      </span>
      <span className={`mov ${movimiento ?? ''}`} aria-hidden="true">
        {movimiento === 'sube' ? '▲' : movimiento === 'baja' ? '▼' : ''}
      </span>
    </li>
  )
}

export default function Leaderboard({ titulo, descripcion, participants, campo, sufijo, max = 10 }) {
  const top = [...participants]
    .sort((a, b) => (b[campo] ?? 0) - (a[campo] ?? 0) || a.ticker.localeCompare(b.ticker))
    .slice(0, max)

  const subieron = useSubidas(participants, campo)
  const ordenTop = top.map((p) => p.ticker).join('|')
  const movidos = useCambiosDePosicion(useMemo(() => ordenTop.split('|'), [ordenTop]))
  const nodos = useRef(new Map())
  const posiciones = useRef(new Map())
  const ordenPrevio = useRef(ordenTop)

  // FLIP: comparamos dónde estaba cada fila con dónde quedó y animamos la
  // diferencia, para que el ranking se reordene deslizándose y no de un salto.
  //
  // Dos precauciones que aprendimos por las malas:
  //  - `offsetTop`, no `getBoundingClientRect()`: el rect es relativo a la
  //    ventana, así que cualquier scroll entre dos renders se interpretaba como
  //    que las filas se habían movido y salían disparadas.
  //  - solo animamos cuando el orden cambió de verdad. El panel del host se
  //    redibuja cada segundo por el reloj, y antes eso bastaba para re-animar.
  useLayoutEffect(() => {
    const cambioElOrden = ordenPrevio.current !== ordenTop
    ordenPrevio.current = ordenTop
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    for (const [ticker, el] of nodos.current) {
      if (!el) continue
      const ahora = el.offsetTop
      const antes = posiciones.current.get(ticker)
      posiciones.current.set(ticker, ahora)

      if (!cambioElOrden || reducido) continue
      if (antes === undefined || Math.abs(antes - ahora) <= 1) continue

      el.animate(
        [{ transform: `translateY(${antes - ahora}px)` }, { transform: 'translateY(0)' }],
        { duration: 450, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      )
    }
  }, [ordenTop])

  const registrar = (ticker, el) => {
    if (el) nodos.current.set(ticker, el)
    else nodos.current.delete(ticker)
  }

  return (
    <section className="tabla">
      <header className="tabla-titulo">
        <h3>{titulo}</h3>
        {descripcion && <p className="tabla-sub">{descripcion}</p>}
      </header>
      {top.length === 0 && <p className="ayuda">Sin datos todavía.</p>}
      <ol className="lista-rank">
        <li className="cabecera" aria-hidden="true">
          <span className="pos">#</span>
          <span className="tick">Ticker</span>
          <span className="nom">Nombre</span>
          <span className="sector">Sect.</span>
          <span className="val">{sufijo === 'pts' ? 'Puntos' : 'Inv.'}</span>
          <span className="mov" />
        </li>
        {top.map((p, i) => (
          <Fila
            key={p.ticker}
            p={p}
            campo={campo}
            sufijo={sufijo}
            posicion={i + 1}
            destello={subieron.has(p.ticker)}
            movimiento={movidos.get(p.ticker)}
            registrar={registrar}
          />
        ))}
      </ol>
    </section>
  )
}
