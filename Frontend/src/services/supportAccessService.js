const STORAGE_KEY = 'supportAccessSession';

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (session) => {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const supportAccessService = {
  getSession: read,
  setSession: write,
  clearSession: () => write(null),
  isActive: () => {
    const s = read();
    if (!s?.sessionId || !s?.tenantId) return false;
    if (s.expiresAt && new Date(s.expiresAt) <= new Date()) {
      write(null);
      return false;
    }
    return true;
  },
};

export default supportAccessService;
