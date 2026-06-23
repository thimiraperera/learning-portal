import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle, AlertTriangle, Info, X, HelpCircle, Trash2 } from "lucide-react";

/* In-app popup notifications. Replaces the native browser dialogs
   (window.confirm / window.alert / window.prompt) and adds toast notifications.
   A module-level bridge lets any code call popup.confirm/alert/prompt/toast
   without threading a hook through deeply nested components. */
const bridge = { fns: null };
let uid = 0;

export const popup = {
  confirm: (message, opts) => (bridge.fns ? bridge.fns.confirm(message, opts) : Promise.resolve(window.confirm(message))),
  alert:   (message, opts) => (bridge.fns ? bridge.fns.alert(message, opts) : Promise.resolve(window.alert(message))),
  prompt:  (message, def, opts) => (bridge.fns ? bridge.fns.prompt(message, def, opts) : Promise.resolve(window.prompt(message, def))),
  toast:   (message, type) => (bridge.fns ? bridge.fns.toast(message, type) : undefined),
};

const PopupCtx = createContext(popup);
export const usePopup = () => useContext(PopupCtx);

const TONE_ICON = { primary: HelpCircle, danger: Trash2, success: CheckCircle, warning: AlertTriangle, info: Info };
const TOAST_ICON = { success: CheckCircle, error: AlertTriangle, info: Info, warning: AlertTriangle };

export function PopupProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { kind, title, message, confirmText, cancelText, tone, value, placeholder, resolve }
  const [toasts, setToasts] = useState([]);
  const inputRef = useRef(null);

  const finish = useCallback((result) => {
    setDialog((d) => { if (d) d.resolve(result); return null; });
  }, []);

  const confirm = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({
      kind: "confirm", message, resolve,
      title: opts.title || "Please confirm",
      confirmText: opts.confirmText || "Confirm",
      cancelText: opts.cancelText || "Cancel",
      tone: opts.tone || (opts.danger ? "danger" : "primary"),
    });
  }), []);

  const alert = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({
      kind: "alert", message, resolve,
      title: opts.title || "Notice",
      confirmText: opts.confirmText || "OK",
      tone: opts.tone || "info",
    });
  }), []);

  const prompt = useCallback((message, def = "", opts = {}) => new Promise((resolve) => {
    setDialog({
      kind: "prompt", message, resolve, value: def == null ? "" : String(def),
      title: opts.title || "Enter a value",
      confirmText: opts.confirmText || "OK",
      cancelText: opts.cancelText || "Cancel",
      tone: opts.tone || "primary",
      placeholder: opts.placeholder || "",
    });
  }), []);

  const removeToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message, type = "success") => {
    if (!message) return;
    const id = ++uid;
    setToasts((t) => [...t, { id, message: String(message), type }]);
    setTimeout(() => removeToast(id), 4500);
    return id;
  }, [removeToast]);

  // Wire the module bridge so popup.* works everywhere.
  useEffect(() => {
    bridge.fns = { confirm, alert, prompt, toast };
    return () => { if (bridge.fns && bridge.fns.confirm === confirm) bridge.fns = null; };
  }, [confirm, alert, prompt, toast]);

  // Focus the prompt input when a prompt opens.
  useEffect(() => { if (dialog?.kind === "prompt" && inputRef.current) inputRef.current.focus(); }, [dialog]);

  // Keyboard: Enter accepts, Escape cancels.
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); finish(dialog.kind === "alert" ? undefined : (dialog.kind === "prompt" ? null : false)); }
      else if (e.key === "Enter" && dialog.kind !== "prompt") { e.preventDefault(); accept(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  const accept = () => {
    if (!dialog) return;
    if (dialog.kind === "confirm") finish(true);
    else if (dialog.kind === "prompt") finish(dialog.value);
    else finish(undefined);
  };
  const cancel = () => {
    if (!dialog) return;
    finish(dialog.kind === "prompt" ? null : (dialog.kind === "alert" ? undefined : false));
  };

  const Icon = dialog ? (TONE_ICON[dialog.tone] || HelpCircle) : null;
  const value = { confirm, alert, prompt, toast };

  return (
    <PopupCtx.Provider value={value}>
      {children}

      {dialog && (
        <div className="popup-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
          <div className="popup-card" role="dialog" aria-modal="true">
            <div className="popup-head">
              <span className={"popup-icon " + dialog.tone}><Icon /></span>
              <div className="popup-title">{dialog.title}</div>
            </div>
            {dialog.message && <div className="popup-message">{dialog.message}</div>}
            {dialog.kind === "prompt" && (
              <input ref={inputRef} className="form-control" style={{ marginBottom: 18 }}
                value={dialog.value} placeholder={dialog.placeholder}
                onChange={(e) => setDialog((d) => ({ ...d, value: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); accept(); } }} />
            )}
            <div className="popup-actions">
              {dialog.kind !== "alert" && (
                <button className="btn btn-ghost" onClick={cancel}>{dialog.cancelText}</button>
              )}
              <button className={"btn " + (dialog.tone === "danger" ? "btn-danger" : "btn-primary")} onClick={accept}>
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack">
        {toasts.map((t) => {
          const TI = TOAST_ICON[t.type] || Info;
          return (
            <div key={t.id} className={"toast " + t.type}>
              <TI />
              <div className="toast-msg">{t.message}</div>
              <button className="toast-x" title="Dismiss" onClick={() => removeToast(t.id)}><X style={{ width: 15, height: 15 }} /></button>
            </div>
          );
        })}
      </div>
    </PopupCtx.Provider>
  );
}
