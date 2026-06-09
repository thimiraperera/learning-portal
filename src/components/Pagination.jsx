import { ChevronLeft, ChevronRight } from "lucide-react";

/* Simple page navigator. Hidden when there is only one page. */
export default function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft /> Prev
      </button>
      {pages.map((p) => (
        <button key={p} className={"page-btn" + (p === page ? " on" : "")} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button className="page-btn" disabled={page === pageCount} onClick={() => onChange(page + 1)}>
        Next <ChevronRight />
      </button>
    </div>
  );
}
