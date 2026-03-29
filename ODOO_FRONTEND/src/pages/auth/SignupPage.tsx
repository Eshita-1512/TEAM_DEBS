import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, Building2, Globe2, ShieldCheck, Sparkles } from 'lucide-react';

interface CountryOption {
  code: string;
  name: string;
  currency: string;
}

const fallbackCountries: CountryOption[] = [
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'EU', name: 'European Union', currency: 'EUR' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
];

function formatCurrencyBadge(country: CountryOption | undefined) {
  return country ? `${country.currency} default` : 'Currency preview unavailable';
}

export function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    company_name: '',
    country_code: '',
    admin_name: '',
    admin_email: '',
    password: '',
  });
  const [countries, setCountries] = useState<CountryOption[]>(fallbackCountries);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      try {
        const res = await fetch('/api/v1/reference/countries', {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error('countries unavailable');
        }
        const body = await res.json() as { items: CountryOption[] };
        if (!cancelled && Array.isArray(body.items) && body.items.length > 0) {
          setCountries(body.items);
          setForm(prev => {
            if (prev.country_code) return prev;
            const defaultCountry = body.items.find(item => item.code === 'US') ?? body.items[0];
            return { ...prev, country_code: defaultCountry.code };
          });
          return;
        }
      } catch {
        if (!cancelled) {
          setCountries(fallbackCountries);
          setForm(prev => {
            if (prev.country_code) return prev;
            return { ...prev, country_code: 'US' };
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingCountries(false);
        }
      }
    }

    loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCountry = countries.find(country => country.code === form.country_code);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await auth.signup(form);
      await login(res.data.access_token);
      navigate('/app');
    } catch {
      setError('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editorial-auth-shell bg-[var(--bg-base)]">
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="space-y-8">
          <div className="editorial-chip">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                Company bootstrap
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                First admin creates the tenant boundary
              </p>
            </div>
          </div>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Create a reimbursement workspace that starts with structure, not guesswork.
            </h1>
            <p className="max-w-xl text-base md:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Company onboarding should set the default currency, establish the first admin, and create a clean foundation for employee submissions, approvals, budgets, and audit records.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="editorial-feature">
              <Building2 size={18} style={{ color: 'var(--primary)' }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Tenant first
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Signup creates the company boundary and the first admin identity.
              </p>
            </div>
            <div className="editorial-feature">
              <Globe2 size={18} style={{ color: 'var(--accent-emerald)' }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Country-linked currency
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                The selected country determines the default currency used across the workspace.
              </p>
            </div>
            <div className="editorial-feature">
              <ShieldCheck size={18} style={{ color: 'var(--accent-amber)' }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Role-ready from day one
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Employee, manager, and admin routes all read from the same session data.
              </p>
            </div>
          </div>

          <div className="ops-info-card space-y-3 rounded-[1.75rem] p-5 md:p-6">
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              What gets created
            </p>
            <div className="grid gap-2">
              {[
                'Company record and company currency',
                'First admin user with elevated access',
                'Expense, approval, and audit workflows ready for use',
              ].map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-1 h-2 w-2 rounded-full" style={{ background: 'var(--primary)' }} />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">
          <div className="editorial-form-shell max-w-[560px] animate-fade-in-scale">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>
                Start a new company
              </p>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Create the first admin account
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                The default currency comes from the selected country, then the workspace opens with the full employee and approval experience.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                  Company name
                </span>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                  className="input-field"
                  placeholder="Acme Inc"
                  autoComplete="organization"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                  Country
                </span>
                <select
                  value={form.country_code}
                  onChange={e => setForm(prev => ({ ...prev, country_code: e.target.value }))}
                  className="input-field"
                  required
                  disabled={loadingCountries}
                >
                  <option value="">Select a country</option>
                  {countries.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.currency})
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>Your workspace currency is set from this choice.</span>
                  <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                    {formatCurrencyBadge(selectedCountry)}
                  </span>
                </div>
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                    Admin name
                  </span>
                  <input
                    type="text"
                    value={form.admin_name}
                    onChange={e => setForm(prev => ({ ...prev, admin_name: e.target.value }))}
                    className="input-field"
                    placeholder="Jane Doe"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                    Admin email
                  </span>
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={e => setForm(prev => ({ ...prev, admin_email: e.target.value }))}
                    className="input-field"
                    placeholder="jane@acme.com"
                    autoComplete="email"
                    required
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                  Password
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  className="input-field"
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                    Creating account...
                  </>
                ) : (
                  <>
                    Create company
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Already have a workspace?{' '}
              <Link
                to="/login"
                className="font-semibold transition-colors duration-150"
                style={{ color: 'var(--primary)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary-dark)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--primary)'; }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
