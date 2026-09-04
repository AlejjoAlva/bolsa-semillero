import { QRCodeSVG } from 'qrcode.react'
import Leaderboard from '../components/Leaderboard'
import LogFeed from '../components/LogFeed'
import { msHasta, rondaDe, rumorDe, useLogs, useParticipants, useSession } from '../lib/data'
import { activos } from '../lib/participantes'
import Cinta from '../components/Cinta'
import RumorBanner from '../components/RumorBanner'
import ResumenMercado from '../components/ResumenMercado'
import { resolverRumor } from '../lib/acciones'
import { useEffect, useRef, useState } from 'react'
import { useTransicionA } from '../lib/animacion'

const ESTADOS = {
  esperando: { texto: 'MERCADO POR ABRIR', clase: 'estado-esperando' },
  activo: { texto: 'MERCADO ABIERTO', clase: 'estado-activo' },
  cerrado: { texto: 'MERCADO CERRADO', clase: 'estado-cerrado' },
}

export default function Display() {
  const session = useSession()
  const { participants: todos } = useParticipants()
  const participants = activos(todos)
  const logs = useLogs(10, rondaDe(session))

  const estado = ESTADOS[session?.game_status] ?? ESTADOS.esperando
  const urlRegistro = `${window.location.origin}/`
  const rumor = rumorDe(session)
  const [ahora, setAhora] = useState(() => Date.now())
  const resolviendo = useRef(false)

  // Un tick por segundo, solo mientras un rumor esté contando.
  useEffect(() => {
    if (!rumor || rumor.resuelto) return undefined
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [rumor])

  // Red de seguridad: normalmente el sorteo lo dispara /host, pero si ese
  // portátil se durmió o se cerró, el rumor se quedaría colgado para siempre.
  // El proyector espera 8 segundos de cortesía y lo resuelve él. La operación
  // es idempotente, así que si los dos llegan a la vez no pasa nada.
  useEffect(() => {
    if (!rumor || rumor.resuelto || resolviendo.current) return
    const vencido = msHasta(rumor.expira_at, ahora) === 0
    if (!vencido) return
    const id = setTimeout(() => {
      resolviendo.current = true
      resolverRumor()
        .catch((err) => console.error('resolverRumor (respaldo)', err))
        .finally(() => {
          resolviendo.current = false
        })
    }, 8000)
    return () => clearTimeout(id)
  }, [rumor, ahora])
  const lider = [...participants].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0]
  const abriendo = useTransicionA(session?.game_status, 'activo')

  return (
    <div className="display">
      {abriendo && (
        <div className="campana" aria-hidden="true">
          <div className="campana-banda">Mercado abierto</div>
        </div>
      )}
      <header className="display-header">
        <h1>Bolsa del Semillero</h1>
        <span className={`estado ${estado.clase}`}>{estado.texto}</span>
        <span className="conteo">{participants.length} acciones en bolsa</span>
      </header>

      {(session?.completada_por || session?.cerrada_por_host) && (
        <section className="cierre-ronda">
          <p className="cierre-eyebrow">Mercado cerrado</p>
          <p className="cierre-texto">
            {session.completada_por ? (
              <>
                <strong>${session.completada_por}</strong> invirtió en todo el mercado
              </>
            ) : (
              <>Se acabó la sesión de negociación</>
            )}
          </p>
          {lider && (
            <p className="cierre-lider">
              Va primero <strong>${lider.ticker}</strong> · {lider.name} · {lider.points ?? 0} pts
            </p>
          )}
        </section>
      )}

      <RumorBanner rumor={rumor} restante={rumor ? msHasta(rumor.expira_at, ahora) : 0} />

      <ResumenMercado participants={participants} ronda={rondaDe(session)} />

      <Cinta participants={participants} />

      <div className="display-tablas">
        <Leaderboard
          titulo="Mejor Portafolio"
          descripcion="Puntos ganados invirtiendo"
          participants={participants}
          campo="points"
          sufijo="pts"
        />
        <Leaderboard
          titulo="Acción Más Valiosa"
          descripcion="Cuánta gente ha invertido en ti"
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
