import { useEffect, useRef, useState } from "react";

/**
 * Small popover/context-menu state hook: tracks open state and closes the menu
 * on an outside mousedown. Shared by album tiles and space cards.
 */
export function useCtxMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return { open, setOpen, ref };
}
