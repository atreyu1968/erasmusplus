import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  FileText,
  Home,
  MessageCircle,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import "./_group.css";

type Conversation = {
  id: string;
  kind: "group" | "direct";
  title: string;
  subtitle: string;
  time: string;
  preview: string;
  initials: string;
};

type Message = {
  name: string;
  text: string;
  time: string;
  mine?: boolean;
};

const conversations: Conversation[] = [
  {
    id: "mobility-nl",
    kind: "group",
    title: "Movilidad Erasmus+ · Países Bajos",
    subtitle: "Convocatoria 2026–2027",
    time: "10:29",
    preview: "Lucía: También está disponible en Documentos.",
    initials: "",
  },
  {
    id: "departure-prep",
    kind: "group",
    title: "Preparación de salida",
    subtitle: "4 participantes",
    time: "Ayer",
    preview: "Lucía: Revisaremos los permisos antes del viaje.",
    initials: "",
  },
  {
    id: "lucia",
    kind: "direct",
    title: "Lucía Fernández",
    subtitle: "Docente · Convocatoria 2026–2027",
    time: "10:29",
    preview: "También está disponible en Documentos.",
    initials: "LF",
  },
  {
    id: "daniel",
    kind: "direct",
    title: "Daniel González",
    subtitle: "Estudiante · Convocatoria 2026–2027",
    time: "Ayer",
    preview: "Gracias, revisaré la información.",
    initials: "DG",
  },
];

const initialMessages: Record<string, Message[]> = {
  "mobility-nl": [
    { name: "Lucía Fernández · Docente", text: "Hola, ya he subido la información de la reunión de preparación al espacio del grupo.", time: "10:22" },
    { name: "Tú", text: "Gracias. ¿Tenemos que llevar el permiso firmado?", time: "10:26", mine: true },
    { name: "Lucía Fernández · Docente", text: "Sí, por favor. Lo revisaremos antes de salir. También está disponible en Documentos.", time: "10:29" },
    { name: "Tú", text: "Perfecto, lo llevaré.", time: "10:32", mine: true },
  ],
  "departure-prep": [
    { name: "Lucía Fernández · Docente", text: "Revisaremos los permisos antes del viaje. Podéis consultar la lista en Documentos.", time: "Ayer" },
    { name: "Tú", text: "De acuerdo, llevaré el permiso firmado.", time: "Ayer", mine: true },
  ],
  lucia: [
    { name: "Lucía Fernández · Docente", text: "Hola, ya he subido la información de la reunión de preparación al espacio del grupo.", time: "10:22" },
    { name: "Tú", text: "Gracias. ¿Tenemos que llevar el permiso firmado?", time: "10:26", mine: true },
    { name: "Lucía Fernández · Docente", text: "Sí, por favor. Lo revisaremos antes de salir. También está disponible en Documentos.", time: "10:29" },
    { name: "Tú", text: "Perfecto, lo llevaré.", time: "10:32", mine: true },
  ],
  daniel: [
    { name: "Daniel González · Estudiante", text: "Hola, ¿has podido consultar la información de la movilidad?", time: "Ayer" },
    { name: "Tú", text: "Sí, ya la he revisado. Gracias por avisar.", time: "Ayer", mine: true },
    { name: "Daniel González · Estudiante", text: "Gracias, revisaré la información.", time: "Ayer" },
  ],
};

