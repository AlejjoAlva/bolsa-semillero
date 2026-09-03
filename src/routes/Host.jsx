import { useEffect, useState } from 'react'
import LogFeed from '../components/LogFeed'
import Leaderboard from '../components/Leaderboard'
import {
  BULL_RUN_MINUTOS,
  activarBullRun,
  asegurarSesion,
  cambiarEstado,
} from '../lib/acciones'
import {
  formatearCuentaRegresiva,
  msRestantesBullRun,
  useLogs,
  useParticipants,
  useSession,
} from '../lib/data'

const PASSWORD = import.meta.env.VITE_HOST_PASSWORD
const CLAVE_SESION = 'bolsa_host_ok'

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
    </main>
  )
}

export default function Host() {
  const [autorizado, setAutorizado] = useState(() => sessionStorage.getItem(CLAVE_SESION) === '1')
  const session = useSession()
  const { participants } = useParticipants()
  const logs = useLogs(0)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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
      setError('No se pudo aplicar el cambio. Revisa tu conexión e intenta de nuevo.')
    }
    setOcupado(false)
  }

  const estado = session?.game_status ?? 'esperando'
  const restante = msRestantesBullRun(session, ahora)

  return (
    <main className="pantalla ancha">
      <section className="card">
        <h2>Control del mercado</h2>
        <p className="ayuda">
          Estado actual: <strong>{estado}</strong> · {participants.length} participantes
          {restante > 0 && <> · Bull Run {formatearCuentaRegresiva(restante)}</>}
        </p>

        <div className="botonera">
          <button
            className="boton primario"
            disabled={ocupado || estado === 'activo'}
            onClick={() => ejecutar(() => cambiarEstado('activo'))}
          >
            Iniciar juego
          </button>
          <button
            className="boton"
            disabled={ocupado || estado === 'cerrado'}
            onClick={() => ejecutar(() => cambiarEstado('cerrado'))}
          >
            Cerrar mercado
          </button>
          <button
            className="boton"
            disabled={ocupado || estado !== 'activo'}
            onClick={() => ejecutar(() => activarBullRun())}
          >
            Activar Bull Run ({BULL_RUN_MINUTOS} min)
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <div className="display-tablas">
        <Leaderboard titulo="Mejor Portafolio" participants={participants} campo="points" sufijo="pts" />
        <Leaderboard
          titulo="Acción Más Valiosa"
          participants={participants}
          campo="received_count"
          sufijo="inv."
        />
      </div>

      <section className="card">
        <LogFeed logs={logs} titulo={`Log completo (${logs.length})`} />
      </section>
    </main>
  )
}
