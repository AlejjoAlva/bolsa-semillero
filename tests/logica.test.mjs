// Pruebas de la lógica pura del juego (sin Firebase, sin navegador):
//   npm test
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COMISION_LIQUIDAR,
  UMBRAL_SOBRECOMPRA,
  HITOS_RUMOR,
  efectoDelRumor,
  elegirAlAzar,
  hitoAlcanzado,
  progresoMercado,
  exposicionA,
  expuestosPorSector,
  sectoresViables,
  umbralExpuestos,
  ajusteDeCierre,
  calcularPuntos,
  haySobrecompra,
  puntosTrasFallo,
  rondaCompletada,
} from '../src/lib/puntaje.js'
import { generarTicker, prefijoDe, idInversion } from '../src/lib/ticker.js'
import { armarQuiz, esCorrecta } from '../src/lib/quiz.js'
import {
  activos, deLaGeneracion, debeOlvidarRegistro, esActivo, fusionarRoster, marcaMasReciente,
} from '../src/lib/participantes.js'
import { AREAS, etiquetaArea, nombreCortoArea, siglaArea } from '../src/lib/areas.js'

// --- Puntaje ---------------------------------------------------------------

test('inversión normal entre dos personas del mismo grupo: 2 puntos', () => {
  const r = calcularPuntos({ rachaPrevia: 0, seniorityInvestor: 'nuevo', seniorityTarget: 'nuevo' })
  assert.equal(r.puntos, 2)
  assert.equal(r.cruce, false)
  assert.equal(r.nuevaRacha, 1)
})

test('cruce nuevo ↔ antiguo suma 1', () => {
  assert.equal(
    calcularPuntos({ seniorityInvestor: 'nuevo', seniorityTarget: 'antiguo' }).puntos,
    3,
  )
})

test('la racha bonifica en el 3.º acierto, no antes', () => {
  const iguales = { seniorityInvestor: 'nuevo', seniorityTarget: 'nuevo' }
  assert.equal(calcularPuntos({ ...iguales, rachaPrevia: 1 }).puntos, 2)
  assert.equal(calcularPuntos({ ...iguales, rachaPrevia: 2 }).puntos, 3) // racha llega a 3
  assert.equal(calcularPuntos({ ...iguales, rachaPrevia: 5 }).puntos, 3) // racha llega a 6
})

// --- Apuesta (venta en corto) ----------------------------------------------

test('la apuesta duplica lo que se hubiera ganado', () => {
  const base = { seniorityInvestor: 'nuevo', seniorityTarget: 'antiguo' }
  assert.equal(calcularPuntos(base).puntos, 3)
  assert.equal(calcularPuntos({ ...base, apuesta: true }).puntos, 6)
})

test('fallar con apuesta cuesta 2 puntos; sin apuesta no cuesta nada', () => {
  assert.equal(puntosTrasFallo(7, true), 5)
  assert.equal(puntosTrasFallo(7, false), 7)
})

test('la apuesta nunca deja los puntos en negativo', () => {
  assert.equal(puntosTrasFallo(1, true), 0)
  assert.equal(puntosTrasFallo(0, true), 0)
})

// --- Rumor de sector -------------------------------------------------------

test('mantener con el rumor falso paga 1 por cada persona del sector', () => {
  assert.equal(efectoDelRumor({ postura: 'mantener', exposicion: 3, cierto: false }), 3)
})

test('mantener con el rumor cierto cuesta 1 por cada una', () => {
  assert.equal(efectoDelRumor({ postura: 'mantener', exposicion: 3, cierto: true }), -3)
})

test('liquidar blinda si el rumor era cierto', () => {
  assert.equal(efectoDelRumor({ postura: 'liquidar', exposicion: 3, cierto: true }), 0)
})

test('liquidar en falso cuesta la comisión, sin importar la exposición', () => {
  assert.equal(efectoDelRumor({ postura: 'liquidar', exposicion: 3, cierto: false }), -COMISION_LIQUIDAR)
  assert.equal(efectoDelRumor({ postura: 'liquidar', exposicion: 1, cierto: false }), -COMISION_LIQUIDAR)
})

test('sin exposición el rumor no toca a nadie, decida lo que decida', () => {
  for (const postura of ['mantener', 'liquidar']) {
    for (const cierto of [true, false]) {
      assert.equal(efectoDelRumor({ postura, exposicion: 0, cierto }), 0, `${postura}/${cierto}`)
    }
  }
})

