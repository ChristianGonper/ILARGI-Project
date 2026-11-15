# Ephemeris validation

These comparisons were recorded on 2026-11-14 against the [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). Horizons identified DE441; ILARGI uses DE440s and DE440 lunar orientation. The families share underlying models: this checks implementation and conventions, not an independent observational accuracy bound.

## Geometric vectors

The Moon relative to Earth at 2026-04-02 15:00 UTC was queried with `EPHEM_TYPE=VECTORS`, `CENTER=500@399`, `TIME_TYPE=UT`, `REF_PLANE=FRAME`, `REF_SYSTEM=ICRF`, `VEC_CORR=NONE`, `OUT_UNITS=KM-S`, `VEC_TABLE=2`.

| Component | Horizons DE441 (km) | SPICE DE440s (km, rounded) |
| --------- | ------------------: | -------------------------: |
| X         |  -373910.6664632003 |           -373910.66710442 |
| Y         |  -106746.2116582052 |           -106746.20977303 |
| Z         |  -71540.67909399251 |            -71540.67810391 |

The residual norm is about 0.00222 km; the regression tolerance is 0.01 km. Tests retain another lunar sample one hour later, plus Sun relative to Moon (0.00154 km residual) and Earth relative to Sun (0.00069 km).

## Apparent vectors and surface angles

Original response headers and rows are retained in [the comparison JSON](horizons/comparison-2026-11-14.json) and [the full Earth observer response](horizons/earth-observer-sample.txt). Vector queries use `VEC_CORR=LT+S`; center is `500@301`, surface is `coord@301` with geodetic longitude, latitude and height in kilometers. ILARGI rotates its lunar-frame vector to J2000 at observation time before comparing it with ICRF. Horizons `REF_PLANE=BODY` is not a body-fixed cartographic frame.

Recorded center-vector residuals at 15:00 and 16:00 UTC are 2.45/2.47 m for Earth and 9.28/9.08 m for Sun. Surface cases at equatorial, midlatitude and near-polar sites have similar residuals (Earth 2.45–2.47 m; Sun 9.26–9.35 m).

Observer queries use `QUANTITIES=4,20`, `ANG_FORMAT=DEG`, `APPARENT=AIRLESS`, `RANGE_UNITS=KM`, `EXTRA_PREC=YES`. Headers specify `MEAN_ME`, spherical radii 1737.4 km and no atmospheric refraction. Horizons includes gravitational light deflection; SPICE LT+S does not. Residuals therefore combine this distinction with DE440s/DE441 differences.

Recorded sky-component residuals are within 0.00122 arcsec after multiplying azimuth differences by cos(elevation). Raw azimuth differences can be larger near zenith. Earth range residuals are about 14 cm; solar residuals are a few meters, with coarser printed solar range precision. Tests allow 0.02 km vector residual, 0.005 arcsec sky components and 0.05 km range residual for these cases only.

## Remaining validation work

The automated suite covers coordinate conventions, frame behavior, synthetic terrain geometry, partial horizons, sampling boundaries and selected eclipse cases. It does not establish a general uncertainty budget or validate every site and date. Terrain convergence, independent terrain comparisons and mission-specific thresholds remain necessary. See [scientific results](scientific-results.md).
