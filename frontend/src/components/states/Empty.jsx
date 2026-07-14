import { motion, useReducedMotion } from "framer-motion";

export default function Empty({ message = "Nothing here yet." }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="text-center py-14 px-6"
    >
      <div
        aria-hidden="true"
        className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-3"
      >
        🗺️
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
    </motion.div>
  );
}
