const projects = new Map();

export function createProject(name) {
  const id = crypto.randomUUID();
  const project = {
    id,
    name,
    status: "New",
    plans: [],
    items: [],
    quotes: [],
    proposal: null,
    createdAt: new Date().toISOString(),
  };
  projects.set(id, project);
  return project;
}

export function listProjects() {
  return [...projects.values()];
}

export function getProject(id) {
  return projects.get(id);
}

export function updateProject(id, patch) {
  const p = projects.get(id);
  if (!p) return null;
  Object.assign(p, patch);
  return p;
}
