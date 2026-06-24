import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

/* A searchable dropdown (typeahead combobox).
   options: [{ value, label }]; value "all" (or unset) shows the placeholder.
   Pass showAll={false} to hide the "All" reset option (pick-one mode). */
export default function SearchSelect({ value, onChange, options, placeholder = "All", allLabel = "All", showAll = true, style, limit = 10, emptyText = "No matches" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !q || o.label.toLowerCase().includes(q));
  // Without a query, only show the most recent `limit`; searching covers all.
  const shown = q ? matches : matches.slice(0, limit);
  const hidden = q ? 0 : matches.length - shown.length;

  const pick = (v) => { onChange(v); setOpen(false); setQuery(""); };

  return (
    <div className="search-select" ref={ref} style={style}>
      <button type="button" className="form-control ss-trigger" onClick={() => setOpen((o) => !o)}>
        <span className={selected ? "" : "ss-placeholder"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className="ss-chev" />
      </button>
      {open && (
        <div className="ss-panel">
          <div className="ss-search">
            <Search />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to search..." />
          </div>
          <div className="ss-options">
            {showAll && <button type="button" className={"ss-option" + (!selected ? " on" : "")} onClick={() => pick("all")}>{allLabel}</button>}
            {shown.map((o) => (
              <button type="button" key={o.value} className={"ss-option" + (o.value === value ? " on" : "")} onClick={() => pick(o.value)}>{o.label}</button>
            ))}
            {matches.length === 0 && <div className="ss-empty">{q ? "No matches" : emptyText}</div>}
            {hidden > 0 && <div className="ss-hint">Showing {shown.length} of {matches.length}. Type to search the rest.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
