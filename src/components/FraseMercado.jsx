import { useEffect, useMemo, useState } from 'react'

/**
 * La línea que le da carácter al proyector: curiosidades reales de economía y
 * mercados, etiquetadas por el área a la que pertenecen, mezcladas con frases
 * sobre lo que de verdad está pasando en el salón.
 *
 * Antes llevaban una comilla de adorno que nunca se cerraba y parecían frases
 * cortadas. Como ahora son datos y no citas, van sin comillas y con la etiqueta
 * del sector delante.
 *
 * Es texto fijo: rota con un temporizador y no cuesta ni una lectura.
 */
const MACRO = 'Macro y commodities'
const ALT = 'Alternativas'
const ANL = 'Analítica'
const CAP = 'Capitales'
const SALA = 'En esta sala'

const FRASES = [
  // --- Macroeconomía, divisas y commodities --------------------------------
  { a: MACRO, t: 'El dólar estadounidense participa en cerca del 90 % de todas las operaciones del mercado cambiario mundial.' },
  { a: MACRO, t: 'El mercado de divisas mueve más de 7 billones de dólares al día: más que el PIB anual de casi cualquier país.' },
  { a: MACRO, t: 'Todo el oro extraído en la historia de la humanidad cabría en un cubo de unos 22 metros de lado.' },
  { a: MACRO, t: 'Los bancos centrales del mundo guardan en conjunto más de 35.000 toneladas de oro en reservas.' },
  { a: MACRO, t: 'Colombia es el segundo exportador mundial de flores cortadas, después de los Países Bajos.' },
  { a: MACRO, t: 'El café se cotiza en Nueva York en centavos de dólar por libra. Su precio se fija lejos de donde se siembra.' },
  { a: MACRO, t: 'En abril de 2020 el petróleo WTI cerró en precio negativo por primera vez: −37,63 dólares por barril.' },
  { a: MACRO, t: 'El índice Big Mac, creado por The Economist en 1986, compara monedas usando el precio de una hamburguesa.' },
  { a: MACRO, t: 'La hiperinflación de Zimbabue llevó a emitir en 2009 un billete de cien billones de dólares zimbabuenses.' },
  { a: MACRO, t: 'Los primeros billetes de papel circularon en China durante la dinastía Song, hace más de mil años.' },
  { a: MACRO, t: 'El Banco de la República se fundó en 1923, tras una misión encabezada por el economista Edwin Kemmerer.' },
  { a: MACRO, t: 'La palabra salario viene del latín salarium, ligada a la sal: uno de los bienes más valiosos de Roma.' },
  { a: MACRO, t: 'El cobre se apoda “doctor cobre” porque su precio anticipa la salud de la economía mundial.' },
  { a: MACRO, t: 'Regla del 72: si algo crece 7 % al año, tarda unos diez años en duplicarse.' },

  // --- Inversiones alternativas ---------------------------------------------
  { a: ALT, t: 'El primer fondo de cobertura moderno lo creó Alfred Winslow Jones en 1949.' },
  { a: ALT, t: 'El Salvator Mundi, atribuido a Leonardo, se vendió en 2017 por 450,3 millones de dólares: la obra más cara jamás subastada.' },
  { a: ALT, t: 'En 1997 David Bowie emitió bonos respaldados por las regalías de sus canciones. Se les llamó Bowie Bonds.' },
  { a: ALT, t: 'Los bonos catástrofe pagan intereses altos a cambio de que el inversionista asuma las pérdidas de un huracán o un terremoto.' },
  { a: ALT, t: 'El capital de riesgo financió a Apple, Amazon y Google años antes de que ganaran un solo peso.' },
  { a: ALT, t: 'Se llama unicornio a la empresa emergente que vale más de mil millones de dólares. El término se acuñó en 2013.' },
  { a: ALT, t: 'Arte, vino, bosques y capital privado comparten un rasgo: son difíciles de vender rápido. La iliquidez es su precio de entrada.' },
  { a: ALT, t: 'La tulipomanía holandesa del siglo XVII se recuerda como la primera burbuja financiera documentada.' },
  { a: ALT, t: 'Diversificar es lo más parecido a un almuerzo gratis que existe en finanzas, decía Harry Markowitz, premio Nobel.' },
  { a: ALT, t: 'Nassim Taleb llamó cisne negro a los sucesos rarísimos que lo cambian todo y que solo parecen obvios después.' },

  // --- Analítica de negocios ------------------------------------------------
  { a: ANL, t: 'La ley de Benford dice que en muchos datos reales el dígito 1 encabeza casi el 30 % de las cifras. Sirve para detectar fraudes contables.' },
  { a: ANL, t: 'Florence Nightingale inventó un tipo de gráfico circular para probar que en Crimea mataban más las infecciones que los combates.' },
  { a: ANL, t: 'El primer gráfico de barras conocido lo publicó William Playfair en 1786, en un libro de economía.' },
  { a: ANL, t: 'La regresión lineal, base de la ciencia de datos moderna, tiene más de dos siglos: Legendre la publicó en 1805.' },
  { a: ANL, t: 'Correlación no es causalidad: el consumo de queso y ciertos accidentes domésticos siguen curvas casi idénticas.' },
  { a: ANL, t: 'Sobreajuste: un modelo que explica el pasado a la perfección suele fallar con el futuro.' },
  { a: ANL, t: 'Las búsquedas en internet anticipan cifras de desempleo, porque la gente busca ayuda antes de aparecer en las estadísticas.' },
  { a: ANL, t: 'Un promedio puede esconderlo todo: con un pie en el horno y otro en el hielo, en promedio se está tibio.' },
  { a: ANL, t: 'El cuarteto de Anscombe: cuatro conjuntos de datos con la misma media y la misma correlación, y gráficas completamente distintas.' },
  { a: ANL, t: 'Muestrear bien importa más que muestrear mucho: en 1936 una encuesta de dos millones de personas falló por preguntarle a quien no debía.' },

  // --- Mercado de capitales -------------------------------------------------
  { a: CAP, t: 'La palabra bolsa viene de los Van der Buerse, familia de Brujas en cuya casa se reunían los comerciantes en el siglo XIV.' },
  { a: CAP, t: 'La Bolsa de Ámsterdam, fundada en 1602 para negociar acciones de la Compañía de las Indias Orientales, es la más antigua del mundo.' },
  { a: CAP, t: 'Wall Street se llama así por un muro que los colonos holandeses levantaron en Manhattan en el siglo XVII.' },
  { a: CAP, t: 'Toro y oso vienen de cómo ataca cada animal: el toro levanta los cuernos, el oso baja la zarpa.' },
  { a: CAP, t: 'La Bolsa de Nueva York marca su apertura con una campana desde el siglo XIX. Sigue haciéndolo cada mañana.' },
  { a: CAP, t: 'El crac de 1929 borró en dos días cerca de una cuarta parte del valor de la bolsa estadounidense.' },
  { a: CAP, t: 'El lunes negro de 1987 fue la mayor caída porcentual en un solo día del Dow Jones: 22,6 %.' },
  { a: CAP, t: 'El Dow Jones original, de 1896, tenía apenas doce empresas. Un índice no es una compañía: es un promedio.' },
  { a: CAP, t: 'General Electric fue la única de esas doce que permaneció más de un siglo en el índice. Salió en 2018.' },
  { a: CAP, t: 'Las acciones clase A de Berkshire Hathaway nunca se han dividido: son de las más caras del mundo.' },
  { a: CAP, t: 'Warren Buffett compró su primera acción a los once años y dice que empezó demasiado tarde.' },
  { a: CAP, t: 'El primer ETF, el SPDR sobre el S&P 500, empezó a operar en 1993 y hoy es de los instrumentos más negociados del planeta.' },
  { a: CAP, t: 'La Bolsa de Valores de Colombia nació en 2001, de la fusión de las bolsas de Bogotá, Medellín y Occidente.' },
  { a: CAP, t: 'Crédito viene del latín credere: creer. Prestar es, literalmente, un acto de fe.' },
  { a: CAP, t: 'Adam Smith publicó La riqueza de las naciones en 1776, el mismo año de la independencia de Estados Unidos.' },
  { a: CAP, t: 'La mano invisible aparece una sola vez en toda La riqueza de las naciones.' },
  { a: CAP, t: 'El Nobel de Economía no lo creó Alfred Nobel: lo instituyó el banco central de Suecia en 1968.' },
  { a: CAP, t: 'Solo tres mujeres han ganado el Nobel de Economía: Elinor Ostrom, Esther Duflo y Claudia Goldin.' },
  { a: CAP, t: 'John Maynard Keynes ganó y perdió fortunas invirtiendo, y gestionó con notable éxito el fondo de su colegio en Cambridge.' },

  // --- Lo que está pasando aquí --------------------------------------------
  { a: SALA, t: 'El mejor activo de esta sala es la gente que todavía no conoces.' },
  { a: SALA, t: 'Diversificar aquí significa hablar con alguien de otra área.' },
  { a: SALA, t: 'Comprar barato es buscar a quien nadie ha buscado todavía.' },
  { a: SALA, t: 'La liquidez de este mercado se llama conversación.' },
  { a: SALA, t: 'El análisis fundamental de hoy es preguntar bien y escuchar mejor.' },
  { a: SALA, t: 'El riesgo de verdad es quedarte con tu grupo de siempre.' },
  { a: SALA, t: 'Toda acción se revaloriza cuando alguien se toma el tiempo de escucharla.' },
  { a: SALA, t: 'Ningún portafolio creció mirando el celular desde una esquina.' },
  { a: SALA, t: 'Rendimientos pasados no garantizan nada. Una buena conversación, casi.' },
  { a: SALA, t: 'La información privilegiada de este mercado se consigue presentándose.' },
]

const ESPERA = [
  { a: SALA, t: 'Escanea el código. Tu ticker te está esperando.' },
  { a: SALA, t: 'En unos minutos, cada persona de esta sala cotiza en bolsa.' },
  { a: SALA, t: 'Regístrate: hoy tú eres una acción.' },
]

/** Baraja una copia, para que el orden no sea el mismo en cada proyección. */
function barajar(lista) {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

export default function FraseMercado({ estado }) {
  const enEspera = estado === 'esperando'
  const lista = useMemo(() => barajar(enEspera ? ESPERA : FRASES), [enEspera])
  const [i, setI] = useState(0)

  useEffect(() => {
    setI(0)
    const id = setInterval(() => setI((v) => (v + 1) % lista.length), 11000)
    return () => clearInterval(id)
  }, [lista])

  const frase = lista[i] ?? lista[0]
  if (!frase) return null

  return (
    <p className="frase-mercado" key={`${estado}-${i}`}>
      <span className="frase-etiqueta">{frase.a}</span>
      <span className="frase-texto">{frase.t}</span>
    </p>
  )
}
