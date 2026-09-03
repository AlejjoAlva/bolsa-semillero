import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Leaderboard from '../components/Leaderboard'
import LogFeed from '../components/LogFeed'
import {
  formatearCuentaRegresiva,
  msRestantesBullRun,
  useLogs,
  useParticipants,
  useSession,
} from '../lib/data'

const ESTADOS = {
  esperando: { texto: 'MERCADO POR ABRIR', clase: 'estado-esperando' },
  activo: { texto: 'MERCADO ABIERTO', clase: 'estado-activo' },
  cerrado: { texto: 'MERCADO CERRADO', clase: 'estado-cerrado' },
}

export default function Display() {
  const session = useSession()
  const { participants } = useParticipants()
  const logs = useLogs(10)
  const [ahora, setAhora] = useState(() => Date.now())

  // Un solo tick por segundo mantiene viva la cuenta regresiva del bull run.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const estado = ESTADOS[session?.game_status] ?? ESTADOS.esperando
  const restante = msRestantesBullRun(session, ahora)
  const urlRegistro = `${window.location.origin}/`

  return (
    <div className="display">
      <header className="display-header">
        <h1>Bolsa del Semillero</h1>
        <span className={`estado ${estado.clase}`}>{estado.texto}</span>
        {restante > 0 && (
          <span className="bull-run">🚀 BULL RUN · puntos dobles · {formatearCuentaRegresiva(restante)}</span>
        )}
        <span className="conteo">{participants.length} acciones en bolsa</span>
      </header>

      <div className="display-tablas">
        <Leaderboard titulo="Mejor Portafolio" participants={participants} campo="points" sufijo="pts" />
        <Leaderboard
          titulo="Acción Más Valiosa"
          participants={participants}
          campo="received_count"
          sufijo="inv."
        />
      </div>

      <div className="display-pie">
        <LogFeed logs={logs} />
        <section className="qr">
          <h3>Regístrate</h3>
          <QRCodeSVG value={urlRegistro} size={160} includeMargin />
          <p className="url">{urlRegistro}</p>
        </section>
      </div>
    </div>
  )
}
