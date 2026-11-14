/** Educational background; sources and schematic overlay limits are documented in docs/sources.md. */
export interface IlargiFact {
  id: string;
  question: string;
  text: string;
}

export const ILARGI_FUN_FACTS: IlargiFact[] = [
  {
    id: "fact-01",
    question: "The Moon is moving away",
    text: "It drifts about 1.5 inches (3.8 cm) farther from Earth every year, about as fast as your fingernails grow. Billions of years ago it was much closer and looked huge in the sky.",
  },
  {
    id: "fact-02",
    question: "A changing view of the Moon",
    text: "The Moon wobbles a little, like it’s gently shaking its head, so over time we get to peek at nearly 60% of it.",
  },
  {
    id: "fact-03",
    question: "The far side gets sunlight too",
    text: "The far side of the Moon gets just as much sunlight as the side we see. People call it “dark” only because we can’t see it from Earth.",
  },
  {
    id: "fact-04",
    question: "Footprints that last",
    text: "Astronaut footprints on the Moon could stay there for millions of years, because there’s no wind or rain to erase them.",
  },
  {
    id: "fact-05",
    question: "Walking on the Moon",
    text: "Twelve Apollo astronauts walked on the Moon between 1969 and 1972.",
  },
  {
    id: "fact-06",
    question: "A lighter step",
    text: "Lunar gravity is about one-sixth of Earth's. Your mass stays the same, but your weight would be much smaller and jumping would feel different.",
  },
  {
    id: "fact-07",
    question: "From an oven to a freezer",
    text: "🥶 Daytime on the Moon can hit 250°F (120°C), and nights can drop below −280°F (−173°C). There’s no air to hold in the heat.",
  },
  {
    id: "fact-08",
    question: "A very long lunar day",
    text: "A lunar solar day lasts about 29.5 Earth days. Near the equator, that means roughly two weeks of sunlight followed by two weeks of darkness.",
  },
  {
    id: "fact-09",
    question: "A giant collision",
    text: "It probably formed when a planet the size of Mars smashed into Earth about 4.5 billion years ago. The leftover pieces clumped together to make the Moon.",
  },
  {
    id: "fact-10",
    question: "The Moon and the tides",
    text: "Its gravity pulls on Earth’s water and causes the tides. The Sun helps a little, but the Moon does most of the pulling.",
  },
  {
    id: "fact-11",
    question: "A dark daytime sky",
    text: "The sky there is always black. With no air to scatter sunlight, it can’t turn blue.",
  },
  {
    id: "fact-12",
    question: "The smell of Moon dust",
    text: "Astronauts said it smelled like burnt gunpowder. It’s also super fine and sharp, almost like crushed glass.",
  },
  {
    id: "fact-13",
    question: "Moonquakes",
    text: "The Moon has its own earthquakes, called moonquakes! They happen because Earth’s gravity squeezes and stretches the Moon, and because the Moon is slowly shrinking as its insides cool down. Some of them can last more than an hour.",
  },
  {
    id: "fact-14",
    question: "Ice near the poles",
    text: "Some dark craters near the Moon’s poles never see sunlight, and they hold ice. One day, astronauts might use it for drinking water or even rocket fuel.",
  },
  {
    id: "fact-15",
    question: "Golf on the Moon",
    text: "Astronauts left golf balls on the Moon, plus nearly 100 bags of poop! Alan Shepard hit two golf balls there during Apollo 14 in 1971.",
  },
];

export const LUNAR_MIRROR_GUIDE = {
  title: "Lunar laser retroreflectors (LRRR)",
  summary:
    "Corner-cube prisms return incident light toward its source. Earth observatories measure the round-trip travel time of laser pulses to study the Earth–Moon system.",
  steps: [
    "1. An Earth observatory sends a laser pulse toward a lunar reflector.",
    "2. A small fraction of the light returns toward the observatory.",
    "3. The round trip takes roughly 2.5 seconds; precise timing supports distance measurements.",
  ],
  discoveries: [
    "The Moon recedes from Earth at about 3.8 cm (1.5 in) per year.",
    "Lunar rotation measurements help constrain the Moon's interior.",
    "Ranging tests gravitational physics using passive reflectors on the Moon.",
  ],
};

/** Schematic circular annotations, not official PSR raster boundaries. */
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
    note: "Southern polar cold trap (PGDA 69)",
  },
  {
    id: "psr-cabeus",
    name: "Cabeus · LCROSS",
    latDeg: -84.678,
    lonEastDeg: -48.693,
    radiusDeg: 1.55,
    areaKm2: 415,
    note: "Water detected in the LCROSS impact plume (2009)",
  },
  {
    id: "psr-shoemaker",
    name: "Shoemaker (PSR)",
    latDeg: -88.057,
    lonEastDeg: 44.313,
    radiusDeg: 1.35,
    areaKm2: 1221,
    note: "1.221 km² in permanent shadow",
  },
  {
    id: "psr-faustini",
    name: "Faustini (PSR)",
    latDeg: -87.133,
    lonEastDeg: 84.499,
    radiusDeg: 1.05,
    areaKm2: 711,
    note: "711 km² in permanent shadow",
  },
  {
    id: "psr-haworth",
    name: "Haworth (PSR)",
    latDeg: -87.529,
    lonEastDeg: -4.854,
    radiusDeg: 1.5,
    areaKm2: 1581,
    note: "1.581 km² in permanent shadow",
  },
  {
    id: "psr-hermite",
    name: "Hermite (Northern PSR)",
    latDeg: 86.17,
    lonEastDeg: -93.32,
    radiusDeg: 1.6,
    areaKm2: 290,
    note: "Northern polar cold trap (~26 K)",
  },
];
