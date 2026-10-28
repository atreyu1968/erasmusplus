import { useState } from "react";
import "./_group.css";

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
  },
  {
    name: "Oporto",
    country: "Portugal",
    description: "Ciudad del Duero y destino previsto para Administración y Gestión.",
    image: "/__mockup/images/visitor-porto.jpg",
  },
  {
    name: "Róterdam",
    country: "Países Bajos",
    description: "Innovación y formación profesional con la red Albeda.",
    image: "/__mockup/images/visitor-rotterdam.jpg",
  },
];

export function Current() {
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
    <div className={`shell${expanded ? " sidebar-expanded" : ""}`}>
      <header className="topbar">
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={expanded ? "Contraer menú" : "Expandir menú"}
          aria-controls="visitor-sidebar"
          aria-expanded={expanded}
          onClick={toggleSidebar}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <a className="brand" href="#">
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
          <a className="btn small" href="#">Acceder</a>
        </div>
      </header>
      <aside className="sidebar" id="visitor-sidebar" aria-label="Navegación principal">
        <p className="side-label">GUÍA DE ISORA · TENERIFE</p>
        <nav>
          {links.map(([href, path, label], index) => (
            <a className={`nav${index === 0 ? " current" : ""}`} href="#" title={label} aria-label={label} key={label}>
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
        <main>
          <div className="hero">
            <p className="eyebrow">IES MANUEL MARTÍN GONZÁLEZ · TENERIFE</p>
            <h1>Enriqueciendo vidas.<br /><span>Abriendo mentes.</span></h1>
            <p>Conecta con Europa. Organiza tu candidatura y participa en experiencias Erasmus+ de formación profesional.</p>
            <div className="actions">
              <a className="btn light" href="#">Solicitar cuenta</a>
              <a className="btn outlined" href="#">Iniciar sesión</a>
            </div>
          </div>
          <div className="heading">
            <h2>Destinos Erasmus+ 2026–2027</h2>
            <p>Portugal y Países Bajos</p>
          </div>
          <div className="dest-grid">
            {destinations.map((destination) => (
              <article className="card destination" key={destination.name}>
                <img src={destination.image} alt="Fotografía ilustrativa" />
                <div>
                  <span className="eyebrow">{destination.country}</span>
                  <h3>{destination.name}</h3>
                  <p>{destination.description}</p>
                </div>
              </article>
            ))}
          </div>
          <footer>Movilidades Erasmus+ MMG · Fase 1 de desarrollo. No introducir datos reales hasta concluir la revisión de seguridad y protección de datos.</footer>
        </main>
      </div>
    </div>
  );
}