test('no elegir nada equivale a mantener', () => {
  assert.equal(efectoDelRumor({ postura: undefined, exposicion: 2, cierto: true }), -2)
  assert.equal(efectoDelRumor({ postura: null, exposicion: 2, cierto: false }), 2)
})

test('la exposición cuenta a cuánta gente del sector le invertiste', () => {
  const areaDe = { AAA01: 'macro', BBB02: 'macro', CCC03: 'capitales' }
  assert.equal(exposicionA('macro', ['AAA01', 'BBB02', 'CCC03'], areaDe), 2)
  assert.equal(exposicionA('capitales', ['AAA01', 'BBB02', 'CCC03'], areaDe), 1)
  assert.equal(exposicionA('alternativas', ['AAA01', 'BBB02'], areaDe), 0)
  assert.equal(exposicionA('macro', [], areaDe), 0)
})

test('la exposición ignora tickers que ya no existen', () => {
  assert.equal(exposicionA('macro', ['AAA01', 'FANTASMA'], { AAA01: 'macro' }), 1)
})

// --- ¿Cuándo tiene sentido lanzar un rumor? --------------------------------

test('el umbral de exposición es el 30% de la sala, nunca menos de 3', () => {
  assert.equal(umbralExpuestos(8), 3)   // 2.4 → sube al mínimo
  assert.equal(umbralExpuestos(30), 9)
  assert.equal(umbralExpuestos(2), 3)
})

const AREA_DE = {
  M1: 'macro', M2: 'macro', C1: 'capitales', C2: 'capitales', A1: 'analitica',
}

test('cuenta personas expuestas, no inversiones: invertir 3 veces en macro es una sola persona expuesta', () => {
  const porInversor = new Map([['X', ['M1', 'M2']], ['Y', ['M1']], ['Z', ['C1']]])
  const expuestos = expuestosPorSector(porInversor, AREA_DE)
  assert.equal(expuestos.macro, 2)
  assert.equal(expuestos.capitales, 1)
  assert.equal(expuestos.analitica ?? 0, 0)
})

test('solo son viables los sectores que alcanzan el umbral', () => {
  assert.deepEqual(sectoresViables({ macro: 4, capitales: 2, analitica: 5 }, 8), ['analitica', 'macro'])
  assert.deepEqual(sectoresViables({ macro: 2, capitales: 1 }, 8), [])
})

test('sin nadie invertido no hay ningún sector viable', () => {
  assert.deepEqual(sectoresViables(expuestosPorSector(new Map(), AREA_DE), 8), [])
})

test('el sorteo del sector es reproducible si se le pasa el azar', () => {
  const viables = ['analitica', 'macro', 'capitales']
  assert.equal(elegirAlAzar(viables, 0), 'analitica')
  assert.equal(elegirAlAzar(viables, 0.5), 'macro')
  assert.equal(elegirAlAzar(viables, 0.99), 'capitales')
  assert.equal(elegirAlAzar([], 0.5), null)
})

// --- Ritmo de los rumores --------------------------------------------------

test('el progreso es la fracción del máximo de inversiones posibles', () => {
  // 5 personas → cada una puede invertir en 4 → 20 inversiones posibles
  assert.equal(progresoMercado(0, 5), 0)
  assert.equal(progresoMercado(10, 5), 0.5)
  assert.equal(progresoMercado(20, 5), 1)
})

test('el progreso no se pasa de 1 ni revienta con poca gente', () => {
  assert.equal(progresoMercado(50, 5), 1)
  assert.equal(progresoMercado(3, 1), 0)
  assert.equal(progresoMercado(3, 0), 0)
})

test('cada hito cruzado habilita un rumor más', () => {
  assert.equal(hitoAlcanzado(0), 0)
  assert.equal(hitoAlcanzado(HITOS_RUMOR[0] / 2), 0)
  for (let i = 0; i < HITOS_RUMOR.length; i++) {
    assert.equal(hitoAlcanzado(HITOS_RUMOR[i]), i + 1, `justo en el hito ${i}`)
  }
  assert.equal(hitoAlcanzado(0.99), HITOS_RUMOR.length)
})

