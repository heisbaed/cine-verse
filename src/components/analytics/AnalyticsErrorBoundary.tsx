import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  optional?: boolean;
}

export default class AnalyticsErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(this.props.optional ? 'Dashboard companion failed' : 'Dashboard failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.optional) return <p className="analytics-note" role="status">Cine is temporarily unavailable. Analytics are still available.</p>;
    return <div className="signal-shell"><main className="analytics-gate"><section className="signal-card" role="alert">
      <h1>Analytics could not load</h1>
      <p>The dashboard encountered an error. Reload to reconnect to your analytics.</p>
      <button className="signal-action" onClick={() => window.location.reload()}>Reload dashboard</button>
      <a href="/">Back to Cineverse</a>
    </section></main></div>;
  }
}
