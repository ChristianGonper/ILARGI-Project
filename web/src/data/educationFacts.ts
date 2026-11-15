/** Educational background; sources and schematic overlay limits are documented in docs/sources.md. */
export interface IlargiFact {
  id: string;
  tag: string;
  text: string;
}

export const ILARGI_FUN_FACTS: IlargiFact[] = [
  {
    id: "fact-lunar-day",
    tag: "Lunar cycle",
    text: "A full lunar solar day lasts about 29.53 Earth days. Near the equator, daylight and darkness each last roughly two weeks.",
  },
  {
    id: "fact-tilt",
    tag: "Polar sunlight",
    text: "The Moon has a small axial tilt, so the Sun stays low near its poles. Local terrain can keep some crater interiors in shadow.",
  },
  {
    id: "fact-mirror-drift",
    tag: "Lunar ranging",
    text: "Laser ranging shows that the Moon is moving away from Earth at about 3.8 centimeters per year.",
  },
  {
    id: "fact-coldest-place",
    tag: "Cold traps",
    text: "Shadowed polar terrain can be extremely cold. Surface temperature requires a thermal model; the globe animation shows geometry.",
  },
  {
    id: "fact-earth-sky",
    tag: "Earth in the sky",
    text: "From much of the near side, Earth stays in a similar part of the sky. Libration and terrain can still change local visibility.",
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
    "The Moon recedes from Earth at about 3.8 cm per year.",
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