test('los hitos caben antes de que alguien complete el mercado', () => {
  // La ronda se cierra cuando alguien invierte en todos: activos-1 inversiones.
  // El primer hito tiene que quedar por debajo de eso, o no saldría ni un rumor.
  for (const activos of [10, 20, 35]) {
    const cierraEn = activos - 1
    const primerHito = HITOS_RUMOR[0] * activos * (activos - 1)
    assert.ok(primerHito < cierraEn * activos * 0.5,
      `con ${activos} personas el primer hito (${Math.ceil(primerHito)}) llega demasiado tarde`)
  }
})

test('los hitos topan la cantidad de rumores automáticos de una ronda', () => {
  assert.equal(hitoAlcanzado(1), HITOS_RUMOR.length)
  assert.ok(HITOS_RUMOR.length <= 4, 'más de cuatro rumores por ronda cansarían a la sala')
})

test('los hitos van en orden ascendente y dentro de (0,1)', () => {
  for (let i = 0; i < HITOS_RUMOR.length; i++) {
    assert.ok(HITOS_RUMOR[i] > 0 && HITOS_RUMOR[i] < 1)
    if (i > 0) assert.ok(HITOS_RUMOR[i] > HITOS_RUMOR[i - 1])
  }
})

// --- Corrección por sobrecompra --------------------------------------------

test('una acción se sobrecalienta al llegar al umbral, no antes', () => {
  assert.equal(haySobrecompra(UMBRAL_SOBRECOMPRA - 1), false)
  assert.equal(haySobrecompra(UMBRAL_SOBRECOMPRA), true)
  assert.equal(haySobrecompra(UMBRAL_SOBRECOMPRA + 3), true)
})

// --- Cierre volátil --------------------------------------------------------

const rec = (ticker, recibidas) => ({ ticker, received_count: recibidas })

test('el cierre volátil castiga a los más comprados y premia a los menos buscados', () => {
  const gente = [
    rec('AAA01', 9), rec('BBB02', 7), rec('CCC03', 6),
    rec('DDD04', 3), rec('EEE05', 1), rec('FFF06', 0),
  ]
  const { bajan, suben } = ajusteDeCierre(gente)
  assert.deepEqual(bajan.map((p) => p.ticker), ['AAA01', 'BBB02', 'CCC03'])
  assert.deepEqual(suben.map((p) => p.ticker), ['FFF06', 'EEE05', 'DDD04'])
})

test('con poca gente nadie sale dos veces castigado y premiado a la vez', () => {
  const { bajan, suben } = ajusteDeCierre([rec('AAA01', 4), rec('BBB02', 1), rec('CCC03', 0)])
  const repetidos = bajan.filter((b) => suben.some((s) => s.ticker === b.ticker))
  assert.deepEqual(repetidos, [])
})

test('sin participantes el cierre volátil no hace nada', () => {
  assert.deepEqual(ajusteDeCierre([]), { bajan: [], suben: [] })
})

// --- Fin de la ronda -------------------------------------------------------

test('la ronda se completa cuando alguien invirtió en todos menos en sí mismo', () => {
  assert.equal(rondaCompletada(6, 8), false)
  assert.equal(rondaCompletada(7, 8), true)
  assert.equal(rondaCompletada(8, 8), true)
})

test('con una sola persona registrada la ronda no se da por completada', () => {
  assert.equal(rondaCompletada(0, 1), false)
})

// --- Tickers ---------------------------------------------------------------

test('el prefijo quita tildes y ñ, y rellena nombres cortos', () => {
  assert.equal(prefijoDe('Óscar Peña'), 'OSC')
  assert.equal(prefijoDe('ñandú'), 'NAN')
  assert.equal(prefijoDe('Jo'), 'JOX')
})

test('el ticker generado nunca choca con uno existente', () => {
  const tomados = new Set()
  for (let i = 0; i < 60; i++) {
    const t = generarTicker('Ana Rojas', tomados)
    assert.ok(t, 'debería quedar sufijo libre')
    assert.match(t, /^ANA\d{2}$/)
    assert.ok(!tomados.has(t))
    tomados.add(t)
  }
})

test('si los 100 sufijos están ocupados devuelve null', () => {
  const tomados = new Set(Array.from({ length: 100 }, (_, n) => 'ANA' + String(n).padStart(2, '0')))
  assert.equal(generarTicker('Ana', tomados), null)
})

