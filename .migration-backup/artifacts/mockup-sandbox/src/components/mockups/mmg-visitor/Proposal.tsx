import { useState } from "react";
import "./_group.css";
import "./Proposal.css";

const links = [
  ["/", "M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M9 21v-7h6v7", "Inicio"],
  ["/acceso", "M10 17l5-5-5-5m5 5H3m11-9h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6", "Acceso"],
  ["/registro", "M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "Registro"],
  ["/privacidad", "M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4", "Privacidad"],
];

const destinations = [
  {
    name: "Viseu",
    country: "Portugal",
    description: "Escuela colaboradora: Escola Secundária de Emídio Navarro.",
    image: "/__mockup/images/visitor-porto.jpg",
    number: "01",
  },
  {
    name: "Oporto",
    country: "Portugal",
    description: "Ciudad del Duero y destino previsto para Administración y Gestión.",
    image: "/__mockup/images/visitor-porto.jpg",
    number: "02",
  },
  {
    name: "Róterdam",
    country: "Países Bajos",
    description: "Innovación y formación profesional con la red Albeda.",
    image: "/__mockup/images/visitor-rotterdam.jpg",
    number: "03",
  },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      {diagonal ? (
        <path d="M5 15 15 5M6 5h9v9" />
      ) : (
        <path d="M3.5 10h12m-5-5 5 5-5 5" />
      )}
    </svg>
  );
}

export function Proposal() {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem("mmg-sidebar-expanded") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem("mmg-sidebar-expanded", String(next));
    } catch {
      // The menu remains usable when browser storage is unavailable.
    }
  };

  return (
    <div className={`shell mmg-proposal${expanded ? " sidebar-expanded" : ""}`}>
      <header className="topbar">
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={expanded ? "Contraer menú" : "Expandir menú"}
          aria-controls="proposal-sidebar"
          aria-expanded={expanded}
          onClick={toggleSidebar}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <a className="brand" href="/" aria-label="Movilidades Erasmus+ — Inicio">
          <span className="mark">MMG+</span>
          <span className="brand-copy">
            <b>Movilidades Erasmus+</b>
            <small>IES Manuel Martín González</small>
          </span>
        </a>
        <span className="course-label">CURSO 2026–2027</span>
        <div className="user">
          <span className="avatar">E</span>
          <span className="user-name">Visitante</span>
          <a className="btn small" href="/acceso">Acceder</a>
        </div>
      </header>

      <aside className="sidebar" id="proposal-sidebar" aria-label="Navegación principal">
        <p className="side-label">GUÍA DE ISORA · TENERIFE</p>
        <nav aria-label="Secciones y páginas">
          {links.map(([href, path, label], index) => (
            <a
              className={`nav${index === 0 ? " current" : ""}`}
              href={href}
              aria-current={index === 0 ? "page" : undefined}
              title={label}
              key={label}
            >
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
              </i>
              <span className="nav-label">{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidefooter">Enriqueciendo vidas.<br />Abriendo mentes.</div>
      </aside>

      <div className="workspace">
        <main className="proposal-main">
          <section className="proposal-hero" aria-labelledby="proposal-title">
            <div className="hero-photo" role="img" aria-label="Vista de Oporto junto al río Duero" />
            <div className="hero-copy">
              <p className="proposal-kicker"><span /> IES Manuel Martín González · Tenerife</p>
              <h1 id="proposal-title">Enriqueciendo vidas.<br /><em>Abriendo mentes.</em></h1>
              <p className="hero-description">
                Conecta con Europa. Organiza tu candidatura y participa en experiencias Erasmus+ de formación profesional.
              </p>
              <div className="proposal-actions">
                <a className="proposal-button primary" href="/registro">Solicitar cuenta <Arrow /></a>
                <a className="proposal-button secondary" href="/acceso">Iniciar sesión <Arrow diagonal /></a>
              </div>
            </div>
            <div className="hero-caption"><span>IES MMG</span><span>Guía de Isora, Tenerife</span></div>
            <span className="hero-index" aria-hidden="true">EU<br />26</span>
          </section>

          <section className="intro-strip" aria-label="Información del curso">
            <p className="strip-label">MOVILIDADES ERASMUS+</p>
            <div className="strip-copy">
              <h2>Una experiencia de formación profesional en Europa.</h2>
              <p>Descubre los destinos previstos para el curso 2026–2027.</p>
            </div>
            <a href="#destinos" className="text-link">Ver destinos <Arrow /></a>
          </section>

          <section className="destinations-section" id="destinos" aria-labelledby="destinations-title">
            <div className="section-heading">
              <div>
                <p className="proposal-kicker"><span /> CURSO 2026–2027</p>
                <h2 id="destinations-title">Europa, más cerca.</h2>
                <p className="section-subtitle">Destinos Erasmus+ · Portugal y Países Bajos</p>
              </div>
              <span className="section-count">03 <i>destinos</i></span>
            </div>

            <div className="proposal-dest-grid">
              {destinations.map((destination) => (
                <article className="proposal-destination" key={destination.name}>
                  <div className="destination-image-wrap">
                    <img src={destination.image} alt={`Vista de ${destination.name}`} loading="lazy" />
                    <span className="destination-number">{destination.number}</span>
                    <span className="destination-country">{destination.country}</span>
                  </div>
                  <div className="destination-content">
                    <h3>{destination.name}</h3>
                    <p>{destination.description}</p>
                    <a href="/registro" aria-label={`Solicitar cuenta para informarse sobre ${destination.name}`}>
                      Solicitar cuenta <Arrow />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="route-panel" aria-labelledby="route-title">
            <div className="route-marker" aria-hidden="true">
              <span className="marker-ring"><span /></span>
              <span className="marker-line" />
              <span className="marker-dot" />
            </div>
            <div className="route-copy">
              <p className="proposal-kicker"><span /> IES MANUEL MARTÍN GONZÁLEZ</p>
              <h2 id="route-title">Desde Tenerife,<br />con rumbo a Europa.</h2>
              <p>Movilidades Erasmus+ de formación profesional. Explora los destinos previstos y accede para conocer el espacio de candidatura.</p>
              <a className="text-link" href="/acceso">Iniciar sesión <Arrow /></a>
            </div>
            <div className="route-art" aria-hidden="true">
              <div className="route-orbit orbit-one" />
              <div className="route-orbit orbit-two" />
              <span className="route-island">TFE</span>
              <span className="route-europe">EU</span>
              <svg viewBox="0 0 360 220" fill="none">
                <path d="M55 154C101 95 140 76 185 106C232 138 255 115 304 55" />
                <circle cx="55" cy="154" r="5" />
                <circle cx="304" cy="55" r="5" />
              </svg>
            </div>
          </section>

          <section className="closing-panel" aria-label="Acceso a la plataforma">
            <div>
              <p className="proposal-kicker"><span /> TU PRÓXIMO PASO</p>
              <h2>¿Quieres conocer la plataforma?</h2>
            </div>
            <div className="closing-actions">
              <a className="proposal-button primary" href="/registro">Solicitar cuenta <Arrow /></a>
              <a className="closing-login" href="/acceso">Ya tengo cuenta <Arrow diagonal /></a>
            </div>
          </section>

          <footer className="proposal-footer">
            <a className="footer-brand" href="/">MMG<span>+</span> <small>Movilidades Erasmus+</small></a>
            <span>IES Manuel Martín González · Tenerife</span>
            <a href="/privacidad">Privacidad <Arrow diagonal /></a>
          </footer>
        </main>
      </div>
    </div>
  );
}
