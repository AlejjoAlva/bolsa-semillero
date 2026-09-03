import { useState } from 'react'
import { armarQuiz, esCorrecta } from '../lib/quiz'
import { ErrorAmable, invertir, romperRacha } from '../lib/acciones'
import { etiquetaArea } from '../lib/data'

/**
 * Flujo del quiz: pregunta -> resultado. La pregunta se arma una sola vez, al
 * abrir el modal, para que no cambie mientras la persona está eligiendo.
 */
export default function InvestModal({ yo, target, participants, onCerrar }) {
  // `participants` cambia con cada snapshot de Firestore; si el quiz dependiera
  // de él, la pregunta se rebarajaría en medio de la elección.
  const [quiz] = useState(() => armarQuiz(target, participants))
  const [seleccion, setSeleccion] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok, puntos?, bullRun?, mensaje? }

  async function confirmar() {
    if (enviando || seleccion === null || !quiz) return
    setEnviando(true)

    if (!esCorrecta(quiz, seleccion)) {
      await romperRacha(yo.ticker)
      setResultado({ ok: false, mensaje: 'No es correcto, puedes intentarlo más tarde.' })
      setEnviando(false)
      return
    }

    try {
      const r = await invertir({
        investorTicker: yo.ticker,
        targetTicker: target.ticker,
        questionType: quiz.categoria,
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
          <p className="exito">
            ¡Inversión registrada! +{resultado.puntos} puntos
            {resultado.bullRun ? ' (Bull Run x2)' : ''}
          </p>
          <ul className="ayuda desglose">
            <li>Base: +2</li>
            {resultado.cruce && <li>Cruce nuevo ↔ antiguo: +1</li>}
            {resultado.bonoRacha && <li>Racha de 3: +1</li>}
            {resultado.bullRun && <li>Bull Run: puntos duplicados</li>}
          </ul>
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
