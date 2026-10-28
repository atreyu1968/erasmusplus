import { ArrowLeft, ArrowRight, FileText, Home, MessageCircle, Send, Settings, ShieldCheck } from "lucide-react";
import "./_group.css";

const messages = [
  { name: "Lucía Fernández · Docente", text: "Hola, ya he subido la información de la reunión de preparación al espacio del grupo.", time: "10:22", mine: false },
  { name: "Tú", text: "Gracias. ¿Tenemos que llevar el permiso firmado?", time: "10:26", mine: true },
  { name: "Lucía Fernández · Docente", text: "Sí, por favor. Lo revisaremos antes de salir. También está disponible en Documentos.", time: "10:29", mine: false },
  { name: "Tú", text: "Perfecto, lo llevaré.", time: "10:32", mine: true },
];

export function Current() {
  return (
    <div className="current-mockup">
      <header className="current-top">
        <a className="mockup-brand" href="#">
          <img src="/__mockup/images/mmg-mobile-logo.png" alt="" />
          <span>ERASMUS+<small>IES MMG · Móvil</small></span>
        </a>
        <button type="button">Perfil</button>
      </header>
      <main className="mockup-content">
        <a className="current-back" href="#"><ArrowLeft size={14} /> Volver a mensajes</a>
        <div className="current-head">
          <div className="mockup-avatar">LF</div>
          <div><h1>Lucía Fernández</h1><span>Mensaje directo</span></div>
        </div>
        <div className="current-notice" role="note">
          Según el protocolo del centro, Coordinación puede supervisar los mensajes de esta conversación. El acceso queda registrado. No se crean copias ocultas de los mensajes.
        </div>
        <div className="current-thread" aria-live="polite">
          {messages.map((message, index) => (
            <article className={`current-bubble ${message.mine ? "mine" : ""}`} key={index}>
              <strong>{message.name}</strong><p>{message.text}</p><time>{message.time}</time>
            </article>
          ))}
        </div>
        <form className="current-composer">
          <textarea aria-label="Escribe un mensaje" placeholder="Escribe un mensaje…" />
          <button type="button" aria-label="Enviar mensaje"><Send size={17} /></button>
        </form>
      </main>
      <nav className="current-bottom" aria-label="Navegación móvil">
        <a href="#"><Home size={18} />Inicio</a>
        <a href="#"><FileText size={18} />Documentos</a>
        <a className="active" href="#"><MessageCircle size={18} />Mensajes</a>
        <a href="#"><Settings size={18} />Perfil</a>
      </nav>
    </div>
  );
}
