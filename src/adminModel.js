const tools = new Set(['all', 'bid', 'productivity']);

function invalidOverview() {
  throw new Error('The project overview could not be verified. Please try again.');
}

function timestamp(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) invalidOverview();
  return value;
}

function project(value, type) {
  if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.id) || value.id < 1 ||
      typeof value.name !== 'string' || !value.name.trim() || !value.owner ||
      !Number.isSafeInteger(value.owner.id) || value.owner.id < 1) invalidOverview();
  for (const field of ['username', 'email']) {
    if (value.owner[field] !== null && typeof value.owner[field] !== 'string') invalidOverview();
  }
  return {
    id: value.id,
    type,
    name: value.name,
    owner: { id: value.owner.id, username: value.owner.username, email: value.owner.email },
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
  };
}

export function parseAdminOverview(value) {
  if (!value || !Array.isArray(value.bids) || !Array.isArray(value.productivity)) invalidOverview();
  const generatedAt = timestamp(value.generatedAt);
  if (generatedAt === null) invalidOverview();
  const projects = [];
  for (const [type, list] of [['bid', value.bids], ['productivity', value.productivity]]) {
    const ids = new Set();
    for (const item of list) {
      const parsed = project(item, type);
      if (ids.has(parsed.id)) invalidOverview();
      ids.add(parsed.id);
      projects.push(parsed);
    }
  }
  projects.sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0) || a.type.localeCompare(b.type) || a.id - b.id);
  return {
    generatedAt,
    projects,
    summary: {
      bidProjects: value.bids.length,
      productivityProjects: value.productivity.length,
      projectOwners: new Set(projects.map(item => item.owner.id)).size,
    },
  };
}

export function filterAdminProjects(projects, query = '', type = 'all') {
  if (!tools.has(type)) return [];
  const search = query.trim().toLocaleLowerCase();
  return projects.filter(item => (type === 'all' || item.type === type) && (!search ||
    [item.name, item.owner.username, item.owner.email].some(value => value?.toLocaleLowerCase().includes(search))));
}
