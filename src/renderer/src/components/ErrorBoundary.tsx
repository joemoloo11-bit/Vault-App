import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: { componentStack?: string } | null
}

interface Props {
  children: ReactNode
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
    this.setState({ hasError: true, error, errorInfo })
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const stack = this.state.errorInfo?.componentStack ?? ''
      return (
        <div style={{
          padding: '32px',
          minHeight: '100vh',
          backgroundColor: '#0D1117',
          color: '#F0F6FC',
          fontFamily: 'Inter, system-ui, sans-serif',
          overflowY: 'auto',
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
              Vault crashed
            </h1>
            <p style={{ fontSize: '13px', color: '#8B949E', marginBottom: '24px' }}>
              Something went wrong while rendering. Screenshot this whole screen and send it. Then close Vault and reopen.
            </p>

            <div style={{
              backgroundColor: '#161B22',
              border: '1px solid #DA3633',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', marginBottom: '8px' }}>
                Error
              </p>
              <p style={{ fontSize: '14px', fontFamily: 'JetBrains Mono, Consolas, monospace', color: '#F85149', wordBreak: 'break-word' }}>
                {this.state.error.name}: {this.state.error.message}
              </p>
            </div>

            {this.state.error.stack && (
              <div style={{
                backgroundColor: '#161B22',
                border: '1px solid #21262D',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', marginBottom: '8px' }}>
                  Stack trace
                </p>
                <pre style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  color: '#C9D1D9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            {stack && (
              <div style={{
                backgroundColor: '#161B22',
                border: '1px solid #21262D',
                borderRadius: '8px',
                padding: '16px',
              }}>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B949E', marginBottom: '8px' }}>
                  Component stack
                </p>
                <pre style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  color: '#C9D1D9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                  {stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              style={{
                marginTop: '24px',
                padding: '8px 16px',
                fontSize: '13px',
                backgroundColor: '#14B8A6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
