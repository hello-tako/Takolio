import { Component, type ErrorInfo, type ReactNode } from 'react';
import { vi } from '../i18n/vi';

interface State { failed: boolean }

/** Keeps the shell usable when a page throws; no stack or message is shown. */
export class AdminErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    console.error(JSON.stringify({ level: 'error', event: 'admin_render_error' }));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="state state-error" role="alert" data-testid="admin-error-boundary">
        <h1 data-testid="admin-page-title">{vi.errorBoundary.title}</h1>
        <p>{vi.errorBoundary.body}</p>
        <button type="button" className="btn btn-secondary" onClick={() => this.setState({ failed: false })}>
          {vi.common.retry}
        </button>
      </div>
    );
  }
}
