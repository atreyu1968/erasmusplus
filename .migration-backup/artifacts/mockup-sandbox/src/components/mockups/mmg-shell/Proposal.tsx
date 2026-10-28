import { useState } from "react";

const studentLinks = [
  ["home", "Inicio"],
  ["application", "Candidatura Erasmus"],
  ["calendar", "Agenda y tareas"],
  ["pin", "Destinos Erasmus"],
  ["plane", "Tipos de movilidad"],
  ["rules", "Normativa Erasmus"],
  ["check", "Compromisos"],
  ["bell", "Notificaciones"],
  ["folder", "Documentación"],
  ["chat", "Chat interno"],
  ["profile", "Mi perfil"],
  ["access", "Acceso biométrico"],
] as const;

const coordinatorLinks = [
  ["accounts", "Control de cuentas"],
  ["application", "Candidaturas recibidas"],
  ["folder", "Archivo documental"],
  ["group", "Grupos de movilidad"],
  ["chat", "Supervisión de chat"],
  ["check", "Autorizaciones de menores"],
  ["add", "Crear cuenta"],
  ["settings", "Configurar Resend"],
] as const;

const accounts = [
  { name: "Lucía Martín Pérez", role: "Docente", email: "lmartin@canariaseducacion.es", verification: "Verificado", status: "Aprobada" },
  { name: "Daniel González Acosta", role: "Alumnado", email: "dgonzalez@canariaseducacion.es", verification: "Verificado", status: "Pendiente" },
  { name: "María Rodríguez Díaz", role: "Alumnado", email: "mrodriguez@canariaseducacion.es", verification: "Pendiente", status: "Pendiente" },
];

const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M9 21v-7h6v7",
  application: "M7 3h10l4 4v14H3V3h4Zm0 0v5h10V3M7 13h10M7 17h7",
  calendar: "M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2",
  pin: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  plane: "m3 12 18-8-7 18-3-7-8-3Zm8 3 5-5",
  rules: "M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4",
  check: "m5 12 4 4L19 6",
  bell: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4",
  folder: "M3 6h7l2 2h9v11H3z",
  chat: "M4 5h16v12H9l-5 4zM8 9h8m-8 4h6",
  profile: "M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  access: "M12 3a9 9 0 1 0 9 9m-9-4v5l4 2m3-11h4m-2-2v4",
  accounts: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3h2a3 3 0 0 1 3 3v1",
  group: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-6v6m-3-3h6",
  add: "M12 5v14m-7-7h14",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64",
  search: "m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  chevron: "m9 18 6-6-6-6",
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] ?? paths.application} />
    </svg>
  );
}

