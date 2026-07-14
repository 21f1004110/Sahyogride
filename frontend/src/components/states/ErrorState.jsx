import { motion, useReducedMotion } from "framer-motion";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="alert"
      className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3"
    >
      <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="text-sm text-amber-800">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 min-h-[44px] inline-flex items-center font-medium text-sm text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
          >
            Retry
          </button>
        )}
      </div>
    </motion.div>
  );
}
