import { ArrowLeft, FileText, Home, MessageCircle, Send, Settings, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import "./_group.css";

const groups = [
  { title: "Movilidad Erasmus+ · Países Bajos", time: "10:29", preview: "También está disponible en Documentos.", detail: "Convocatoria 2026–2027" },
  { title: "Preparación de salida", time: "Ayer", preview: "Revisaremos los permisos antes del viaje.", detail: "4 participantes" },
];
const contacts = [
  { title: "Lucía Fernández", detail: "Docente · Convocatoria 2026–2027" },
  { title: "Daniel González", detail: "Estudiante · Convocatoria 2026–2027" },
];
const messages = [
  { name: "Lucía Fernández · Docente", text: "Hola, ya he subido la información de la reunión de preparación al espacio del grupo.", time: "10:22", mine: false },
  { name: "Tú", text: "Gracias. ¿Tenemos que llevar el permiso firmado?", time: "10:26", mine: true },
  { name: "Lucía Fernández · Docente", text: "Sí, por favor. Lo revisaremos antes de salir. También está disponible en Documentos.", time: "10:29", mine: false },
  { name: "Tú", text: "Perfecto, lo llevaré.", time: "10:32", mine: true },
];

export function Current() {
  const [open, setOpen] = useState(false);

  return (
    <div className="extract-shell">
      <header className="extract-header">
        <a className="extract-brand" href="#">
          <img src="/__mockup/images/mmg-mobile-logo.png" alt="" />
          <span>ERASMUS+<small>IES MMG · Móvil</small></span>
        </a>
        <span className="extract-user" aria-label="Perfil">F</span>
      </header>
      <main className="extract-content">
        {!open ? (
          <>
            <p className="extract-eyebrow">IES MMG · Comunicación</p>
            <h1 className="extract-title">Mensajes</h1>
            <p className="extract-lede">Tus conversaciones autorizadas, en un solo lugar.</p>
            <div className="extract-tabs"><span className="selected">Grupos · 2</span><span>Contactos · 2</span></div>
            <section className="extract-section">
              <h2>Grupos</h2><p>Conversaciones de tus movilidades</p>
              {groups.map((group) => (
                <a href="#" className="extract-row" key={group.title} onClick={(event) => { event.preventDefault(); setOpen(true); }}>
                  <span className="extract-avatar group"><Users size={18} /></span>
                  <span className="extract-row-copy"><span className="extract-row-head"><strong>{group.title}</strong><time>{group.time}</time></span><span>{group.preview}</span></span>
                </a>
              ))}
            </section>
            <section className="extract-section">
              <h2>Contactos</h2><p>Personas de tu entorno Erasmus+</p>
              {contacts.map((contact) => (
                <a href="#" className="extract-row" key={contact.title} onClick={(event) => { event.preventDefault(); setOpen(true); }}>
                  <span className="extract-avatar">{contact.title.split(" ").map((word) => word[0]).join("")}</span>
                  <span className="extract-row-copy"><span className="extract-row-head"><strong>{contact.title}</strong></span><span>{contact.detail}</span></span>
                </a>
              ))}
            </section>
          </>
        ) : (
          <>
            <div className="extract-chat-head">
              <button className="extract-back" type="button" aria-label="Volver a mensajes" onClick={() => setOpen(false)}><ArrowLeft size={17} /></button>
              <span className="extract-avatar">LF</span>
              <span className="extract-chat-person"><strong>Lucía Fernández</strong><span>Mensaje directo</span></span>
            </div>
            <div className="extract-policy" role="note"><ShieldCheck size={14} />Según el protocolo del centro, Coordinación puede supervisar los mensajes de esta conversación. El acceso queda registrado. No se crean copias ocultas.</div>
            <div className="extract-thread" aria-live="polite">
              {messages.map((message, index) => (
                <article className={`extract-bubble${message.mine ? " mine" : ""}`} key={index}>
                  {!message.mine && <strong>{message.name}</strong>}
                  <p>{message.text}</p><time>{message.time}</time>
                </article>
              ))}
            </div>
            <form className="extract-composer" onSubmit={(event) => event.preventDefault()}>
              <textarea aria-label="Escribe un mensaje" placeholder="Escribe un mensaje…" />
              <button type="button" aria-label="Enviar mensaje"><Send size={16} /></button>
            </form>
            <p className="extract-hint">Los mensajes se comparten solo con las personas autorizadas.</p>
          </>
        )}
      </main>
      <nav className="extract-nav" aria-label="Navegación móvil">
        <a href="#"><Home size={18} />Inicio</a><a href="#"><FileText size={18} />Documentos</a><a className="active" href="#"><MessageCircle size={18} />Mensajes</a><a href="#"><Settings size={18} />Perfil</a>
      </nav>
    </div>
  );
}
