/**
 * Verifica el camino NUEVO contra Firestore real: que un registro tardío
 * aparezca por la consulta delta, que la ronda limpia deje pasar inversiones y
 * que la corrección por sobrecompra se dispare y toque solo documentos propios.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db, ensureAnonAuth } from './src/lib/firebase.js'
import { fusionarRoster, marcaMasReciente } from './src/lib/participantes.js'
import {
  cambiarEstado, invertir, registrarParticipante, reiniciarPartida, sincronizarActivos,
} from './src/lib/acciones.js'

let ok = 0, mal = 0
const comprobar = (cond, texto) => {
  if (cond) { ok++; console.log(`  ✅ ${texto}`) } else { mal++; console.log(`  ❌ ${texto}`) }
}
const traer = async () => {
  const s = await getDocs(collection(db, 'participants'))
  return s.docs.map((d) => ({ ticker: d.id, ...d.data() }))
}

async function main() {
  await ensureAnonAuth()

  console.log('\n1. Carga inicial y marca de tiempo')
  const roster = await traer()
  comprobar(roster.length > 0, `el listado carga (${roster.length} participantes)`)
  const marca = marcaMasReciente(roster)
  comprobar(marca !== null, 'hay una marca de created_at para acotar el delta')
  comprobar(roster.every((p) => p.ticker), 'todos traen ticker')

  console.log('\n2. Registro tardío: ¿lo ve la consulta delta?')
  const antes = roster.length
  const nuevoTicker = await registrarParticipante(
    { nombre: 'Zoe Tardia', area: 'macro', seniority: 'nuevo',
      respuestas: { comida: 'Ramen', superpoder: 'Volar', anecdota: 'Llegué tarde', ciudad: 'Bogotá' } },
    new Set(roster.map((p) => p.ticker)),
  )
  console.log(`  (registrado $${nuevoTicker})`)
  const delta = await getDocs(query(collection(db, 'participants'), where('created_at', '>=', marca)))
  const entrantes = delta.docs.map((d) => ({ ticker: d.id, ...d.data() }))
  comprobar(entrantes.some((p) => p.ticker === nuevoTicker), 'el delta trae al que llegó tarde')
  comprobar(delta.size < antes, `el delta es barato: ${delta.size} documentos en vez de ${antes}`)
  const fusion = fusionarRoster(roster, entrantes)
  comprobar(fusion.some((p) => p.ticker === nuevoTicker), 'la fusión lo incorpora al listado')
  comprobar(fusion.length === antes + 1, `sin duplicados: ${antes} + 1 = ${fusion.length}`)
  comprobar(
    fusion.filter((p) => p.ticker === nuevoTicker).length === 1,
    'el recién llegado aparece exactamente una vez',
  )

  console.log('\n3. activos_count como señal de cambio')
  const ses = await getDoc(doc(db, 'session', 'main'))
  comprobar(ses.data().activos_count === antes + 1, `activos_count subió a ${ses.data().activos_count}`)

  console.log('\n4. Ronda limpia: inversiones y corrección por sobrecompra')
  const ronda = await reiniciarPartida()
  console.log(`  (ronda nueva: ${ronda})`)
  await sincronizarActivos()
  await cambiarEstado('activo')
  const t = fusion.map((p) => p.ticker)
  let hechas = 0, correccion = null
  for (let i = 1; i <= 6; i++) {
    const r = await invertir({ investorTicker: t[i], targetTicker: t[0], questionType: 'comida' })
    hechas++
    if (r.correccion) correccion = r.correccion
  }
  comprobar(hechas === 6, `las 6 inversiones entraron en la ronda limpia`)
  comprobar(correccion !== null, 'la corrección por sobrecompra se disparó')
  comprobar(correccion?.afectados === 6, `tocó a los 6 inversores (afectados: ${correccion?.afectados})`)

  console.log('\n5. El documento propio refleja los puntos (que es lo que ve el celular)')
  const propio = await getDoc(doc(db, 'participants', t[1]))
  comprobar(typeof propio.data().points === 'number', `points vive en el documento propio (${propio.data().points})`)
  comprobar(propio.data().inversiones_hechas >= 1, 'inversiones_hechas se actualizó')

  await cambiarEstado('esperando')
  console.log(`\n${'='.repeat(50)}\n  ${ok} correctas, ${mal} fallidas\n${'='.repeat(50)}`)
  process.exit(mal ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
