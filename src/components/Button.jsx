import { useState, useRef, useEffect } from "react";

/* A button that shows a loading spinner while its action is in flight, so the
   user knows to wait. Two modes (they can combine):
   - Auto: if onClick returns a promise, the spinner shows until it resolves.
   - Controlled: pass loading={true} (e.g. for <form> submit buttons whose work
     is driven by onSubmit, not onClick).
   Everything else (className, type, title, style, disabled...) passes through. */
export default function Button({ onClick, children, className = "btn", loading = false, disabled = false, type = "button", ...rest }) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const isLoading = loading || busy;

  const handle = (e) => {
    if (isLoading || disabled || !onClick) return;
    const r = onClick(e);
    if (r && typeof r.then === "function") {
      setBusy(true);
      Promise.resolve(r).finally(() => { if (mounted.current) setBusy(false); });
    }
  };

  return (
    <button type={type} className={className + (isLoading ? " is-loading" : "")}
      disabled={isLoading || disabled} onClick={handle} {...rest}>
      {isLoading && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
