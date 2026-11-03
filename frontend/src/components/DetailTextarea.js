import { useEffect, useRef } from "react";

// Descripción de línea en varias líneas: crece sola y respeta los saltos de línea (Intro).
export const DetailTextarea = ({ value, onChange, placeholder = "Descripción (opcional) · pulsa Intro para añadir más líneas", ...rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.max(34, el.scrollHeight + 2)}px`; }
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} onChange={onChange} placeholder={placeholder}
      className="flex-1 min-w-0 resize-none overflow-hidden rounded-md border border-input bg-transparent px-3 py-1.5 text-sm leading-5 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      {...rest} />
  );
};
