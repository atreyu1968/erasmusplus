import "../mmg-visitor/_group.css";
import "../mmg-visitor/Proposal.css";
import "./Destinations.css";

type Destination = {
  name: string;
  country: string;
  number: string;
  description: string;
  image: string;
  imageAlt: string;
  author: string | null;
  source: string | null;
  license: string | null;
  licenseUrl: string | null;
};

const destinations: Destination[] = [
  {
    name: "Viseu",
    country: "Portugal",
    number: "01",
    description: "Escuela colaboradora: Escola Secundária de Emídio Navarro.",
    image: "/__mockup/images/mmg-verified-destinations-viseu.jpg",
    imageAlt: "Casas del centro histórico de Viseu reflejadas junto al agua",
    author: "Michal Gorski",
    source: "https://commons.wikimedia.org/wiki/File:Viseu,_Portugal_-_panoramio.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    name: "Oporto",
    country: "Portugal",
    number: "02",
    description: "Ciudad del Duero y destino previsto para Administración y Gestión.",
    image: "/__mockup/images/mmg-verified-destinations-porto.jpg",
    imageAlt: "Vista de la Ribeira de Oporto y los edificios junto al río Duero",
    author: "João Tiago M. S. Andrade",
    source: "https://commons.wikimedia.org/wiki/File:Ribeira_do_Porto.jpg",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  },
  {
    name: "Róterdam",
    country: "Países Bajos",
    number: "03",
    description: "Innovación y formación profesional con la red Albeda.",
    image: "/__mockup/images/visitor-rotterdam.jpg",
    imageAlt: "Canal urbano con edificios y embarcaciones",
    author: null,
    source: null,
    license: null,
    licenseUrl: null,
  },
];

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

export function Destinations() {
  return (
    <div className="mmg-proposal verified-destination-preview">
      <header className="verified-topbar">
        <a className="verified-brand" href="/" aria-label="Movilidades Erasmus+ — Inicio">
          <span className="verified-mark">MMG+</span>
          <span>
            <b>Movilidades Erasmus+</b>
            <small>IES Manuel Martín González</small>
          </span>
        </a>
        <span className="verified-topbar-note">CURSO 2026–2027</span>
        <a className="verified-access" href="/acceso">Acceder <Arrow /></a>
      </header>

      <main className="proposal-main">
        <section className="destinations-section verified-destinations" aria-labelledby="verified-title">
          <div className="section-heading">
            <div>
              <p className="proposal-kicker"><span /> CURSO 2026–2027</p>
              <h1 id="verified-title">Europa, más cerca.</h1>
              <p className="section-subtitle">Destinos Erasmus+ · Portugal y Países Bajos</p>
            </div>
            <span className="section-count">03 <i>destinos</i></span>
          </div>

          <div className="proposal-dest-grid">
            {destinations.map((destination) => (
              <article className="proposal-destination" key={destination.name}>
                <div className="destination-image-wrap">
                  <img src={destination.image} alt={destination.imageAlt} loading="lazy" />
                  <span className="destination-number">{destination.number}</span>
                  <span className="destination-country">{destination.country}</span>
                </div>
                <div className="destination-content">
                  <h2>{destination.name}</h2>
                  <p>{destination.description}</p>
                  {destination.author && destination.source && destination.license && destination.licenseUrl ? (
                    <div className="verified-photo-credit" aria-label={`Crédito fotográfico: ${destination.author}`}>
                      <span>Foto: <b>{destination.author}</b></span>
                      <span>
                        <a href={destination.source} target="_blank" rel="noreferrer">Fuente en Wikimedia Commons</a>
                        {" · "}
                        <a href={destination.licenseUrl} target="_blank" rel="noreferrer">{destination.license}</a>
                      </span>
                      <small>Imagen recortada para la tarjeta.</small>
                    </div>
                  ) : (
                    <div className="verified-photo-credit verified-photo-reference">
                      <span>Imagen actual de referencia.</span>
                      <small>La fuente y la licencia de Róterdam se validan por separado.</small>
                    </div>
                  )}
                  <a className="verified-destination-cta" href="/registro">
                    Solicitar cuenta <Arrow />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <p className="verified-source-note">
            Viseu y Oporto usan fotos distintas con fuente y licencia enlazadas. Róterdam conserva su imagen actual.
          </p>
        </section>
      </main>
    </div>
  );
}