test('el id de inversión es determinístico y direccional', () => {
  assert.equal(idInversion('ANA47', 'CAR12', 1), 'ANA47_CAR12_r1')
  assert.notEqual(idInversion('ANA47', 'CAR12', 1), idInversion('CAR12', 'ANA47', 1))
})

test('el id de inversión cambia con la ronda, para poder reinvertir tras un reinicio', () => {
  assert.notEqual(idInversion('ANA47', 'CAR12', 1), idInversion('ANA47', 'CAR12', 2))
  assert.equal(idInversion('ANA47', 'CAR12', 2), 'ANA47_CAR12_r2')
})

test('sin ronda explícita asume la 1', () => {
  assert.equal(idInversion('ANA47', 'CAR12'), 'ANA47_CAR12_r1')
})

// --- Participantes activos -------------------------------------------------

test('un participante sin el campo activo cuenta como activo', () => {
  assert.equal(esActivo({ ticker: 'ANA47' }), true)
  assert.equal(esActivo({ ticker: 'ANA47', activo: true }), true)
})

test('sacar del mercado es activo: false', () => {
  assert.equal(esActivo({ ticker: 'ANA47', activo: false }), false)
})

test('activos() filtra a los que fueron sacados del mercado', () => {
  const lista = [
    { ticker: 'AAA01' },
    { ticker: 'BBB02', activo: true },
    { ticker: 'CCC03', activo: false },
  ]
  assert.deepEqual(activos(lista).map((p) => p.ticker), ['AAA01', 'BBB02'])
})


// --- Quiz ------------------------------------------------------------------

const persona = (ticker, respuestas) => ({ ticker, private_answers: respuestas })

const GRUPO = [
  persona('ANA47', { comida: 'Ajiaco', superpoder: 'Volar', anecdota: 'Toqué batería', ciudad: 'Cali' }),
  persona('CAR12', { comida: 'Sushi', superpoder: 'Invisibilidad', anecdota: 'Corrí una maratón', ciudad: 'Bogotá' }),
  persona('LUC03', { comida: 'Pizza', superpoder: 'Leer mentes', anecdota: 'Viví en Japón', ciudad: 'Medellín' }),
  persona('MIG88', { comida: 'Tacos', superpoder: 'Superfuerza', anecdota: 'Crié un loro', ciudad: 'Pereira' }),
]

test('arma 3 opciones, una correcta y dos ajenas', () => {
  const target = GRUPO[0]
  for (let i = 0; i < 30; i++) {
    const quiz = armarQuiz(target, GRUPO)
    assert.ok(quiz)
    assert.equal(quiz.opciones.length, 3)
    assert.equal(new Set(quiz.opciones).size, 3, 'sin opciones repetidas')
    assert.ok(quiz.opciones.includes(target.private_answers[quiz.categoria]))
    assert.ok(esCorrecta(quiz, target.private_answers[quiz.categoria]))
    assert.ok(!esCorrecta(quiz, quiz.opciones.find((o) => o !== quiz.correcta)))
  }
})

test('la respuesta del target nunca aparece como distractor duplicado', () => {
  // Dos personas comparten ciudad: la opción no debe aparecer dos veces.
  const grupo = [
    persona('AAA01', { ciudad: 'Cali' }),
    persona('BBB02', { ciudad: 'Cali' }),
    persona('CCC03', { ciudad: 'Bogotá' }),
    persona('DDD04', { ciudad: 'Medellín' }),
  ]
  for (let i = 0; i < 20; i++) {
    const quiz = armarQuiz(grupo[0], grupo)
    assert.equal(new Set(quiz.opciones.map((o) => o.toLowerCase())).size, quiz.opciones.length)
  }
})

test('con una sola persona registrada no hay pregunta posible', () => {
  assert.equal(armarQuiz(GRUPO[0], [GRUPO[0]]), null)
})

test('degrada a 2 opciones si solo hay un distractor', () => {
  const grupo = [persona('AAA01', { ciudad: 'Cali' }), persona('BBB02', { ciudad: 'Bogotá' })]
  const quiz = armarQuiz(grupo[0], grupo)
  assert.equal(quiz.opciones.length, 2)
  assert.ok(quiz.opciones.includes('Cali'))
})

