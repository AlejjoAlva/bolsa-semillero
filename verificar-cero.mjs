/** Verifica "empezar de cero" contra Firestore real. */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db, ensureAnonAuth } from './src/lib/firebase.js'
import { debeOlvidarRegistro, esActivo } from './src/lib/participantes.js'
import { empezarDeCero, registrarParticipante } from './src/lib/acciones.js'

let ok = 0, mal = 0
const comprobar = (c, txt) => { if (c) { ok++; console.log(`  ✅ ${txt}`) } else { mal++; console.log(`  ❌ ${txt}`) } }
const sesion = () => getDoc(doc(db, 'session', 'main')).then((s) => (s.exists() ? s.data() : {}))
const todos = () => getDocs(collection(db, 'participants')).then((s) => s.docs.map((d) => ({ ticker: d.id, ...d.data() })))

async function main() {
  await ensureAnonAuth()
  const antesSes = await sesion()
  const antes = await todos()
  console.log(`\nAntes: ${antes.length} registrados, ${antes.filter(esActivo).length} activos, generación ${antesSes.generacion ?? 0}`)

  console.log('\n1. Ejecutando empezarDeCero()')
  const r = await empezarDeCero()
  console.log(`  (retirados: ${r.retirados}, ronda ${r.ronda}, generación ${r.generacion})`)

  const despues = await todos()
  const ses = await sesion()
  comprobar(despues.every((p) => !esActivo(p)), 'nadie queda activo en el mercado')
  comprobar(despues.every((p) => (p.points ?? 0) === 0), 'todos quedan en cero puntos')
  comprobar(despues.every((p) => (p.received_count ?? 0) === 0), 'inversiones recibidas en cero')
  comprobar(despues.every((p) => (p.inversiones_hechas ?? 0) === 0), 'inversiones hechas en cero')
  comprobar(despues.every((p) => !p.postura_rumor), 'posturas de rumor limpiadas')
  comprobar(ses.activos_count === 0, `activos_count queda en 0 (${ses.activos_count})`)
  comprobar(ses.game_status === 'esperando', `la sesión queda en esperando (${ses.game_status})`)
  comprobar(ses.rumor === null, 'no queda ningún rumor colgado')
  comprobar(ses.generacion === (antesSes.generacion ?? 0) + 1, `la generación subió a ${ses.generacion}`)

  console.log('\n2. El celular debe olvidar su registro')
  comprobar(debeOlvidarRegistro(ses.generacion, antesSes.generacion ?? 0), 'un celular de la partida anterior olvida su ticker')
  comprobar(!debeOlvidarRegistro(ses.generacion, ses.generacion), 'uno que ya se enteró no vuelve a olvidarlo')

  console.log('\n3. Registrarse otra vez funciona y da ticker nuevo')
  const nuevo = await registrarParticipante(
    { nombre: 'Prueba Limpia', area: 'capitales', seniority: 'nuevo',
      respuestas: { comida: 'Pizza', superpoder: 'Volar', anecdota: 'Nada', ciudad: 'Cali' } },
    new Set(despues.map((p) => p.ticker)),
  )
  const final = await todos()
  const sesFinal = await sesion()
  comprobar(Boolean(nuevo), `se pudo registrar de nuevo ($${nuevo})`)
  comprobar(!despues.some((p) => p.ticker === nuevo), 'el ticker nuevo no choca con ninguno viejo')
  comprobar(final.filter(esActivo).length === 1, `solo hay 1 activo tras el registro (${final.filter(esActivo).length})`)
  comprobar(sesFinal.activos_count === 1, `activos_count volvió a 1 (${sesFinal.activos_count})`)

  console.log(`\n${'='.repeat(50)}\n  ${ok} correctas, ${mal} fallidas\n${'='.repeat(50)}`)
  process.exit(mal ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
