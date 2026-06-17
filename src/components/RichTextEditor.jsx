import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from "lucide-react";

/* Lightweight rich-text / HTML editor (no extra dependency). A small toolbar
   drives document.execCommand on a contentEditable area; the raw HTML is synced
   back to the parent via onChange. Used for the editable login-page description. */
export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);

  // Populate the area when the value changes from outside (e.g. brand loads
  // asynchronously) without resetting the caret while the admin is typing.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value]);

  const sync = () => onChange(ref.current ? ref.current.innerHTML : "");
  const run = (cmd, arg) => { document.execCommand(cmd, false, arg); sync(); };

  const cmdBtn = (cmd, Icon, title) => (
    <button type="button" className="rte-btn" title={title}
      onMouseDown={(e) => { e.preventDefault(); run(cmd); }}>
      <Icon />
    </button>
  );

  const addLink = (e) => {
    e.preventDefault();
    const url = window.prompt("Link URL (include https://)");
    if (url) run("createLink", url);
  };

  return (
    <div className="rte">
      <div className="rte-toolbar">
        {cmdBtn("bold", Bold, "Bold")}
        {cmdBtn("italic", Italic, "Italic")}
        {cmdBtn("underline", Underline, "Underline")}
        {cmdBtn("insertUnorderedList", List, "Bulleted list")}
        {cmdBtn("insertOrderedList", ListOrdered, "Numbered list")}
        <button type="button" className="rte-btn" title="Insert link" onMouseDown={addLink}><Link2 /></button>
        {cmdBtn("removeFormat", Eraser, "Clear formatting")}
      </div>
      <div ref={ref} className="rte-area" contentEditable suppressContentEditableWarning
        data-placeholder={placeholder || ""} onInput={sync} onBlur={sync} />
    </div>
  );
}
