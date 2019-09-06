import React, { useContext, useEffect } from "react";
import { VError } from "verror";
import { AppStateContext, AppState } from "../AppState";
import { AuthError } from "../lib/errors";

export function ErrorHandler(props: { error: any }) {
  const { error } = props;
  const setAppState = useContext(AppStateContext).setState;

  useEffect(() => {
    if (error instanceof AuthError) {
      setAppState(AppState.auth);
    }
    logError(error);
  }, [error, setAppState]);

  let msg;
  if (error instanceof Error) {
    msg = error.message;
  } else if (error != null) {
    msg = error.toString();
  } else {
    msg = "Unknown error";
  }

  return (
    <div>
      <h2>Something went wrong :-(</h2>
      <p>Error: {msg}</p>
    </div>
  );
}

function logError(error: any, errorInfo?: any) {
  const allInfo = {
    ...VError.info(error),
    ...errorInfo
  };
  const stack = VError.fullStack(error);
  console.log("Unhandled error:", stack, allInfo);
}

type ErrorBoundaryState = { hasError: false } | { hasError: true; error: any };

export class ErrorBoundary extends React.Component<{}, ErrorBoundaryState> {
  public constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public render() {
    if (this.state.hasError) {
      return <ErrorHandler error={this.state.error}></ErrorHandler>;
    }

    return this.props.children;
  }
}
