import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronRight, FileText, Fingerprint, Home, LogIn, LogOut,
  MessageCircle, Search, Send, Settings, ShieldCheck, Users, X,
} from 'lucide-react';
import {
  getGetMobileConversationDirectoryQueryKey, getGetMobileConversationMessagesQueryKey,
  getGetMobileDashboardQueryKey, getGetMobilePasskeysQueryKey,
  getGetMobileSessionQueryKey,
  useCompleteMobileTask, useCreateMobileSession, useDeleteMobilePasskey, useDeleteMobilePushSubscription,
  useDeleteMobileSession, useGetMobileConversationDirectory,
  useFinishMobilePasskeyLogin, useFinishMobilePasskeyRegistration,
  useGetMobileConversationMessages, useGetMobileDashboard, useGetMobileDocuments,
  useGetMobilePasskeys, useGetMobilePushConfig, useGetMobileSession,
  useStartMobilePasskeyLogin, useStartMobilePasskeyRegistration,
  useSaveMobilePushSubscription, useSendMobileMessage,
} from '@workspace/api-client-react';
import type { MobileAction, MobilePasskeyStartResult, MobilePushSubscriptionInput, MobileUser } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });

const logo = `${import.meta.env.BASE_URL}erasmus-logo.png`;
const dateLabel = (date: string | null | undefined) => date ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(date)) : '';
const dateTimeLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const clockLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
const conversationTimeLabel = (date: string | null | undefined) => {
  if (!date) return '';
  const value = new Date(date);
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return clockLabel(date);
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(value);
};
const messageDayLabel = (date: string) => {
  const value = new Date(date);
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === yesterday.toDateString()) return 'Ayer';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(value);
};
const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const roleLabel = (role: string) => ({ student: 'Estudiante', teacher: 'Docente', coordinator: 'Coordinación' }[role] ?? role);
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const navigationItems = [
  { href: '/inicio', label: 'Inicio', icon: Home },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
  { href: '/perfil', label: 'Perfil', icon: Settings },
];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/acceso" component={LoginPage} />
          <Route path="/"><EntryRoute /></Route>
          <Route><PrivateShell /></Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

