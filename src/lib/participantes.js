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
