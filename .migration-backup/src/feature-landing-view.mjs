const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

function safeUrl(value) {
  const url = String(value ?? '').trim();
  if (/^https:\/\/[^/]/i.test(url) || /^\/(?!\/)/.test(url)) return url;
  return '';
}

function destinationCredit(destination) {
  if (!destination.image_credit || !destination.image_source_url ||
      !destination.image_license_name || !destination.image_license_url) return '';
  const source=safeUrl(destination.image_source_url);
  const license=safeUrl(destination.image_license_url);
  if (!source || !license || !source.startsWith('https://') || !license.startsWith('https://')) return '';
  return '<small class="vl-photo-credit">Foto: ' + escapeHtml(destination.image_credit) +
    ' · <a href="' + escapeHtml(source) + '" target="_blank" rel="noopener noreferrer">Fuente</a>' +
    ' · <a href="' + escapeHtml(license) + '" target="_blank" rel="noopener noreferrer">' +
    escapeHtml(destination.image_license_name) + '</a>' +
    (destination.image_note ? ' · ' + escapeHtml(destination.image_note) : '') + '</small>';
}

function arrow() {
  return '<span class="vl-arrow" aria-hidden="true">→</span>';
}

function renderTags(items, translate = value => value) {
  if (!Array.isArray(items) || !items.length) return '';
  return '<div class="vl-tags">' + items.map(item =>
    '<span class="vl-tag">' + escapeHtml(translate(item)) + '</span>'
  ).join('') + '</div>';
}

const mobilityNames = {
  short: 'Movilidad de corta duración',
  long: 'Movilidad de larga duración',
  shadowing: 'Observación profesional'
};

