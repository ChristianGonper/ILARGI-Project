import { ArrowRight, Compass, GraduationCap, Microscope } from "lucide-react";
import type { AppMode, HealthResponse } from "../types";
import { IlargiMascot } from "./IlargiMascot";

interface HomeScreenProps {
  health: HealthResponse | null;
  onSelectMode: (mode: Exclude<AppMode, "home">) => void;
}

export function HomeScreen({ health, onSelectMode }: HomeScreenProps) {
  return (
    <div className="home-shell">
      <div className="home-stars" aria-hidden="true" />
      <header className="home-topbar">
        <div className="topbar-left">
          <span className="brand-title">ILARGI</span>
          <span className="pill pill-cyan">
            NASA Space Apps · Lunar Explorer
          </span>
        </div>
        <div className="topbar-right">
          <span className="pill pill-muted">
            {health?.frame ?? "MOON_ME_DE440_ME421"} ·{" "}
            {health?.abcorr ?? "LT+S"}
          </span>
          <span className="pill pill-ok">
            {health?.kernels ?? "DE440s"} · OK
          </span>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="eyebrow">
            Interactive Lunar Analyzer for Radiance, Geometry, and
            Intervisibility
          </div>
          <h1 className="home-title">
            Explora la luz, las sombras y las órbitas de la Luna
          </h1>
          <p className="home-lead">
            Un mismo motor científico basado en efemérides reales{" "}
            <strong>JPL SPICE DE440s</strong> y topografía láser{" "}
            <strong>NASA LRO/LOLA</strong>, adaptado a dos experiencias:
            análisis técnico de misión o viaje divulgativo guiado por nuestra
            mascota <strong>ILARGI</strong>.
          </p>

          <div className="home-mascot-box">
            <IlargiMascot
              speakerMood="¡Hola, tripulación!"
              message="¡Bienvenidos a ILARGI! Soy vuestro guía lunar. Si queréis gráficas científicas, horizontes LOLA y comparar hasta 10 zonas, elegid Modo PRO. Si preferís ver el día lunar como una película, buscar agua helada, descubrir los espejos de la Luna y simular los 3 cuerpos, ¡venid conmigo al Modo Educación!"
              showFunFacts
            />
          </div>
        </section>

        <section className="home-cards" aria-label="Selector de modo">
          <article className="mode-card mode-card-edu">
            <div className="mode-card-top">
              <span className="mode-icon-badge edu">
                <GraduationCap size={24} />
              </span>
              <span className="pill pill-cyan">Divulgación · Interactivo</span>
            </div>
            <h2>Modo Educación</h2>
            <p className="mode-desc">
              Diseñado para comprender visualmente cómo cambia la iluminación
              solar en la Luna a lo largo de un día lunar completo (29,5 días),
              con la compañía constante de <strong>ILARGI</strong>.
            </p>
            <ul className="mode-features">
              <li>
                Película dinámica del ciclo solar completo sobre el globo lunar
                3D (con rotación libre e independiente).
              </li>
              <li>
                Landing spots, puntos de continua iluminación y sombra
                permanente (<strong>NASA PGDA LOLA 69</strong>).
              </li>
              <li>
                Capa exclusiva de <strong>Agua / Hielo polar</strong> en trampas
                frías y explicación interactiva del{" "}
                <strong>Espejo de la Luna</strong>.
              </li>
              <li>
                Simulación simultánea y ampliable de las órbitas de los{" "}
                <strong>3 cuerpos (Sol · Tierra · Luna)</strong>.
              </li>
            </ul>
            <button
              type="button"
              className="btn-primary mode-cta"
              onClick={() => onSelectMode("education")}
            >
              <Compass size={16} />
              Entrar en Modo Educación
              <ArrowRight size={16} />
            </button>
          </article>

          <article className="mode-card mode-card-pro">
            <div className="mode-card-top">
              <span className="mode-icon-badge pro">
                <Microscope size={24} />
              </span>
              <span className="pill pill-ok">Ingeniería · Ciencia</span>
            </div>
            <h2>Modo PRO</h2>
            <p className="mode-desc">
              Mesa de trabajo científica para planificar emplazamientos de
              aterrizaje con perfiles topográficos LOLA, fracciones de disco y
              eclipses reales.
            </p>
            <ul className="mode-features">
              <li>
                Análisis multi-punto (hasta <strong>10 emplazamientos</strong>{" "}
                simultáneos) o coordenadas manuales con pin 3D.
              </li>
              <li>
                Horizonte topográfico LOLA (20 m / 80 m / ≈237 m) con curvatura
                lunar y elevación del observador.
              </li>
              <li>
                Gráficos Plotly de trayectoria celeste, evolución diaria,
                eclipses tierra-sol y fracciones visibles.
              </li>
              <li>
                Máscaras minerales regionales <strong>LP-GRS</strong>, tabla
                comparativa y exportación CSV.
              </li>
            </ul>
            <button
              type="button"
              className="btn-secondary mode-cta pro-cta"
              onClick={() => onSelectMode("pro")}
            >
              <Microscope size={16} />
              Entrar en Modo PRO
              <ArrowRight size={16} />
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}
