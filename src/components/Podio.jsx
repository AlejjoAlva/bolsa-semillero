import { nombreCortoArea } from '../lib/areas'

/**
 * Cierre de la jornada: el podio y el balance de lo que pasó.
 *
 * Todo se calcula con los participantes que la pantalla ya tiene en memoria,
 * así que el resumen final no cuesta ni una lectura extra a Firestore.
 */
function estadisticas(participants) {
  const gente = participants.length || 1
  const operaciones = participants.reduce((t, p) => t + (p.inversiones_hechas ?? 0), 0)

  const masActivo = [...participants].sort(
    (a, b) => (b.inversiones_hechas ?? 0) - (a.inversiones_hechas ?? 0),
  )[0]
  const masBuscada = [...participants].sort(
    (a, b) => (b.received_count ?? 0) - (a.received_count ?? 0),
  )[0]

  const porArea = new Map()
  for (const p of participants) {
    const previo = porArea.get(p.area) ?? { recibidas: 0, cuantos: 0 }
    porArea.set(p.area, {
      recibidas: previo.recibidas + (p.received_count ?? 0),
      cuantos: previo.cuantos + 1,
    })
  }
  const areaEstrella = [...porArea.entries()].sort((a, b) => b[1].recibidas - a[1].recibidas)[0]

  // Cuánta gente llegó a conocer al menos a la mitad de la sala.
  const mitad = Math.max(1, Math.floor((gente - 1) / 2))
  const bienConectados = participants.filter((p) => (p.inversiones_hechas ?? 0) >= mitad).length

  // Nadie se queda sin ninguna inversión recibida: es el dato que dice si la
  // actividad de verdad integró a todo el mundo.
  const sinRecibir = participants.filter((p) => (p.received_count ?? 0) === 0).length

  return {
    operaciones,
    promedio: (operaciones / gente).toFixed(1),
    masActivo,
    masBuscada,
    areaEstrella,
    bienConectados,
    mitad,
    sinRecibir,
  }
}

function Escalon({ p, puesto }) {
  if (!p) return null
  const medalla = ['🥇', '🥈', '🥉'][puesto - 1]
  return (
    <div className={`escalon escalon-${puesto}`}>
      <span className="escalon-medalla" aria-hidden="true">{medalla}</span>
      <span className="escalon-ticker">${p.ticker}</span>
      <span className="escalon-nombre">{p.name}</span>
      <span className="escalon-puntos">{p.points ?? 0}</span>
      <span className="escalon-pts">puntos</span>
      <span className="escalon-base">{puesto}</span>
    </div>
  )
}

export default function Podio({ participants, session }) {
  const orden = [...participants].sort(
    (a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.received_count ?? 0) - (a.received_count ?? 0),
  )
  const [primero, segundo, tercero] = orden
  const e = estadisticas(participants)

  const dato = (etiqueta, valor, pie) => (
    <div className="dato-final">
      <span className="dato-etiqueta">{etiqueta}</span>
      <span className="dato-valor">{valor}</span>
      {pie && <span className="dato-pie">{pie}</span>}
    </div>
  )

  return (
    <div className="cierre-jornada">
      <div className="podio-zona">
        <p className="podio-eyebrow">
          {session?.completada_por ? (
            <>
              <b>${session.completada_por}</b> invirtió en todo el mercado y cerró la bolsa
            </>
          ) : (
            'La jornada de negociación terminó'
          )}
        </p>

        <div className="podio">
          <Escalon p={segundo} puesto={2} />
          <Escalon p={primero} puesto={1} />
          <Escalon p={tercero} puesto={3} />
        </div>

        {primero && (
          <p className="podio-pie">
            Gana <b>${primero.ticker}</b> — {primero.name} — con {primero.points ?? 0} puntos
          </p>
        )}
      </div>

      <div className="balance-final">
        <h2>Balance de la jornada</h2>
        <div className="datos-finales">
          {dato('Operaciones cerradas', e.operaciones, 'conversaciones que sí ocurrieron')}
          {dato('Promedio por persona', e.promedio, 'gente nueva por cabeza')}
          {e.masActivo &&
            dato(
              'Más se movió',
              `$${e.masActivo.ticker}`,
              `${e.masActivo.inversiones_hechas ?? 0} inversiones hechas`,
            )}
          {e.masBuscada &&
            dato(
              'Más demandada',
              `$${e.masBuscada.ticker}`,
              `${e.masBuscada.received_count ?? 0} personas invirtieron`,
            )}
          {e.areaEstrella &&
            dato(
              'Sector del día',
              nombreCortoArea(e.areaEstrella[0]),
              `${e.areaEstrella[1].recibidas} inversiones recibidas`,
            )}
          {dato(
            'Conocieron a media sala',
            e.bienConectados,
            `con ${e.mitad} inversiones o más`,
          )}
          {dato(
            'Sin una sola inversión',
            e.sinRecibir,
            e.sinRecibir === 0 ? 'nadie se quedó por fuera' : 've a saludarlos',
          )}
          {dato('Acciones en bolsa', participants.length, 'personas cotizando hoy')}
        </div>
      </div>
    </div>
  )
}