test('ignora categorías que el target dejó vacías', () => {
  const target = persona('AAA01', { comida: '', ciudad: 'Cali' })
  const grupo = [target, persona('BBB02', { comida: 'Sushi', ciudad: 'Bogotá' }), persona('CCC03', { comida: 'Pizza', ciudad: 'Cúcuta' })]
  for (let i = 0; i < 20; i++) {
    assert.equal(armarQuiz(target, grupo).categoria, 'ciudad')
  }
})

test('los inactivos no sirven como distractores del quiz', () => {
  const grupo = [
    persona('AAA01', { ciudad: 'Cali' }),
    { ...persona('BBB02', { ciudad: 'Bogotá' }), activo: false },
    persona('CCC03', { ciudad: 'Medellín' }),
  ]
  for (let i = 0; i < 25; i++) {
    const quiz = armarQuiz(grupo[0], grupo)
    assert.ok(!quiz.opciones.includes('Bogotá'), 'no debería ofrecer la respuesta de alguien sacado del mercado')
  }
})

// --- Áreas del semillero ---------------------------------------------------

test('las áreas son las cuatro reales del semillero', () => {
  assert.deepEqual(AREAS.map((a) => a.key), ['macro', 'alternativas', 'analitica', 'capitales'])
  assert.equal(etiquetaArea('macro'), 'Macroeconomía, divisas y commodities')
  assert.equal(etiquetaArea('alternativas'), 'Inversiones alternativas')
  assert.equal(etiquetaArea('analitica'), 'Analítica de negocios')
  assert.equal(etiquetaArea('capitales'), 'Mercado de capitales')
})

test('cada área trae nombre oficial, nombre corto y sigla, y las siglas no se repiten', () => {
  const siglas = new Set()
  for (const a of AREAS) {
    assert.ok(a.label.length > 0 && a.corto.length > 0)
    assert.equal(a.sigla.length, 3, `la sigla de ${a.key} debe tener 3 letras`)
    assert.ok(a.corto.length <= a.label.length, `el corto de ${a.key} no puede ser más largo`)
    assert.ok(!siglas.has(a.sigla), `sigla repetida: ${a.sigla}`)
    siglas.add(a.sigla)
  }
})

test('un área desconocida no rompe la interfaz', () => {
  assert.equal(etiquetaArea('inventada'), 'inventada')
  assert.equal(nombreCortoArea('inventada'), 'inventada')
  assert.equal(siglaArea('inventada'), '???')
})

// --- Roster del celular ----------------------------------------------------
// El celular ya no escucha toda la colección: carga el listado una vez y luego
// pide solo lo que se creó después. Estas dos funciones son toda la lógica de
// esa mezcla, y por eso se prueban aquí sin Firestore de por medio.

const ts = (ms) => ({ toMillis: () => ms })

test('fusionarRoster: sin listado previo devuelve a los entrantes', () => {
  const nuevos = [{ ticker: 'ANA10' }, { ticker: 'BET60' }]
  assert.deepEqual(fusionarRoster([], nuevos).map((p) => p.ticker), ['ANA10', 'BET60'])
})

test('fusionarRoster: no duplica a quien ya estaba', () => {
  const actual = [{ ticker: 'ANA10', points: 0 }]
  const fusion = fusionarRoster(actual, [{ ticker: 'ANA10', points: 4 }])
  assert.equal(fusion.length, 1)
})

test('fusionarRoster: el entrante gana sobre la copia vieja', () => {
  const fusion = fusionarRoster([{ ticker: 'ANA10', name: 'Ana', activo: true }],
                                [{ ticker: 'ANA10', name: 'Ana', activo: false }])
  assert.equal(fusion[0].activo, false)
})

test('fusionarRoster: conserva a los que no vuelven a llegar', () => {
  const fusion = fusionarRoster([{ ticker: 'ANA10' }, { ticker: 'BET60' }], [{ ticker: 'CAR07' }])
  assert.deepEqual(fusion.map((p) => p.ticker).sort(), ['ANA10', 'BET60', 'CAR07'])
})

test('fusionarRoster: ordena por ticker para que la lista no salte', () => {
  const fusion = fusionarRoster([{ ticker: 'ZOE99' }, { ticker: 'ANA10' }], [{ ticker: 'MIG21' }])
  assert.deepEqual(fusion.map((p) => p.ticker), ['ANA10', 'MIG21', 'ZOE99'])
})

