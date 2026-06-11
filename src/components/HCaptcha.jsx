import { useEffect, useRef } from "react";

/* Loads the hCaptcha script once and renders a widget explicitly.
   onChange(token) fires on success; onChange("") on expiry/error. */
let scriptPromise = null;
function loadScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.hcaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    window.__hcaptchaOnLoad = () => resolve();
    const s = document.createElement("script");
    s.src = "https://js.hcaptcha.com/1/api.js?render=explicit&onload=__hcaptchaOnLoad";
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("hCaptcha failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function HCaptcha({ siteKey, onChange }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.hcaptcha || widgetId.current != null) return;
        widgetId.current = window.hcaptcha.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onChange(token),
          "expired-callback": () => onChange(""),
          "error-callback": () => onChange(""),
        });
      })
      .catch(() => { /* network/script error: leave the box empty */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={ref} className="h-captcha-box" />;
}
