import { QRCodeSVG } from 'qrcode.react'
import {
  BONO_CRUCE,
  BONO_RACHA,
  CASTIGO_APUESTA,
  CASTIGO_CORRECCION,
  PUNTOS_BASE,
  RACHA_CADA,
  UMBRAL_SOBRECOMPRA,
} from '../lib/puntaje'
import Leaderboard from '../components/Leaderboard'
import LogFeed from '../components/LogFeed'
import { msHasta, rondaDe, rumorDe, useLogs, useParticipants, useSession } from '../lib/data'
import { activos } from '../lib/participantes'
import Cinta from '../components/Cinta'
import RumorBanner from '../components/RumorBanner'
import ResumenMercado from '../components/ResumenMercado'
import FraseMercado from '../components/FraseMercado'
import Podio from '../components/Podio'
import Firma from '../components/Firma'
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
  const cerrada = Boolean(session?.completada_por || session?.cerrada_por_host)
  // Un rumor a medias al cerrar el mercado todavía reparte puntos. Si el podio
  // saliera antes de resolverlo, la sala vería un ganador y luego el podio se
  // recolocaría solo. Se espera a que no quede rumor pendiente.
  const rumorPendiente = Boolean(rumor && !rumor.resuelto)

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

  const abriendo = useTransicionA(session?.game_status, 'activo')

  return (
    <div className="display">
      {abriendo && (
        <div className="campana" aria-hidden="true">
          <div className="campana-banda">Mercado abierto</div>
        </div>
      )}

      <header className="display-header">
        <div className="display-marca">
          <h1>La Bolsa</h1>
          <span className="display-subtitulo">Aquí cada persona cotiza · UACE</span>
        </div>
        <span className={`estado ${estado.clase}`}>{estado.texto}</span>
        <span className="conteo">{participants.length} acciones en bolsa</span>
        <img className="display-logo" src="/uace-logo.png" alt="Unidad de Análisis en Ciencias Económicas" />
      </header>

      <FraseMercado estado={session?.game_status ?? 'esperando'} />

      {rumorPendiente && (
        <RumorBanner rumor={rumor} restante={msHasta(rumor.expira_at, ahora)} />
      )}

      {cerrada && !rumorPendiente ? (
        <Podio participants={participants} session={session} />
      ) : (
        <>
          <ResumenMercado participants={participants} />

          <div className="display-cuerpo">
            <section className="zona zona-rank-a">
              <Leaderboard
                titulo="Mejor Portafolio"
                descripcion="Puntos ganados invirtiendo"
                participants={participants}
                campo="points"
                sufijo="pts"
                max={7}
              />
            </section>

            <section className="zona zona-rank-b">
              <Leaderboard
                titulo="Acción Más Valiosa"
                descripcion="Cuánta gente ha invertido en ti"
                participants={participants}
                campo="received_count"
                sufijo="inv."
                max={7}
              />
            </section>

            <aside className="zona zona-qr">
              <section className="qr">
                <h3>Regístrate</h3>
                <QRCodeSVG value={urlRegistro} size={128} includeMargin />
                <p className="url">{urlRegistro}</p>
              </section>
              <ul className="reglas-rapidas">
                <li><b>+{PUNTOS_BASE}</b> por inversión acertada</li>
                <li><b>+{BONO_CRUCE}</b> si es nuevo ↔ antiguo</li>
                <li><b>+{BONO_RACHA}</b> cada {RACHA_CADA} aciertos seguidos</li>
                <li><b>−{CASTIGO_CORRECCION}</b> a los inversores de una acción al llegar a {UMBRAL_SOBRECOMPRA}</li>
                <li><b>−{CASTIGO_APUESTA}</b> si apuestas y fallas</li>
              </ul>
            </aside>

            <section className="zona zona-log">
              <LogFeed logs={logs} />
            </section>
          </div>
        </>
      )}

      <Cinta participants={participants} />
      <Firma />
    </div>
  )
}
