import { useEffect, useRef } from "react";

/* Renders an explicit checkbox widget for either hCaptcha or Google reCAPTCHA v2.
   Both libraries expose the same render() options, so one component covers both.
   onChange(token) fires on success; onChange("") on expiry/error. */
const PROVIDERS = {
  hcaptcha: {
    get: () => window.hcaptcha,
    src: "https://js.hcaptcha.com/1/api.js?render=explicit&onload=__hcaptchaOnLoad",
    onload: "__hcaptchaOnLoad",
  },
  recaptcha: {
    get: () => window.grecaptcha,
    src: "https://www.google.com/recaptcha/api.js?render=explicit&onload=__recaptchaOnLoad",
    onload: "__recaptchaOnLoad",
  },
};

const scriptPromises = {};
function loadScript(provider) {
  const cfg = PROVIDERS[provider];
  if (typeof window === "undefined" || !cfg) return Promise.reject(new Error("no captcha provider"));
  if (cfg.get()) return Promise.resolve();
  if (scriptPromises[provider]) return scriptPromises[provider];
  scriptPromises[provider] = new Promise((resolve, reject) => {
    window[cfg.onload] = () => resolve();
    const s = document.createElement("script");
    s.src = cfg.src;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("captcha failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromises[provider];
}

export default function Captcha({ provider = "hcaptcha", siteKey, onChange }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    widgetId.current = null;
    if (ref.current) ref.current.innerHTML = ""; // clear a previous provider's widget
    loadScript(provider)
      .then(() => {
        const api = PROVIDERS[provider]?.get();
        if (cancelled || !ref.current || !api || widgetId.current != null) return;
        widgetId.current = api.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onChange(token),
          "expired-callback": () => onChange(""),
          "error-callback": () => onChange(""),
        });
      })
      .catch(() => { /* network/script error: leave the box empty */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, siteKey]);

  return <div ref={ref} className="h-captcha-box" />;
}