export function WhatsApp() {
  const [activeId, setActiveId] = useState<string | null>(() => {
    const requestedId = new URLSearchParams(window.location.search).get("chat");
    return conversations.some((conversation) => conversation.id === requestedId) ? requestedId : null;
  });
  const [activeTab, setActiveTab] = useState<"all" | "groups" | "contacts">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [messagesByConversation, setMessagesByConversation] = useState(initialMessages);
  const activeConversation = conversations.find((item) => item.id === activeId);
  const filteredConversations = useMemo(() => conversations.filter((item) => {
    const matchesTab = activeTab === "all" || (activeTab === "groups" ? item.kind === "group" : item.kind === "direct");
    const query = search.trim().toLocaleLowerCase("es");
    return matchesTab && (!query || `${item.title} ${item.subtitle} ${item.preview}`.toLocaleLowerCase("es").includes(query));
  }), [activeTab, search]);

  const openConversation = (id: string) => {
    setActiveId(id);
    setDraft("");
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;
    const nextMessage: Message = { name: "Tú", text, time: "Ahora", mine: true };
    setMessagesByConversation((current) => ({
      ...current,
      [activeId]: [...(current[activeId] ?? []), nextMessage],
    }));
    setDraft("");
  };

  return (
    <div className="wa-shell">
      <style>{`
        .wa-shell{--wa-navy:#143d6b;--wa-blue:#236cba;--wa-teal:#12a5a5;--wa-ink:#1d3149;--wa-muted:#74869a;--wa-line:#dce6ed;--wa-paper:#f2f6f9;--wa-wash:#eaf0f3;display:flex;flex-direction:column;width:100%;height:100dvh;min-height:620px;overflow:hidden;background:var(--wa-paper);color:var(--wa-ink);font-family:var(--app-font-sans, sans-serif);box-sizing:border-box}
        .wa-shell *{box-sizing:border-box}.wa-shell button,.wa-shell input,.wa-shell textarea{font:inherit}
        .wa-header{height:67px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:var(--wa-navy);color:#fff;box-shadow:0 5px 18px #1235581c}
        .wa-brand{display:flex;align-items:center;gap:10px;color:#fff;font:800 12px/1.1 var(--app-font-serif, sans-serif);letter-spacing:.01em}
        .wa-brand img{width:62px;height:40px;object-fit:contain}.wa-brand small{display:block;margin-top:4px;color:#bfd5e7;font:700 8px/1 var(--app-font-sans, sans-serif);letter-spacing:.1em;text-transform:uppercase}
        .wa-user{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#d8f2ef;color:var(--wa-navy);font-size:11px;font-weight:800}
        .wa-main{width:min(100%,620px);flex:1;min-height:0;overflow-y:auto;margin:0 auto;padding:16px 15px 12px}
        .wa-inbox-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 1px 13px}
        .wa-inbox-top h1{margin:0;color:#173e67;font:800 27px/1.15 var(--app-font-serif, sans-serif);letter-spacing:-.04em}
        .wa-inbox-top p{margin:5px 0 0;color:#718398;font-size:11px;line-height:1.5}
        .wa-mark{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:15px;background:#dff1f0;color:#138b8d}
        .wa-search{height:42px;display:flex;align-items:center;gap:9px;margin-bottom:11px;padding:0 12px;border:1px solid #d9e5ed;border-radius:13px;background:#fff;color:#74869a}
        .wa-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#1d3149;font-size:12px}
        .wa-search input::placeholder{color:#94a1ae}
        .wa-tabs{display:flex;gap:7px;overflow-x:auto;padding:0 0 13px;scrollbar-width:none}
        .wa-tab{display:flex;align-items:center;gap:7px;min-height:34px;padding:0 12px;border:1px solid #d9e5ed;border-radius:999px;background:#fff;color:#3d5870;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}
        .wa-tab.active{border-color:#b9e1de;background:#e3f3f1;color:#0d797c}
        .wa-count{min-width:18px;height:18px;display:grid;place-items:center;border-radius:99px;background:#eff4f6;color:#547084;font-size:9px}
        .wa-list-head{margin:0 0 8px;color:#173e67;font:800 14px var(--app-font-serif, sans-serif)}
        .wa-list{overflow:hidden;border:1px solid #dce6ed;border-radius:17px;background:#fff;box-shadow:0 8px 25px #123f6510}
        .wa-row{width:100%;min-height:77px;display:flex;align-items:center;gap:11px;padding:11px 12px;border:0;border-bottom:1px solid #edf1f4;background:#fff;text-align:left;cursor:pointer;transition:background .15s}
        .wa-row:last-child{border-bottom:0}.wa-row:hover{background:#f8fbfc}
        .wa-avatar{width:43px;height:43px;flex:none;display:grid;place-items:center;border-radius:15px;background:#e4f2f5;color:#1e6892;font-size:11px;font-weight:800}
        .wa-avatar.group{background:#e3f4f1;color:#137e7f}
        .wa-copy{min-width:0;flex:1}.wa-rowline{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .wa-rowline strong{overflow:hidden;color:#173e67;font-size:12px;text-overflow:ellipsis;white-space:nowrap}
        .wa-rowline time{flex:none;color:#91a0ad;font-size:9px}
        .wa-preview{display:block;overflow:hidden;margin-top:5px;color:#718398;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
        .wa-subtitle{display:block;overflow:hidden;margin-top:3px;color:#9aa8b5;font-size:9px;text-overflow:ellipsis;white-space:nowrap}
        .wa-empty{padding:24px 16px;text-align:center;color:#74869a;font-size:11px;line-height:1.5}
        .wa-empty strong{display:block;margin:7px 0 3px;color:#315b74;font-size:12px}
        .wa-chat{height:100%;min-height:0;display:flex;flex-direction:column}
        .wa-chat-head{display:flex;align-items:center;gap:10px;margin:-2px -15px 10px;padding:8px 15px 11px;border-bottom:1px solid var(--wa-line);background:var(--wa-paper)}
        .wa-back{width:40px;height:40px;flex:none;display:grid;place-items:center;border:1px solid var(--wa-line);border-radius:13px;background:#fff;color:#315b7c;cursor:pointer}
        .wa-chat-meta{min-width:0;flex:1}.wa-chat-meta strong{display:block;overflow:hidden;color:#173e67;font:800 14px/1.2 var(--app-font-serif, sans-serif);text-overflow:ellipsis;white-space:nowrap}
        .wa-chat-meta span{display:block;margin-top:3px;color:#74869a;font-size:10px}
        .wa-policy{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;padding:9px 10px;border:1px solid #d3e7e9;border-radius:11px;background:#e6f2f5;color:#315b74;font-size:9px;line-height:1.45}
        .wa-policy svg{flex:none;margin-top:1px;color:#16888d}
        .wa-thread{flex:1;min-height:210px;max-height:56vh;display:flex;flex-direction:column;gap:9px;overflow-y:auto;padding:13px 11px;border:1px solid #dce6ed;border-radius:15px;background-color:#eaf0f3;background-image:radial-gradient(#cfdbe0 0.65px,transparent .65px);background-size:13px 13px}
        .wa-bubble{max-width:88%;align-self:flex-start;padding:9px 11px;border:1px solid #e4eaee;border-radius:14px 14px 14px 4px;background:#fff;box-shadow:0 3px 10px #183c570d}
        .wa-bubble.mine{align-self:flex-end;border-color:#c7e6e3;border-radius:14px 14px 4px 14px;background:#dff2ef}
        .wa-bubble strong{display:block;margin-bottom:3px;color:#287596;font-size:9px}
        .wa-bubble p{margin:0;color:#344f64;font-size:11px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
        .wa-bubble time{display:block;margin-top:4px;color:#8191a0;font-size:8px;text-align:right}
        .wa-composer{display:flex;align-items:flex-end;gap:8px;margin-top:9px;padding:6px;border:1px solid #d9e4eb;border-radius:15px;background:#fff;box-shadow:0 5px 20px #153b600d}
        .wa-composer textarea{min-width:0;flex:1;min-height:40px;max-height:90px;padding:10px 8px;border:0;outline:0;background:transparent;color:#1d3149;resize:none;font-size:11px}
        .wa-composer textarea::placeholder{color:#8a99a7}
        .wa-send{width:42px;height:42px;flex:none;display:grid;place-items:center;border:0;border-radius:12px;background:#167ba2;color:#fff;cursor:pointer}
        .wa-send:disabled{background:#aabdc9;cursor:not-allowed}
        .wa-hint{margin:7px 4px 0;color:#8695a3;font-size:9px;text-align:center}
        .wa-nav{flex:none;display:grid;grid-template-columns:repeat(4,1fr);padding:7px 8px calc(7px + env(safe-area-inset-bottom));background:var(--wa-navy);box-shadow:0 -8px 24px #102e4d28}
        .wa-nav button{min-height:52px;display:grid;place-items:center;align-content:center;gap:4px;border:0;background:transparent;color:#c4d5e3;font-size:8px;font-weight:700;cursor:pointer}
        .wa-nav button.active{color:#7fe0dc}
        .wa-shell button:focus-visible,.wa-shell input:focus-visible,.wa-shell textarea:focus-visible{outline:3px solid #12a5a5;outline-offset:2px}
        @media(max-width:390px){.wa-main{padding-right:13px;padding-left:13px}.wa-row{gap:9px;padding-right:10px;padding-left:10px}.wa-rowline strong{font-size:11px}}
        @media(prefers-reduced-motion:reduce){.wa-row{transition:none}}
      `}</style>
      <header className="wa-header">
        <div className="wa-brand">
          <img src="/__mockup/images/mmg-mobile-logo.png" alt="" />
          <span>ERASMUS+<small>IES MMG · Móvil</small></span>
        </div>
        <span className="wa-user" aria-label="Perfil">F</span>
      </header>

      <main className="wa-main">
        {activeConversation ? (
          <section className="wa-chat" aria-label={`Conversación: ${activeConversation.title}`}>
            <div className="wa-chat-head">
              <button className="wa-back" type="button" aria-label="Volver a mensajes" onClick={() => setActiveId(null)}>
                <ArrowLeft size={19} />
              </button>
              <span className={`wa-avatar${activeConversation.kind === "group" ? " group" : ""}`}>
                {activeConversation.kind === "group" ? <Users size={19} /> : activeConversation.initials}
              </span>
              <div className="wa-chat-meta">
                <strong>{activeConversation.title}</strong>
                <span>{activeConversation.kind === "group" ? "Grupo autorizado" : "Mensaje directo"}</span>
              </div>
            </div>
            <div className="wa-policy" role="note">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Coordinación puede supervisar los mensajes según el protocolo del centro. El acceso queda registrado.</span>
            </div>
            <div className="wa-thread" aria-live="polite" aria-label="Mensajes de la conversación">
              {(messagesByConversation[activeConversation.id] ?? []).map((message, index) => (
                <article className={`wa-bubble${message.mine ? " mine" : ""}`} key={`${activeConversation.id}-${index}`}>
                  {!message.mine && <strong>{message.name}</strong>}
                  <p>{message.text}</p>
                  <time>{message.time}</time>
                </article>
              ))}
            </div>
            <form className="wa-composer" onSubmit={sendMessage}>
              <textarea
                aria-label="Escribe un mensaje"
                maxLength={2500}
                placeholder="Escribe un mensaje…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button className="wa-send" type="submit" aria-label="Enviar mensaje" disabled={!draft.trim()}>
                <Send size={17} />
              </button>
            </form>
            <p className="wa-hint">Mensajes compartidos solo con personas autorizadas.</p>
          </section>
        ) : (
          <>
            <div className="wa-inbox-top">
              <div><h1>Mensajes</h1><p>Tus conversaciones autorizadas, en un solo lugar.</p></div>
              <span className="wa-mark"><MessageCircle size={20} /></span>
            </div>
            <label className="wa-search">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Buscar conversaciones" placeholder="Buscar conversación" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <div className="wa-tabs" role="tablist" aria-label="Filtrar conversaciones">
              {([
                ["all", "Todo", conversations.length],
                ["groups", "Grupos", conversations.filter((item) => item.kind === "group").length],
                ["contacts", "Contactos", conversations.filter((item) => item.kind === "direct").length],
              ] as const).map(([tab, label, count]) => (
                <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`wa-tab${activeTab === tab ? " active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {label}<span className="wa-count">{count}</span>
                </button>
              ))}
            </div>
            <h2 className="wa-list-head">{activeTab === "contacts" ? "Contactos" : activeTab === "groups" ? "Grupos" : "Conversaciones"}</h2>
            {filteredConversations.length ? (
              <div className="wa-list">
                {filteredConversations.map((conversation) => (
                  <button className="wa-row" type="button" key={conversation.id} onClick={() => openConversation(conversation.id)}>
                    <span className={`wa-avatar${conversation.kind === "group" ? " group" : ""}`}>
                      {conversation.kind === "group" ? <Users size={18} /> : conversation.initials}
                    </span>
                    <span className="wa-copy">
                      <span className="wa-rowline"><strong>{conversation.title}</strong><time>{conversation.time}</time></span>
                      <span className="wa-preview">{conversation.preview}</span>
                      <span className="wa-subtitle">{conversation.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="wa-list wa-empty">
                <MessageCircle size={20} aria-hidden="true" />
                <strong>Sin conversaciones</strong>
                No hay resultados para esta búsqueda.
              </div>
            )}
          </>
        )}
      </main>
      <nav className="wa-nav" aria-label="Navegación móvil">
        <button type="button" aria-label="Inicio"><Home size={18} />Inicio</button>
        <button type="button" aria-label="Documentos"><FileText size={18} />Documentos</button>
        <button type="button" className="active" aria-current="page"><MessageCircle size={18} />Mensajes</button>
        <button type="button" aria-label="Perfil"><Settings size={18} />Perfil</button>
      </nav>
    </div>
  );
}
