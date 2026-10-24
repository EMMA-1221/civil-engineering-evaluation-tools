import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { filterAdminProjects, parseAdminOverview } from '../adminModel';
import Icon from '../components/Icon';
import './Admin.css';

const toolName = type => type === 'bid' ? 'Bid / No-Bid' : 'Productivity';
const projectLink = project => project.type === 'bid' ? `/bid/${project.id}` : `/productivity-analysis?productivityLoss=${project.id}&mode=proactive`;
const date = value => value ? new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';

export default function Admin() {
  const { token, user } = useAuth();
  if (!token || user?.role !== 'admin') {
    return <div className="hcg-admin-page"><div className="admin-state" role="alert"><h1>Administrator access required.</h1><p>This account cannot open the project overview.</p><Link className="admin-link" to="/">Return to workspace <Icon name="arrow-right" /></Link></div></div>;
  }
  return <AdminOverview key={`${user.id}:${user.role}:${token}`} token={token} />;
}

function AdminOverview({ token }) {
  const [request, setRequest] = useState({ status: 'loading' });
  const [reloadCount, setReloadCount] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/overview`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setRequest({ status: 'denied' });
          return;
        }
        if (!response.ok) throw new Error('The project overview could not be loaded. Please try again.');
        const data = parseAdminOverview(await response.json());
        if (!controller.signal.aborted) setRequest({ status: 'ready', data });
      } catch {
        if (!controller.signal.aborted) setRequest({ status: 'error' });
      }
    };
    load();
    return () => controller.abort();
  }, [token, reloadCount]);

  const reload = () => { setRequest({ status: 'loading' }); setReloadCount(value => value + 1); };
  const data = request.status === 'ready' ? request.data : null;
  const projects = data ? filterAdminProjects(data.projects, query, type) : [];
  const filtered = Boolean(query.trim()) || type !== 'all';

  return <div className="hcg-admin-page">
    <header className="admin-page-header">
      <div><span className="admin-eyebrow">Administration</span><h1>A view across every project.</h1><p>Review saved Bid and Productivity projects, their owners and latest updates.</p></div>
      <Link className="admin-back-link" to="/">Workspace <Icon name="arrow-up-right" /></Link>
    </header>

    {request.status === 'loading' && <div className="admin-state" role="status"><span className="admin-loading-dot" aria-hidden="true" /><h2>Loading project overview…</h2><p>Gathering saved projects from both tools.</p></div>}
    {request.status === 'denied' && <div className="admin-state admin-access-state" role="alert"><h2>Administrator access is unavailable.</h2><p>Your session may have expired or this account no longer has administrator access.</p><div className="admin-state-actions"><button type="button" className="admin-button" onClick={reload}>Check access again</button><Link className="admin-link" to="/">Return to workspace <Icon name="arrow-right" /></Link></div></div>}
    {request.status === 'error' && <div className="admin-state admin-error-state" role="alert"><h2>The overview couldn’t be loaded.</h2><p>Project information is temporarily unavailable. Please try again.</p><button type="button" className="admin-button" onClick={reload}>Try again</button></div>}

    {data && <>
      <section className="admin-summary" aria-label="Saved project counts">
        <div><span>Total projects</span><strong>{data.projects.length}</strong></div>
        <div><span>Bid evaluations</span><strong>{data.summary.bidProjects}</strong></div>
        <div><span>Productivity projects</span><strong>{data.summary.productivityProjects}</strong></div>
        <div><span>Project owners</span><strong>{data.summary.projectOwners}</strong></div>
      </section>

      <section className="admin-projects" aria-labelledby="admin-projects-title">
        <div className="admin-section-heading"><div><h2 id="admin-projects-title">All saved projects</h2><p>Open a project to review its inputs and results.</p></div><button type="button" className="admin-refresh" onClick={reload}>Refresh overview</button></div>
        <div className="admin-filters">
          <div className="admin-search-field"><label htmlFor="admin-project-search">Search projects or owners</label><input id="admin-project-search" type="search" placeholder="Project name, owner or email" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <div className="admin-type-field"><label htmlFor="admin-tool-filter">Tool</label><select id="admin-tool-filter" value={type} onChange={event => setType(event.target.value)}><option value="all">All tools</option><option value="bid">Bid / No-Bid</option><option value="productivity">Productivity</option></select></div>
        </div>
        <p className="admin-result-count" role="status">{projects.length} {projects.length === 1 ? 'project' : 'projects'}{filtered ? ` shown of ${data.projects.length}` : ' across all users'}</p>
        {projects.length > 0 ? <table className="admin-project-table"><caption className="admin-sr-only">Saved projects across both tools, ordered by latest update.</caption><thead><tr><th scope="col">Project</th><th scope="col">Tool</th><th scope="col">Owner</th><th scope="col">Updated</th><th scope="col"><span className="admin-sr-only">Open project</span></th></tr></thead><tbody>{projects.map(project => <tr key={`${project.type}:${project.id}`}>
          <td className="admin-project-name" data-label="Project"><Link to={projectLink(project)}>{project.name}</Link></td>
          <td data-label="Tool"><span className={`admin-tool-tag admin-tool-${project.type}`}>{toolName(project.type)}</span></td>
          <td className="admin-project-owner" data-label="Owner"><span>{project.owner.username || project.owner.email || `Account #${project.owner.id}`}</span>{project.owner.email && project.owner.username && <small>{project.owner.email}</small>}</td>
          <td className="admin-project-date" data-label="Updated">{project.updatedAt ? <time dateTime={project.updatedAt}>{date(project.updatedAt)}</time> : 'Not recorded'}</td>
          <td className="admin-project-action"><Link className="admin-link" to={projectLink(project)} aria-label={`Open ${toolName(project.type)} project ${project.name}`}>Open <Icon name="arrow-up-right" /></Link></td>
        </tr>)}</tbody></table> : <div className="admin-empty"><h3>{filtered ? 'No projects match your search.' : 'No saved projects yet.'}</h3><p>{filtered ? 'Try a different project name or owner, or show all tools.' : 'Projects will appear here after they are saved in either tool.'}</p>{filtered && <button type="button" className="admin-refresh" onClick={() => { setQuery(''); setType('all'); }}>Clear filters</button>}</div>}
      </section>
      <p className="admin-snapshot">Overview loaded <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time>.</p>
    </>}
  </div>;
}
