import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore } from './api';
import { connectSocket, disconnectSocket } from './socket';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setLoading(false); return null; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      connectSocket(tokenStore.get());
      return data.user;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    connectSocket(token);
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, signIn, signOut, refresh }), [user, loading, signIn, signOut, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (u) => (u?.role === 'seller' ? '/seller' : '/buyer');
