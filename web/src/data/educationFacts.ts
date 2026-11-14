export interface IlargiFact {
  id: string;
  question: string;
  text: string;
}

/**
 * Datos curiosos ("¿Y sabías qué...?") narrados por ILARGI.
 * Estructura preparada para añadir fácilmente nuevos datos posteriormente.
 */
export const ILARGI_FUN_FACTS: IlargiFact[] = [
  {
    id: "fact-01",
    question: "…the Moon is running away?",
    text: "It drifts about 1.5 inches (3.8 cm) farther from Earth every year, about as fast as your fingernails grow. Billions of years ago it was much closer and looked huge in the sky.",
  },
  {
    id: "fact-02",
    question: "…the Moon doesn’t always show us exactly the same face?",
    text: "The Moon wobbles a little, like it’s gently shaking its head, so over time we get to peek at nearly 60% of it.",
  },
  {
    id: "fact-03",
    question: "…the “dark side” isn’t dark?",
    text: "The far side of the Moon gets just as much sunlight as the side we see. People call it “dark” only because we can’t see it from Earth.",
  },
  {
    id: "fact-04",
    question: "…footprints can last forever?",
    text: "Astronaut footprints on the Moon could stay there for millions of years, because there’s no wind or rain to erase them.",
  },
  {
    id: "fact-05",
    question: "…walking on the Moon is a very exclusive club?",
    text: "Only 12 people have ever done it. They were all American astronauts on the Apollo missions, between 1969 and 1972.",
  },
  {
    id: "fact-06",
    question: "…on the Moon you’d be super light?",
    text: "If you weigh 90 pounds (41 kg) on Earth, you’d weigh just 15 pounds (7 kg) on the Moon. You could jump about six times higher, too!",
  },
  {
    id: "fact-07",
    question: "…on the Moon you can go from an oven to a freezer?",
    text: "🥶 Daytime on the Moon can hit 250°F (120°C), and nights can drop below −280°F (−173°C). There’s no air to hold in the heat.",
  },
  {
    id: "fact-08",
    question: "…Moon days are really, really, reaaaaally long?",
    text: "One day on the Moon lasts about a month: two weeks of sunlight, then two weeks of darkness. That’s about 29 Earth days from one sunrise to the next!",
  },
  {
    id: "fact-09",
    question: "…the Moon was born from a giant crash?",
    text: "It probably formed when a planet the size of Mars smashed into Earth about 4.5 billion years ago. The leftover pieces clumped together to make the Moon.",
  },
  {
    id: "fact-10",
    question: "…the Moon moves Earth’s oceans?",
    text: "Its gravity pulls on Earth’s water and causes the tides. The Sun helps a little, but the Moon does most of the pulling.",
  },
  {
    id: "fact-11",
    question: "…the Moon’s sky is dark even during the day?",
    text: "The sky there is always black. With no air to scatter sunlight, it can’t turn blue.",
  },
  {
    id: "fact-12",
    question: "…Moon dust smells like fireworks?",
    text: "Astronauts said it smelled like burnt gunpowder. It’s also super fine and sharp, almost like crushed glass.",
  },
  {
    id: "fact-13",
    question: "…the Moon’s ground shaaAaAakes?",
    text: "The Moon has its own earthquakes, called moonquakes! They happen because Earth’s gravity squeezes and stretches the Moon, and because the Moon is slowly shrinking as its insides cool down. Some of them can last more than an hour.",
  },
  {
    id: "fact-14",
    question: "…there’s hidden ice on the Moon?",
    text: "Some dark craters near the Moon’s poles never see sunlight, and they hold ice. One day, astronauts might use it for drinking water or even rocket fuel.",
  },
  {
    id: "fact-15",
    question: "…you can find golf balls on the Moon?",
    text: "Astronauts left golf balls on the Moon, plus nearly 100 bags of poop! Alan Shepard hit two golf balls there during Apollo 14 in 1971.",
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
