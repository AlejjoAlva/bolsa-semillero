import { nombreCortoArea } from '../lib/data'

/**
 * La decisión del participante ante un rumor de sector: mantener su exposición
 * o liquidarla. Quien no toca nada, mantiene — y la tarjeta lo dice, para que
 * quedarse quieto sea una decisión consciente y no un descuido.
 */
export default function RumorCard({ rumor, yo, onElegir }) {
  if (!rumor) return null

  const mia = yo.postura_rumor_id === rumor.id ? yo.postura_rumor : null
  const sector = nombreCortoArea(rumor.area)

  if (rumor.resuelto) {
    const cierto = rumor.resuelto === 'cierto'
    return (
      <section className="card rumor">
        <p className="rumor-eyebrow">{cierto ? 'El rumor era cierto' : 'El rumor era falso'}</p>
        <p className="rumor-titulo">
          {cierto ? `${sector} se desplomó` : `${sector} aguantó el golpe`}
        </p>
        <p className="ayuda">
          {mia === 'liquidar'
            ? cierto
              ? 'Liquidaste a tiempo: no perdiste nada.'
              : 'Liquidaste de más: pagaste la comisión.'
            : cierto
              ? 'Mantuviste: perdiste un punto por cada persona de ese sector en tu portafolio.'
              : 'Mantuviste: ganaste un punto por cada persona de ese sector en tu portafolio.'}
        </p>
      </section>
    )
  }

  return (
    <section className="card rumor">
      <p className="rumor-eyebrow">Rumor de mercado</p>
      <p className="rumor-titulo">Dicen que {sector} se va a desplomar</p>
      <p className="ayuda">
        Si mantienes y el rumor es falso, ganas un punto por cada persona de {sector} en la que ya
        invertiste. Si es cierto, pierdes uno por cada una. Liquidar te blinda, pero si el rumor
        resulta falso pagas una comisión.
      </p>

      <div className="botonera">
        <button
          className={`boton ${mia === 'mantener' ? 'primario' : ''}`}
          onClick={() => onElegir('mantener')}
        >
          Mantener
        </button>
        <button
          className={`boton ${mia === 'liquidar' ? 'primario' : ''}`}
          onClick={() => onElegir('liquidar')}
        >
          Liquidar
        </button>
      </div>

      <p className="ayuda">
        {mia
          ? `Tu decisión: ${mia === 'mantener' ? 'mantener' : 'liquidar'}. Puedes cambiarla hasta que se acabe el tiempo.`
          : 'Si no eliges nada, mantienes.'}
      </p>
    </section>
  )
}
