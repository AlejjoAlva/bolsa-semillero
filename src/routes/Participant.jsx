import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RegisterForm from '../components/RegisterForm'
import Instrucciones from '../components/Instrucciones'
import Firma from '../components/Firma'
import InvestModal from '../components/InvestModal'
import {
  claseArea,
  etiquetaArea,
  rondaDe,
  rumorDe,
  siglaArea,
  useRoster,
  useSession,
} from '../lib/data'
import { activos, debeOlvidarRegistro, esActivo } from '../lib/participantes'
import { useContador } from '../lib/animacion'
import { fijarPostura } from '../lib/acciones'
import RumorCard from '../components/RumorCard'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const CLAVE_LOCAL = 'bolsa_ticker'
// Qué "generación" de la partida vio este celular. Si el anfitrión empieza de
// cero, la de la sesión cambia y este celular olvida su registro.
const CLAVE_GENERACION = 'bolsa_generacion'

/**
 * Inversiones que ya hizo esta persona en la ronda actual, para no ofrecer
 * objetivos repetidos. Las de rondas anteriores se descartan en memoria: son
 * pocas por persona y así la consulta no necesita un índice compuesto.
 */
function useMisInversiones(ticker, ronda) {
  const [hechas, setHechas] = useState(new Set())

  useEffect(() => {
    if (!ticker || ronda === undefined) {
      setHechas(new Set())
      return
    }
    const q = query(collection(db, 'investments'), where('investor', '==', ticker))
    return onSnapshot(
      q,
      (snap) =>
        setHechas(
          new Set(
            snap.docs
              .map((d) => d.data())
              .filter((d) => (d.ronda ?? 1) === ronda)
              .map((d) => d.target),
          ),
        ),
      (err) => console.error('investments listener', err),
    )
  }, [ticker, ronda])

  return hechas
}

/**
 * El título de la app esconde la entrada al panel de control: cinco toques
 * seguidos llevan a /host. Así el anfitrión llega desde cualquier celular sin
 * que la ruta esté a la vista de los participantes (que igual tendrían que
 * saber la contraseña).
 */
function TituloConAcceso() {
  const navegar = useNavigate()
  const toques = useRef({ n: 0, ultimo: 0 })

  function tocar() {
    const ahora = Date.now()
    toques.current.n = ahora - toques.current.ultimo < 1200 ? toques.current.n + 1 : 1
    toques.current.ultimo = ahora
    if (toques.current.n >= 5) {
      toques.current.n = 0
      navegar('/host')
    }
  }

  return (
    <header className="cabecera-app">
      <h1 className="titulo-app" onClick={tocar}>
        La Bolsa
      </h1>
      <img className="logo-app" src="/uace-logo.png" alt="Unidad de Análisis en Ciencias Económicas" />
    </header>
  )
}

/** Las tres cifras del perfil, contando hacia arriba cuando cambian. */
function Metricas({ yo }) {
  const puntos = useContador(yo.points ?? 0)
  const recibidas = useContador(yo.received_count ?? 0)
  const racha = useContador(yo.streak ?? 0)

  return (
    <div className="metricas">
      <div>
        <strong>{puntos}</strong>
        <span>puntos</span>
      </div>
      <div>
        <strong>{recibidas}</strong>
        <span>inversiones recibidas</span>
      </div>
      <div>
        <strong>{racha}</strong>
        <span>racha</span>
      </div>
    </div>
  )
}

