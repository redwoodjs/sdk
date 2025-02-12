"use client"

import React from 'react'

interface Props {
  children: React.ReactNode
  componentName?: string
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in component ${this.props.componentName || 'unknown'}:`, {
      error,
      errorInfo,
      component: this.props.componentName,
      stack: error.stack
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-500 rounded-md bg-red-50">
          <h2 className="text-red-700 font-bold">Something went wrong in {this.props.componentName}</h2>
          <pre className="text-sm text-red-600 mt-2">{this.state.error?.message}</pre>
          <pre className="text-xs text-red-500 mt-2">{this.state.error?.stack}</pre>
        </div>
      )
    }

    return this.props.children
  }
} 