function renderDestination(destination, index) {
  const image = safeUrl(destination.image_url);
  const alt = destination.image_alt || `Fotografía de ${destination.name || 'un destino Erasmus+'}`;
  const modes = Array.isArray(destination.modes) ? destination.modes : [];
  const families = Array.isArray(destination.families) ? destination.families : [];

  return '<article class="vl-destination">' +
    '<div class="vl-destination-media">' +
      (image
        ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(alt) + '" loading="lazy">'
        : '<div class="visitor-destination-image-empty" role="img" aria-label="Imagen de destino no disponible"></div>') +
      '<span class="vl-destination-index">' + String(index + 1).padStart(2, '0') + '</span>' +
      (destination.country ? '<span class="vl-country">' + escapeHtml(destination.country) + '</span>' : '') +
    '</div>' +
    '<div class="vl-destination-body">' +
      '<h3>' + escapeHtml(destination.name || 'Destino Erasmus+') + '</h3>' +
      '<p>' + escapeHtml(destination.description || 'Una oportunidad para aprender y compartir experiencia profesional en Europa.') + '</p>' +
      renderTags(modes, mode => mobilityNames[mode] || mode) +
      (families.length ? '<div class="vl-families">Familias profesionales: ' + escapeHtml(families.join(' · ')) + '</div>' : '') +
      destinationCredit(destination) +
      '<a class="vl-destination-cta" href="/registro"><span>Explorar esta oportunidad</span>' + arrow() + '</a>' +
    '</div>' +
  '</article>';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function renderGalleryItem(item) {
  const image = safeUrl(item.imageUrl);
  const title = item.title || 'Experiencias Erasmus+';
  const date = formatDate(item.createdAt);
  return '<article class="vl-gallery-item">' +
    (image
      ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(item.imageAlt || title) + '" loading="lazy">'
      : '<div class="visitor-destination-image-empty" role="img" aria-label="Imagen no disponible"></div>') +
    '<div class="vl-gallery-caption"><h3>' + escapeHtml(title) + '</h3>' +
    (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') +
    (date ? '<time datetime="' + escapeHtml(new Date(item.createdAt).toISOString()) + '">' + escapeHtml(date) + '</time>' : '') +
    '</div></article>';
}

function contactField(label, content) {
  return content ? '<div><small>' + escapeHtml(label) + '</small>' + content + '</div>' : '';
}

function renderSocial(name, value, label) {
  const url = safeUrl(value);
  return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>' : '';
}

/**
 * Render the public Erasmus+ landing page body.
 * The server layout remains responsible for the fixed branded header and public shell.
 */
export function renderVisitorLanding({ settings = {}, editionLabel = '', destinations = [], galleryItems = [] } = {}) {
  const title = settings.title || 'IES Manuel Martín González';
  const eyebrow = settings.eyebrow || 'IES Manuel Martín González · Tenerife';
  const heroTitle = settings.heroTitle || 'Enriqueciendo vidas. Abriendo mentes.';
  const heroDescription = settings.heroDescription || 'Conecta con Europa. Organiza tu candidatura y participa en experiencias Erasmus+ de formación profesional.';
  const heroImage = safeUrl(settings.heroImageUrl) ||
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1500&q=85';
  const validDestinations = Array.isArray(destinations) ? destinations : [];
  const validGallery = Array.isArray(galleryItems) ? galleryItems : [];
  const currentEdition = editionLabel || 'Edición vigente';
  const uniqueCountries = [...new Set(validDestinations.map(item => item.country).filter(Boolean))];
  const countryLine = uniqueCountries.length ? uniqueCountries.join(' · ') : 'Nuevos destinos europeos';
  const phone = String(settings.contactPhone || '').trim();
  const phoneHref = phone.replace(/[^\d+]/g, '');
  const email = String(settings.contactEmail || '').trim();
  const aboutTitle = settings.aboutTitle || 'La formación profesional también se construye viajando.';
  const aboutText = settings.aboutText || `${title} impulsa experiencias de movilidad Erasmus+ para que alumnado y profesorado conozcan otros entornos profesionales, contrasten ideas y vuelvan con nuevas herramientas. Cada destino abre una perspectiva distinta; el aprendizaje continúa mucho después del viaje.`;
  const destinationsTitle = settings.destinationsTitle || 'Destinos para descubrir.';
  const destinationsDescription = settings.destinationsDescription || 'Conoce las oportunidades de movilidad y las familias profesionales vinculadas a cada experiencia.';
  const galleryTitle = settings.galleryTitle || 'La experiencia, en imágenes.';
  const galleryDescription = settings.galleryDescription || 'Momentos, lugares y aprendizajes compartidos por la comunidad Erasmus+ del centro.';
  const contactTitle = settings.contactTitle || '¿Hablamos de tu próxima experiencia?';
  const contactDescription = settings.contactDescription || 'Consulta las convocatorias y mantente cerca de las novedades Erasmus+ del centro.';
  const socialLinks = [
    renderSocial('Instagram', settings.socialInstagram, 'Instagram'),
    renderSocial('Facebook', settings.socialFacebook, 'Facebook'),
    renderSocial('YouTube', settings.socialYoutube, 'YouTube')
  ].filter(Boolean).join('');

  const heroArt =
    '<div class="vl-hero-art"><img src="' + escapeHtml(heroImage) + '" alt="" aria-hidden="true"><span class="vl-art-label">IES MMG · Guía de Isora · Tenerife</span></div>';

  const destinationContent = validDestinations.length
    ? '<div class="vl-destination-grid">' + validDestinations.map(renderDestination).join('') + '</div>'
    : '<div class="vl-empty">La próxima edición y sus destinos se publicarán aquí en cuanto estén confirmados. Mientras tanto, puedes consultar el acceso a la plataforma o solicitar una cuenta.</div>';

  const galleryContent = validGallery.length
    ? '<section class="vl-section vl-gallery" id="galeria" aria-labelledby="vl-gallery-title">' +
      '<div class="vl-section-heading"><div><p class="vl-kicker">Historias en movimiento</p><h2 id="vl-gallery-title">' + escapeHtml(galleryTitle) + '</h2></div>' +
      '<p>' + escapeHtml(galleryDescription) + '</p></div>' +
      '<div class="vl-gallery-grid">' + validGallery.map(renderGalleryItem).join('') + '</div></section>'
    : '';

  const emailContent = email ? '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a>' : '';
  const phoneContent = phone && phoneHref ? '<a href="tel:' + escapeHtml(phoneHref) + '">' + escapeHtml(phone) + '</a>' : '';
  const addressContent = settings.address ? '<span>' + escapeHtml(settings.address) + '</span>' : '';

  return '<section class="vl-hero" aria-labelledby="vl-title">' +
      '<div class="vl-hero-copy">' +
        '<p class="vl-kicker">' + escapeHtml(eyebrow) + '</p>' +
        '<h1 id="vl-title">' + escapeHtml(heroTitle) + '</h1>' +
        '<p class="vl-hero-description">' + escapeHtml(heroDescription) + '</p>' +
         '<div class="vl-actions"><a class="vl-button vl-button-primary" href="/registro">Solicitar cuenta ' + arrow() + '</a><a class="vl-button vl-button-quiet" href="/acceso">Iniciar sesión ' + arrow(true) + '</a></div>' +
      '</div>' + heroArt +
    '</section>' +
    '<div class="vl-edition-ribbon" aria-label="Resumen de la edición">' +
      '<div><small>Edición activa</small><strong>' + escapeHtml(currentEdition) + '</strong></div>' +
      '<div><small>Destinos publicados</small><strong class="vl-ribbon-number">' + String(validDestinations.length).padStart(2, '0') + '</strong></div>' +
      '<div><small>Europa te espera</small><strong>' + escapeHtml(countryLine) + '</strong></div>' +
    '</div>' +
    '<section class="vl-story" aria-labelledby="vl-story-title">' +
      '<div class="vl-story-mark"><strong>+EU</strong><span>Aprendizaje que cruza fronteras</span></div>' +
      '<div class="vl-story-copy"><p class="vl-kicker">Una oportunidad real de aprender haciendo</p><h2 id="vl-story-title">' + escapeHtml(aboutTitle) + '</h2>' +
      '<p>' + escapeHtml(aboutText) + '</p></div>' +
    '</section>' +
    '<section class="vl-section" id="destinos" aria-labelledby="vl-destinations-title">' +
       '<div class="vl-section-heading"><div><p class="vl-kicker">Convocatoria · ' + escapeHtml(currentEdition) + '</p><h2 id="vl-destinations-title">' + escapeHtml(destinationsTitle) + '</h2></div>' +
       '<p>' + escapeHtml(destinationsDescription) + '</p></div>' +
      destinationContent +
    '</section>' +
    '<section class="vl-journey" aria-labelledby="vl-journey-title">' +
      '<div class="vl-journey-copy"><p class="vl-kicker">Con raíces en Tenerife</p><h2 id="vl-journey-title">Del aula al mundo profesional europeo.</h2>' +
      '<p>Una estancia Erasmus+ combina práctica, convivencia y mirada internacional. Desde Guía de Isora, cada movilidad conecta el talento local con otras maneras de hacer y de aprender.</p>' +
      '<div class="vl-actions"><a class="vl-button vl-button-primary" href="/registro">Da el primer paso ' + arrow() + '</a></div></div>' +
      '<div class="vl-journey-art" aria-hidden="true"><span class="vl-orbit"></span><span class="vl-orbit"></span>' +
      '<svg class="vl-route-line" viewBox="0 0 520 260"><path d="M42 210C143 74 211 72 268 138S378 184 479 45"/><circle cx="42" cy="210" r="7"/><circle cx="479" cy="45" r="7"/></svg>' +
      '<span class="vl-place vl-place-start">TFE</span><span class="vl-place vl-place-end">EU</span></div>' +
    '</section>' +
    galleryContent +
    '<section class="vl-contact" aria-labelledby="vl-contact-title"><div><p class="vl-kicker">IES Manuel Martín González</p><h2 id="vl-contact-title">' + escapeHtml(contactTitle) + '</h2>' +
      '<p>' + escapeHtml(contactDescription) + '</p>' +
      (socialLinks ? '<nav class="vl-socials" aria-label="Redes sociales">' + socialLinks + '</nav>' : '') +
    '</div><div class="vl-contact-info">' +
      contactField('Correo electrónico', emailContent) +
      contactField('Teléfono', phoneContent) +
      contactField('Dónde estamos', addressContent) +
      '<div><small>Participantes</small><a href="/acceso">Acceder a mi espacio</a></div>' +
    '</div></section>' +
    '<footer class="vl-footer"><span class="vl-footer-brand">' + escapeHtml(title) + ' · Erasmus+</span><span>Guía de Isora, Tenerife</span><a href="/privacidad">Protección de datos</a><a href="/registro">Solicitar una cuenta</a></footer>';
}
