import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#141414] flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="text-[#c94a4a] text-4xl font-bold">!<span className="text-[#555]">!</span></div>
            <h1 className="text-[#d4d4d4] text-xl font-semibold">Something went wrong</h1>
            <p className="text-[#888] text-sm leading-relaxed">
              The application encountered an error. This usually happens when the backend is not running.
            </p>
            <div className="bg-[#1e1e1e] border border-[#333] rounded p-3 text-left text-xs text-[#c94a4a] font-mono break-all max-h-32 overflow-y-auto">
              {this.state.error.message}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { this.setState({ error: null }); window.location.reload() }}
                className="bg-[#c9673a] hover:bg-[#d97a4a] text-black font-semibold px-5 py-2 rounded text-sm transition-colors"
              >
                Reload
              </button>
              <button
                onClick={() => { this.setState({ error: null }) }}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#ccc] px-5 py-2 rounded text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
            <p className="text-[#555] text-xs">
              Make sure both servers are running, then reload.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
