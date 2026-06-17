import { ChevronLeft, ChevronRight } from "lucide-react";

const SIZES = [6, 10, 20, 50, 100];

/* Windowed page list: always show the first and last page, the current page
   with one neighbour each side, and a "…" where pages are skipped. Keeps the
   row short enough to stay on one line in every screen size. */
function pageItems(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(pageCount - 1, page + 1);
  if (left > 2) items.push("...");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < pageCount - 1) items.push("...");
  items.push(pageCount);
  return items;
}

/* Page navigator with an optional admin-selectable page size.
   Pass pageSize + onPageSize to show the "show N per page" control.
   On mobile the Prev/Next buttons drop below the numbers, each half-width. */
export default function Pagination({ page, pageCount, onChange, pageSize, onPageSize, total }) {
  const showSizer = !!onPageSize;
  if (pageCount <= 1 && !showSizer) return null;

  const items = pageItems(page, pageCount);

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
          <button className="page-btn page-prev" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft /> Prev</button>
          <div className="page-nums">
            {items.map((it, i) => it === "..."
              ? <span key={"e" + i} className="page-ellipsis">…</span>
              : <button key={it} className={"page-btn page-num" + (it === page ? " on" : "")} onClick={() => onChange(it)}>{it}</button>)}
          </div>
          <button className="page-btn page-next" disabled={page === pageCount} onClick={() => onChange(page + 1)}>Next <ChevronRight /></button>
        </div>
      )}
    </div>
  );
}
