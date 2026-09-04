/**
 * Cinta de teletipo: los tickers desfilando con sus puntos, como el tablero de
 * una bolsa. Es puro CSS (una animación de translateX en bucle), así que no
 * cuesta nada aunque quede horas en pantalla.
 *
 * La pista se repite dos veces porque el bucle traslada un ancho completo: sin
 * la copia, se vería el hueco entre el final y el reinicio.
 */
export default function Cinta({ participants }) {
  if (participants.length === 0) return null

  const orden = [...participants].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  const item = (p, copia) => (
    <span className="cinta-item" key={`${copia}-${p.ticker}`}>
      <span className="tk">${p.ticker}</span>{' '}
      <span className={(p.points ?? 0) > 0 ? 'sube' : 'plano'}>
        {(p.points ?? 0) > 0 ? `▲ ${p.points}` : '—'}
      </span>
    </span>
  )

  return (
    <div className="cinta" aria-hidden="true">
      <div className="cinta-pista">
        {orden.map((p) => item(p, 'a'))}
        {orden.map((p) => item(p, 'b'))}
      </div>
    </div>
  )
}
