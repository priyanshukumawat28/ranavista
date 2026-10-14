import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, MessageSquare, Paperclip, Send } from 'lucide-react';
import api, { errMsg, fileUrl, uploadFiles } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { Spinner, cx } from './ui';

export default function Chat({ rfqId, counterpart = 'the other party' }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const bottom = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get(`/chat/${rfqId}`).then((r) => { setMsgs(r.data.messages); setOpen(r.data.open); }).catch((e) => setErr(errMsg(e))).finally(() => setLoading(false));
  }, [rfqId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs.length]);

  useSocketEvent('message', useCallback((p) => {
    if (p.rfqId !== rfqId) return;
    setMsgs((m) => (m.some((x) => x._id === p.message._id) ? m : [...m, p.message]));
  }, [rfqId]));

  const send = async (attachment) => {
    if (!text.trim() && !attachment) return;
    setBusy(true);
    setErr('');
    try {
      const { data } = await api.post(`/chat/${rfqId}`, { text, attachment });
      setMsgs((m) => (m.some((x) => x._id === data._id) ? m : [...m, data]));
      setText('');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const attach = async (e) => {
    if (!e.target.files?.length) return;
    try {
      const [f] = await uploadFiles([e.target.files[0]]);
      await send(f);
    } catch (x) { setErr(errMsg(x)); }
    e.target.value = '';
  };

  return (
    <div className="card flex h-[520px] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-mist px-5 py-3.5">
        <MessageSquare className="h-4 w-4 text-gold" />
        <span className="font-medium text-forest">Messages</span>
        <span className="text-xs text-ink-medium">with {counterpart}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-cream/40 px-4 py-4">
        {loading && <div className="flex justify-center py-10"><Spinner /></div>}
        {!loading && msgs.length === 0 && (
          <p className="py-14 text-center text-sm text-ink-medium">{open ? 'No messages yet. Say hello 👋' : 'Chat opens once the seller sends a quotation.'}</p>
        )}
        {msgs.map((m) => {
          const mine = String(m.sender?._id) === String(user._id);
          return (
            <div key={m._id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-forest text-white' : 'rounded-bl-md bg-white text-ink ring-1 ring-beige')}>
                {!mine && <p className="mb-0.5 text-[11px] font-medium text-gold-dark">{m.sender?.company || m.sender?.name}</p>}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                {m.attachment?.url && (
                  <a href={fileUrl(m.attachment.url)} target="_blank" rel="noreferrer" className={cx('mt-1 inline-flex items-center gap-1 text-xs underline', mine ? 'text-gold-light' : 'text-muted')}>
                    <Paperclip className="h-3 w-3" />{m.attachment.name}
                  </a>
                )}
                <p className={cx('mt-1 text-[10px]', mine ? 'text-white/50' : 'text-ink-medium')}>{dateTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {err && <p className="border-t border-mist bg-danger/5 px-4 py-2 text-xs text-danger">{err}</p>}
      {open ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-mist bg-white p-3">
          <input type="file" ref={fileRef} className="hidden" onChange={attach} />
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg p-2.5 text-ink-medium hover:bg-mist" aria-label="Attach file"><Paperclip className="h-4 w-4" /></button>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Write a message…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5" />
          <button disabled={busy || !text.trim()} className="btn-primary px-3.5" aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      ) : (
        <div className="flex items-center gap-2 border-t border-mist bg-white px-4 py-3 text-xs text-ink-medium"><Lock className="h-3.5 w-3.5" /> Chat is locked until a quotation is sent.</div>
      )}
    </div>
  );
}
