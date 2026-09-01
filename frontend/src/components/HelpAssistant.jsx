import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { askAssistant } from "../api/ai";

const STARTER_QUESTIONS = [
  "How do I cancel a booking?",
  "Does this cost anything?",
  "How can I track the vehicle?",
];

export default function HelpAssistant() {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);

  const askMutation = useMutation({
    mutationFn: (q) => askAssistant(q),
    onSuccess: (data, q) => {
      setThread((prev) => [
        ...prev,
        { role: "user", text: q },
        {
          role: "assistant",
          text: data.answer,
          fallback: data.fallback,
          suggestedTrips: data.suggested_trips,
          suggestedQuery: data.suggested_query,
        },
      ]);
    },
    onError: (_err, q) => {
      setThread((prev) => [
        ...prev,
        { role: "user", text: q },
        { role: "assistant", text: "Sorry, something went wrong. Please try again.", fallback: true },
      ]);
    },
  });

  function ask(q) {
    const trimmed = q.trim();
    if (!trimmed || askMutation.isPending) return;
    setQuestion("");
    askMutation.mutate(trimmed);
  }

  function handleSubmit(e) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Help assistant"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="card w-[min(22rem,calc(100vw-2.5rem))] max-h-[28rem] flex flex-col p-0 overflow-hidden shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-primary-50/60">
              <p className="flex items-center gap-1.5 font-heading font-semibold text-gray-900 text-sm">
                <SparklesIcon className="w-4 h-4 text-primary-600" aria-hidden="true" />
                Ask for help
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help assistant"
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white/70 transition"
              >
                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {thread.length === 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">
                    Ask how booking works — this only answers questions, it can never book, cancel, or
                    change anything for you.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {STARTER_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => ask(q)}
                        className="text-left text-sm rounded-lg border border-gray-200 px-3 py-2 hover:border-primary-300 hover:bg-primary-50/40 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {thread.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[92%]"}>
                  <div
                    className={`text-sm rounded-xl px-3 py-2 ${
                      msg.role === "user" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.text}
                    {msg.role === "assistant" && !msg.suggestedTrips?.length && (
                      <p className={`text-xs mt-1 ${msg.fallback ? "text-gray-400" : "text-primary-500"}`}>
                        {msg.fallback ? "Answered from FAQ" : "Answered by AI"}
                      </p>
                    )}
                  </div>

                  {msg.role === "assistant" && msg.suggestedTrips?.length > 0 && (
                    <ul className="mt-1.5 space-y-1.5">
                      {msg.suggestedTrips.map((trip) => (
                        <li key={trip.id}>
                          <Link
                            to={`/trips/${trip.id}`}
                            onClick={() => setOpen(false)}
                            className="block rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-primary-300 hover:bg-primary-50/40 transition"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {trip.origin} &rarr; {trip.destination}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                {new Date(trip.departure_time).toLocaleString()}
                              </span>
                              {trip.purpose && (
                                <span className="flex items-center gap-1">
                                  <TagIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  {trip.purpose}
                                </span>
                              )}
                              {trip.seats_available != null && (
                                <span className="flex items-center gap-1">
                                  <UsersIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  {trip.seats_available}/{trip.total_seats} seats
                                </span>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {msg.role === "assistant" && msg.suggestedQuery && (
                    <Link
                      to={`/trips?q=${encodeURIComponent(msg.suggestedQuery)}`}
                      onClick={() => setOpen(false)}
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      <MagnifyingGlassIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Search trips for "{msg.suggestedQuery}"
                    </Link>
                  )}
                </div>
              ))}

              {askMutation.isPending && (
                <div className="text-sm rounded-xl px-3 py-2 max-w-[85%] bg-gray-100 text-gray-400 mr-auto">
                  Thinking…
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-3 border-t border-gray-100">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question…"
                aria-label="Ask the help assistant a question"
                className="input-field !mt-0 flex-1 !py-2"
              />
              <button
                type="submit"
                disabled={askMutation.isPending || !question.trim()}
                aria-label="Send question"
                className="min-h-[40px] min-w-[40px] shrink-0 flex items-center justify-center rounded-xl bg-primary-600 text-white disabled:opacity-40 active:scale-95 transition"
              >
                <PaperAirplaneIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help assistant" : "Open help assistant"}
        aria-expanded={open}
        className="min-h-[52px] min-w-[52px] flex items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 active:scale-95 transition"
      >
        {open ? <XMarkIcon className="w-6 h-6" aria-hidden="true" /> : <ChatBubbleLeftRightIcon className="w-6 h-6" aria-hidden="true" />}
      </button>
    </div>
  );
}
