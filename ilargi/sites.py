"""Puntos históricos y emplazamientos lunares predefinidos para ILARGI."""

from dataclasses import dataclass


@dataclass(frozen=True)
class HistoricalSite:
    id: str
    name: str
    mission: str
    latitude_deg: float
    longitude_east_deg: float
    region: str
    in_lola_sample: bool = False


HISTORICAL_SITES: tuple[HistoricalSite, ...] = (
    HistoricalSite(
        id="lola-center",
        name="Polo Sur · Muestra LOLA Centro",
        mission="LOLA DEM 20m/80m",
        latitude_deg=-89.500,
        longitude_east_deg=0.000,
        region="Polo Sur (muestra LOLA + LP-GRS)",
        in_lola_sample=True,
    ),
    HistoricalSite(
        id="lola-north",
        name="Polo Sur · Cresta LOLA Norte",
        mission="LOLA DEM 20m/80m",
        latitude_deg=-89.200,
        longitude_east_deg=0.000,
        region="Polo Sur (muestra LOLA + LP-GRS)",
        in_lola_sample=True,
    ),
    HistoricalSite(
        id="lola-east",
        name="Polo Sur · Sector LOLA 10° E",
        mission="LOLA DEM 20m/80m",
        latitude_deg=-89.500,
        longitude_east_deg=10.000,
        region="Polo Sur (muestra LOLA + LP-GRS)",
        in_lola_sample=True,
    ),
    HistoricalSite(
        id="shackleton-rim",
        name="Borde Shackleton (ref.)",
        mission="Artemis · Candidato polar",
        latitude_deg=-89.540,
        longitude_east_deg=129.780,
        region="Polo Sur (cobertura LP-GRS)",
    ),
    HistoricalSite(
        id="malapert-massif",
        name="Macizo Malapert (ref.)",
        mission="Artemis · Candidato polar",
        latitude_deg=-86.000,
        longitude_east_deg=2.000,
        region="Polo Sur (cobertura LP-GRS)",
    ),
    HistoricalSite(
        id="chandrayaan-3",
        name="Shiv Shakti Point",
        mission="Chandrayaan-3 (2023)",
        latitude_deg=-69.373,
        longitude_east_deg=32.319,
        region="Región polar sur media",
    ),
    HistoricalSite(
        id="change-4",
        name="Cráter Von Kármán",
        mission="Chang'e 4 (2019)",
        latitude_deg=-45.457,
        longitude_east_deg=177.588,
        region="Cara oculta · Cuenca Aitken",
    ),
    HistoricalSite(
        id="apollo-11",
        name="Mare Tranquillitatis",
        mission="Apollo 11 (1969)",
        latitude_deg=0.674,
        longitude_east_deg=23.473,
        region="Cara visible ecuatorial",
    ),
    HistoricalSite(
        id="apollo-15",
        name="Hadley-Apennine",
        mission="Apollo 15 (1971)",
        latitude_deg=26.132,
        longitude_east_deg=3.634,
        region="Cara visible norte",
    ),
    HistoricalSite(
        id="apollo-16",
        name="Tierras Altas Descartes",
        mission="Apollo 16 (1972)",
        latitude_deg=-8.973,
        longitude_east_deg=15.500,
        region="Cara visible sur",
    ),
    HistoricalSite(
        id="apollo-17",
        name="Taurus-Littrow",
        mission="Apollo 17 (1972)",
        latitude_deg=20.191,
        longitude_east_deg=30.772,
        region="Cara visible noreste",
    ),
)

SITE_BY_ID: dict[str, HistoricalSite] = {site.id: site for site in HISTORICAL_SITES}


@dataclass(frozen=True)
class EducationSite:
    id: str
    name: str
    category: str  # "landing" | "eternal_light" | "psr" | "mirror"
    category_label: str
    mission_or_source: str
    latitude_deg: float
    longitude_east_deg: float
    region: str
    illumination_note: str
    earth_visibility_note: str
    water_note: str
    ilargi_story: str


