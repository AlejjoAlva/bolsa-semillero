import { useState } from 'react'

/**
 * Las reglas para quien acaba de llegar. Va plegada por defecto salvo antes de
 * registrarse: nadie lee un muro de texto con el celular en la mano, pero todos
 * necesitan saber que hay que hablar con la persona antes de invertir.
 */
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
          </p>

          <ol className="pasos">
            <li>
              <strong>Busca a alguien y háblale.</strong> De verdad: la app te va a preguntar algo
              que solo puedes saber si conversaste con esa persona.
            </li>
            <li>
              <strong>Responde la pregunta.</strong> Si aciertas, invertiste en ella y ganas puntos.
              Si fallas, pierdes tu racha y puedes volver a intentarlo más tarde.
            </li>
            <li>
              <strong>Repite con todo el mundo.</strong> No puedes invertir dos veces en la misma
              persona, así que la única forma de crecer es conocer gente nueva.
            </li>
          </ol>

          <p className="titulillo">Cómo se ganan puntos</p>
          <ul className="lista-reglas">
            <li><strong>2 puntos</strong> por cada inversión acertada.</li>
            <li><strong>+1</strong> si esa persona es del otro grupo (nuevo ↔ antiguo).</li>
            <li><strong>+1</strong> cada vez que encadenas 3 aciertos seguidos.</li>
            <li><strong>Venta en corto:</strong> puedes apostar antes de responder. Aciertas, doble;
              fallas, pierdes 2.</li>
          </ul>

          <p className="titulillo">Cómo se pierden</p>
          <ul className="lista-reglas">
            <li>
              <strong>Si una acción se pone de moda, se desinfla.</strong> Cuando demasiada gente
              invierte en la misma persona, esa acción se sobrevalora y todos los que invirtieron
              en ella pierden un punto. Conviene descubrir a quien nadie ha buscado todavía.
            </li>
            <li>
              <strong>Los rumores mueven el mercado.</strong> De vez en cuando corre el rumor de que
              un sector se va a desplomar. Tendrás que decidir si mantienes tu posición o liquidas,
              y el resultado se sortea en la pantalla grande.
            </li>
          </ul>

          <p className="cierre-instrucciones">
            La partida termina cuando alguien logra invertir en <strong>todo</strong> el mercado —o
            cuando el anfitrión cierra la sesión—. Pero <strong>gana quien tenga más puntos</strong>,
            no quien llegue primero.
          </p>
        </div>
      )}
    </section>
  )
}
