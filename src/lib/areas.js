// Las áreas del semillero, sin dependencias: así se pueden probar con `npm test`
// y usarlas desde scripts sin arrastrar Firebase ni React.

/**
 * Las cuatro áreas reales del semillero. Cada una lleva tres nombres porque
 * cada sitio pide uno distinto: el oficial para el registro y el perfil, uno
 * corto para los titulares del proyector —donde el nombre completo no cabe— y
 * la sigla para las tablas densas.
 */
export const AREAS = [
  {
    key: 'macro',
    label: 'Macroeconomía, divisas y commodities',
    corto: 'Macro y commodities',
    sigla: 'MAC',
  },
  { key: 'alternativas', label: 'Inversiones alternativas', corto: 'Alternativas', sigla: 'ALT' },
  { key: 'analitica', label: 'Analítica de negocios', corto: 'Analítica', sigla: 'ANL' },
  { key: 'capitales', label: 'Mercado de capitales', corto: 'Capitales', sigla: 'CAP' },
]

const buscarArea = (key) => AREAS.find((a) => a.key === key)

/** Nombre oficial completo. Para el registro y el perfil. */
export const etiquetaArea = (key) => buscarArea(key)?.label ?? key

/** Nombre corto. Para titulares y sitios donde el completo no cabe. */
export const nombreCortoArea = (key) => buscarArea(key)?.corto ?? key

/** Clase CSS del sector: cada área tiene su color, como en un tablero de bolsa. */
export const claseArea = (key) => `sector sector-${key}`

/** Sigla de 3 letras para las tablas densas. */
export const siglaArea = (key) => buscarArea(key)?.sigla ?? '???'
