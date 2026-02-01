"use client";

import React, { ReactNode } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("React Error Boundary caught an error", error, {
      componentStack: errorInfo.componentStack,
    });

    // Show toast notification to user
    toast.error(`Application Error: ${error.message}`, {
      description: "Check the console for more details",
      duration: 10000,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <div className="flex gap-4">
              <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h1 className="text-xl font-bold text-red-400 mb-2">
                  Application Error
                </h1>
                <p className="text-red-300 text-sm mb-4">
                  {this.state.error?.message}
                </p>
                <div className="bg-red-950/50 rounded p-3 mb-4">
                  <p className="text-xs text-red-200 font-mono break-words">
                    {this.state.error?.stack}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
                  >
                    Reload Page
                  </button>
                  <button
                    onClick={() => window.location.href = "/"}
                    className="flex-1 px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded text-sm font-medium"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
