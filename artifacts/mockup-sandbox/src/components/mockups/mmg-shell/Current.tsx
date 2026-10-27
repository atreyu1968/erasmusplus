import "./_group.css";

const studentLinks = [
  ["⌂", "Inicio"],
  ["▤", "Candidatura Erasmus"],
  ["▦", "Agenda y tareas"],
  ["⌖", "Destinos Erasmus"],
  ["✈", "Tipos de movilidad"],
  ["§", "Normativa Erasmus"],
  ["✓", "Compromisos"],
  ["♧", "Notificaciones"],
  ["▣", "Documentación"],
  ["✉", "Chat interno"],
  ["♙", "Mi perfil"],
  ["◎", "Acceso biométrico"],
];

const coordinatorLinks = [
  ["▦", "Control de cuentas"],
  ["▤", "Candidaturas recibidas"],
  ["▣", "Archivo documental"],
  ["♙", "Grupos de movilidad"],
  ["✉", "Supervisión de chat"],
  ["✓", "Autorizaciones de menores"],
  ["＋", "Crear cuenta"],
  ["⚙", "Configurar Resend"],
];

const accounts = [
  ["Lucía Martín Pérez", "Docente", "lmartin@canariaseducacion.es", "Verificado", "Aprobada"],
  ["Daniel González Acosta", "Alumnado", "dgonzalez@canariaseducacion.es", "Verificado", "Pendiente"],
  ["María Rodríguez Díaz", "Alumnado", "mrodriguez@canariaseducacion.es", "Pendiente", "Pendiente"],
];

export function Current() {
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#">
          <span className="mark">MMG+</span>
          <span><b>Movilidades Erasmus+</b><small>IES Manuel Martín González</small></span>
        </a>
        <p className="side-label">GUÍA DE ISORA · TENERIFE</p>
        <nav>
          {studentLinks.map(([icon, label], index) => (
            <a className={`nav${index === 0 ? " current" : ""}`} href="#" key={label}>
              <i>{icon}</i>{label}
            </a>
          ))}
          <div className="current-nav-divider">COORDINACIÓN</div>
          {coordinatorLinks.map(([icon, label]) => (
            <a className="nav" href="#" key={label}><i>{icon}</i>{label}</a>
          ))}
        </nav>
        <div className="sidefooter">Enriqueciendo vidas.<br />Abriendo mentes.</div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>CURSO 2026–2027</span>
          <div className="user"><span className="avatar">F</span>Francisco · Coordinación
            <button className="btn small">Cerrar sesión</button>
          </div>
        </header>
        <main>
          <div className="heading">
            <p className="eyebrow">ADMINISTRACIÓN ERASMUS+ MMG</p>
            <h1>Panel de coordinación</h1>
            <p>Registro y aprobación de cuentas. Solo podrán aprobarse usuarios con correo institucional verificado.</p>
          </div>
          <section className="metrics">
            <div><span>REGISTRADOS</span><b>24</b></div>
            <div><span>PENDIENTES</span><b>5</b></div>
            <div><span>DOCENTES</span><b>7</b></div>
            <div><span>ALUMNADO</span><b>17</b></div>
          </section>
          <section className="card">
            <div className="row">
              <h2>Control de cuentas</h2>
              <button className="btn small">+ Añadir cuenta</button>
              <button className="btn small">✓ Revisar autorizaciones</button>
              <button className="btn small">⚙ Configurar Resend</button>
            </div>
            <div className="responsive">
              <table>
                <thead><tr><th>PARTICIPANTE</th><th>CORREO</th><th>VERIFICACIÓN</th><th>ESTADO</th><th>FICHA</th><th>ACCIONES</th></tr></thead>
                <tbody>{accounts.map(([name, role, email, verification, status]) => (
                  <tr key={email}>
                    <td><b>{name}</b><small>{role}</small></td><td>{email}</td><td>{verification}</td>
                    <td><span className="pill">{status}</span></td><td><a href="#">Ver ficha</a></td>
                    <td><button className="current-text-button">Aprobar</button><button className="current-text-button">Editar</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <footer>Movilidades Erasmus+ MMG · Fase 1 de desarrollo. No introducir datos reales hasta concluir la revisión de seguridad y protección de datos.</footer>
        </main>
      </div>
    </div>
  );
}
