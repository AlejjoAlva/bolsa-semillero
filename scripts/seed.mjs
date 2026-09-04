/**
 * Siembra participantes falsos en el proyecto REAL, para ensayar los rankings y
 * los quizzes sin necesitar 30 personas en la sala.
 *
 *   npm run seed                  # 12 participantes
 *   npm run seed -- --n 25        # 25 participantes
 *   npm run seed -- --limpiar     # saca del mercado a todos los sembrados
 *
 * Lee la config de .env (node --env-file) y entra con un usuario anónimo, igual
 * que un celular cualquiera: no usa credenciales de administrador, así que solo
 * puede hacer lo que las reglas de firestore.rules permiten. Por eso `--limpiar`
 * no borra, sino que marca `activo: false` — nadie puede borrar desde el cliente.
 */
const API_KEY = process.env.VITE_FB_API_KEY
const PROJECT = process.env.VITE_FB_PROJECT_ID

if (!API_KEY || !PROJECT) {
  console.error('Faltan VITE_FB_API_KEY / VITE_FB_PROJECT_ID. ¿Existe el archivo .env? (ver README §1.2)')
  process.exit(1)
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

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
const AREAS = ['macro', 'alternativas', 'analitica', 'capitales']

const str = (v) => ({ stringValue: v })
const int = (v) => ({ integerValue: String(v) })
const bool = (v) => ({ booleanValue: v })
const alAzar = (arr, i) => arr[i % arr.length]

function prefijo(nombre) {
  return (nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00f1/gi, 'N')
    .toUpperCase().replace(/[^A-Z]/g, '') + 'XXX').slice(0, 3)
}

async function entrarAnonimo() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  )
  const datos = await res.json()
  if (!res.ok) {
    throw new Error(
      `No se pudo entrar con usuario anónimo: ${datos.error?.message}. ` +
        'Revisa que Authentication > Anónimo esté habilitado en la consola de Firebase.',
    )
  }
  return { token: datos.idToken, uid: datos.localId }
}

function pedir(token) {
  return async (metodo, ruta, cuerpo) => {
    const res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${res.status} ${datos.error?.message ?? ''}`)
    return datos
  }
}

async function listarParticipantes(api) {
  const docs = []
  let pageToken
  do {
    const q = `?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
    const datos = await api('GET', `/participants${q}`)
    docs.push(...(datos.documents ?? []))
    pageToken = datos.nextPageToken
  } while (pageToken)
  return docs
}

async function limpiar(api) {
  const docs = await listarParticipantes(api)
  const sembrados = docs.filter((d) => d.fields?.seed?.booleanValue === true)

  if (sembrados.length === 0) {
    console.log('No hay participantes sembrados que sacar del mercado.')
    return
  }

  for (const d of sembrados) {
    const ticker = d.name.split('/').pop()
    await api('PATCH', `/participants/${ticker}?updateMask.fieldPaths=activo`, {
      fields: { activo: bool(false) },
    })
    console.log(`  $${ticker} fuera del mercado`)
  }
  console.log(`\nListo: ${sembrados.length} sembrados fuera del mercado (siguen registrados, sin borrar).`)
}

async function sembrar(api, uid, cantidad) {
  const existentes = new Set((await listarParticipantes(api)).map((d) => d.name.split('/').pop()))

  let creados = 0
  for (let i = 0; i < cantidad; i++) {
    const nombre = `${alAzar(NOMBRES, i)} ${alAzar(APELLIDOS, i * 3)}`
    let ticker
    let n = 0
    do {
      ticker = prefijo(nombre) + String((i * 7 + n * 13) % 100).padStart(2, '0')
      n++
    } while (existentes.has(ticker) && n < 100)
    if (existentes.has(ticker)) continue
    existentes.add(ticker)

    await api('PATCH', `/participants/${ticker}`, {
      fields: {
        uid: str(uid), // las reglas exigen que coincida con quien escribe
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
        activo: bool(true),
        seed: bool(true), // marca para poder sacarlos luego en bloque
        created_at: { timestampValue: new Date().toISOString() },
      },
    })
    creados++
    console.log(`  $${ticker}  ${nombre}`)
  }

  console.log(`\nListo: ${creados} participantes sembrados en ${PROJECT}.`)
  console.log('Sácalos después con:  npm run seed -- --limpiar')
}

async function main() {
  const args = process.argv.slice(2)
  const { token, uid } = await entrarAnonimo()
  const api = pedir(token)

  if (args.includes('--limpiar')) return limpiar(api)

  const i = args.indexOf('--n')
  const cantidad = Number(i >= 0 ? args[i + 1] : args[0]) || 12
  console.log(`Sembrando ${cantidad} participantes en ${PROJECT}…`)
  return sembrar(api, uid, cantidad)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
