import React from 'react';

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#000', color: 'var(--error)',
          fontFamily: 'var(--font-mono)', fontSize: 13, gap: 12,
        }}>
          <div>что-то пошло не так</div>
          <div style={{ opacity: 0.6, fontSize: 11, maxWidth: 400, textAlign: 'center' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 4, padding: '6px 16px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, cursor: 'pointer',
              color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--font-mono)',
            }}
          >попробовать снова</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
