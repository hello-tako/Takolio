import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminApiError } from '../api/client';
import { useAuthConfig, useLogin } from '../api/hooks';
import { BrandLockup } from '../components/TakolioEmblem';
import { Badge, Button, ErrorState, Field, LoadingState, Notice, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { loginErrorMessage } from '../lib/errors';

function PasswordLogin() {
  const login = useLogin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: () => setPassword(''),
      },
    );
  };

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <Field label={vi.auth.email} htmlFor="admin-login-email">
        <input
          id="admin-login-email"
          data-testid="admin-login-email"
          type="email"
          name="email"
          placeholder={vi.auth.emailPlaceholder}
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label={vi.auth.password} htmlFor="admin-login-password">
        <input
          id="admin-login-password"
          data-testid="admin-login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      {login.isError ? (
        <p className="form-error" role="alert" data-testid="admin-login-error">
          {loginErrorMessage(login.error)}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="btn-block" data-testid="admin-login-submit" disabled={login.isPending}>
        {login.isPending ? vi.auth.submitting : vi.auth.submit}
      </Button>
    </form>
  );
}

function CloudflareLogin() {
  const login = useLogin();
  const navigate = useNavigate();
  return (
    <div className="login-form">
      <p className="muted">{vi.auth.cloudflareBody}</p>
      {login.isError ? (
        <p className="form-error" role="alert" data-testid="admin-login-error">
          {loginErrorMessage(login.error)}
        </p>
      ) : null}
      <Button
        variant="primary"
        className="btn-block"
        data-testid="admin-login-submit"
        disabled={login.isPending}
        onClick={() => login.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}
      >
        {login.isPending ? vi.auth.submitting : vi.auth.cloudflareButton}
      </Button>
    </div>
  );
}

const MODE_TONE: Record<string, Tone> = {
  cloudflare_access: 'brand',
  password: 'info',
  unavailable: 'warning',
};

export function LoginPage() {
  const [params] = useSearchParams();
  const reasonKey = params.get('reason') ?? '';
  const reason = Object.prototype.hasOwnProperty.call(vi.auth.reasons, reasonKey) ? vi.auth.reasons[reasonKey] : undefined;
  const config = useAuthConfig();

  let body: ReactNode;
  if (config.isPending) {
    body = <LoadingState rows={2} />;
  } else if (config.isError) {
    body =
      config.error instanceof AdminApiError && config.error.status === 404 ? (
        <Notice tone="warning" title={vi.auth.consoleDisabledTitle} testId="admin-login-unavailable">
          {vi.auth.consoleDisabledBody}
        </Notice>
      ) : (
        <ErrorState error={config.error} onRetry={() => void config.refetch()} />
      );
  } else if (config.data.mode === 'password') {
    body = <PasswordLogin />;
  } else if (config.data.mode === 'cloudflare_access') {
    body = (
      <>
        <h2 className="login-subtitle">{vi.auth.cloudflareTitle}</h2>
        <CloudflareLogin />
      </>
    );
  } else {
    body = (
      <Notice tone="warning" title={vi.auth.unavailableTitle} testId="admin-login-unavailable">
        {vi.auth.unavailableBody}
      </Notice>
    );
  }

  const mode = config.data?.mode;

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-sanctuary" aria-label={vi.auth.postureTitle}>
          <div>
            <div className="login-sanctuary-eyebrow">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>{vi.auth.securityEyebrow}</span>
            </div>
            <BrandLockup className="brand" />
            <div style={{ marginTop: '20px' }}>
              <h2>{vi.auth.postureTitle}</h2>
              <ul className="login-posture-list">
                {vi.auth.postureItems.map((item) => (
                  <li key={item}>
                    <span className="login-posture-bullet" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="small" style={{ color: '#B6C3BD', margin: 0 }}>
            Takolio Control Tower V4 · Cloudflare Workers Edge Isolation
          </p>
        </aside>

        <main id="admin-main" className="login-card" tabIndex={-1}>
          {mode ? (
            <div className="login-mode-row">
              <Badge tone={MODE_TONE[mode] ?? 'neutral'}>{vi.auth.modeBadges[mode] ?? mode}</Badge>
            </div>
          ) : null}
          <h1 data-testid="admin-page-title">{vi.auth.loginTitle}</h1>
          <p className="muted">{vi.auth.loginLead}</p>
          {reason ? (
            <Notice tone="warning" testId="admin-login-reason">
              {reason}
            </Notice>
          ) : null}
          {body}
        </main>
      </div>
    </div>
  );
}
