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
