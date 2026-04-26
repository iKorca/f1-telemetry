import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Human-readable identifier shown when the boundary traps an error */
  label?: string;
  /** Optional fallback renderer. Receives the error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Local error boundary — wraps a single panel / chart so one runtime fault
 * doesn't take the whole tab down. Per React docs, this must be a class
 * component; keep the implementation tight.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log with the label so console triage is fast.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return (
      <div
        role="alert"
        style={{
          padding: '0.6rem 0.8rem',
          border: '1px solid rgba(232, 0, 45, 0.35)',
          borderRadius: '6px',
          background: 'rgba(232, 0, 45, 0.06)',
          color: 'var(--grey-light)',
          fontFamily: 'var(--font-d)',
          fontSize: '0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
        }}
      >
        <div style={{ color: 'var(--red)', fontWeight: 700, letterSpacing: '0.1em' }}>
          {this.props.label || 'Panel'} crashed
        </div>
        <div style={{ fontSize: '0.55rem' }}>{this.state.error.message}</div>
        <button
          type="button"
          onClick={this.reset}
          style={{
            alignSelf: 'flex-start',
            fontFamily: 'var(--font-d)',
            fontSize: '0.5rem',
            padding: '0.2rem 0.5rem',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            background: 'transparent',
            color: 'var(--white)',
            cursor: 'pointer',
          }}
        >
          RETRY
        </button>
      </div>
    );
  }
}
