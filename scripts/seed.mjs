/**
 * Siembra participantes falsos en el EMULADOR de Firestore, para probar
 * leaderboards y quizzes sin necesitar 30 personas.
 *
 *   npm run seed            # 12 participantes
 *   npm run seed -- 25      # 25 participantes
 *
 * Requiere el emulador corriendo (npm run emu). Nunca toca producción:
 * apunta solo a 127.0.0.1:8080 y usa el token "owner" del emulador.
 */
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROJECT = process.env.VITE_FB_PROJECT_ID ?? 'demo-bolsa'
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`

const NOMBRES = ['Ana', 'Carlos', 'Lucía', 'Miguel', 'Sofía', 'Andrés', 'Valeria', 'Julián',
  'Camila', 'Ricardo', 'Daniela', 'Esteban', 'Paula', 'Óscar', 'Mariana', 'Felipe',
  'Laura', 'Tomás', 'Isabela', 'Sebastián', 'Natalia', 'Gabriel', 'Juliana', 'Mateo',
  'Verónica', 'Alejandro', 'Carolina', 'Diego', 'Manuela', 'Nicolás']
const APELLIDOS = ['Rojas', 'Gómez', 'Pérez', 'Torres', 'Vargas', 'Castro', 'Ríos', 'Mejía']
const COMIDAS = ['Bandeja paisa', 'Sushi', 'Ajiaco', 'Pizza margarita', 'Arepa de huevo',
  'Sancocho', 'Tacos al pastor', 'Lasaña', 'Ceviche', 'Empanadas', 'Ramen', 'Mondongo']
const PODERES = ['Volar', 'Leer mentes', 'Teletransportarme', 'Parar el tiempo', 'Invisibilidad',
  'Hablar con animales', 'Superfuerza', 'Curar heridas', 'Respirar bajo el agua', 'Duplicarme']
const ANECDOTAS = ['Me perdí 6 horas en un aeropuerto', 'Toqué batería en una banda de rock',
  'Fui campeón regional de ajedrez', 'Me caí a un río en una excursión',
  'Trabajé un verano en una panadería', 'Conocí a un presidente en un ascensor',
  'Aprendí japonés viendo anime', 'Corrí una media maratón sin entrenar',
  'Me tatué el logo de mi equipo', 'Vendí arepas para pagar un viaje',
  'Salí en televisión de fondo', 'Cociné para 80 personas en un grado']
const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena',
  'Pereira', 'Manizales', 'Cúcuta', 'Villavicencio', 'Popayán', 'Neiva']
const AREAS = ['analitica', 'macro', 'commodities', 'capitales']

const str = (v) => ({ stringValue: v })
const int = (v) => ({ integerValue: String(v) })
const alAzar = (arr, i) => arr[i % arr.length]

function prefijo(nombre) {
  return (nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00f1/gi, 'N')
    .toUpperCase().replace(/[^A-Z]/g, '') + 'XXX').slice(0, 3)
}

async function escribir(coleccion, id, fields) {
  const url = `${BASE}/${coleccion}${id ? `?documentId=${id}` : ''}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
}

async function main() {
  const cantidad = Number(process.argv[2]) || 12

  const res = await fetch(`http://${HOST}/`).catch(() => null)
  if (!res) {
    console.error(`No hay emulador de Firestore en ${HOST}. Corre "npm run emu" primero.`)
    process.exit(1)
  }

  await escribir('session', 'main', {
    game_status: str('activo'),
    bull_run_expires_at: { nullValue: null },
  }).catch(() => {}) // ya existía

  const usados = new Set()
  for (let i = 0; i < cantidad; i++) {
    const nombre = `${alAzar(NOMBRES, i)} ${alAzar(APELLIDOS, i * 3)}`
    let ticker
    let n = 0
    do {
      ticker = prefijo(nombre) + String((i * 7 + n * 13) % 100).padStart(2, '0')
      n++
    } while (usados.has(ticker) && n < 100)
    usados.add(ticker)

    await escribir('participants', ticker, {
      uid: str(`seed-${ticker}`),
      name: str(nombre),
      area: str(alAzar(AREAS, i)),
      seniority: str(i % 2 === 0 ? 'nuevo' : 'antiguo'),
      private_answers: {
        mapValue: {
          fields: {
            comida: str(alAzar(COMIDAS, i)),
            superpoder: str(alAzar(PODERES, i * 3)),
            anecdota: str(alAzar(ANECDOTAS, i * 5)),
            ciudad: str(alAzar(CIUDADES, i * 7)),
          },
        },
      },
      points: int(0),
      received_count: int(0),
      streak: int(0),
      created_at: { timestampValue: new Date().toISOString() },
    })
    console.log(`  $${ticker}  ${nombre}`)
  }

  console.log(`\nListo: ${cantidad} participantes sembrados en el emulador (${PROJECT}).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
