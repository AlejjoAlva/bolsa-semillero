import { useState } from 'react'
import { armarQuiz, esCorrecta } from '../lib/quiz'
import {
  CASTIGO_APUESTA,
  ErrorAmable,
  fallarInversion,
  invertir,
  registrarFallo,
} from '../lib/acciones'
import { etiquetaArea } from '../lib/data'

/**
 * Flujo del quiz: pregunta -> resultado. La pregunta se arma una sola vez, al
 * abrir el modal, para que no cambie mientras la persona está eligiendo.
 */
export default function InvestModal({ yo, target, participants, ronda, onCerrar }) {
  // `participants` cambia con cada snapshot de Firestore; si el quiz dependiera
  // de él, la pregunta se rebarajaría en medio de la elección.
  const [quiz] = useState(() => armarQuiz(target, participants))
  const [seleccion, setSeleccion] = useState(null)
  const [apuesta, setApuesta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok, puntos?, mensaje? }

  async function confirmar() {
    if (enviando || seleccion === null || !quiz) return
    setEnviando(true)

    if (!esCorrecta(quiz, seleccion)) {
      const perdidos = await fallarInversion(yo.ticker, apuesta)
      // Que la pérdida se vea en el tablero, igual que se ven las ganancias. No
      // se espera —el log es informativo y no debe frenar la respuesta— pero sí
      // se recoge el error para no dejar una promesa suelta.
      registrarFallo(yo.ticker, perdidos, ronda).catch((e) => console.error('registrarFallo', e))
      setResultado({
        ok: false,
        mensaje:
          perdidos > 0
            ? `No es correcto. La apuesta te costó ${perdidos} ${perdidos === 1 ? 'punto' : 'puntos'}. Puedes intentarlo más tarde.`
            : 'No es correcto, puedes intentarlo más tarde.',
      })
      setEnviando(false)
      return
    }

    try {
      const r = await invertir({
        investorTicker: yo.ticker,
        targetTicker: target.ticker,
        questionType: quiz.categoria,
        apuesta,
      })
      setResultado({ ok: true, ...r })
    } catch (err) {
      console.error('invertir', err)
      setResultado({
        ok: false,
        mensaje:
          err instanceof ErrorAmable
            ? err.message
            : 'No pudimos registrar la inversión. Revisa tu conexión e intenta de nuevo.',
      })
    }
    setEnviando(false)
  }

  return (
    <section className="card">
      <header className="fila-encabezado">
        <div>
          <h2>${target.ticker}</h2>
          <p className="ayuda">
            {target.name} · {etiquetaArea(target.area)} · {target.seniority}
          </p>
        </div>
      </header>

      {!quiz && (
        <>
          <p className="error">
            Todavía no hay suficientes participantes registrados para armar la pregunta. Intenta en un
            momento.
          </p>
          <button className="boton" onClick={onCerrar}>
            Volver
          </button>
        </>
      )}

      {quiz && !resultado && (
        <>
          <p className="ayuda">Primero habla con esta persona. Después responde:</p>
          <p className="pregunta">{quiz.pregunta}</p>

          <div className="opciones">
            {quiz.opciones.map((opcion) => (
              <button
                key={opcion}
                type="button"
                className={`opcion ${seleccion === opcion ? 'activa' : ''}`}
                onClick={() => setSeleccion(opcion)}
                disabled={enviando}
              >
                {opcion}
              </button>
            ))}
          </div>

          <label className={`apuesta ${apuesta ? 'activa' : ''}`}>
            <input
              type="checkbox"
              checked={apuesta}
              onChange={(e) => setApuesta(e.target.checked)}
              disabled={enviando}
            />
            <span>
              <strong>Vender en corto</strong>
              <em>
                Aciertas: puntos dobles. Fallas: pierdes {CASTIGO_APUESTA}.
              </em>
            </span>
          </label>

          <button
            className="boton primario"
            onClick={confirmar}
            disabled={enviando || seleccion === null}
          >
            {enviando ? 'Confirmando…' : 'Confirmar'}
          </button>
          <button className="boton" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </button>
        </>
      )}

      {resultado?.ok && (
        <>
          <p className="flotante">+{resultado.puntos}</p>
          <p className="exito">Inversión registrada</p>
          <ul className="ayuda desglose">
            <li>Base: +2</li>
            {resultado.cruce && <li>Cruce nuevo ↔ antiguo: +1</li>}
            {resultado.bonoRacha && <li>Racha de 3: +1</li>}
            {resultado.apuesta && <li>Venta en corto: puntos duplicados</li>}
          </ul>

          {resultado.correccion && (
            <p className="aviso">
              📉 <strong>${resultado.correccion.ticker}</strong> se sobrecalentó por exceso de
              demanda. Los {resultado.correccion.afectados} que invirtieron en esa acción pierden un
              punto — tú incluido.
            </p>
          )}

          {resultado.rondaCompleta && (
            <p className="aviso">
              🏁 Invertiste en todo el mercado: la ronda se cierra. Mira la pantalla grande.
            </p>
          )}

          <button className="boton primario" onClick={onCerrar}>
            Seguir invirtiendo
          </button>
        </>
      )}

      {resultado && !resultado.ok && (
        <>
          <p className="error">{resultado.mensaje}</p>
          <button className="boton primario" onClick={onCerrar}>
            Volver
          </button>
        </>
      )}
    </section>
  )
}
