export const API = import.meta.env.VITE_API_URL || '';

export const apiFetch = (path, options = {}) =>
  fetch(`${API}${path}`, { credentials: 'include', ...options });