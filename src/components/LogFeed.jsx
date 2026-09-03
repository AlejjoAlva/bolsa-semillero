const ICONO = { registro: '🎉', inversion: '📈', bull_run: '🚀' }

function hora(ts) {
  const ms = ts?.toMillis?.()
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export default function LogFeed({ logs, titulo = 'Actividad del mercado' }) {
  return (
    <section className="tabla">
      <h3>{titulo}</h3>
      {logs.length === 0 && <p className="ayuda">Nada ha pasado todavía.</p>}
      <ul className="lista-log">
        {logs.map((l) => (
          <li key={l.id}>
            <span className="icono">{ICONO[l.type] ?? '•'}</span>
            <span className="detalle">{l.detail}</span>
            <span className="hora">{hora(l.timestamp)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