function Header({ user }: { user?: { firstName: string; lastName: string } | null }) {
  const [path] = useLocation();
  return (
    <header className="top-nav">
      <Link href="/" className="brand"><img src={logo} alt="IES Manuel Martín González" /><span>ERASMUS+<small>IES MMG · Móvil</small></span></Link>
      <nav className="nav-links" aria-label="Navegación principal">
        {navigationItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${path.startsWith(href) ? 'active' : ''}`}><Icon size={16} />{label}</Link>)}
      </nav>
      <div className="nav-actions">
        {user ? <Link href="/perfil" aria-label="Abrir perfil" className="avatar">{initials(fullName(user))}</Link> : <Link href="/acceso" className="button secondary"><LogIn size={15} /> Acceso</Link>}
      </div>
    </header>
  );
}

function BottomNavigation({ user }: { user?: { firstName: string; lastName: string } | null }) {
  const [path] = useLocation();
  if (!user) return null;
  return <nav className="bottom-nav" aria-label="Navegación móvil">{navigationItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path.startsWith(href) ? 'active' : ''}><Icon /><span>{label}</span></Link>)}</nav>;
}

function PageFrame({ children, user, className = '', showFooter = true }: { children: ReactNode; user?: { firstName: string; lastName: string } | null; className?: string; showFooter?: boolean }) {
  return <div className="app-shell"><Header user={user} /><main className={`content ${className}`.trim()}>{children}{showFooter && <footer className="site-footer">Erasmus+ · IES Manuel Martín González</footer>}</main><BottomNavigation user={user} /></div>;
}

function LoadingState({ label = 'Cargando información' }: { label?: string }) {
  return <div role="status" aria-label={label}><div className="skeleton-block" /><div className="skeleton" style={{ width: '72%' }} /><div className="skeleton" style={{ width: '48%' }} /></div>;
}
function ErrorState({ retry, text = 'No se ha podido cargar la información.' }: { retry: () => void; text?: string }) {
  return <div className="status error" role="alert">{text} <button className="text-link" onClick={retry}>Reintentar</button></div>;
}
function EmptyState({ icon: Icon, title, detail }: { icon: typeof FileText; title: string; detail: string }) {
  return <div className="panel empty"><div className="empty-mark"><Icon size={20} /></div><strong>{title}</strong><p>{detail}</p></div>;
}

function EntryRoute() {
  const session = useGetMobileSession();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (session.data) setLocation(session.data.authenticated ? '/inicio' : '/acceso');
  }, [session.data, setLocation]);
  if (session.isError) return <PageFrame><ErrorState retry={() => session.refetch()} text="No se ha podido comprobar la sesión." /></PageFrame>;
  return <PageFrame><LoadingState label="Abriendo tu espacio" /></PageFrame>;
}

function LoginPage() {
  const session = useGetMobileSession();
  const mutation = useCreateMobileSession();
  const startPasskey = useStartMobilePasskeyLogin();
  const finishPasskey = useFinishMobilePasskeyLogin();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeySupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!session.data?.csrfToken) { setError('No se ha podido validar la sesión. Recarga la página e inténtalo de nuevo.'); return; }
    setError('');
    mutation.mutate({ data: { username: username.trim(), password, csrfToken: session.data.csrfToken } }, {
      onSuccess: async () => { await client.invalidateQueries({ queryKey: getGetMobileSessionQueryKey() }); setLocation('/inicio'); },
      onError: () => setError('No se ha podido iniciar sesión. Comprueba tus datos e inténtalo de nuevo.'),
    });
  };
  const loginWithPasskey = async () => {
    if (!passkeySupported) { setError('Este navegador no admite acceso con passkey. Usa tu contraseña o prueba un navegador actualizado.'); return; }
    if (!session.data?.csrfToken) { setError('No se ha podido validar la sesión. Recarga la página e inténtalo de nuevo.'); return; }
    if (!username.trim()) { setError('Introduce primero tu DNI o CIAL.'); document.getElementById('username')?.focus(); return; }
    setError(''); setPasskeyBusy(true);
    try {
      const started = await startPasskey.mutateAsync({ data: { username: username.trim(), csrf: session.data.csrfToken } });
      const credential = await navigator.credentials.get({ publicKey: assertionOptions(started) }) as PublicKeyCredential | null;
      if (!credential) throw new Error('Se canceló la verificación en este dispositivo.');
      const response = credential.response as AuthenticatorAssertionResponse;
      const result = await finishPasskey.mutateAsync({ data: { attempt: started.attempt, csrf: session.data.csrfToken, response: {
        id: credential.id, rawId: bytesToBase64Url(credential.rawId), type: credential.type,
        response: { clientDataJSON: bytesToBase64Url(response.clientDataJSON), authenticatorData: bytesToBase64Url(response.authenticatorData), signature: bytesToBase64Url(response.signature), userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null },
        clientExtensionResults: credential.getClientExtensionResults(),
      } } });
      if (!result.ok) throw new Error('No se ha podido verificar esta passkey.');
      await client.invalidateQueries({ queryKey: getGetMobileSessionQueryKey() });
      setLocation('/inicio');
    } catch (cause) { setError(readableAuthError(cause)); }
    finally { setPasskeyBusy(false); }
  };
  return <PageFrame><div className="panel form-card"><div className="access-mark"><ShieldCheck size={23} /></div><p className="eyebrow">IES MMG · Erasmus+</p><h1>Accede a tu espacio</h1><p className="lede">Usa tu cuenta del centro para consultar tareas, documentos y conversaciones autorizadas.</p>
    {session.isLoading && <div className="skeleton" />}
    {session.isError && <ErrorState retry={() => session.refetch()} text="No se ha podido preparar el acceso." />}
    {error && <div className="status error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="username">Usuario</label><input id="username" autoComplete="username" required maxLength={100} value={username} onChange={(e) => setUsername(e.target.value)} /></div>
      <div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <button className="button" data-testid="button-login" disabled={mutation.isPending || !session.data?.csrfToken} type="submit">{mutation.isPending ? 'Entrando…' : 'Entrar'}<ArrowRight size={16} /></button>
    </form>
    <div className="access-divider"><span>o entra con este dispositivo</span></div>
    <button className="button secondary passkey-button" type="button" data-testid="button-passkey-login" disabled={passkeyBusy || !session.data?.csrfToken} onClick={loginWithPasskey}><Fingerprint size={19} />{passkeyBusy ? 'Verificando dispositivo…' : 'Usar passkey o biometría'}</button>
    <p className="privacy-note">La huella, el rostro o el PIN se verifican en tu dispositivo. Los datos biométricos nunca salen de él.</p>
    {!passkeySupported && <div className="status">Este navegador no admite passkeys. Puedes acceder con tu contraseña.</div>}
  </div></PageFrame>;
}

function PrivateShell() {
  const session = useGetMobileSession();
  if (session.isLoading) return <PageFrame><LoadingState label="Comprobando sesión" /></PageFrame>;
  if (session.isError) return <PageFrame><ErrorState retry={() => session.refetch()} text="No se ha podido comprobar la sesión." /></PageFrame>;
  if (!session.data?.authenticated || !session.data.user) return <PageFrame><div className="panel form-card"><p className="eyebrow">Acceso restringido</p><h1>Tu espacio te espera</h1><p className="lede">Inicia sesión para consultar documentos, mensajes y la actividad de tu movilidad.</p><Link className="button" href="/acceso">Acceder<ArrowRight size={16} /></Link></div></PageFrame>;
  return <AuthenticatedRoutes user={session.data.user} csrfToken={session.data.csrfToken} />;
}

function AuthenticatedRoutes({ user, csrfToken }: { user: MobileUser; csrfToken: string }) {
  return <Switch>
    <Route path="/inicio"><DashboardPage user={user} csrfToken={csrfToken} /></Route>
    <Route path="/documentos"><DocumentsPage user={user} /></Route>
    <Route path="/mensajes/:kind/:id"><ConversationPage user={user} csrfToken={csrfToken} /></Route>
    <Route path="/mensajes"><MessagesPage user={user} /></Route>
    <Route path="/perfil"><ProfilePage user={user} csrfToken={csrfToken} /></Route>
    <Route><DashboardPage user={user} csrfToken={csrfToken} /></Route>
  </Switch>;
}

function DashboardPage({ user, csrfToken }: { user: { id: number; firstName: string; lastName: string; role: string; editionLabel: string | null }; csrfToken: string }) {
  const query = useGetMobileDashboard();
  const complete = useCompleteMobileTask();
  const client = useQueryClient();
  const [feedback, setFeedback] = useState('');
  if (query.isLoading) return <PageFrame user={user}><LoadingState /></PageFrame>;
  if (query.isError || !query.data) return <PageFrame user={user}><ErrorState retry={() => query.refetch()} /></PageFrame>;
  const dashboard = query.data;
  const summary = dashboard.summary;
  const action: MobileAction = { csrfToken };
  const completeTask = (taskId: number) => complete.mutate({ taskId, data: action }, {
    onSuccess: async () => { setFeedback('Tarea completada.'); await client.invalidateQueries({ queryKey: getGetMobileDashboardQueryKey() }); },
    onError: () => setFeedback('No se ha podido completar la tarea. Inténtalo de nuevo.'),
  });
  return <PageFrame user={user}>
    <section className="dashboard-welcome"><p className="eyebrow">{dashboard.user.editionLabel ?? 'Erasmus+'} · {roleLabel(dashboard.user.role)}</p><h1>Hola, {dashboard.user.firstName}</h1><p>Tu espacio de movilidad, actualizado en un solo lugar.</p></section>
    <div className="metrics">
      {(user.role === 'coordinator' ? [
        ['Solicitudes', summary.applications], ['Solicitudes pendientes', summary.pendingApplicants], ['Grupos', summary.groups], ['Próximos eventos', summary.upcomingEvents],
      ] : [['Solicitudes', summary.applications], ['Grupos', summary.groups], ['Tareas pendientes', summary.pendingTasks], ['Próximos eventos', summary.upcomingEvents]]).map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <div className="dashboard-columns">
      <section><div className="section-head"><div><p className="eyebrow">Lo que sigue</p><h2>Agenda</h2></div></div>
        {dashboard.events.length ? <div className="card-list">{dashboard.events.map((event) => <article className="list-row" key={event.id}><div className="list-icon"><CalendarDays size={18} /></div><div className="list-copy"><strong>{event.title}</strong><span>{dateTimeLabel(event.startTime)}{event.location ? ` · ${event.location}` : ''}{event.groupName ? ` · ${event.groupName}` : ''}</span></div></article>)}</div> : <EmptyState icon={CalendarDays} title="Sin eventos próximos" detail="Cuando haya actividades previstas para ti, aparecerán aquí." />}
        <div className="section-head"><div><p className="eyebrow">Pendiente</p><h2>Tareas</h2></div></div>
        {feedback && <div className={`status ${feedback.startsWith('No') ? 'error' : 'success'}`} role="status">{feedback}</div>}
        {dashboard.tasks.length ? <div className="panel profile-section">{dashboard.tasks.map((task) => <div className="task-row" key={task.id}><div className="task-mark">{task.completed && <Check size={14} />}</div><div style={{ flex: 1 }}><h3>{task.title}</h3><p>{task.description}{task.dueDate ? ` · Fecha límite: ${dateLabel(task.dueDate)}` : ''}</p></div>{!task.completed && <button className="button secondary" disabled={complete.isPending} onClick={() => completeTask(task.id)}>Completar</button>}</div>)}</div> : <EmptyState icon={CheckCircle2} title="Todo al día" detail="No tienes tareas asignadas en este momento." />}
      </section>
      <section><div className="section-head"><div><p className="eyebrow">Tu movilidad</p><h2>Grupos</h2></div></div>
        {dashboard.groups.length ? <div className="card-list">{dashboard.groups.map((group) => <div className="list-row" key={group.id}><div className="list-icon teal"><Users size={18} /></div><div className="list-copy"><strong>{group.name}</strong><span>{group.destination}{group.editionLabel ? ` · ${group.editionLabel}` : ''}</span></div></div>)}</div> : <EmptyState icon={Users} title="Sin grupos asignados" detail="Los grupos vinculados a tu cuenta aparecerán aquí." />}
        <div className="section-head"><div><p className="eyebrow">Novedades</p><h2>Avisos</h2></div></div>
        {dashboard.notices.length ? <div className="card-list">{dashboard.notices.map((notice) => <article className="panel profile-section" key={notice.id}><div className="list-copy"><strong>{notice.title}</strong><span>{dateTimeLabel(notice.createdAt)}</span><p>{notice.body}</p></div></article>)}</div> : <EmptyState icon={Bell} title="Sin avisos nuevos" detail="Aquí se mostrarán las comunicaciones del programa." />}
        {dashboard.applications.length > 0 && <><div className="section-head"><div><p className="eyebrow">Seguimiento</p><h2>Solicitudes</h2></div></div><div className="card-list">{dashboard.applications.map((item) => <article className="list-row" key={item.id}><div className="list-icon"><BookOpen size={18} /></div><div className="list-copy"><strong>{item.mobility} · {item.destination}</strong><span>{item.editionLabel} · {item.status}{item.decision ? ` · ${item.decision}` : ''}</span></div></article>)}</div></>}
      </section>
    </div>
  </PageFrame>;
}

function DocumentsPage({ user }: { user: { firstName: string; lastName: string } }) {
  const query = useGetMobileDocuments();
  if (query.isLoading) return <PageFrame user={user}><LoadingState /></PageFrame>;
  if (query.isError || !query.data) return <PageFrame user={user}><ErrorState retry={() => query.refetch()} /></PageFrame>;
  const documents = query.data.documents;
  return <PageFrame user={user}><p className="eyebrow">Tu expediente</p><h1 className="page-title">Documentos</h1><p className="lede">Consulta los archivos disponibles para tu cuenta.</p>
    <div className="section-head"><div><h2>Archivos disponibles</h2></div><span className="badge">{documents.length}</span></div>
    {documents.length ? <div className="card-list">{documents.map((doc) => <a className="list-row" key={doc.id} href={doc.downloadUrl} target="_blank" rel="noreferrer"><div className="list-icon"><FileText size={18} /></div><div className="list-copy"><strong>{doc.name}</strong><span>{doc.source} · {dateLabel(doc.createdAt)} · {doc.mime} · {formatBytes(doc.bytes)}</span></div><ArrowDownToLine className="row-end" size={18} /></a>)}</div> : <EmptyState icon={FileText} title="Todavía no hay documentos" detail="Los documentos que el equipo comparta contigo aparecerán aquí." />}
  </PageFrame>;
}
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

function MessagesPage({ user }: { user: { firstName: string; lastName: string } }) {
  const query = useGetMobileConversationDirectory();
  const [filter, setFilter] = useState<'all' | 'groups' | 'contacts'>('all');
  const [search, setSearch] = useState('');
  if (query.isLoading) return <PageFrame user={user} className="inbox-content" showFooter={false}><LoadingState /></PageFrame>;
  if (query.isError || !query.data) return <PageFrame user={user} className="inbox-content" showFooter={false}><ErrorState retry={() => query.refetch()} /></PageFrame>;
  const { contacts, groups } = query.data;
  const term = search.trim().toLocaleLowerCase('es');
  const visibleGroups = groups.filter((group) => !term || `${group.title} ${group.subtitle} ${group.lastMessage ?? ''}`.toLocaleLowerCase('es').includes(term));
  const visibleContacts = contacts.filter((contact) => !term || `${fullName(contact)} ${contact.role} ${contact.editionLabel ?? ''}`.toLocaleLowerCase('es').includes(term));
  const total = groups.length + contacts.length;
  const shown = (filter !== 'contacts' && visibleGroups.length > 0) || (filter !== 'groups' && visibleContacts.length > 0);
  return <PageFrame user={user} className="inbox-content" showFooter={false}>
    <section className="inbox-screen" aria-labelledby="messages-title">
      <header className="inbox-heading">
        <div>
          <p className="eyebrow">IES MMG · Erasmus+</p>
          <div className="inbox-title-line"><h1 id="messages-title" className="page-title">Mensajes</h1><span className="inbox-total">{total} conversaciones</span></div>
          <p className="lede">Grupos y contactos de tu convocatoria.</p>
        </div>
        <div className="inbox-mark" aria-hidden="true"><MessageCircle size={19} /></div>
      </header>
      <label className="inbox-search">
        <Search size={17} aria-hidden="true" />
        <input data-testid="input-message-search" type="search" aria-label="Buscar conversaciones" placeholder="Buscar conversaciones" value={search} onChange={(event) => setSearch(event.target.value)} />
        {search && <button type="button" className="search-clear" aria-label="Borrar búsqueda" data-testid="button-clear-message-search" onClick={() => setSearch('')}><X size={15} /></button>}
      </label>
      <div className="inbox-filters" role="group" aria-label="Filtrar conversaciones">
        <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} data-testid="filter-all-conversations" onClick={() => setFilter('all')}>Todos <span>{total}</span></button>
        <button type="button" aria-pressed={filter === 'groups'} className={filter === 'groups' ? 'active' : ''} data-testid="filter-group-conversations" onClick={() => setFilter('groups')}>Grupos <span>{groups.length}</span></button>
        <button type="button" aria-pressed={filter === 'contacts'} className={filter === 'contacts' ? 'active' : ''} data-testid="filter-direct-conversations" onClick={() => setFilter('contacts')}>Personas <span>{contacts.length}</span></button>
      </div>
      <div className="inbox-list" aria-label="Conversaciones">
        {!shown ? <div className="inbox-empty"><div className="inbox-empty-mark"><Search size={20} /></div><strong>{term ? 'No hay resultados' : 'Aún no hay conversaciones'}</strong><p>{term ? 'Prueba con otro nombre o grupo.' : 'Aquí aparecerán los grupos y contactos autorizados de tu convocatoria.'}</p></div> : <>
          {filter !== 'contacts' && visibleGroups.length > 0 && <section className="conversation-section" aria-label="Grupos">
            {filter === 'all' && <div className="conversation-section-title"><span>Grupos</span><span>{visibleGroups.length}</span></div>}
            {visibleGroups.map((group) => <Link key={group.id} href={`/mensajes/group/${group.id}`} className="conversation-row" data-testid={`conversation-group-${group.id}`} aria-label={`${group.title}. ${group.lastMessage || group.subtitle}`}>
              <span className="conversation-avatar group"><Users size={19} /></span>
              <span className="conversation-row-copy"><span className="conversation-row-title"><strong>{group.title}</strong><time>{conversationTimeLabel(group.lastMessageAt)}</time></span><span className="conversation-row-preview">{group.lastMessage || group.subtitle}</span><span className="conversation-row-detail">{group.subtitle}</span></span>
            </Link>)}
          </section>}
          {filter !== 'groups' && visibleContacts.length > 0 && <section className="conversation-section" aria-label="Personas">
            {filter === 'all' && <div className="conversation-section-title"><span>Personas</span><span>{visibleContacts.length}</span></div>}
            {visibleContacts.map((contact) => {
              const title = fullName(contact);
              const detail = `${roleLabel(contact.role)}${contact.editionLabel ? ` · ${contact.editionLabel}` : ''}`;
              return <Link key={contact.id} href={`/mensajes/direct/${contact.id}`} className="conversation-row" data-testid={`conversation-contact-${contact.id}`} aria-label={`${title}. ${detail}`}>
                <span className="conversation-avatar">{initials(title)}</span>
                <span className="conversation-row-copy"><span className="conversation-row-title"><strong>{title}</strong></span><span className="conversation-row-preview">{detail}</span><span className="conversation-row-detail">Mensaje directo</span></span>
              </Link>;
            })}
          </section>}
        </>}
      </div>
    </section>
  </PageFrame>;
}

function ConversationPage({ user, csrfToken }: { user: { id: number; firstName: string; lastName: string }; csrfToken: string }) {
  const params = useParams<{ kind: string; id: string }>();
  const kind = params.kind === 'group' ? 'group' : 'direct';
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0 && (params.kind === 'direct' || params.kind === 'group');
  const query = useGetMobileConversationMessages(kind, valid ? id : 0, { query: { enabled: valid, queryKey: getGetMobileConversationMessagesQueryKey(kind, valid ? id : 0) } });
  const mutation = useSendMobileMessage();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const messageThreadRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = messageThreadRef.current; if (el) el.scrollTop = el.scrollHeight; }, [id, kind, query.data?.messages.length]);
  const send = (event: FormEvent) => {
    event.preventDefault();
    const message = content.trim();
    if (!message || !valid) return;
    mutation.mutate({ data: { kind, targetId: id, content: message, csrfToken } }, {
      onSuccess: async () => { setContent(''); setError(''); await Promise.all([client.invalidateQueries({ queryKey: getGetMobileConversationMessagesQueryKey(kind, id) }), client.invalidateQueries({ queryKey: getGetMobileConversationDirectoryQueryKey() })]); },
      onError: () => setError('No se ha podido enviar el mensaje. Vuelve a intentarlo.'),
    });
  };
  if (!valid) return <PageFrame user={user} className="chat-content" showFooter={false}><ErrorState retry={() => setLocation('/mensajes')} text="Esta conversación no está disponible." /></PageFrame>;
  return <PageFrame user={user} className="chat-content" showFooter={false}>
    {query.isLoading ? <LoadingState /> : query.isError || !query.data ? <ErrorState retry={() => query.refetch()} /> : <section className="chat-screen" aria-label={`Conversación con ${query.data.title}`}>
      <header className="chat-header">
        <Link href="/mensajes" className="chat-back" aria-label="Volver a mensajes" data-testid="link-back-to-messages"><ArrowLeft size={19} /></Link>
        <span className={`chat-avatar${kind === 'group' ? ' group' : ''}`}>{kind === 'group' ? <Users size={19} /> : initials(query.data.title)}</span>
        <span className="chat-header-copy"><strong>{query.data.title}</strong><small>{kind === 'group' ? 'Grupo autorizado' : 'Mensaje directo'}</small></span>
      </header>
      <aside className="chat-policy" role="note">
        <ShieldCheck size={16} aria-hidden="true" />
        <span><strong>Comunicación supervisada</strong><small>Coordinación puede supervisar esta conversación según el protocolo del centro. El acceso queda registrado. No se crean copias ocultas.</small></span>
      </aside>
      <div className="chat-thread" ref={messageThreadRef} role="log" aria-live="polite" aria-relevant="additions text">
        {query.data.messages.length ? query.data.messages.map((message) => {
          const mine = message.senderId === user.id;
          return <article className={`chat-message${mine ? ' mine' : ''}`} key={message.id} data-testid={`message-${message.id}`}>
            {!mine && <strong className="chat-sender">{message.senderName}</strong>}
            <p>{message.content}</p>
            <time>{clockLabel(message.createdAt)}</time>
          </article>;
        }) : <div className="chat-empty"><div className="chat-empty-mark"><MessageCircle size={20} /></div><strong>Empieza la conversación</strong><p>Tu mensaje será visible para las personas autorizadas en este espacio.</p></div>}
      </div>
      {error && <div className="chat-error" role="alert">{error}</div>}
      <form className="chat-composer" onSubmit={send}>
        <textarea data-testid="input-message" aria-label="Escribe un mensaje" maxLength={2500} rows={1} placeholder="Escribe un mensaje…" value={content} onChange={(event) => setContent(event.target.value)} />
        <button className="send-button" data-testid="button-send-message" aria-label="Enviar mensaje" disabled={!content.trim() || mutation.isPending}><Send size={17} /></button>
      </form>
      <p className="chat-hint">Solo las personas autorizadas pueden ver este chat.</p>
    </section>}
  </PageFrame>;
}

function base64UrlToBytes(base64Url: string) {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
function bytesToBase64Url(buffer: ArrayBuffer) {
  let binary = '';
  new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function assertionOptions(started: MobilePasskeyStartResult): PublicKeyCredentialRequestOptions {
  const options = started.options as Record<string, unknown>;
  return { ...options, challenge: base64UrlToBytes(String(options.challenge)), allowCredentials: (options.allowCredentials as Array<Record<string, unknown>> | undefined)?.map((credential) => ({ ...credential, id: base64UrlToBytes(String(credential.id)) })) } as PublicKeyCredentialRequestOptions;
}
function creationOptions(started: MobilePasskeyStartResult): PublicKeyCredentialCreationOptions {
  const options = started.options as Record<string, unknown>;
  const user = options.user as Record<string, unknown>;
  return { ...options, challenge: base64UrlToBytes(String(options.challenge)), user: { ...user, id: base64UrlToBytes(String(user.id)) }, excludeCredentials: (options.excludeCredentials as Array<Record<string, unknown>> | undefined)?.map((credential) => ({ ...credential, id: base64UrlToBytes(String(credential.id)) })) } as unknown as PublicKeyCredentialCreationOptions;
}
function encodeAttestation(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return { id: credential.id, rawId: bytesToBase64Url(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment, response: { clientDataJSON: bytesToBase64Url(response.clientDataJSON), attestationObject: bytesToBase64Url(response.attestationObject), transports: response.getTransports?.() ?? [] }, clientExtensionResults: credential.getClientExtensionResults() };
}
function readableAuthError(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'No se completó la verificación. Vuelve a intentarlo y confirma el acceso en tu dispositivo.';
  if (error instanceof Error && error.message) return error.message;
  return 'No se ha podido verificar el acceso. Comprueba tus datos e inténtalo de nuevo.';
}

function ProfilePage({ user, csrfToken }: { user: { firstName: string; lastName: string; role: string; editionLabel: string | null }; csrfToken: string }) {
  const client = useQueryClient();
  const config = useGetMobilePushConfig();
  const save = useSaveMobilePushSubscription();
  const remove = useDeleteMobilePushSubscription();
  const logout = useDeleteMobileSession();
  const passkeys = useGetMobilePasskeys();
  const startRegistration = useStartMobilePasskeyRegistration();
  const finishRegistration = useFinishMobilePasskeyRegistration();
  const deletePasskey = useDeleteMobilePasskey();
  const session = useGetMobileSession();
  const [, setLocation] = useLocation();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [passkeyFeedback, setPasskeyFeedback] = useState('');
  const passkeySupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials;
  useEffect(() => {
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()).then((sub) => setSubscribed(Boolean(sub))).catch(() => undefined);
  }, []);
  const enablePush = async () => {
    setFeedback('');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { setPermission('unsupported'); return; }
    if (!config.data?.enabled || !config.data.publicKey) { setFeedback('Las notificaciones no están disponibles en este momento.'); return; }
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') { setFeedback(granted === 'denied' ? 'El permiso está bloqueado en el navegador. Puedes cambiarlo desde los ajustes del sitio.' : 'No se ha concedido permiso para las notificaciones.'); return; }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) { setFeedback('Las notificaciones no están preparadas en este dispositivo.'); return; }
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.data.publicKey) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Subscription incomplete');
      const data: MobilePushSubscriptionInput = { endpoint: json.endpoint, expirationTime: json.expirationTime ?? null, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, csrfToken };
      await save.mutateAsync({ data });
      setSubscribed(true);
      setFeedback('Notificaciones activadas para este navegador.');
    } catch {
      setFeedback('No se ha podido activar este navegador. Comprueba su configuración e inténtalo de nuevo.');
    }
  };
  const disablePush = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await remove.mutateAsync({ data: { endpoint: subscription.endpoint, csrfToken } });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setFeedback('Notificaciones desactivadas en este navegador.');
    } catch {
      setFeedback('No se ha podido desactivar este navegador.');
    }
  };
  const signOut = async () => {
    const currentCsrfToken = session.data?.csrfToken;
    if (!currentCsrfToken || signOutBusy) {
      setFeedback('No se ha podido validar la sesión. Recarga la página antes de cerrar sesión.');
      return;
    }
    setSignOutBusy(true);
    setFeedback('');
    try {
      let subscription: PushSubscription | null = null;
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.getRegistration();
          subscription = registration ? await registration.pushManager.getSubscription() : null;
        }
      } catch {
        setFeedback('No se ha podido comprobar la suscripción de este navegador. Revisa la conexión e inténtalo de nuevo; la sesión sigue abierta.');
        return;
      }
      if (subscription) {
        try {
          await remove.mutateAsync({ data: { endpoint: subscription.endpoint, csrfToken: currentCsrfToken } });
        } catch {
          setFeedback('No se ha podido retirar la suscripción de notificaciones del servidor. La sesión sigue abierta; comprueba la conexión e inténtalo de nuevo.');
          return;
        }
        try {
          const unsubscribed = await subscription.unsubscribe();
          if (!unsubscribed) throw new Error('Subscription remains active');
          setSubscribed(false);
        } catch {
          setFeedback('La suscripción se retiró del servidor, pero no se pudo desactivar en este navegador. Revisa los permisos del navegador e inténtalo de nuevo; la sesión sigue abierta.');
          return;
        }
      }
      await logout.mutateAsync({ data: { csrfToken: currentCsrfToken } });
      await client.clear();
      setLocation('/');
    } catch {
      setFeedback('No se ha podido cerrar la sesión. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setSignOutBusy(false);
    }
  };
  const pushSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const pushBusy = save.isPending || remove.isPending;
  const registerPasskey = async () => {
    setPasskeyFeedback('');
    if (!passkeySupported) { setPasskeyFeedback('Este navegador no admite passkeys. Prueba un navegador actualizado en un dispositivo compatible.'); return; }
    try {
      const started = await startRegistration.mutateAsync({ data: { csrf: csrfToken } });
      const credential = await navigator.credentials.create({ publicKey: creationOptions(started) }) as PublicKeyCredential | null;
      if (!credential) throw new Error('Se canceló el registro de la passkey.');
      const result = await finishRegistration.mutateAsync({ data: { attempt: started.attempt, csrf: csrfToken, response: encodeAttestation(credential) } });
      if (!result.ok) throw new Error('No se ha podido guardar esta passkey.');
      await client.invalidateQueries({ queryKey: getGetMobilePasskeysQueryKey() });
      setPasskeyFeedback('Passkey registrada en este dispositivo.');
    } catch (cause) { setPasskeyFeedback(readableAuthError(cause)); }
  };
  const revokePasskey = async (id: string) => {
    if (!window.confirm('¿Quieres revocar esta passkey? Este dispositivo dejará de poder iniciar sesión con ella.')) return;
    setPasskeyFeedback('');
    try {
      await deletePasskey.mutateAsync({ credentialId: id, data: { csrf: csrfToken } });
      await client.invalidateQueries({ queryKey: getGetMobilePasskeysQueryKey() });
      setPasskeyFeedback('Passkey revocada.');
    } catch (cause) { setPasskeyFeedback(readableAuthError(cause)); }
  };
  return <PageFrame user={user}>
    <p className="eyebrow">Tu cuenta</p><h1 className="page-title">Perfil</h1><p className="lede">Información de acceso y preferencias de este navegador.</p>
    <section className="panel profile-section"><div className="profile-info"><div className="profile-avatar">{initials(fullName(user))}</div><div><strong>{fullName(user)}</strong><span>{roleLabel(user.role)}{user.editionLabel ? ` · ${user.editionLabel}` : ''}</span></div></div>
      <div className="setting-row"><div><strong>Cuenta del centro</strong><p>Tu sesión también se comparte con la web de Erasmus+ MMG.</p></div><ShieldCheck size={19} color="#138c95" /></div>
    </section>
    <section className="panel profile-section"><p className="eyebrow">Preferencias</p><h2>Notificaciones del navegador</h2>
      {!pushSupported ? <div className="status">Este navegador no admite notificaciones push.</div> : <>
        {permission === 'denied' && <div className="status error">El permiso para notificaciones está denegado en el navegador. Cámbialo desde los ajustes del sitio para poder activarlas.</div>}
        {permission === 'default' && <div className="status">Al activar esta opción, el navegador solicitará permiso. La decisión se toma solo después de pulsar el botón.</div>}
        {config.isLoading && <div className="skeleton" />}
        {config.isError && <ErrorState retry={() => config.refetch()} text="No se ha podido consultar la configuración de notificaciones." />}
        {config.data && !config.data.enabled && <div className="status">Las notificaciones push están desactivadas para este servicio.</div>}
        <div className="setting-row"><div><strong>Avisos de mensajes</strong><p>Recibe un aviso sin mostrar el contenido del mensaje.</p></div><button type="button" className="toggle" role="switch" aria-checked={subscribed} aria-label={subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'} disabled={pushBusy || config.isLoading || !config.data?.enabled || permission === 'denied'} onClick={subscribed ? disablePush : enablePush} /></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!subscribed && <button className="button" disabled={pushBusy || config.isLoading || !config.data?.enabled || permission === 'denied'} onClick={enablePush}><Bell size={16} />{permission === 'granted' ? 'Activar notificaciones' : 'Permitir notificaciones'}</button>}
          {subscribed && <button className="button secondary" disabled={pushBusy} onClick={disablePush}>Desactivar en este navegador</button>}
        </div>
      </>}
    </section>
    <section className="panel profile-section passkeys-section">
      <p className="eyebrow">Acceso seguro</p><h2>Passkeys de este dispositivo</h2>
      <p className="setting-description">Accede con la verificación integrada del dispositivo: huella, rostro o PIN. Los datos biométricos permanecen en tu dispositivo y no se envían al centro.</p>
      {!passkeySupported && <div className="status">Este navegador no admite passkeys. Prueba con un navegador actualizado.</div>}
      {passkeys.isLoading && <LoadingState label="Cargando passkeys" />}
      {passkeys.isError && <ErrorState retry={() => passkeys.refetch()} text="No se han podido consultar tus passkeys." />}
      {passkeys.data?.credentials.map((credential) => <div className="passkey-row" key={credential.id}><div className="passkey-icon"><Fingerprint size={18} /></div><div className="list-copy"><strong>Este dispositivo</strong><span>Registrada el {dateTimeLabel(credential.createdAt)}</span></div><button className="button ghost revoke-button" type="button" data-testid={`button-revoke-passkey-${credential.id}`} disabled={deletePasskey.isPending} onClick={() => revokePasskey(credential.id)}>Revocar</button></div>)}
      {passkeys.data && passkeys.data.credentials.length === 0 && <div className="empty passkey-empty"><strong>Aún no has registrado una passkey</strong><p>Vincula este dispositivo para acceder sin contraseña.</p></div>}
      <button className="button secondary" type="button" data-testid="button-register-passkey" disabled={!passkeySupported || startRegistration.isPending || finishRegistration.isPending} onClick={registerPasskey}><Fingerprint size={17} />{startRegistration.isPending || finishRegistration.isPending ? 'Registrando…' : 'Registrar este dispositivo'}</button>
      {passkeyFeedback && <div className={`status ${passkeyFeedback.includes('no se ha') || passkeyFeedback.includes('canceló') ? 'error' : 'success'}`} role="status">{passkeyFeedback}</div>}
    </section>
    {feedback && <div className={`status ${feedback.startsWith('No') || feedback.startsWith('La suscripción') ? 'error' : 'success'}`} role="status">{feedback}</div>}
    <button className="button secondary" disabled={signOutBusy || logout.isPending || remove.isPending} onClick={signOut}><LogOut size={16} />{signOutBusy || logout.isPending || remove.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
  </PageFrame>;
}

export default App;
