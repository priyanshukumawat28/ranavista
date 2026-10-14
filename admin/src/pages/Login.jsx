import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Button, Field, Input } from '../components/ui';
import Logo from '../components/Logo';

export default function Login() {
  const { signIn } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { const { data } = await api.post('/auth/login', { ...f, portal: 'admin' }); signIn(data); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <div className="bg-hero flex min-h-screen items-center justify-center px-4">
      <div className="bg-grain fixed inset-0 opacity-30" aria-hidden />
      <form onSubmit={submit} className="rise relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-lift">
        <Logo tagline={false} />
        <p className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gold-dark"><ShieldCheck className="h-4 w-4" /> Staff sign-in</p>
        <div className="mt-5 space-y-4">
          {err && <Alert type="error">{err}</Alert>}
          <Field label="Email"><Input type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password"><Input type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Button loading={busy} className="w-full" size="lg">Sign in</Button>
        </div>
      </form>
    </div>
  );
}
