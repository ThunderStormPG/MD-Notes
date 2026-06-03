const API_URL = 'http://localhost:3001/api/v1';

export const getAuthToken = () => localStorage.getItem('km_token');
export const setAuthToken = (token: string) => localStorage.setItem('km_token', token);
export const removeAuthToken = () => localStorage.removeItem('km_token');

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'API Request Failed');
  }

  return response.json();
}

// Auth
export const login = (email: string, password: string) => 
  fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const register = (email: string, password: string, fullName: string) => 
  fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName }) });

// Workspaces
export const getWorkspaces = () => fetchApi('/workspaces');
export const createWorkspace = (name: string) => fetchApi('/workspaces', { method: 'POST', body: JSON.stringify({ name }) });

// Folders
export const getFolders = (workspaceId: string) => fetchApi(`/workspaces/${workspaceId}/folders`);
export const createFolder = (workspaceId: string, name: string, parentId?: string) => 
  fetchApi(`/workspaces/${workspaceId}/folders`, { method: 'POST', body: JSON.stringify({ name, parentId }) });

// Notes
export const getWorkspaceNotes = (workspaceId: string) => fetchApi(`/workspaces/${workspaceId}/notes`);
export const getWorkspaceGraph = (workspaceId: string) => fetchApi(`/workspaces/${workspaceId}/graph`);
export const getNote = (id: string) => fetchApi(`/notes/${id}`);
export const createNote = (workspaceId: string, folderId: string | null, title: string, contentMarkdown: string) => 
  fetchApi('/notes', { method: 'POST', body: JSON.stringify({ workspaceId, folderId, title, contentMarkdown }) });
export const updateNote = (id: string, title: string, contentMarkdown: string, frontmatter = '{}') => 
  fetchApi(`/notes/${id}`, { method: 'PUT', body: JSON.stringify({ title, contentMarkdown, frontmatter }) });

// Assets
export const uploadAsset = (fileName: string, base64Data: string) => 
  fetchApi('/assets/upload', { method: 'POST', body: JSON.stringify({ fileName, base64Data }) });

// Collaboration (SSE)
export const getSyncUrl = (noteId: string) => `${API_URL}/notes/${noteId}/sync?token=${getAuthToken()}`;
export const broadcast = (noteId: string, payload: any) =>
  fetchApi(`/notes/${noteId}/broadcast`, { method: 'POST', body: JSON.stringify(payload) });
