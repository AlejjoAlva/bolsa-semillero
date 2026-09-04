import { useEffect, useMemo, useRef, useState } from 'react'
import LogFeed from '../components/LogFeed'
import Firma from '../components/Firma'
import Leaderboard from '../components/Leaderboard'
import {
  ErrorAmable,
  asegurarSesion,
  cambiarEstado,
  cierreVolatil,
  congelarRumorArmado,
  devolverAlMercado,
  finalizarPartida,
  lanzarRumor,
  lanzarRumorPorHito,
  empezarDeCero,
  reiniciarPartida,
  resolverRumor,
  sacarDelMercado,
  sincronizarActivos,
} from '../lib/acciones'
import {
  AREAS,
  nombreCortoArea,
  formatearCuentaRegresiva,
  msHasta,
  rondaDe,
  rumorDe,
  useInversiones,
  useLogs,
  useParticipants,
  useSession,
} from '../lib/data'
import {
  AVISO_RUMOR_SEG,
  HITOS_RUMOR,
  elegirAlAzar,
  expuestosPorSector,
  hitoAlcanzado,
  progresoMercado,
  sectoresViables,
  umbralExpuestos,
} from '../lib/puntaje'
import { activos, deLaGeneracion, esActivo } from '../lib/participantes'

const PASSWORD = import.meta.env.VITE_HOST_PASSWORD
const CLAVE_SESION = 'bolsa_host_ok'
const CONFIRMACION = 'REINICIAR'
const CONFIRMACION_CERO = 'EMPEZAR DE CERO'

function Login({ onEntrar }) {
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')

  // Sin contraseña configurada no hay puerta que abrir: mejor decirlo que dejar entrar a todos.
  if (!PASSWORD) {
    return (
      <main className="pantalla">
        <div className="card">
          <h2>Panel de host</h2>
          <p className="error">
            Falta <code>VITE_HOST_PASSWORD</code> en el archivo <code>.env</code>. Llénalo y vuelve
            a correr <code>npm run build</code> antes de desplegar.
          </p>
        </div>
        <Firma />
      </main>
    )
  }

  function enviar(e) {
    e.preventDefault()
    if (valor === PASSWORD) {
      sessionStorage.setItem(CLAVE_SESION, '1')
      onEntrar()
    } else {
      setError('Contraseña incorrecta.')
    }
  }

  return (
    <main className="pantalla">
      <form className="card" onSubmit={enviar}>
        <h2>Panel de host</h2>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="boton primario" type="submit">
          Entrar
        </button>
      </form>
      <Firma />
    </main>
  )
}

/**
 * Reinicio de partida: vive al pie, discreto, y pide escribir la palabra
 * completa. Un "¿seguro?" se acepta sin leer; esto no.
 */
/**
 * Empezar de cero: retira a todo el mundo y obliga a registrarse de nuevo.
 * Más drástico que reiniciar la partida, así que pide una confirmación más
 * larga y avisa de lo único que no puede hacer: borrar de verdad la base.
 */
