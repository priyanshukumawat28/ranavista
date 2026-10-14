import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore } from './api';
import { connectSocket, disconnectSocket } from './socket';

const Ctx = createContext(null);

/** Which admin sub-roles may open each section (super admins can open everything). */
export const ACCESS = {
  overview: ['finance', 'support', 'category'],
  rfqs: ['finance', 'support', 'category'],
  assign: ['support', 'category'],
  sellers: ['finance', 'support', 'category'],
  approve: ['support', 'category'],
  suspend: ['support'],
  buyers: ['finance', 'support', 'category'],
  orders: ['finance', 'support', 'category'],
  money: ['finance'],
  disputes: ['support', 'finance'],
  resolve: ['finance'],
  plans: ['finance', 'support', 'category'],
  editPlans: ['finance'],
  revenue: ['finance'],
  reviews: ['support', 'finance'],
  enquiries: ['support', 'finance'],
  audit: [],
  team: [],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me')
      .then(({ data }) => { if (data.user.role === 'admin') { setUser(data.user); connectSocket(tokenStore.get()); } else tokenStore.clear(); })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(({ token, user: u }) => { tokenStore.set(token); setUser(u); connectSocket(token); }, []);
  const signOut = useCallback(() => { tokenStore.clear(); disconnectSocket(); setUser(null); }, []);
  const can = useCallback((area) => !!user && (user.adminRole === 'super' || (ACCESS[area] || []).includes(user.adminRole)), [user]);

  const value = useMemo(() => ({ user, loading, signIn, signOut, can }), [user, loading, signIn, signOut, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
