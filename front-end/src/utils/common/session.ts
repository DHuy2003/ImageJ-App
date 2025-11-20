const SESSION_KEY = 'imageSessionId';

export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';

  let sid = window.sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    // Mỗi tab mới sẽ random 1 id
    sid = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
};
