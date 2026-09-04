// Quién sigue en el mercado. Sin dependencias de Firebase para poder probarlo con `npm test`.
//
// Sacar a alguien del mercado no borra su documento (las reglas no permiten borrar):
// le pone `activo: false`. Los documentos viejos no tienen el campo, así que la
// ausencia cuenta como activo y no hace falta migrar nada.

export function esActivo(participante) {
  return participante?.activo !== false
}

export function activos(participantes) {
  return participantes.filter(esActivo)
}

// --- Roster del celular ------------------------------------------------------
// El celular no escucha la colección entera: la carga una vez y después solo
// pide lo que se creó más tarde (ver useRoster en data.js). Firestore cobra por
// documento entregado, así que escuchar en vivo a 35 personas para mostrar
// nombres que nunca cambian era el grueso del consumo. Los datos que sí cambian
// —los puntos propios— llegan por el listener del documento propio, y los
// ajenos se ven en el proyector, que sí está en vivo.

/**
 * Mezcla el listado que ya se tenía con los documentos recién traídos.
 * Los entrantes pisan a la copia vieja del mismo ticker. Ordena por ticker
 * para que la lista de la pantalla no salte de posición al llegar alguien.
 */
export function fusionarRoster(actual, entrantes) {
  const porTicker = new Map()
  for (const p of [...actual, ...entrantes]) {
    if (p?.ticker) porTicker.set(p.ticker, p)
  }
  return [...porTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/** Milisegundos de un created_at, venga como Timestamp de Firestore, Date o número. */
function enMilis(valor) {
  if (typeof valor?.toMillis === 'function') return valor.toMillis()
  if (valor instanceof Date) return valor.getTime()
  return typeof valor === 'number' ? valor : null
}

/**
 * El `created_at` más alto del listado, tal cual (sin convertir), para poder
 * usarlo como cota en la siguiente consulta. `null` si nadie lo tiene: en ese
 * caso quien llame debe recargar el listado completo en vez de pedir un delta.
 */
export function marcaMasReciente(participantes) {
  let mejor = null
  let mejorMs = -Infinity
  for (const p of participantes) {
    const ms = enMilis(p?.created_at)
    if (ms !== null && ms > mejorMs) {
      mejorMs = ms
      mejor = p.created_at
    }
  }
  return mejor
}

/**
 * ¿Debe el celular olvidar su ticker y volver a la pantalla de registro?
 *
 * Cuando el anfitrión usa "empezar de cero", la sesión sube un contador de
 * generación. Cada celular guarda la generación que vio; si la de la sesión es
 * otra, es que se empezó una partida nueva y su registro anterior ya no vale.
 *
 * Mientras la sesión no haya cargado (`undefined`/`null`) no se olvida nada:
 * borrar el registro por un dato que aún no llegó dejaría a la persona
 * registrándose dos veces.
 */
export function debeOlvidarRegistro(generacionSesion, generacionVista) {
  if (typeof generacionSesion !== 'number') return false
  return generacionSesion !== (generacionVista ?? 0)
}

/**
 * Los registros de la partida vigente. "Empezar de cero" no borra —las reglas
 * no lo permiten desde el cliente— sino que sube el contador de generación de
 * la sesión, así que los inscritos en ensayos anteriores se quedan atrás con
 * una generación menor y dejan de aparecer.
 *
 * Los documentos antiguos, de antes de que existiera el campo, cuentan como
 * generación 0, que es también lo que vale una sesión recién creada.
 */
export function deLaGeneracion(participantes, generacionSesion) {
  const actual = generacionSesion ?? 0
  return participantes.filter((p) => (p?.generacion ?? 0) === actual)
}
