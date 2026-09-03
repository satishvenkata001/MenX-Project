import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Premium MENX Global React Error Boundary Component
 * Catches uncaught runtime render errors in children and displays a sleek MENX fallback UI
 * instead of unmounting the tree to a blank white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error(' [MENX ErrorBoundary Caught Error]:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in duration-300">
            
            {/* Icon Banner */}
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-500 shadow-lg shadow-amber-500/5">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <h1 className="text-xl font-black text-white tracking-tight">
                Something went wrong
              </h1>
              <p className="text-xs text-gray-400 leading-relaxed">
                We encountered an unexpected interface error. Your account data and session remain secure.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-black font-extrabold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-750 active:scale-95 text-gray-200 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 border border-gray-700 transition-all cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go Home</span>
              </button>
            </div>

            {/* Development-only error snippet preview */}
            {import.meta.env.DEV && this.state.error && (
              <div className="text-left bg-gray-950 border border-gray-800/80 rounded-xl p-3 text-[10px] font-mono text-red-400 overflow-x-auto max-h-32">
                <span className="font-bold text-gray-400 block mb-1">Dev Debug:</span>
                {this.state.error.toString()}
              </div>
            )}

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
