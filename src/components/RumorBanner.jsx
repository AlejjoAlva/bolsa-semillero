import { formatearCuentaRegresiva, nombreCortoArea } from '../lib/data'

/**
 * El rumor en la pantalla grande: titular, cuenta regresiva y, al vencer, el
 * sorteo. El estado intermedio ("sorteando") existe para que la sala vea que el
 * resultado se decide al azar delante de todos y no lo decide el anfitrión.
 */
export default function RumorBanner({ rumor, restante }) {
  if (!rumor) return null

  const sector = nombreCortoArea(rumor.area)

  if (!rumor.resuelto) {
    return (
      <section className={`rumor-banner ${restante === 0 ? 'sorteando' : ''}`}>
        <p className="rumor-eyebrow">Rumor de mercado</p>
        <p className="rumor-titular">Dicen que {sector} se va a desplomar</p>
        <p className="rumor-reloj">
          {restante > 0 ? formatearCuentaRegresiva(restante) : 'Sorteando el resultado…'}
        </p>
      </section>
    )
  }

  const cierto = rumor.resuelto === 'cierto'
  return (
    <section className={`rumor-banner resuelto ${cierto ? 'cae' : 'aguanta'}`}>
      <p className="rumor-eyebrow">{cierto ? 'El rumor era cierto' : 'El rumor era falso'}</p>
      <p className="rumor-titular">
        {cierto ? `${sector} se desploma` : `${sector} aguanta`}
      </p>
      <p className="rumor-reloj">
        {cierto
          ? 'Quienes mantuvieron pierden un punto por cada acción del sector'
          : 'Quienes mantuvieron ganan un punto por cada acción del sector'}
      </p>
    </section>
  )
}