export function Proposal() {
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const showActionNote = (label: string) => {
    setNotice(`${label} · acción disponible en el panel de coordinación.`);
    window.setTimeout(() => setNotice(""), 3200);
  };

  return (
    <div className="mmg-proposal">
      <style>{`
        .mmg-proposal {
          --mmg-navy:#143d6b; --mmg-blue:#236cba; --mmg-teal:#12a5a5;
          --mmg-ink:#203951; --mmg-muted:#71849a; --mmg-line:#e0e9f1;
          --mmg-canvas:#f2f6fa; --mmg-white:#fff;
          min-height:100vh; background:var(--mmg-canvas); color:var(--mmg-ink);
          font:13px/1.45 "DM Sans", "Segoe UI", sans-serif; display:flex; flex-direction:column;
        }
        .mmg-proposal * { box-sizing:border-box; }
        .mmg-proposal button { font:inherit; cursor:pointer; }
        .mmg-topbar { height:62px; flex:none; background:var(--mmg-navy); color:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 24px; box-shadow:0 2px 8px #102f501f; z-index:2; }
        .mmg-brandline { display:flex; align-items:center; gap:12px; min-width:0; }
        .mmg-brandmark { display:grid; place-items:center; width:36px; height:36px; background:#fff; border-radius:9px; color:var(--mmg-navy); font-size:12px; font-weight:900; letter-spacing:-.5px; }
        .mmg-brandname { font-size:13px; font-weight:750; white-space:nowrap; }
        .mmg-brandname small { display:block; color:#bfd3e7; font-size:10px; font-weight:450; margin-top:2px; }
        .mmg-course { margin-left:26px; padding-left:25px; border-left:1px solid #ffffff38; color:#d4e2ef; font-size:10px; font-weight:750; letter-spacing:1.2px; white-space:nowrap; }
        .mmg-userline { display:flex; align-items:center; gap:11px; font-size:11px; color:#e8f0f7; }
        .mmg-usercircle { width:30px; height:30px; display:grid; place-items:center; border-radius:50%; background:#d6edf0; color:var(--mmg-navy); font-weight:800; }
        .mmg-signout { border:1px solid #ffffff50; background:transparent; color:white; border-radius:6px; padding:7px 10px; font-size:10px!important; margin-left:8px; }
        .mmg-body { flex:1; min-height:calc(100vh - 62px); display:grid; grid-template-columns:68px minmax(0,1fr); }
        .mmg-rail { background:#fff; border-right:1px solid var(--mmg-line); display:flex; flex-direction:column; align-items:center; padding:14px 8px; gap:6px; }
        .mmg-railmark { font-size:9px; color:#9aabba; font-weight:800; letter-spacing:.8px; margin:0 0 5px; }
        .mmg-railbutton { width:42px; height:39px; border:0; color:#768ba0; display:grid; place-items:center; background:transparent; border-radius:8px; position:relative; text-decoration:none; }
        .mmg-railbutton:hover { background:#eef5fb; color:var(--mmg-blue); }
        .mmg-railbutton.active { background:#eaf3fc; color:var(--mmg-blue); }
        .mmg-railbutton.active:before { content:""; position:absolute; left:-8px; height:22px; width:3px; border-radius:0 3px 3px 0; background:var(--mmg-teal); }
        .mmg-raildivider { width:30px; height:1px; background:var(--mmg-line); margin:8px 0; }
        .mmg-work { min-width:0; padding:26px 34px 18px; max-width:1540px; width:100%; margin:0 auto; }
        .mmg-crumb { color:#8a9bae; font-size:10px; display:flex; align-items:center; gap:6px; margin:0 0 10px; }
        .mmg-crumb strong { color:var(--mmg-blue); font-weight:700; }
        .mmg-pagehead { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:21px; }
        .mmg-overline { color:var(--mmg-teal); font-weight:800; letter-spacing:1.25px; font-size:9px; margin:0 0 5px; }
        .mmg-pagehead h1 { color:var(--mmg-navy); font-size:27px; letter-spacing:-.8px; line-height:1.15; margin:0; }
        .mmg-pagehead p { color:var(--mmg-muted); font-size:11px; margin:7px 0 0; }
        .mmg-head-meta { display:flex; align-items:center; gap:9px; color:#71849a; font-size:10px; white-space:nowrap; }
        .mmg-live-dot { width:7px; height:7px; display:inline-block; border-radius:50%; background:var(--mmg-teal); margin-right:5px; }
        .mmg-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:19px; }
        .mmg-stat { background:#fff; border:1px solid var(--mmg-line); border-radius:9px; min-height:77px; padding:14px 15px; display:flex; align-items:center; gap:12px; }
        .mmg-stat-icon { width:34px; height:34px; flex:none; display:grid; place-items:center; color:var(--mmg-blue); background:#edf5fc; border-radius:8px; }
        .mmg-stat:nth-child(2) .mmg-stat-icon { color:#aa7628; background:#fff5e5; }
        .mmg-stat:nth-child(3) .mmg-stat-icon { color:#168277; background:#e7f6f3; }
        .mmg-stat:nth-child(4) .mmg-stat-icon { color:#5977a0; background:#edf1f8; }
        .mmg-stat-label { display:block; color:#75879b; font-weight:750; font-size:9px; letter-spacing:.7px; }
        .mmg-stat-value { display:block; color:var(--mmg-navy); font-size:21px; font-weight:800; line-height:1.2; margin-top:2px; }
        .mmg-panel { background:#fff; border:1px solid var(--mmg-line); border-radius:10px; overflow:hidden; box-shadow:0 3px 14px #193e5c08; }
        .mmg-panelhead { padding:16px 18px; display:flex; align-items:center; justify-content:space-between; gap:14px; border-bottom:1px solid var(--mmg-line); }
        .mmg-panel-title { display:flex; align-items:center; gap:10px; min-width:0; }
        .mmg-panel-title h2 { color:var(--mmg-navy); margin:0; font-size:15px; letter-spacing:-.2px; }
        .mmg-count { padding:3px 7px; border-radius:12px; color:#5f7890; background:#f0f4f8; font-size:9px; font-weight:750; white-space:nowrap; }
        .mmg-actions { display:flex; justify-content:flex-end; gap:7px; flex-wrap:wrap; }
        .mmg-action { min-height:31px; border:1px solid #d7e2ed; background:#fff; color:var(--mmg-blue); padding:6px 10px; border-radius:6px; font-size:10px!important; font-weight:700; display:inline-flex; align-items:center; gap:6px; }
        .mmg-action:hover { background:#f3f8fc; border-color:#a9c6df; }
        .mmg-action.primary { background:var(--mmg-blue); border-color:var(--mmg-blue); color:#fff; }
        .mmg-action.primary:hover { background:#1c5d9f; }
        .mmg-tablewrap { width:100%; overflow-x:auto; }
        .mmg-table { border-collapse:collapse; width:100%; min-width:760px; }
        .mmg-table th { text-align:left; padding:11px 13px; background:#f7f9fb; color:#7d8ea0; font-size:8px; letter-spacing:.7px; font-weight:800; white-space:nowrap; border-bottom:1px solid var(--mmg-line); }
        .mmg-table td { padding:13px; border-bottom:1px solid #edf1f5; font-size:10px; color:#5d7186; vertical-align:middle; }
        .mmg-table tbody tr:last-child td { border-bottom:0; }
        .mmg-table tbody tr:hover { background:#fbfdff; }
        .mmg-person { display:flex; align-items:center; gap:10px; min-width:175px; }
        .mmg-personmark { width:31px; height:31px; border-radius:8px; display:grid; place-items:center; color:#2c6598; background:#eaf2f9; font-size:10px; font-weight:800; flex:none; }
        .mmg-person strong { display:block; color:#29435d; font-size:10px; font-weight:750; }
        .mmg-person small { display:block; color:#8b9aac; margin-top:3px; font-size:9px; }
        .mmg-email { white-space:nowrap; color:#526d85; }
        .mmg-status { display:inline-flex; align-items:center; gap:5px; border-radius:12px; padding:4px 8px; font-size:9px; font-weight:750; white-space:nowrap; }
        .mmg-status:before { content:""; width:5px; height:5px; border-radius:50%; background:currentColor; }
        .mmg-status.verified { color:#19806e; background:#e9f6f2; }
        .mmg-status.unverified { color:#a36c1e; background:#fff4df; }
        .mmg-status.approved { color:#19806e; background:#e9f6f2; }
        .mmg-status.pending { color:#a36c1e; background:#fff4df; }
        .mmg-record { color:var(--mmg-blue); font-size:10px; font-weight:750; text-decoration:none; white-space:nowrap; }
        .mmg-record:hover { text-decoration:underline; }
        .mmg-rowactions { display:flex; align-items:center; gap:5px; white-space:nowrap; }
        .mmg-textaction { background:transparent; border:0; color:var(--mmg-blue); padding:4px 5px; border-radius:4px; font-size:10px!important; font-weight:750; }
        .mmg-textaction:hover { background:#eaf3fc; }
        .mmg-footer { color:#94a2b1; margin-top:14px; padding:11px 4px 0; border-top:1px solid #dfe7ee; font-size:9px; line-height:1.6; text-align:center; }
        .mmg-notice { position:fixed; z-index:10; right:18px; bottom:18px; max-width:min(380px,calc(100vw - 36px)); padding:12px 15px; border-radius:8px; background:var(--mmg-navy); color:#fff; box-shadow:0 8px 24px #112f4c35; font-size:11px; }
        .mmg-mobiletoggle { display:none; }
        .mmg-proposal button:focus-visible,.mmg-proposal a:focus-visible { outline:3px solid #42bfc1; outline-offset:2px; }
        @media(max-width:900px) {
          .mmg-work { padding:22px 20px 16px; }
          .mmg-panelhead { align-items:flex-start; flex-direction:column; }
          .mmg-actions { justify-content:flex-start; }
        }
        @media(max-width:680px) {
          .mmg-topbar { height:58px; padding:0 13px; }
          .mmg-brandmark { width:32px; height:32px; }
          .mmg-brandname { font-size:11px; }
          .mmg-brandname small { font-size:9px; }
          .mmg-course { display:none; }
          .mmg-userline { gap:7px; font-size:10px; }
          .mmg-userline .mmg-userlabel { display:none; }
          .mmg-signout { padding:6px 7px; margin-left:1px; }
          .mmg-body { display:block; min-height:calc(100vh - 58px); }
          .mmg-mobiletoggle { display:flex; width:100%; justify-content:space-between; align-items:center; border:0; border-bottom:1px solid var(--mmg-line); padding:9px 14px; color:var(--mmg-navy); background:#fff; font-size:11px; font-weight:750; }
          .mmg-rail { display:none; align-items:stretch; padding:8px 12px; flex-direction:row; flex-wrap:wrap; gap:5px; }
          .mmg-rail.open { display:flex; }
          .mmg-railmark,.mmg-raildivider { display:none; }
          .mmg-railbutton { width:39px; height:37px; }
          .mmg-railbutton.active:before { left:8px; top:-8px; height:3px; width:22px; border-radius:0 0 3px 3px; }
          .mmg-work { padding:19px 13px 14px; }
          .mmg-pagehead { align-items:flex-start; flex-direction:column; gap:7px; margin-bottom:15px; }
          .mmg-pagehead h1 { font-size:23px; }
          .mmg-head-meta { display:none; }
          .mmg-stats { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:13px; }
          .mmg-stat { padding:10px; min-height:67px; gap:9px; }
          .mmg-stat-icon { width:30px; height:30px; }
          .mmg-stat-value { font-size:18px; }
          .mmg-panelhead { padding:13px; gap:11px; }
          .mmg-actions { gap:6px; }
          .mmg-action { padding:6px 8px; font-size:9px!important; }
          .mmg-footer { font-size:8px; }
        }
        @media(prefers-reduced-motion:reduce) { .mmg-proposal *, .mmg-proposal *:before, .mmg-proposal *:after { scroll-behavior:auto!important; } }
      `}</style>
      <header className="mmg-topbar">
        <div className="mmg-brandline">
          <span className="mmg-brandmark">MMG+</span>
          <span className="mmg-brandname">Movilidades Erasmus+<small>IES Manuel Martín González</small></span>
          <span className="mmg-course">CURSO 2026–2027</span>
        </div>
        <div className="mmg-userline">
          <span className="mmg-usercircle">F</span>
          <span className="mmg-userlabel">Francisco · Coordinación</span>
          <button className="mmg-signout" type="button" onClick={() => showActionNote("Cerrar sesión")}>Cerrar sesión</button>
        </div>
      </header>
      <div className="mmg-body">
        <button className="mmg-mobiletoggle" type="button" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          <span>Navegación</span><Icon name="chevron" size={15} />
        </button>
        <nav className={`mmg-rail${mobileNavOpen ? " open" : ""}`} aria-label="Navegación principal">
          <span className="mmg-railmark">MMG</span>
          {studentLinks.map(([icon, label]) => (
            <a key={label} className="mmg-railbutton" href="#" title={label} aria-label={label} onClick={(event) => event.preventDefault()}>
              <Icon name={icon} />
            </a>
          ))}
          <span className="mmg-raildivider" aria-hidden="true" />
          {coordinatorLinks.map(([icon, label], index) => (
            <a key={label} className={`mmg-railbutton${index === 0 ? " active" : ""}`} href="#" title={label} aria-label={label} onClick={(event) => event.preventDefault()}>
              <Icon name={icon} />
            </a>
          ))}
        </nav>
        <main className="mmg-work">
          <div className="mmg-crumb">Coordinación <Icon name="chevron" size={12} /> <strong>Control de cuentas</strong></div>
          <section className="mmg-pagehead">
            <div>
              <p className="mmg-overline">ADMINISTRACIÓN ERASMUS+ MMG</p>
              <h1>Panel de coordinación</h1>
              <p>Registro y aprobación de cuentas. Solo podrán aprobarse usuarios con correo institucional verificado.</p>
            </div>
            <div className="mmg-head-meta"><span><i className="mmg-live-dot" />Gestión de cuentas</span></div>
          </section>
          <section className="mmg-stats" aria-label="Resumen de cuentas">
            <div className="mmg-stat"><span className="mmg-stat-icon"><Icon name="accounts" /></span><span><span className="mmg-stat-label">REGISTRADOS</span><strong className="mmg-stat-value">24</strong></span></div>
            <div className="mmg-stat"><span className="mmg-stat-icon"><Icon name="calendar" /></span><span><span className="mmg-stat-label">PENDIENTES</span><strong className="mmg-stat-value">5</strong></span></div>
            <div className="mmg-stat"><span className="mmg-stat-icon"><Icon name="profile" /></span><span><span className="mmg-stat-label">DOCENTES</span><strong className="mmg-stat-value">7</strong></span></div>
            <div className="mmg-stat"><span className="mmg-stat-icon"><Icon name="group" /></span><span><span className="mmg-stat-label">ALUMNADO</span><strong className="mmg-stat-value">17</strong></span></div>
          </section>
          <section className="mmg-panel" aria-labelledby="accounts-title">
            <div className="mmg-panelhead">
              <div className="mmg-panel-title"><h2 id="accounts-title">Control de cuentas</h2><span className="mmg-count">3 registros</span></div>
              <div className="mmg-actions">
                <button className="mmg-action primary" type="button" onClick={() => showActionNote("Añadir cuenta")}><Icon name="add" size={14} />Añadir cuenta</button>
                <button className="mmg-action" type="button" onClick={() => showActionNote("Revisar autorizaciones")}><Icon name="check" size={14} />Revisar autorizaciones</button>
                <button className="mmg-action" type="button" onClick={() => showActionNote("Configurar Resend")}><Icon name="settings" size={14} />Configurar Resend</button>
              </div>
            </div>
            <div className="mmg-tablewrap">
              <table className="mmg-table">
                <thead><tr><th>PARTICIPANTE</th><th>CORREO</th><th>VERIFICACIÓN</th><th>ESTADO</th><th>FICHA</th><th>ACCIONES</th></tr></thead>
                <tbody>{accounts.map((account) => (
                  <tr key={account.email}>
                    <td><div className="mmg-person"><span className="mmg-personmark">{account.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{account.name}</strong><small>{account.role}</small></span></div></td>
                    <td className="mmg-email">{account.email}</td>
                    <td><span className={`mmg-status ${account.verification === "Verificado" ? "verified" : "unverified"}`}>{account.verification}</span></td>
                    <td><span className={`mmg-status ${account.status === "Aprobada" ? "approved" : "pending"}`}>{account.status}</span></td>
                    <td><a className="mmg-record" href="#" onClick={(event) => { event.preventDefault(); showActionNote("Ver ficha"); }}>Ver ficha</a></td>
                    <td><div className="mmg-rowactions"><button className="mmg-textaction" type="button" onClick={() => showActionNote("Aprobar")}>Aprobar</button><button className="mmg-textaction" type="button" onClick={() => showActionNote("Editar")}>Editar</button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <footer className="mmg-footer">Movilidades Erasmus+ MMG · Fase 1 de desarrollo. No introducir datos reales hasta concluir la revisión de seguridad y protección de datos.</footer>
        </main>
      </div>
      {notice && <div className="mmg-notice" role="status">{notice}</div>}
    </div>
  );
}
