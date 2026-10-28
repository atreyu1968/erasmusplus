import { ArrowLeft, FileText, Home, MessageCircle, MoreVertical, Paperclip, Phone, Send, Settings, ShieldCheck } from "lucide-react";
import "./_group.css";

const messages = [
  { sender: "Lucía Fernández · Docente", text: "Hola, ya he subido la información de la reunión de preparación al espacio del grupo.", time: "10:22", mine: false },
  { sender: "Tú", text: "Gracias. ¿Tenemos que llevar el permiso firmado?", time: "10:26", mine: true },
  { sender: "Lucía Fernández · Docente", text: "Sí, por favor. Lo revisaremos antes de salir. También está disponible en Documentos.", time: "10:29", mine: false },
  { sender: "Tú", text: "Perfecto, lo llevaré.", time: "10:32", mine: true },
];

export function Coordination() {
  return (
    <div className="proposal-mockup">
      <header className="proposal-top">
        <a className="mockup-brand" href="#">
          <img src="/__mockup/images/mmg-mobile-logo.png" alt="" />
          <span>ERASMUS+<small>IES MMG · Móvil</small></span>
        </a>
        <button className="header-action" type="button" aria-label="Opciones"><MoreVertical size={17} /></button>
      </header>
      <main className="proposal-content">
        <div className="proposal-toolbar">
          <button type="button" aria-label="Volver a conversaciones"><ArrowLeft size={17} /></button>
          <div className="mockup-avatar">LF</div>
          <div className="person">
            <h1>Lucía Fernández</h1>
            <p><span className="presence" />Docente · Convocatoria 2026–2027</p>
          </div>
          <div className="proposal-tools">
            <button type="button" aria-label="Llamar"><Phone size={15} /></button>
            <button type="button" aria-label="Más opciones"><MoreVertical size={15} /></button>
          </div>
        </div>
        <div className="proposal-policy" role="note">
          <ShieldCheck size={15} />
          <span>Conversación sujeta al protocolo de comunicación del centro. La supervisión autorizada queda registrada.</span>
        </div>
        <section className="proposal-thread" aria-live="polite">
          <div className="thread-day">Hoy · 28 de octubre</div>
          {messages.map((message, index) => (
            <article className={`proposal-message ${message.mine ? "mine" : ""}`} key={index}>
              {!message.mine && <p className="sender">{message.sender}</p>}
              <div className="bubble"><p>{message.text}</p><time>{message.time}</time></div>
            </article>
          ))}
        </section>
        <form className="proposal-composer">
          <button type="button" aria-label="Adjuntar archivo" style={{ background: "transparent", color: "#6d8095" }}><Paperclip size={17} /></button>
          <textarea aria-label="Escribe un mensaje" placeholder="Escribe un mensaje…" />
          <button type="button" aria-label="Enviar mensaje"><Send size={17} /></button>
        </form>
        <p className="proposal-hint">Los mensajes se compartirán solo con las personas autorizadas.</p>
      </main>
      <nav className="proposal-bottom" aria-label="Navegación móvil">
        <a href="#"><Home size={18} />Inicio</a>
        <a href="#"><FileText size={18} />Documentos</a>
        <a className="active" href="#"><MessageCircle size={18} />Mensajes</a>
        <a href="#"><Settings size={18} />Perfil</a>
      </nav>
    </div>
  );
}