test('fusionarRoster: descarta entrantes sin ticker en vez de romper la lista', () => {
  const fusion = fusionarRoster([{ ticker: 'ANA10' }], [{ name: 'sin ticker' }, { ticker: 'BET60' }])
  assert.deepEqual(fusion.map((p) => p.ticker), ['ANA10', 'BET60'])
})

test('marcaMasReciente: listado vacío no tiene marca', () => {
  assert.equal(marcaMasReciente([]), null)
})

test('marcaMasReciente: devuelve el created_at más alto', () => {
  const viejo = ts(1000)
  const nuevo = ts(5000)
  assert.equal(marcaMasReciente([{ created_at: viejo }, { created_at: nuevo }]), nuevo)
})

test('marcaMasReciente: ignora a quien no tiene created_at', () => {
  const marca = ts(1000)
  assert.equal(marcaMasReciente([{ ticker: 'ANA10' }, { created_at: marca }]), marca)
})

test('marcaMasReciente: sin ningún created_at devuelve null', () => {
  assert.equal(marcaMasReciente([{ ticker: 'ANA10' }, { ticker: 'BET60' }]), null)
})

test('marcaMasReciente: entiende Date además de Timestamp de Firestore', () => {
  const fecha = new Date(9000)
  assert.equal(marcaMasReciente([{ created_at: ts(1000) }, { created_at: fecha }]), fecha)
})

// --- Empezar de cero -------------------------------------------------------
// El anfitrión puede retirar a todo el mundo y obligar a registrarse de nuevo.
// La señal es un contador de "generación" en la sesión: cada celular recuerda
// cuál vio, y si no coincide con la de ahora, olvida su ticker.

test('debeOlvidarRegistro: sin reinicios, nadie olvida nada', () => {
  assert.equal(debeOlvidarRegistro(0, 0), false)
})

test('debeOlvidarRegistro: el anfitrión reinició y el celular no se ha enterado', () => {
  assert.equal(debeOlvidarRegistro(1, 0), true)
})

test('debeOlvidarRegistro: ya se enteró de ese reinicio, no vuelve a olvidar', () => {
  assert.equal(debeOlvidarRegistro(3, 3), false)
})

test('debeOlvidarRegistro: la sesión todavía no cargó, no se toca nada', () => {
  assert.equal(debeOlvidarRegistro(undefined, 2), false)
  assert.equal(debeOlvidarRegistro(null, 2), false)
})

test('debeOlvidarRegistro: un celular que nunca vio una generación arranca en cero', () => {
  assert.equal(debeOlvidarRegistro(0, undefined), false)
  assert.equal(debeOlvidarRegistro(2, undefined), true)
})

test('debeOlvidarRegistro: cualquier diferencia obliga a olvidar, incluso hacia atrás', () => {
  // Si se restaura una base vieja, la generación puede bajar. Sigue siendo
  // "otra partida", así que el celular se vuelve a registrar igual.
  assert.equal(debeOlvidarRegistro(1, 5), true)
})

// --- Generación: ocultar los ensayos anteriores ----------------------------

test('deLaGeneracion: deja pasar solo a los de la generación vigente', () => {
  const gente = [{ ticker: 'ANA10', generacion: 2 }, { ticker: 'BET60', generacion: 1 }]
  assert.deepEqual(deLaGeneracion(gente, 2).map((p) => p.ticker), ['ANA10'])
})

test('deLaGeneracion: los documentos sin el campo son de la generación 0', () => {
  const gente = [{ ticker: 'ANA10' }, { ticker: 'BET60', generacion: 1 }]
  assert.deepEqual(deLaGeneracion(gente, 0).map((p) => p.ticker), ['ANA10'])
})

test('deLaGeneracion: una sesión sin generación equivale a la 0', () => {
  const gente = [{ ticker: 'ANA10' }, { ticker: 'BET60', generacion: 3 }]
  assert.deepEqual(deLaGeneracion(gente, undefined).map((p) => p.ticker), ['ANA10'])
})

test('deLaGeneracion: a quien el anfitrión sacó a mano NO lo oculta', () => {
  // Sigue siendo de esta generación, solo que inactivo: tiene que verse en el
  // panel para poder devolverlo al mercado.
  const gente = [{ ticker: 'ANA10', generacion: 2, activo: false }]
  assert.equal(deLaGeneracion(gente, 2).length, 1)
})

test('deLaGeneracion: listado vacío no revienta', () => {
  assert.deepEqual(deLaGeneracion([], 5), [])
})
