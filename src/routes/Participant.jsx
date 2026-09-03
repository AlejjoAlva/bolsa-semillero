import { useEffect, useMemo, useState } from 'react'
import RegisterForm from '../components/RegisterForm'
import InvestModal from '../components/InvestModal'
import { bullRunActivo, etiquetaArea, useParticipants, useSession } from '../lib/data'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const CLAVE_LOCAL = 'bolsa_ticker'

/** Inversiones que ya hizo esta persona, para no ofrecer objetivos repetidos. */
function useMisInversiones(ticker) {
  const [hechas, setHechas] = useState(new Set())

  useEffect(() => {
    if (!ticker) {
      setHechas(new Set())
      return
    }
    const q = query(collection(db, 'investments'), where('investor', '==', ticker))
    return onSnapshot(
      q,
      (snap) => setHechas(new Set(snap.docs.map((d) => d.data().target))),
      (err) => console.error('investments listener', err),
    )
  }, [ticker])

  return hechas
}

export default function Participant() {
  const session = useSession()
  const { participants, cargado } = useParticipants()
  const [ticker, setTicker] = useState(() => localStorage.getItem(CLAVE_LOCAL) ?? null)
  const [busqueda, setBusqueda] = useState('')
  const [objetivo, setObjetivo] = useState(null)

  const yo = useMemo(() => participants.find((p) => p.ticker === ticker) ?? null, [participants, ticker])
  const misInversiones = useMisInversiones(yo?.ticker)

  // Si se borró el localStorage pero este mismo dispositivo ya se registró,
  // lo reconocemos por el uid anónimo.
  useEffect(() => {
    if (ticker || !cargado) return
    const uid = auth.currentUser?.uid
    const mio = uid && participants.find((p) => p.uid === uid)
    if (mio) {
      localStorage.setItem(CLAVE_LOCAL, mio.ticker)
      setTicker(mio.ticker)
    }
  }, [ticker, cargado, participants])

  // El ticker guardado ya no existe (p. ej. se limpió la base): volvemos al registro.
  useEffect(() => {
    if (ticker && cargado && !yo) {
      localStorage.removeItem(CLAVE_LOCAL)
      setTicker(null)
    }
  }, [ticker, cargado, yo])

  function alRegistrar(nuevoTicker) {
    localStorage.setItem(CLAVE_LOCAL, nuevoTicker)
    setTicker(nuevoTicker)
  }

  const tickersExistentes = useMemo(() => new Set(participants.map((p) => p.ticker)), [participants])

  const candidatos = useMemo(() => {
    if (!yo) return []
    const texto = busqueda.trim().toLowerCase()
    return participants
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
      </main>
    )
  }

  if (!yo) {
    return (
      <main className="pantalla">
        <h1 className="titulo-app">Bolsa del Semillero</h1>
        <RegisterForm tickersExistentes={tickersExistentes} onRegistrado={alRegistrar} />
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
          onCerrar={() => setObjetivo(null)}
        />
      </main>
    )
  }

  const abierto = session?.game_status === 'activo'
  const bull = bullRunActivo(session)

  return (
    <main className="pantalla">
      <section className="card perfil">
        <h1 className="ticker-grande">${yo.ticker}</h1>
        <p className="ayuda">
          {yo.name} · {etiquetaArea(yo.area)} · {yo.seniority}
        </p>
        <div className="metricas">
          <div>
            <strong>{yo.points ?? 0}</strong>
            <span>puntos</span>
          </div>
          <div>
            <strong>{yo.received_count ?? 0}</strong>
            <span>inversiones recibidas</span>
          </div>
          <div>
            <strong>{yo.streak ?? 0}</strong>
            <span>racha</span>
          </div>
        </div>
        {bull && <p className="aviso-bull">🚀 Bull Run activo: puntos dobles</p>}
      </section>

      <section className="card">
        <h2>Invertir</h2>
        {!abierto && (
          <p className="aviso">
            {session?.game_status === 'cerrado'
              ? 'El mercado cerró. Mira la pantalla grande.'
              : 'El mercado abre pronto, mira la pantalla grande.'}
          </p>
        )}

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
                    {p.name} · {etiquetaArea(p.area)}
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
    </main>
  )
}
