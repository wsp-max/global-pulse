"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-6">
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
            <p className="text-sm font-semibold text-red-200">화면 렌더링 중 오류가 발생했습니다.</p>
            <p className="mt-2 text-xs text-red-300">
              페이지를 새로고침해 주세요. 같은 문제가 반복되면 운영 로그를 확인해 주세요.
            </p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