function EmpezarDeCero({ ocupado, cuantos, onEmpezar }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  if (!abierto) {
    return (
      <div className="zona-riesgo">
        <p className="ayuda">
          Empezar de cero saca del mercado a las {cuantos} personas registradas y deja la partida
          en blanco: cada celular vuelve solo a la pantalla de registro y hay que inscribirse de
          nuevo, con tickers nuevos. Úsalo entre ensayos.
        </p>
        <p className="ayuda">
          Los documentos antiguos siguen en la base, invisibles para la app. Borrarlos de verdad
          solo se puede desde la terminal (ver README §4.5).
        </p>
        <button className="boton compacto peligro" disabled={ocupado} onClick={() => setAbierto(true)}>
          Empezar de cero
        </button>
      </div>
    )
  }

  return (
    <div className="confirmacion">
      <label className="campo">
        <span>
          Escribe <code>{CONFIRMACION_CERO}</code> para retirar a todo el mundo
        </span>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoFocus />
      </label>
      <div className="botonera">
        <button
          className="boton compacto peligro"
          disabled={ocupado || texto.trim().toUpperCase() !== CONFIRMACION_CERO}
          onClick={async () => {
            await onEmpezar()
            setAbierto(false)
            setTexto('')
          }}
        >
          Sí, empezar de cero
        </button>
        <button
          className="boton compacto"
          disabled={ocupado}
          onClick={() => {
            setAbierto(false)
            setTexto('')
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function ReiniciarPartida({ ocupado, cuantos, onReiniciar }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  if (!abierto) {
    return (
      <div className="zona-riesgo">
        <p className="ayuda">
          Reiniciar deja a las {cuantos} personas registradas en cero puntos y vuelve a abrir el
          mercado desde el principio. Nadie pierde su ticker ni tiene que registrarse de nuevo.
        </p>
        <button className="boton compacto peligro" disabled={ocupado} onClick={() => setAbierto(true)}>
          Reiniciar partida
        </button>
      </div>
    )
  }

  return (
    <div className="confirmacion">
      <label className="campo">
        <span>
          Escribe <code>{CONFIRMACION}</code> para confirmar el reinicio
        </span>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoFocus />
      </label>
      <div className="botonera">
        <button
          className="boton compacto peligro"
          disabled={ocupado || texto.trim().toUpperCase() !== CONFIRMACION}
          onClick={async () => {
            await onReiniciar()
            setAbierto(false)
            setTexto('')
          }}
        >
          Sí, reiniciar
        </button>
        <button
          className="boton compacto"
          disabled={ocupado}
          onClick={() => {
            setAbierto(false)
            setTexto('')
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function Host() {
  const [autorizado, setAutorizado] = useState(() => sessionStorage.getItem(CLAVE_SESION) === '1')
  const session = useSession()
  const { participants } = useParticipants()
  // Tope al log del panel: con 40 personas la ronda puede dejar cientos de
  // entradas, y cargarlas todas en cada apertura del panel es tráfico regalado.
  const logs = useLogs(150, rondaDe(session))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')
  const [area, setArea] = useState(AREAS[0].key)
  const [ahora, setAhora] = useState(() => Date.now())
  const [aviso, setAviso] = useState(null)
  const [confirmandoFin, setConfirmandoFin] = useState(false)
  const resolviendo = useRef(false)

  const rumor = rumorDe(session)
  const restanteRumor = rumor && !rumor.resuelto ? msHasta(rumor.expira_at, ahora) : 0
  const inversiones = useInversiones(rondaDe(session))
  const autoLanzando = useRef(false)

  // Madurez del mercado: sobre qué sectores ya tiene sentido lanzar un rumor.
  const madurez = useMemo(() => {
    const enJuego = participants.filter((p) => p.activo !== false)
    const areaDe = Object.fromEntries(enJuego.map((p) => [p.ticker, p.area]))
    const porInversor = new Map()
    for (const i of inversiones) {
      if (!porInversor.has(i.investor)) porInversor.set(i.investor, [])
      porInversor.get(i.investor).push(i.target)
    }
    const expuestos = expuestosPorSector(porInversor, areaDe)
    const progreso = progresoMercado(inversiones.length, enJuego.length)
    return {
      expuestos,
      progreso,
      hito: hitoAlcanzado(progreso),
      umbral: umbralExpuestos(enJuego.length),
      viables: sectoresViables(expuestos, enJuego.length),
    }
  }, [participants, inversiones])

  const lanzados = session?.rumores_lanzados ?? 0
  const hayRumorVivo = Boolean(rumor && !rumor.resuelto)
  const armado =
    session?.game_status === 'activo' &&
    !hayRumorVivo &&
    madurez.hito > lanzados &&
    madurez.viables.length > 0
  const congelado = armado && session?.hito_cancelado === madurez.hito
  const siguienteHito = HITOS_RUMOR[lanzados] ?? null

  // El reloj solo hace falta mientras haya un rumor contando.
  useEffect(() => {
    if (!rumor || rumor.resuelto) return undefined
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [rumor])

  // El contador de activos puede desincronizarse; al abrir el panel se cura.
  useEffect(() => {
    if (autorizado) sincronizarActivos().catch((err) => console.error('sincronizarActivos', err))
  }, [autorizado])

  // Aviso de 20 segundos antes de que salga el rumor. Vive solo en esta pantalla
  // —no escribe en Firestore— para no gastar tráfico en algo que solo tú ves.
  useEffect(() => {
    if (!armado || congelado) {
      setAviso(null)
      return undefined
    }
    setAviso(AVISO_RUMOR_SEG)
    const id = setInterval(() => setAviso((s) => (s === null ? null : s - 1)), 1000)
    return () => clearInterval(id)
  }, [armado, congelado, madurez.hito])

  // Al agotarse el aviso, sale. La transacción de lanzarRumorPorHito vuelve a
  // comprobarlo todo, así que dos pestañas de /host no lanzan dos rumores.
  useEffect(() => {
    if (aviso === null || aviso > 0 || autoLanzando.current) return
    autoLanzando.current = true
    lanzarRumorPorHito(madurez.viables, madurez.hito)
      .catch((err) => console.error('lanzarRumorPorHito', err))
      .finally(() => {
        autoLanzando.current = false
      })
  }, [aviso, madurez])

  // Al vencer el plazo, el panel dispara el sorteo. Es el único cliente que
  // siempre está abierto, y `resolviendo` evita mandarlo dos veces.
  useEffect(() => {
    if (!rumor || rumor.resuelto || restanteRumor > 0 || resolviendo.current) return
    resolviendo.current = true
    resolverRumor()
      .catch((err) => console.error('resolverRumor', err))
      .finally(() => {
        resolviendo.current = false
      })
  }, [rumor, restanteRumor])

  // Crea session/main si todavía no existe, para que el resto de la app tenga qué leer.
  useEffect(() => {
    if (autorizado) asegurarSesion().catch((err) => console.error('asegurarSesion', err))
  }, [autorizado])

  if (!autorizado) return <Login onEntrar={() => setAutorizado(true)} />

  async function ejecutar(accion) {
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      await accion()
    } catch (err) {
      console.error('host', err)
      setError(
        err instanceof ErrorAmable
          ? err.message
          : 'No se pudo aplicar el cambio. Revisa tu conexión e intenta de nuevo.',
      )
    }
    setOcupado(false)
  }

  const estado = session?.game_status ?? 'esperando'
  // Los inscritos en ensayos anteriores quedaron en una generación menor y no
  // se muestran. A quien se sacó a mano SÍ se ve: es de esta generación, solo
  // que inactivo, y hay que poder devolverlo al mercado.
  const deEstaPartida = deLaGeneracion(participants, session?.generacion)
  const enMercado = activos(deEstaPartida)
  const texto = filtro.trim().toLowerCase()
  const listados = [...deEstaPartida]
    .filter(
      (p) =>
        texto === '' ||
        p.ticker.toLowerCase().includes(texto) ||
        (p.name ?? '').toLowerCase().includes(texto),
    )
    .sort((a, b) => a.ticker.localeCompare(b.ticker))

  return (
    <main className="pantalla ancha">
      <div className="host-barra">
        <p className="host-estado">
          Mercado <strong>{estado}</strong> ·{' '}
          <strong>{enMercado.length}</strong> en bolsa
          {deEstaPartida.length !== enMercado.length && (
            <> ({deEstaPartida.length - enMercado.length} fuera)</>
          )}
        </p>

        <div className="host-grupo">
          <span className="etiqueta">Mercado</span>
          <button
            className="boton compacto primario"
            disabled={ocupado || estado === 'activo'}
            onClick={() => ejecutar(() => cambiarEstado('activo'))}
          >
            Abrir
          </button>
          <button
            className="boton compacto"
            disabled={ocupado || estado === 'cerrado'}
            onClick={() => ejecutar(() => cambiarEstado('cerrado'))}
          >
            Cerrar
          </button>
        </div>

        <div className="host-grupo">
          <span className="etiqueta">Rumor</span>
          <select
            className="buscador compacto"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={ocupado || Boolean(rumor && !rumor.resuelto)}
          >
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <button
            className="boton compacto"
            disabled={ocupado || estado !== 'activo' || Boolean(rumor && !rumor.resuelto)}
            onClick={() => ejecutar(() => lanzarRumor(area))}
          >
            {restanteRumor > 0 ? `En curso ${formatearCuentaRegresiva(restanteRumor)}` : 'Lanzar'}
          </button>
        </div>

        <div className="host-grupo">
          <span className="etiqueta">Partida</span>
          {confirmandoFin ? (
            <>
              <button
                className="boton compacto peligro"
                disabled={ocupado}
                onClick={() => {
                  setConfirmandoFin(false)
                  ejecutar(() => finalizarPartida())
                }}
              >
                Sí, finalizar
              </button>
              <button className="boton compacto" onClick={() => setConfirmandoFin(false)}>
                No
              </button>
            </>
          ) : (
            <button
              className="boton compacto"
              disabled={ocupado || estado === 'cerrado'}
              onClick={() => setConfirmandoFin(true)}
            >
              Finalizar partida
            </button>
          )}
        </div>

        <div className="host-grupo">
          <span className="etiqueta">Cierre</span>
          <button
            className="boton compacto"
            disabled={ocupado || estado !== 'cerrado'}
            onClick={() => ejecutar(() => cierreVolatil())}
          >
            Cierre volátil
          </button>
        </div>
      </div>

      {(session?.completada_por || session?.cerrada_por_host) && (
        <p className="aviso">
          🏁{' '}
          {session.completada_por ? (
            <>
              <strong>${session.completada_por}</strong> invirtió en todo el mercado y el
              mercado se cerró solo.
            </>
          ) : (
            <>Cerraste el mercado.</>
          )}{' '}
          Puedes aplicar el cierre volátil y luego anunciar al ganador por puntos.
        </p>
      )}

      <div className={`madurez ${aviso !== null ? 'inminente' : ''} ${congelado ? 'congelado' : ''}`}>
        <span className="etiqueta">Rumor automático</span>

        <span className="madurez-estado">
          {hayRumorVivo
            ? `Rumor en curso · ${formatearCuentaRegresiva(restanteRumor)}`
            : aviso !== null
              ? `Sale en ${aviso} s — sorteando entre ${madurez.viables.map(nombreCortoArea).join(' y ')}`
              : congelado
                ? 'Congelado. Queda armado: lánzalo cuando te convenga.'
                : madurez.hito > lanzados
                  ? `Esperando exposición: hacen falta ${madurez.umbral} personas en un mismo sector`
                  : siguienteHito === null
                    ? 'Ya salieron todos los rumores'
                    : `Siguiente rumor al ${Math.round(siguienteHito * 100)}% del mercado`}
        </span>

        {aviso !== null && (
          <button
            className="boton compacto"
            disabled={ocupado}
            onClick={() => ejecutar(() => congelarRumorArmado(madurez.hito))}
          >
            Congelar
          </button>
        )}

        {congelado && (
          <button
            className="boton compacto primario"
            disabled={ocupado}
            onClick={() => ejecutar(() => lanzarRumor(elegirAlAzar(madurez.viables)))}
          >
            Lanzar ahora
          </button>
        )}

        <span className="madurez-barra" title={`${Math.round(madurez.progreso * 100)}% del mercado`}>
          <span className="relleno" style={{ width: `${Math.round(madurez.progreso * 100)}%` }} />
          {HITOS_RUMOR.map((h) => (
            <span key={h} className={`hito ${madurez.progreso >= h ? 'pasado' : ''}`} style={{ left: `${h * 100}%` }} />
          ))}
        </span>

        <span className="madurez-conteo">
          <span className="fuerte">{Math.round(madurez.progreso * 100)}% · {lanzados}/{HITOS_RUMOR.length} rumores</span>
          {AREAS.map((a) => (
            <span key={a.key} className={madurez.viables.includes(a.key) ? 'ok' : ''}>
              {a.corto} {madurez.expuestos[a.key] ?? 0}/{madurez.umbral}
            </span>
          ))}
        </span>
      </div>

      <div className="host-pantallas">
        <span className="etiqueta">Abrir en otra pestaña</span>
        <a className="boton compacto" href="/display" target="_blank" rel="noreferrer">
          Proyector · /display
        </a>
        <a className="boton compacto" href="/" target="_blank" rel="noreferrer">
          Vista del celular · /
        </a>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="host-cols">
        <section className="card">
          <h2>Participantes ({deEstaPartida.length})</h2>
          <input
            className="buscador"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Busca por ticker o nombre"
          />
          {listados.length === 0 && <p className="ayuda">Nadie coincide con esa búsqueda.</p>}
          <div className="panel-scroll">
            <ul className="lista-objetivos">
              {listados.map((p) => {
                const dentro = esActivo(p)
                return (
                  <li key={p.ticker} className={dentro ? '' : 'fuera'}>
                    <div className="objetivo-info">
                      <strong>${p.ticker}</strong>
                      <span>
                        {p.name} · {p.points ?? 0} pts · {p.received_count ?? 0} inv.
                        {!dentro && ' · fuera'}
                      </span>
                    </div>
                    <button
                      className="boton compacto"
                      disabled={ocupado}
                      onClick={() =>
                        ejecutar(() => (dentro ? sacarDelMercado(p.ticker) : devolverAlMercado(p.ticker)))
                      }
                    >
                      {dentro ? 'Sacar' : 'Devolver'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="ayuda">
            Sacar del mercado esconde a alguien de rankings, listas y quizzes. No borra nada:
            conserva sus puntos y puedes devolverlo.
          </p>
        </section>

        <div className="host-cols-derecha">
          <section className="card">
            <h2>Tablero</h2>
            <div className="display-tablas">
              <Leaderboard
                titulo="Mejor Portafolio"
                descripcion="Puntos ganados invirtiendo"
                participants={enMercado}
                campo="points"
                sufijo="pts"
              />
              <Leaderboard
                titulo="Acción Más Valiosa"
                descripcion="Cuánta gente ha invertido en ti"
                participants={enMercado}
                campo="received_count"
                sufijo="inv."
              />
            </div>
          </section>
          <section className="card">
            <LogFeed logs={logs} titulo={`Actividad del mercado (últimas ${logs.length})`} />
          </section>
        </div>
      </div>

      <ReiniciarPartida
        ocupado={ocupado}
        cuantos={deEstaPartida.length}
        onReiniciar={() => ejecutar(() => reiniciarPartida())}
      />

      <EmpezarDeCero
        ocupado={ocupado}
        cuantos={enMercado.length}
        onEmpezar={() => ejecutar(() => empezarDeCero())}
      />
      <Firma />
    </main>
  )
}
