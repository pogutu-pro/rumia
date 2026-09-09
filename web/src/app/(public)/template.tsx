/**
 * Public route template.
 *
 * Previously wrapped children in a framer-motion `motion.div` for page
 * transitions, but the exit animation never fired (no AnimatePresence parent)
 * and the ~32 KB framer-motion overhead caused jank on low-end Android devices.
 *
 * Now uses a lightweight CSS-only fade that the browser composites natively.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
}
