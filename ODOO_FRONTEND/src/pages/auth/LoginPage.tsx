import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { tryMockLogin } from '@/api/mock';
import { ArrowRight, ShieldCheck, ReceiptText, Clock3, Sparkles } from 'lucide-react';

const trustPoints = [
  'Session bootstrap after login',
  'Role-aware navigation and permissions',
  'Employee, manager, and admin workflows in one system',
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await auth.login({ email, password });
      await login(res.data.access_token);
      navigate('/app');
    } catch {
      const mock = tryMockLogin(email, password);
      if (mock) {
        await login(mock.token);
        navigate('/app');
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editorial-auth-shell bg-[var(--bg-base)]">
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="space-y-8 text-left">
          <div className="editorial-chip">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                Odoo reimbursements
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Trust-first workflow control
              </p>
            </div>
          </div>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Sign in to a workflow that reads like a ledger, not a toy dashboard.
            </h1>
            <p className="max-w-xl text-base md:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Employee submissions, OCR review, manager approvals, and reimbursement tracking all sit behind one session. This entry point restores the company context, role, and permissions before the app shell renders.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="editorial-feature">
              <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Secure session
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Login returns a token, then `GET /auth/me` resolves the current company and role.
              </p>
            </div>
            <div className="editorial-feature">
              <ReceiptText size={18} style={{ color: 'var(--accent-emerald)' }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Expense context
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Submission, history, and OCR review stay attached to the same company ledger.
              </p>
            </div>
            <div className="editorial-feature">
              <Clock3 size={18} style={{ color: 'var(--accent-amber)' }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Fast handoff
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Once authenticated, users land in the app shell with the right starting route.
              </p>
            </div>
          </div>

          <div className="ops-info-card space-y-3 rounded-[1.75rem] p-5 md:p-6">
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              What this session unlocks
            </p>
            <div className="grid gap-2">
              {trustPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-1 h-2 w-2 rounded-full" style={{ background: 'var(--primary)' }} />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">
          <div className="editorial-form-shell animate-fade-in-scale">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>
                Secure sign in
              </p>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Resume your company workspace
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Enter the same account used for submission, approval, or admin operations. The backend remains the source of truth for role and company access.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    color: 'var(--accent-rose)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.16)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
                style={{ padding: '13px 24px', fontSize: '15px' }}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Don&apos;t have a company yet?{' '}
              <Link
                to="/signup"
                className="font-semibold transition-colors duration-150"
                style={{ color: 'var(--primary)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary-dark)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--primary)'; }}
              >
                Create one
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
