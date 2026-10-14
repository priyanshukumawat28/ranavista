import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { timeAgo } from '../lib/format';
import { cx } from './ui';

export default function NotificationBell({ allLink }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ list: [], unread: 0 });
  const ref = useRef(null);

  const load = useCallback(() => api.get('/notifications').then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useSocketEvent('notification', useCallback((n) => setData((d) => ({ list: [n, ...d.list].slice(0, 50), unread: d.unread + 1 })), []));

  const markAll = async () => {
    await api.post('/notifications/read');
    setData((d) => ({ list: d.list.map((n) => ({ ...n, read: true })), unread: 0 }));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-ink-medium hover:bg-mist hover:text-forest" aria-label={`Notifications (${data.unread} unread)`}>
        <Bell className="h-5 w-5" />
        {data.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="rise absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-beige">
          <div className="flex items-center justify-between border-b border-mist px-4 py-3">
            <span className="font-medium text-forest">Notifications</span>
            {data.unread > 0 && <button onClick={markAll} className="text-xs text-muted hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {data.list.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-medium">You're all caught up.</p>}
            {data.list.slice(0, 12).map((n) => (
              <Link key={n._id} to={n.link || allLink} onClick={() => { setOpen(false); if (!n.read) api.post('/notifications/read', { id: n._id }); }}
                className={cx('block border-b border-mist px-4 py-3 transition hover:bg-cream/60', !n.read && 'bg-gold/5')}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-ink-medium">{n.body}</p>
                    <p className="mt-1 text-[11px] text-slate-dark">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {allLink && <Link to={allLink} onClick={() => setOpen(false)} className="block bg-cream/50 py-2.5 text-center text-xs font-medium text-forest hover:bg-cream">View all</Link>}
        </div>
      )}
    </div>
  );
}
