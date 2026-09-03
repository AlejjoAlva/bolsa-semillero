// Pruebas de la lógica pura del juego (sin Firebase, sin navegador):
//   npm test
import test from 'node:test'
import assert from 'node:assert/strict'

import { calcularPuntos } from '../src/lib/puntaje.js'
import { generarTicker, prefijoDe, idInversion } from '../src/lib/ticker.js'
import { armarQuiz, esCorrecta } from '../src/lib/quiz.js'

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

test('bull run duplica el total, bonos incluidos', () => {
  const r = calcularPuntos({
    rachaPrevia: 2,
    seniorityInvestor: 'nuevo',
    seniorityTarget: 'antiguo',
    bullRun: true,
  })
  assert.equal(r.puntos, 8) // (2 + 1 cruce + 1 racha) x2
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
  assert.equal(idInversion('ANA47', 'CAR12'), 'ANA47_CAR12')
  assert.notEqual(idInversion('ANA47', 'CAR12'), idInversion('CAR12', 'ANA47'))
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