export default function Participant() {
  const session = useSession()
  // El ticker se declara antes que el roster porque el roster escucha en vivo
  // el documento propio y necesita saber cuál es.
  const [ticker, setTicker] = useState(() => localStorage.getItem(CLAVE_LOCAL) ?? null)
  const { participants, cargado, propioResuelto, recargar } = useRoster(ticker, session?.activos_count)
  const [actualizando, setActualizando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [objetivo, setObjetivo] = useState(null)

  const ronda = rondaDe(session)
  const yo = useMemo(() => participants.find((p) => p.ticker === ticker) ?? null, [participants, ticker])
  const misInversiones = useMisInversiones(yo?.ticker, ronda)

  // Si se borró el localStorage pero este mismo dispositivo ya se registró,
  // lo reconocemos por el uid anónimo.
  useEffect(() => {
    if (ticker || !cargado) return
    const uid = auth.currentUser?.uid
    // Solo se recupera un registro VIGENTE: tras "empezar de cero" el documento
    // viejo sigue ahí con este mismo uid anónimo, y sin este filtro el celular
    // resucitaría un ticker retirado en vez de volver al registro.
    const mio = uid && participants.find((p) => p.uid === uid && esActivo(p))
    if (mio) {
      localStorage.setItem(CLAVE_LOCAL, mio.ticker)
      setTicker(mio.ticker)
    }
  }, [ticker, cargado, participants])

  // El anfitrión empezó de cero: este celular debe registrarse otra vez.
  useEffect(() => {
    const generacion = session?.generacion
    const vista = Number(localStorage.getItem(CLAVE_GENERACION) ?? 0)
    if (!debeOlvidarRegistro(generacion, vista)) return
    localStorage.setItem(CLAVE_GENERACION, String(generacion))
    localStorage.removeItem(CLAVE_LOCAL)
    setTicker(null)
  }, [session?.generacion])

  // El ticker guardado ya no existe (p. ej. se limpió la base): volvemos al registro.
  // Solo se descarta el ticker cuando el listener del documento propio ha
  // confirmado que NO existe. Comprobarlo contra el listado sería una carrera:
  // recién registrado, el listado es todavía la foto anterior y borraríamos un
  // registro que sí existe, dejando a la persona atrapada en el formulario.
  useEffect(() => {
    if (ticker && cargado && propioResuelto && !yo) {
      localStorage.removeItem(CLAVE_LOCAL)
      setTicker(null)
    }
  }, [ticker, cargado, propioResuelto, yo])

  // El celular no escucha la lista en vivo (ver useRoster): se refresca sola
  // cuando alguien entra o sale, pero este botón deja pedirla a mano.
  async function actualizarLista() {
    setActualizando(true)
    try {
      await recargar()
    } finally {
      setActualizando(false)
    }
  }

  function alRegistrar(nuevoTicker) {
    localStorage.setItem(CLAVE_LOCAL, nuevoTicker)
    setTicker(nuevoTicker)
  }

  const tickersExistentes = useMemo(() => new Set(participants.map((p) => p.ticker)), [participants])

  const candidatos = useMemo(() => {
    if (!yo) return []
    const texto = busqueda.trim().toLowerCase()
    return activos(participants)
      .filter((p) => p.ticker !== yo.ticker)
      .filter(
        (p) =>
          texto === '' ||
          p.ticker.toLowerCase().includes(texto) ||
          (p.name ?? '').toLowerCase().includes(texto),
      )
      .sort((a, b) => a.ticker.localeCompare(b.ticker))
  }, [participants, yo, busqueda])

  if (!cargado) {
    return (
      <main className="pantalla">
        <p className="ayuda">Conectando con el mercado…</p>
        <Firma />
      </main>
    )
  }

  if (!yo) {
    return (
      <main className="pantalla">
        <TituloConAcceso />
        <Instrucciones abiertaAlPrincipio />
        <RegisterForm tickersExistentes={tickersExistentes} onRegistrado={alRegistrar} />
        <Firma />
      </main>
    )
  }

  if (yo.activo === false) {
    return (
      <main className="pantalla">
        <section className="card perfil">
          <h1 className="ticker-grande">${yo.ticker}</h1>
          <p className="aviso">
            El anfitrión te sacó del mercado. Si crees que es un error, háblale — puede devolverte
            desde su panel y no pierdes nada de lo que llevas.
          </p>
        </section>
        <Firma />
      </main>
    )
  }

  if (objetivo) {
    return (
      <main className="pantalla">
        <InvestModal
          yo={yo}
          target={objetivo}
          participants={participants}
          ronda={ronda}
          onCerrar={() => setObjetivo(null)}
        />
        <Firma />
      </main>
    )
  }

  const abierto = session?.game_status === 'activo'
  const cerrada = Boolean(session?.completada_por || session?.cerrada_por_host)

  return (
    <main className="pantalla">
      <section className="card perfil">
        <h1 className="ticker-grande">${yo.ticker}</h1>
        <p className="ayuda">
          {yo.name} · {etiquetaArea(yo.area)} · {yo.seniority}
        </p>
        <Metricas yo={yo} />
      </section>

      <Instrucciones />

      <RumorCard
        rumor={rumorDe(session)}
        yo={yo}
        onElegir={(postura) => fijarPostura(yo.ticker, rumorDe(session).id, postura)}
      />

      {cerrada && (
        <section className="card cierre-participante">
          <p className="rumor-eyebrow">Mercado cerrado</p>
          <p className="rumor-titulo">
            {session.completada_por === yo.ticker
              ? 'Invertiste en todo el mercado y cerraste la ronda'
              : session.completada_por
                ? `$${session.completada_por} completó el mercado`
                : 'El anfitrión cerró la sesión'}
          </p>
          <p className="ayuda">
            Terminaste con <strong>{yo.points ?? 0} puntos</strong> y{' '}
            <strong>{yo.received_count ?? 0}</strong>{' '}
            {(yo.received_count ?? 0) === 1 ? 'persona invirtió' : 'personas invirtieron'} en ti.
            Los resultados finales están en la pantalla grande.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Invertir</h2>
        {!abierto && !cerrada && (
          <p className="aviso">El mercado abre pronto, mira la pantalla grande.</p>
        )}

        <div className="fila-actualizar">
          <span className="ayuda">
            {candidatos.length === 1 ? '1 acción disponible' : `${candidatos.length} acciones disponibles`}
          </span>
          <button
            className="boton compacto fantasma"
            onClick={actualizarLista}
            disabled={actualizando}
          >
            {actualizando ? 'Actualizando…' : '↻ Actualizar lista'}
          </button>
        </div>

        <input
          className="buscador"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca por ticker o nombre"
          disabled={!abierto}
        />

        {candidatos.length === 0 && (
          <p className="ayuda">
            {participants.length <= 1
              ? 'Aún no hay nadie más registrado.'
              : 'Nadie coincide con esa búsqueda.'}
          </p>
        )}

        <ul className="lista-objetivos">
          {candidatos.map((p) => {
            const yaInvertido = misInversiones.has(p.ticker)
            return (
              <li key={p.ticker}>
                <div className="objetivo-info">
                  <strong>${p.ticker}</strong>
                  <span>
                    {p.name} <span className={claseArea(p.area)}>{siglaArea(p.area)}</span>
                  </span>
                </div>
                <button
                  className="boton compacto"
                  disabled={!abierto || yaInvertido}
                  onClick={() => setObjetivo(p)}
                >
                  {yaInvertido ? 'Ya invertiste' : 'Invertir'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <Firma />
    </main>
  )
}
