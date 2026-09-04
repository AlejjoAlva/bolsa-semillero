import { nombreCortoArea } from '../lib/data'

/**
 * Franja de indicadores del proyector, al estilo de la cabecera de resumen de
 * una terminal financiera: pocos números, enormes, siempre en el mismo sitio.
 * Todo sale de los datos que la pantalla ya tiene en memoria — no cuesta ni una
 * lectura extra a Firestore.
 */
export default function ResumenMercado({ participants }) {
  const inversiones = participants.reduce((t, p) => t + (p.inversiones_hechas ?? 0), 0)
  const lider = [...participants].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0]
  const masBuscada = [...participants].sort(
    (a, b) => (b.received_count ?? 0) - (a.received_count ?? 0),
  )[0]

  const tile = (etiqueta, valor, pie) => (
    <div className="indicador">
      <span className="indicador-etiqueta">{etiqueta}</span>
      <span className="indicador-valor">{valor}</span>
      {pie && <span className="indicador-pie">{pie}</span>}
    </div>
  )

  return (
    <div className="resumen">
      {tile('Acciones listadas', participants.length)}
      {tile('Operaciones', inversiones)}
      {lider && tile('Mayor portafolio', `$${lider.ticker}`, `${lider.points ?? 0} pts`)}
      {masBuscada &&
        tile('Más demandada', `$${masBuscada.ticker}`, nombreCortoArea(masBuscada.area))}
    </div>
  )
}
