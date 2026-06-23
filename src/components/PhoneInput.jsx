import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

/* Phone field with a country-code selector (flag + dial code) next to the
   number box. The combined value is stored as "<dial> <number>" e.g.
   "+94 771234567", so it round-trips through the existing `phone` column.
   Flags come from flagcdn.com so they render on every platform (emoji flags
   do not show on Windows). */
const COUNTRIES = [
  { c: "lk", d: "+94", n: "Sri Lanka" },
  { c: "in", d: "+91", n: "India" },
  { c: "gb", d: "+44", n: "United Kingdom" },
  { c: "us", d: "+1", n: "United States" },
  { c: "au", d: "+61", n: "Australia" },
  { c: "ca", d: "+1", n: "Canada" },
  { c: "ae", d: "+971", n: "United Arab Emirates" },
  { c: "sa", d: "+966", n: "Saudi Arabia" },
  { c: "qa", d: "+974", n: "Qatar" },
  { c: "kw", d: "+965", n: "Kuwait" },
  { c: "sg", d: "+65", n: "Singapore" },
  { c: "my", d: "+60", n: "Malaysia" },
  { c: "pk", d: "+92", n: "Pakistan" },
  { c: "bd", d: "+880", n: "Bangladesh" },
  { c: "np", d: "+977", n: "Nepal" },
  { c: "mv", d: "+960", n: "Maldives" },
  { c: "de", d: "+49", n: "Germany" },
  { c: "fr", d: "+33", n: "France" },
  { c: "it", d: "+39", n: "Italy" },
  { c: "es", d: "+34", n: "Spain" },
  { c: "nl", d: "+31", n: "Netherlands" },
  { c: "se", d: "+46", n: "Sweden" },
  { c: "ch", d: "+41", n: "Switzerland" },
  { c: "ie", d: "+353", n: "Ireland" },
  { c: "nz", d: "+64", n: "New Zealand" },
  { c: "za", d: "+27", n: "South Africa" },
  { c: "ng", d: "+234", n: "Nigeria" },
  { c: "ke", d: "+254", n: "Kenya" },
  { c: "eg", d: "+20", n: "Egypt" },
  { c: "cn", d: "+86", n: "China" },
  { c: "jp", d: "+81", n: "Japan" },
  { c: "kr", d: "+82", n: "South Korea" },
  { c: "ph", d: "+63", n: "Philippines" },
  { c: "id", d: "+62", n: "Indonesia" },
  { c: "th", d: "+66", n: "Thailand" },
  { c: "vn", d: "+84", n: "Vietnam" },
  { c: "br", d: "+55", n: "Brazil" },
];
const DEFAULT = COUNTRIES[0];

const flagSrc = (c) => `https://flagcdn.com/20x15/${c}.png`;

/* Split a stored value into a country + local number. Dial codes vary in
   length, so match the longest dial-code prefix. */
function parse(value) {
  const v = String(value || "").trim();
  if (!v) return { country: DEFAULT, number: "" };
  const digits = v.replace(/[^\d+]/g, "");
  const sorted = [...COUNTRIES].sort((a, b) => b.d.length - a.d.length);
  const hit = sorted.find((o) => digits.startsWith(o.d));
  if (hit) return { country: hit, number: digits.slice(hit.d.length) };
  return { country: DEFAULT, number: v.replace(/^\+/, "") };
}

export default function PhoneInput({ value, onChange, style }) {
  const init = parse(value);
  const [country, setCountry] = useState(init.country);
  const [number, setNumber] = useState(init.number);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  // Reflect external value changes (e.g. switching which student is edited).
  useEffect(() => {
    const p = parse(value);
    setCountry(p.country);
    setNumber(p.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const emit = (cty, num) => {
    const clean = num.replace(/[^\d]/g, "");
    onChange(clean ? `${cty.d} ${clean}` : "");
  };
  const pickCountry = (cty) => { setCountry(cty); setOpen(false); setQuery(""); emit(cty, number); };
  const setNum = (raw) => { const num = raw.replace(/[^\d]/g, ""); setNumber(num); emit(country, num); };

  const ql = query.trim().toLowerCase();
  const matches = COUNTRIES.filter((o) => !ql || o.n.toLowerCase().includes(ql) || o.d.includes(ql) || o.c.includes(ql));

  return (
    <div className="phone-input" ref={ref} style={style}>
      <button type="button" className="phone-cc" onClick={() => setOpen((o) => !o)}>
        <img src={flagSrc(country.c)} alt="" width="20" height="15" />
        <span>{country.d}</span>
        <ChevronDown className="ss-chev" />
      </button>
      <input className="phone-num" inputMode="tel" name="phone" autoComplete="tel" value={number} onChange={(e) => setNum(e.target.value)} placeholder="771234567" />
      {open && (
        <div className="ss-panel phone-menu">
          <div className="ss-search">
            <Search />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search country..." />
          </div>
          <div className="ss-options">
            {matches.map((o) => (
              <button type="button" key={o.c + o.d} className={"ss-option phone-opt" + (o.c === country.c && o.d === country.d ? " on" : "")} onClick={() => pickCountry(o)}>
                <img src={flagSrc(o.c)} alt="" width="20" height="15" /> <span className="phone-opt-name">{o.n}</span> <span className="phone-opt-dial">{o.d}</span>
              </button>
            ))}
            {matches.length === 0 && <div className="ss-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
