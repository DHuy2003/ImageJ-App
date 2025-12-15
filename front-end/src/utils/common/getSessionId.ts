const SESSION_KEY = 'imagej_session_id';

export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'anonymous';
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      id = crypto.randomUUID();
    } else {
      id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
};