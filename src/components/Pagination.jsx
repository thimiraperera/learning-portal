import { ChevronLeft, ChevronRight } from "lucide-react";

const SIZES = [6, 10, 20, 50, 100];

/* Page navigator with an optional admin-selectable page size.
   Pass pageSize + onPageSize to show the "show N per page" control. */
export default function Pagination({ page, pageCount, onChange, pageSize, onPageSize, total }) {
  const showSizer = !!onPageSize;
  if (pageCount <= 1 && !showSizer) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="pagination-bar">
      {showSizer && (
        <div className="page-size">
          Show
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          per page{typeof total === "number" ? ` · ${total} total` : ""}
        </div>
      )}
      {pageCount > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft /> Prev</button>
          {pages.map((p) => (
            <button key={p} className={"page-btn" + (p === page ? " on" : "")} onClick={() => onChange(p)}>{p}</button>
          ))}
          <button className="page-btn" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next <ChevronRight /></button>
        </div>
      )}
    </div>
  );
}
