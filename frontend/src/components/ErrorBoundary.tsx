import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '600px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '30px',
            textAlign: 'center',
          }}>
            <h1 style={{ color: '#dc3545', marginTop: 0 }}>⚠️ Something went wrong</h1>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              An unexpected error occurred. This has been logged and we'll look into it.
            </p>
            
            <details style={{
              marginBottom: '20px',
              textAlign: 'left',
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '4px',
              border: '1px solid #dee2e6',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '10px' }}>
                Error Details
              </summary>
              <div style={{
                fontSize: '13px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#721c24',
              }}>
                {this.state.error?.toString()}
                {this.state.errorInfo && (
                  <>
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </div>
            </details>

            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
