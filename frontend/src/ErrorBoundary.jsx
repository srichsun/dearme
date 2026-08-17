import { Component } from "react";

// When a screen throws, React unmounts the whole tree — which leaves a blank
// page and no clue what happened. This catches it and says something instead,
// and keeps the error where it can be read: on the screen behind a tap, and in
// the console, so a phone in someone else's hand is still diagnosable.
//
// A class because that is still the only way to catch a render error in React.
export default class ErrorBoundary extends Component {
  state = { error: null, shown: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Left in the console on purpose: this is the only copy of what went wrong.
    console.error("Dear Myself crashed:", error, info?.componentStack);
  }

  render() {
    const { error, shown } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="screen crashed">
        <section className="panel">
          <h2 className="display">Something went wrong</h2>
          <p className="note">
            Nothing you wrote is lost — it is saved as you go. Reloading usually
            fixes it.
          </p>
          <button className="primary wide" onClick={() => location.reload()}>
            Reload
          </button>
          <button
            className="ghost wide"
            onClick={() => this.setState({ shown: !shown })}
          >
            {shown ? "Hide details" : "What happened?"}
          </button>
          {shown && (
            <pre className="crashdetail">
              {/* Message first and always: Safari's stack omits it, so a stack
                  on its own says where but never what. */}
              {[String(error?.message || error), error?.stack]
                .filter(Boolean)
                .join("\n\n")}
            </pre>
          )}
        </section>
      </main>
    );
  }
}
