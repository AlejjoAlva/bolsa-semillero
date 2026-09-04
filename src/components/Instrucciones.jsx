import { useState } from 'react'
import {
  BONO_CRUCE,
  BONO_RACHA,
  CASTIGO_APUESTA,
  CASTIGO_CORRECCION,
  CIERRE_CUANTAS,
  CIERRE_PUNTOS,
  COMISION_LIQUIDAR,
  PUNTOS_BASE,
  RACHA_CADA,
  RUMOR_MINUTOS,
  UMBRAL_SOBRECOMPRA,
} from '../lib/puntaje'

/**
 * Las reglas para quien acaba de llegar. Va plegada por defecto salvo antes de
 * registrarse: nadie lee un muro de texto con el celular en la mano, pero todos
 * necesitan saber que hay que hablar con la persona antes de invertir.
 *
 * Las cifras salen de las constantes de `puntaje.js`, no escritas a mano, para
 * que el instructivo no pueda contradecir a las reglas que de verdad corren.
 */
// La ventana del rumor sale de la constante, no escrita a mano: si cambia
// RUMOR_MINUTOS, el instructivo cambia con ella.
const VENTANA_RUMOR =
  RUMOR_MINUTOS % 1 === 0 ? `${RUMOR_MINUTOS} minutos` : `${Math.round(RUMOR_MINUTOS * 60)} segundos`

export default function Instrucciones({ abiertaAlPrincipio = false }) {
  const [abierta, setAbierta] = useState(abiertaAlPrincipio)

  return (
    <section className="card instrucciones">
      <button className="instrucciones-toggle" onClick={() => setAbierta((v) => !v)}>
        <span>Cómo se juega</span>
        <span className="chevron">{abierta ? '−' : '+'}</span>
      </button>

      {abierta && (
        <div className="instrucciones-cuerpo">
          <p>
            Hoy cada persona de este salón es una <strong>acción en bolsa</strong>. Tú también:
            al registrarte recibes tu ticker, como <span className="cifra">$ANA47</span>.
            <strong> Gana quien más puntos tenga al cierre</strong>, no quien termine primero.
          </p>

          <ol className="pasos">
            <li>
              <strong>Busca a alguien y háblale.</strong> De verdad: la app te va a preguntar algo
              que solo puedes saber si conversaste con esa persona.
            </li>
            <li>
              <strong>Responde la pregunta.</strong> Si aciertas, invertiste en ella y ganas puntos.
            </li>
            <li>
              <strong>Repite con gente nueva.</strong> No puedes invertir dos veces en la misma
              persona: la única forma de crecer es conocer a más gente.
            </li>
          </ol>

          <p className="titulillo">Cómo ganas puntos</p>
          <ul className="lista-reglas">
            <li>
              <strong>+{PUNTOS_BASE}</strong> por cada inversión acertada.
            </li>
            <li>
              <strong>+{BONO_CRUCE}</strong> si esa persona es del otro grupo (nuevo ↔ antiguo).
              Mezclarse paga.
            </li>
            <li>
              <strong>+{BONO_RACHA}</strong> cada vez que encadenas {RACHA_CADA} aciertos seguidos.
              Fallar rompe la racha y vuelve a empezar de cero.
            </li>
            <li>
              <strong>Venta en corto.</strong> Antes de responder puedes apostar: si aciertas cobras
              el doble, si fallas pierdes {CASTIGO_APUESTA} puntos. Úsala cuando estés seguro.
            </li>
          </ul>

          <p className="titulillo">Cómo pierdes puntos</p>
          <ul className="lista-reglas">
            <li>
              <strong>Apostar y fallar:</strong> −{CASTIGO_APUESTA} puntos. Es la única pérdida que
              decides tú por completo.
            </li>
            <li>
              <strong>Corrección por sobrecompra:</strong> −{CASTIGO_CORRECCION} punto. Es la regla
              que más confunde, así que va explicada aparte, abajo.
            </li>
            <li>
              <strong>Rumores de sector:</strong> puedes perder según lo que decidas cuando corra un
              rumor. También aparte, abajo.
            </li>
          </ul>
          <p className="ayuda">Nadie puede quedar con puntos negativos: el piso es cero.</p>

          <p className="titulillo">La corrección por sobrecompra</p>
          <p>
            Cuando una misma persona recibe <strong>{UMBRAL_SOBRECOMPRA} inversiones</strong>, su
            acción se considera <strong>sobrevalorada</strong>: todo el mundo se amontonó sobre
            ella y su precio ya no refleja nada. Entonces el mercado corrige.
          </p>
          <p>
            Lo importante: <strong>quien se sobrevalora no pierde nada. Pierden sus inversores</strong>,
            −{CASTIGO_CORRECCION} punto cada uno. Ser popular no se castiga; lo que se castiga es
            comprar caro, cuando todos ya compraron.
          </p>
          <p>
            La lección práctica: <strong>no vayas donde ya hay fila</strong>. Buscar a quien nadie
            ha buscado todavía vale más que sumarte al que ya tiene cinco inversores. Ocurre una
            sola vez por persona.
          </p>

          <p className="titulillo">Los rumores de sector</p>
          <p>
            De vez en cuando corre el rumor de que un área se va a desplomar. Tienes{' '}
            <strong>{VENTANA_RUMOR}</strong> para decidir en tu celular:{' '}
            <strong>mantener</strong> o <strong>liquidar</strong>. No
            elegir cuenta como mantener. Después, la pantalla grande sortea si era cierto.
          </p>
          <ul className="lista-reglas">
            <li>
              <strong>Mantuviste y era cierto:</strong> −1 por cada acción de ese sector que tengas.
            </li>
            <li>
              <strong>Mantuviste y era falso:</strong> +1 por cada acción de ese sector que tengas.
            </li>
            <li>
              <strong>Liquidaste y era cierto:</strong> 0. Te blindaste.
            </li>
            <li>
              <strong>Liquidaste y era falso:</strong> −{COMISION_LIQUIDAR} de comisión.
            </li>
          </ul>
          <p className="ayuda">
            Si no tienes a nadie de ese sector, el rumor no te toca. El mercado sigue abierto
            durante la ventana: puedes correr a invertir en ese sector, o huir a otro.
          </p>

          <p className="titulillo">Qué está en tus manos y qué no</p>
          <p>
            <strong>Depende de ti:</strong> a cuánta gente le hablas, si te arriesgas con la venta
            en corto, si inviertes en alguien que ya está saturado, y qué haces cuando corre un
            rumor.
          </p>
          <p>
            <strong>No depende de ti:</strong> si el rumor resulta cierto —se sortea—, cuánta gente
            invierte en ti, y el <strong>cierre volátil</strong> del final, donde las{' '}
            {CIERRE_CUANTAS} acciones más compradas pierden {CIERRE_PUNTOS} puntos y las{' '}
            {CIERRE_CUANTAS} menos buscadas ganan {CIERRE_PUNTOS}. Ir de último tiene premio.
          </p>

          <p className="cierre-instrucciones">
            El mercado cierra cuando alguien logra invertir en <strong>todo</strong> el mercado, o
            cuando el anfitrión lo cierra. Todo lo que va pasando —quién gana y quién pierde
            puntos— se ve en vivo en la <strong>pantalla grande</strong>.
          </p>
        </div>
      )}
    </section>
  )
}
