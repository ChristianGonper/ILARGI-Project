export interface IlargiFact {
  id: string;
  tag: string;
  text: string;
}

/**
 * Datos curiosos ("¿Y sabías qué...?") narrados por ILARGI.
 * Estructura preparada para añadir fácilmente nuevos datos posteriormente.
 */
export const ILARGI_FUN_FACTS: IlargiFact[] = [
  {
    id: "fact-lunar-day",
    tag: "Ciclo lunar",
    text: "Un día solar completo en la Luna dura unos 29,53 días terrestres (≈709 horas): ¡dos semanas seguidas de luz y dos semanas de noche en el ecuador!",
  },
  {
    id: "fact-tilt",
    tag: "Luz y oscuridad",
    text: "A diferencia de la Tierra (23,4°), el eje de la Luna solo está inclinado 1,54°. Por eso, en los polos el Sol roza el horizonte y hay cráteres que jamás reciben luz.",
  },
  {
    id: "fact-mirror-drift",
    tag: "Espejo de la Luna",
    text: "Gracias a los espejos retrorreflectores de Apolo y Lunojod sabemos que la Luna se aleja de la Tierra 3,8 centímetros cada año por las mareas.",
  },
  {
    id: "fact-coldest-place",
    tag: "Trampas frías",
    text: "En el cráter polar norte Hermite, la sonda LRO midió 26 Kelvin (−247 °C): ¡es el punto más frío medido por una nave en el Sistema Solar, más que Plutón!",
  },
  {
    id: "fact-earth-sky",
    tag: "Vista desde la Luna",
    text: "Desde la cara visible la Tierra no sale ni se pone como el Sol: permanece casi quieta en el cielo, girando sobre sí misma y cambiando de fase.",
  },
];

export const LUNAR_MIRROR_GUIDE = {
  title: "El Espejo de la Luna (Retrorreflectores Láser · LRRR)",
  summary:
    "No son espejos planos normales: están formados por prismas de cuarzo en esquina de cubo que devuelven cualquier rayo láser exactamente hacia el telescopio de la Tierra que lo disparó.",
  steps: [
    "1. Emisión: un observatorio terrestre dispara pulsos láser hacia la Luna (unos 384.400 km).",
    "2. Reflexión: de 250 millones de fotones enviados, apenas regresa 1 tras rebotar en los prismas.",
    "3. Medición: el viaje dura ~2,5 segundos y mide la distancia Tierra–Luna con precisión de milímetros.",
  ],
  discoveries: [
    "La Luna se aleja de la Tierra ~3,8 cm/año debido a la fricción de las mareas.",
    "Las libraciones revelan que la Luna posee un núcleo líquido interno.",
    "Permiten comprobar la Relatividad General de Einstein sin gastar batería ni piezas móviles.",
  ],
};

/**
 * Principales trampas frías polares (PSR) catalogadas en NASA PGDA Product 69 (LOLA 18,6 años)
 * para la capa educativa de Agua / Hielo en el globo 3D.
 */
export interface PolarColdTrapZone {
  id: string;
  name: string;
  latDeg: number;
  lonEastDeg: number;
  radiusDeg: number;
  areaKm2: number;
  note: string;
}

export const POLAR_WATER_COLD_TRAPS: PolarColdTrapZone[] = [
  {
    id: "psr-shackleton",
    name: "Shackleton (PSR)",
    latDeg: -89.695,
    lonEastDeg: 126.371,
    radiusDeg: 0.75,
    areaKm2: 319,
    note: "Trampa fría polar sur (PGDA 69)",
  },
  {
    id: "psr-cabeus",
    name: "Cabeus · LCROSS",
    latDeg: -84.678,
    lonEastDeg: -48.693,
    radiusDeg: 1.55,
    areaKm2: 415,
    note: "Agua helada confirmada por LCROSS (2009)",
  },
  {
    id: "psr-shoemaker",
    name: "Shoemaker (PSR)",
    latDeg: -88.057,
    lonEastDeg: 44.313,
    radiusDeg: 1.35,
    areaKm2: 1221,
    note: "1.221 km² en sombra permanente",
  },
  {
    id: "psr-faustini",
    name: "Faustini (PSR)",
    latDeg: -87.133,
    lonEastDeg: 84.499,
    radiusDeg: 1.05,
    areaKm2: 711,
    note: "711 km² en sombra permanente",
  },
  {
    id: "psr-haworth",
    name: "Haworth (PSR)",
    latDeg: -87.529,
    lonEastDeg: -4.854,
    radiusDeg: 1.5,
    areaKm2: 1581,
    note: "1.581 km² en sombra permanente",
  },
  {
    id: "psr-hermite",
    name: "Hermite (PSR Norte)",
    latDeg: 86.17,
    lonEastDeg: -93.32,
    radiusDeg: 1.6,
    areaKm2: 290,
    note: "Trampa fría polar norte (~26 K)",
  },
];
