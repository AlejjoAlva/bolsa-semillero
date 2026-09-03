export default function Leaderboard({ titulo, participants, campo, sufijo, max = 10 }) {
  const top = [...participants]
    .sort((a, b) => (b[campo] ?? 0) - (a[campo] ?? 0) || a.ticker.localeCompare(b.ticker))
    .slice(0, max)

  return (
    <section className="tabla">
      <h3>{titulo}</h3>
      {top.length === 0 && <p className="ayuda">Sin datos todavía.</p>}
      <ol className="lista-rank">
        {top.map((p, i) => (
          <li key={p.ticker}>
            <span className="pos">{i + 1}</span>
            <span className="tick">${p.ticker}</span>
            <span className="nom">{p.name}</span>
            <span className="val">
              {p[campo] ?? 0}
              {sufijo ? ` ${sufijo}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