EDUCATION_SITES: tuple[EducationSite, ...] = (
    # --- Puntos de continua iluminación (NASA PGDA Product 69 · LOLA 18.6 años) ---
    EducationSite(
        id="edu-connecting-ridge",
        name="Cresta Conectada Shackleton–de Gerlache (C1)",
        category="eternal_light",
        category_label="Luz continua (PGDA 69)",
        mission_or_source="NASA PGDA LOLA 69 · Site01 / C1",
        latitude_deg=-89.450,
        longitude_east_deg=-137.310,
        region="Polo Sur · Cresta polar",
        illumination_note="~88–95% de luz solar media (máx. en ciclo de 18,6 años)",
        earth_visibility_note="Visibilidad intermitente con la Tierra (~45–55% según elevación)",
        water_note="Zona muy soleada y cálida de día; el hielo superficial no es estable aquí, pero limita con trampas frías vecinas.",
        ilargi_story=(
            "¡Estás viendo uno de los puntos más soleados de toda la Luna! "
            "En la Cresta Conectada (Site01 de la NASA), el Sol casi roza el horizonte durante ~90% del tiempo. "
            "No existe luz eterna absoluta al 100%, pero es oro puro para paneles solares."
        ),
    ),
    EducationSite(
        id="edu-shackleton-rim",
        name="Borde del Cráter Shackleton (Pico S)",
        category="eternal_light",
        category_label="Luz continua (PGDA 69)",
        mission_or_source="NASA PGDA LOLA 69 · Site04 / Mazarico 2011",
        latitude_deg=-89.780,
        longitude_east_deg=-155.730,
        region="Polo Sur · Borde de Shackleton",
        illumination_note="~81–87% de iluminación media en superficie (hasta ~90% a 2 m)",
        earth_visibility_note="Visibilidad directa periódica hacia la Tierra",
        water_note="Justo al lado del borde está el interior helado del cráter Shackleton (trampa fría).",
        ilargi_story=(
            "El borde del cráter Shackleton es el balcón energético del Polo Sur: recibe Sol más del 80% del ciclo, "
            "¡a pocos kilómetros del abismo en sombra permanente del interior del cráter!"
        ),
    ),
    EducationSite(
        id="edu-malapert-massif",
        name="Macizo de Malapert",
        category="eternal_light",
        category_label="Luz continua (PGDA 69)",
        mission_or_source="NASA PGDA LOLA 69 · Site23 / Artemis",
        latitude_deg=-85.995,
        longitude_east_deg=-0.236,
        region="Polo Sur · Cara visible (~5 km altitud)",
        illumination_note="~75–89% de iluminación en cimas y crestas expuestas",
        earth_visibility_note="Alta visibilidad directa con la Tierra (>85% en la ladera norte)",
        water_note="Cresta iluminada ideal para energía y comunicaciones; posibles reservas de hielo en cráteres cercanos.",
        ilargi_story=(
            "El Macizo de Malapert se alza unos 5 kilómetros sobre el Polo Sur. "
            "Al mirar hacia 0° de longitud, combina muchísima luz solar con una línea de visión excelente hacia la Tierra."
        ),
    ),
    EducationSite(
        id="edu-mons-mouton",
        name="Mons Mouton (Meseta Leibnitz Beta)",
        category="eternal_light",
        category_label="Luz continua (PGDA 69)",
        mission_or_source="NASA PGDA LOLA 69 · Site20 / Artemis III & IM-2",
        latitude_deg=-85.427,
        longitude_east_deg=31.743,
        region="Polo Sur · Meseta elevada (~6 km)",
        illumination_note="Ventanas largas de luz solar en la meseta superior",
        earth_visibility_note="Buena visibilidad directa para antenas de espacio profundo (~65%)",
        water_note="Meseta plana próxima a regiones frías estudiadas para prospección de agua.",
        ilargi_story=(
            "Mons Mouton es una enorme meseta plana de 6 km de altura bautizada en honor a la matemática de la NASA Melba Mouton. "
            "Es una de las grandes candidatas para Artemis III."
        ),
    ),
    EducationSite(
        id="edu-peary-north",
        name="Borde del Cráter Peary (Luz Norte)",
        category="eternal_light",
        category_label="Luz continua (PGDA 69)",
        mission_or_source="NASA PGDA LOLA 69 (Norte) · Bussey / LRO",
        latitude_deg=88.630,
        longitude_east_deg=24.400,
        region="Polo Norte · Borde de Peary",
        illumination_note="~70–89% de iluminación media en los picos del borde norte",
        earth_visibility_note="Visibilidad moderada de la Tierra cerca del horizonte",
        water_note="Contraste extremo: picos casi siempre iluminados junto a pequeños suelos polares en sombra.",
        ilargi_story=(
            "¡También el Polo Norte tiene sus picos casi eternos! En el borde del cráter Peary, "
            "las crestas reciben luz solar durante la mayor parte del verano lunar norte."
        ),
    ),
    # --- Puntos de continua oscuridad / PSR (NASA PGDA Product 69) ---
    EducationSite(
        id="edu-cabeus-lcross",
        name="Cráter Cabeus · Impacto LCROSS (PSR)",
        category="psr",
        category_label="Oscuridad continua (PSR)",
        mission_or_source="NASA PGDA LOLA 69 · LCROSS (2009)",
        latitude_deg=-84.678,
        longitude_east_deg=-48.693,
        region="Polo Sur · Trampa fría (~415 km² PSR)",
        illumination_note="0% de luz solar directa en 18,6 años (Sombra Permanente)",
        earth_visibility_note="Oculto tras las paredes del cráter durante casi todo el ciclo",
        water_note="Agua confirmada: la sonda LCROSS detectó ~5,6% en masa de hielo/vapor de agua en la pluma de impacto (2009).",
        ilargi_story=(
            "Aquí el Sol no ha brillado desde hace miles de millones de años. En 2009 la NASA lanzó la sonda LCROSS "
            "contra este suelo congelado de Cabeus ¡y levantó un penacho con agua helada real!"
        ),
    ),
    EducationSite(
        id="edu-shackleton-psr",
        name="Fondo del Cráter Shackleton (PSR)",
        category="psr",
        category_label="Oscuridad continua (PSR)",
        mission_or_source="NASA PGDA LOLA 69 · LRO / LOLA",
        latitude_deg=-89.695,
        longitude_east_deg=126.371,
        region="Polo Sur · Interior Shackleton (~319 km² PSR)",
        illumination_note="0% de luz solar directa (el Sol queda bloqueado por el borde)",
        earth_visibility_note="Sin línea de visión directa hacia la Tierra desde el fondo",
        water_note="Trampa fría (~90 K o menos) con fuertes indicios de hielo mezclado con regolito.",
        ilargi_story=(
            "Mientras el borde de Shackleton brilla casi todo el mes, su fondo de 4 km de profundidad vive en noche perpetua. "
            "Es una auténtica nevera cósmica donde puede conservarse hielo de agua."
        ),
    ),
    EducationSite(
        id="edu-shoemaker-psr",
        name="Cráter Shoemaker (PSR)",
        category="psr",
        category_label="Oscuridad continua (PSR)",
        mission_or_source="NASA PGDA LOLA 69 · Lunar Prospector",
        latitude_deg=-88.057,
        longitude_east_deg=44.313,
        region="Polo Sur · ~1.221 km² en sombra permanente",
        illumination_note="0% de luz solar directa en la máscara PSR de PGDA 69",
        earth_visibility_note="Muy baja o nula desde el interior profundo",
        water_note="Elevada concentración de hidrógeno detectada por neutrones; posible reserva de hielo polar.",
        ilargi_story=(
            "El cráter Shoemaker alberga más de 1.200 km² en sombra eterna. "
            "Como el eje de la Luna apenas está inclinado 1,54°, el Sol pasa rasante por encima sin tocar jamás su suelo."
        ),
    ),
    EducationSite(
        id="edu-faustini-psr",
        name="Cráter Faustini (PSR)",
        category="psr",
        category_label="Oscuridad continua (PSR)",
        mission_or_source="NASA PGDA LOLA 69",
        latitude_deg=-87.133,
        longitude_east_deg=84.499,
        region="Polo Sur · ~711 km² en sombra permanente",
        illumination_note="0% de luz solar directa en 18,6 años",
        earth_visibility_note="Sin visibilidad directa desde el fondo del cráter",
        water_note="Trampa fría polar donde los volátiles como el agua quedan atrapados por el frío extremo.",
        ilargi_story=(
            "Faustini es otra de las grandes trampas frías del Polo Sur: allí hace tanto frío que una molécula de agua "
            "que caiga sobre el suelo queda congelada casi para siempre."
        ),
    ),
    EducationSite(
        id="edu-haworth-psr",
        name="Cráter Haworth (PSR)",
        category="psr",
        category_label="Oscuridad continua (PSR)",
        mission_or_source="NASA PGDA LOLA 69",
        latitude_deg=-87.529,
        longitude_east_deg=-4.854,
        region="Polo Sur · ~1.581 km² en sombra permanente",
        illumination_note="0% de luz solar directa (mayor área PSR contigua cercana al polo)",
        earth_visibility_note="Sin línea de visión directa desde el fondo",
        water_note="Gran cuenca fría candidata para futura extracción de hielo lunar (ISRU).",
        ilargi_story=(
            "Haworth guarda una de las mayores extensiones de oscuridad continua del Polo Sur: ¡casi 1.600 km² "
            "donde nunca entra un rayo directo de Sol!"
        ),
    ),
    EducationSite(
        id="edu-hermite-psr",
        name="Cráter Hermite SW (PSR Norte · 26 K)",
        category="psr",
        category_label="Oscuridad continua (PSR)",
        mission_or_source="NASA PGDA LOLA 69 (Norte) · Diviner LRO",
        latitude_deg=86.170,
        longitude_east_deg=-93.320,
        region="Polo Norte · Cráter Hermite",
        illumination_note="0% de luz solar directa; récord térmico de 26 K (−247 °C)",
        earth_visibility_note="Bloqueado por las paredes del cráter",
        water_note="¡Más frío que la superficie de Plutón! Trampa fría extrema para agua y otros hielos.",
        ilargi_story=(
            "¡Abrígate bien! En el cráter Hermite, cerca del Polo Norte, la sonda LRO midió 26 Kelvin (−247 °C): "
            "el lugar más frío medido por una nave en el Sistema Solar, ¡incluso más frío que Plutón!"
        ),
    ),
    # --- Landing Spots históricos y recientes ---
    EducationSite(
        id="edu-apollo-11",
        name="Mare Tranquillitatis · Apolo 11",
        category="landing",
        category_label="Landing Spot",
        mission_or_source="Apollo 11 (1969)",
        latitude_deg=0.674,
        longitude_east_deg=23.473,
        region="Cara visible ecuatorial",
        illumination_note="Ciclo clásico de ~14,8 días de luz y ~14,8 días de noche",
        earth_visibility_note="Tierra siempre visible en lo alto del cielo (cara visible)",
        water_note="Zona ecuatorial muy caliente de día (+120 °C); no conserva hielo superficial.",
        ilargi_story=(
            "¡El 20 de julio de 1969 aquí pisó el ser humano otro mundo por primera vez! "
            "Como está cerca del ecuador, verás el día durar dos semanas seguidas y la noche otras dos."
        ),
    ),
    EducationSite(
        id="edu-apollo-15",
        name="Hadley-Apennine · Apolo 15",
        category="landing",
        category_label="Landing Spot",
        mission_or_source="Apollo 15 (1971)",
        latitude_deg=26.132,
        longitude_east_deg=3.634,
        region="Cara visible norte · Montes Apeninos",
        illumination_note="Ciclo día/noche de ~29,5 días con relieve montañoso alrededor",
        earth_visibility_note="Tierra siempre visible en el cielo lunar",
        water_note="Sin hielo estable en superficie; región geológica volcánica y montañosa.",
        ilargi_story=(
            "Apolo 15 estrenó el Rover Lunar junto a unos montes altísimos y dejó también nuestro mayor "
            "espejo láser de 300 prismas."
        ),
    ),
    EducationSite(
        id="edu-apollo-16",
        name="Tierras Altas Descartes · Apolo 16",
        category="landing",
        category_label="Landing Spot",
        mission_or_source="Apollo 16 (1972)",
        latitude_deg=-8.973,
        longitude_east_deg=15.500,
        region="Cara visible sur",
        illumination_note="Ciclo equilibrado de ~14,8 días de Sol y ~14,8 días de noche",
        earth_visibility_note="Tierra siempre alta en el cielo",
        water_note="Tierras altas antiguas sin depósitos de hielo superficial.",
        ilargi_story=(
            "En las tierras altas de Descartes, Apolo 16 exploró rocas lunares primordiales muy distintas de los mares oscuros."
        ),
    ),
    EducationSite(
        id="edu-apollo-17",
        name="Taurus-Littrow · Apolo 17",
        category="landing",
        category_label="Landing Spot",
        mission_or_source="Apollo 17 (1972)",
        latitude_deg=20.191,
        longitude_east_deg=30.772,
        region="Cara visible noreste",
        illumination_note="Día y noche lunares de ~2 semanas cada uno",
        earth_visibility_note="Tierra siempre visible",
        water_note="Sin hielo superficial estable; famoso por el suelo naranja de origen volcánico.",
        ilargi_story=(
            "Taurus-Littrow fue el último alunizaje tripulado del programa Apolo en 1972. "
            "¡Incluso encontraron diminutas cuentas de vidrio naranja volcánico!"
        ),
    ),
    EducationSite(
        id="edu-change-4",
        name="Cráter Von Kármán · Chang'e 4",
        category="landing",
        category_label="Landing Spot",
        mission_or_source="Chang'e 4 (2019)",
        latitude_deg=-45.457,
        longitude_east_deg=177.588,
        region="Cara oculta · Cuenca Aitken",
        illumination_note="Ciclo día/noche lunar estándar (~29,5 días)",
        earth_visibility_note="¡La Tierra NUNCA se ve! Necesitó el satélite relé Queqiao",
        water_note="Sin hielo estable en superficie; fondo de la mayor cuenca de impacto lunar.",
        ilargi_story=(
            "¡Bienvenidos a la cara oculta! Desde aquí la Tierra jamás asoma por el cielo. "
            "Por eso Chang'e 4 necesitó un satélite relé orbitando más allá de la Luna para poder enviar fotos."
        ),
    ),
    EducationSite(
        id="edu-chandrayaan-3",
        name="Shiv Shakti Point · Chandrayaan-3",
        category="landing",
        category_label="Landing Spot",
        mission_or_source="Chandrayaan-3 (2023)",
        latitude_deg=-69.373,
        longitude_east_deg=32.319,
        region="Región polar sur media",
        illumination_note="Sol bajo sobre el horizonte durante el día polar sur",
        earth_visibility_note="Tierra visible a baja elevación en el horizonte norte",
        water_note="Puerta de entrada a la región polar sur donde se investigan volátiles y agua.",
        ilargi_story=(
            "En 2023, la misión india Chandrayaan-3 aterrizó más al sur que ninguna nave anterior, "
            "abriendo camino hacia el Polo Sur lunar."
        ),
    ),
    # --- Espejos de la Luna (Retrorreflectores Láser LRRR) ---
    EducationSite(
        id="edu-mirror-apollo11",
        name="Espejo Apolo 11 · Mare Tranquillitatis",
        category="mirror",
        category_label="Espejo de la Luna (LRRR)",
        mission_or_source="LRRR Apollo 11 (1969) · 100 prismas",
        latitude_deg=0.674,
        longitude_east_deg=23.473,
        region="Cara visible · Primer espejo lunar",
        illumination_note="Funciona mejor durante el día lunar gracias a su control térmico",
        earth_visibility_note="Tierra siempre visible para apuntar láseres desde observatorios",
        water_note="Experimento óptico pasivo; sin hielo superficial.",
        ilargi_story=(
            "¡Este fue el primer 'espejo' dejado en la Luna! Tiene 100 prismas de cuarzo en esquina de cubo "
            "que devuelven cualquier rayo láser exactamente hacia el telescopio en la Tierra que lo disparó."
        ),
    ),
    EducationSite(
        id="edu-mirror-lunokhod1",
        name="Espejo Lunojod 1 · Mare Imbrium",
        category="mirror",
        category_label="Espejo de la Luna (LRRR)",
        mission_or_source="Luna 17 / Lunojod 1 (1970) · 14 prismas",
        latitude_deg=38.315,
        longitude_east_deg=-35.008,
        region="Cara visible noroeste · Mare Imbrium",
        illumination_note="Rinde especialmente bien durante la noche lunar",
        earth_visibility_note="Tierra siempre visible desde el cuadrante noroeste",
        water_note="Sin depósitos de agua en esta latitud media.",
        ilargi_story=(
            "¡El espejo perdido y reencontrado! Estuvo perdido casi 40 años hasta que la sonda LRO fotografió al rover Lunojod 1 en 2010 "
            "y los láseres terrestres volvieron a hacerlo brillar."
        ),
    ),
    EducationSite(
        id="edu-mirror-apollo14",
        name="Espejo Apolo 14 · Fra Mauro",
        category="mirror",
        category_label="Espejo de la Luna (LRRR)",
        mission_or_source="LRRR Apollo 14 (1971) · 100 prismas",
        latitude_deg=-3.644,
        longitude_east_deg=-17.479,
        region="Cara visible · Formación Fra Mauro",
        illumination_note="Ciclo solar ecuatorial clásico (~14,8 días de luz)",
        earth_visibility_note="Tierra fija casi sobre el cenit",
        water_note="Sin hielo superficial estable.",
        ilargi_story=(
            "El reflector de Apolo 14 forma parte de la red de triángulos ópticos que permite medir no solo la distancia, "
            "sino también cómo oscila y se tambalea la Luna (libración)."
        ),
    ),
    EducationSite(
        id="edu-mirror-apollo15",
        name="Espejo Apolo 15 · Hadley-Apennine",
        category="mirror",
        category_label="Espejo de la Luna (LRRR)",
        mission_or_source="LRRR Apollo 15 (1971) · 300 prismas",
        latitude_deg=26.132,
        longitude_east_deg=3.634,
        region="Cara visible · El mayor retrorreflector",
        illumination_note="Optimizado térmicamente para mediciones láser diurnas y nocturnas",
        earth_visibility_note="Tierra siempre visible en dirección casi vertical",
        water_note="Sin hielo superficial estable.",
        ilargi_story=(
            "¡El rey de los espejos lunares! Con 300 prismas, Apolo 15 es tres veces más grande que los demás "
            "y ha proporcionado alrededor del 75% de todas las mediciones láser históricas."
        ),
    ),
    EducationSite(
        id="edu-mirror-lunokhod2",
        name="Espejo Lunojod 2 · Cráter Le Monnier",
        category="mirror",
        category_label="Espejo de la Luna (LRRR)",
        mission_or_source="Luna 21 / Lunojod 2 (1973) · 14 prismas",
        latitude_deg=25.832,
        longitude_east_deg=30.922,
        region="Cara visible · Borde este de Serenitatis",
        illumination_note="Más sensible durante la noche lunar",
        earth_visibility_note="Tierra siempre visible",
        water_note="Sin hielo superficial estable.",
        ilargi_story=(
            "Los espejos de los rovers Lunojod 1 y 2 siguen respondiendo a los pulsos láser más de 50 años después, "
            "sin gastar ni una gota de batería porque son prismas totalmente pasivos."
        ),
    ),
    EducationSite(
        id="edu-mirror-nglr1",
        name="Espejo NGLR-1 · Mare Crisium (Blue Ghost 1)",
        category="mirror",
        category_label="Espejo de la Luna (LRRR)",
        mission_or_source="CLPS Blue Ghost 1 (2025) · Prisma único 10 cm",
        latitude_deg=18.562,
        longitude_east_deg=61.810,
        region="Cara visible este · Mare Crisium",
        illumination_note="Ciclo solar estándar de latitudes medias",
        earth_visibility_note="Tierra visible hacia el horizonte oeste",
        water_note="Sin hielo superficial estable.",
        ilargi_story=(
            "¡El espejo más moderno! Depositado en 2025 en Mare Crisium, usa un único gran prisma de 10 cm "
            "para lograr una precisión submilimétrica desde la Tierra."
        ),
    ),
)
