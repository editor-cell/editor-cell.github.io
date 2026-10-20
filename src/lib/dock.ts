import { useEffect, useState, type RefObject } from "react";

/**
 * The height a panel at the foot of the screen takes, so a spacer of the same height keeps
 * the page's last lines from sitting under it, folded or open.
 */
export function useDockHeight(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(node.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [ref, active]);
  return height;
}
