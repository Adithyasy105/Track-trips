import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiSparkles } from 'react-icons/hi2';
import { FaLightbulb, FaSpinner, FaUser, FaRedo } from 'react-icons/fa';
import { aiAPI } from '../../services/api';
import AICopilotInput from './AICopilotInput';

const SUGGESTED_QUESTIONS = [
  'Where did we spend the most money?',
  'Who paid the most overall?',
  'Who owes the most in this trip?',
  'What were our top 3 expenses?',
  'How much did we spend on food?',
  'Summarize the trip spending.',
];

const INITIAL_MESSAGE = {
  role: 'ai',
  text: "Hello! I'm your AI Financial Copilot. I can analyze this trip's expenses, spending, and settlements. Ask me who spent the most, where your money went, or who owes whom.",
};

export const sanitizeChatText = (text = '') => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\s)(\*|_)(.*?)\2(\s|$)/g, '$1$3$4')
    .replace(/^\s{0,3}#{1,6}\s?/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '• ')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const AICopilotTab = ({ tripId, isPopup = false, onClose }) => {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);

  // Auto-scroll inside chat messages container
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages, loading]);

  const buildHistory = () => {
    return messages.slice(1).map((message) => ({
      role: message.role === 'error' ? 'ai' : message.role,
      text: message.text,
    }));
  };

  const sendMessage = async (question) => {
    const q = question?.trim();
    if (!q || loading || !tripId) return;

    const history = buildHistory();

    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiAPI.copilotChat(tripId, { question: q, history });
      const answer =
        response?.data?.answer ||
        response?.data?.message ||
        'I could not generate an answer for that question.';

      setMessages((prev) => [...prev, { role: 'ai', text: answer }]);
    } catch (error) {
      console.error('AI Copilot error:', error);
      const errorMessage =
        error?.response?.data?.userMessage ||
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Unable to analyze the trip right now. Please try again.';

      setMessages((prev) => [...prev, { role: 'error', text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    if (loading) return;
    setMessages([INITIAL_MESSAGE]);
    setInput('');
  };

  const isFirstMessage = messages.length === 1;

  return (
    <div
      className={[
        'relative flex w-full flex-col overflow-hidden border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xl',
        isPopup ? 'h-full rounded-none sm:rounded-[28px]' : 'rounded-2xl sm:rounded-3xl h-[460px] xs:h-[490px] sm:h-[510px] lg:h-[530px] xl:h-[550px] max-h-[70vh]'
      ].join(' ')}
    >
      {/* HEADER */}
      <header
        className="
          flex
          flex-shrink-0
          items-center
          justify-between
          gap-3
          border-b
          border-slate-200/80
          bg-slate-50/80
          px-4
          py-3
          dark:border-slate-800
          dark:bg-slate-950/60
          backdrop-blur-md
        "
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm flex-shrink-0">
            <HiSparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              AI Financial Copilot
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Live Trip Analysis & Expense Insights
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isFirstMessage && (
            <button
              type="button"
              onClick={clearConversation}
              disabled={loading}
              title="Reset Chat"
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                bg-slate-200/70
                text-slate-600
                hover:bg-slate-300
                dark:bg-slate-800
                dark:text-slate-300
                dark:hover:bg-slate-700
                transition-colors
                cursor-pointer
              "
            >
              <FaRedo className="h-3 w-3" />
            </button>
          )}

          {isPopup && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Copilot"
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* CHAT MESSAGES SCROLL AREA */}
      <div
        ref={messagesRef}
        role="log"
        aria-live="polite"
        className="
          flex-1
          min-h-0
          overflow-y-auto
          overscroll-contain
          p-4
          space-y-3.5
          bg-gradient-to-b
          from-sky-50/30
          via-transparent
          to-slate-50/50
          dark:from-slate-950/30
          dark:to-slate-900/50
        "
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const isError = message.role === 'error';

            return (
              <motion.div
                key={`${index}-${message.role}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex w-full items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'
                  }`}
              >
                {!isUser && (
                  <div
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border shadow-2xs ${isError
                      ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'border-sky-200 bg-sky-500 text-white dark:border-sky-700'
                      }`}
                  >
                    <HiSparkles className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[78%] break-words whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${isUser
                    ? 'rounded-br-xs bg-sky-600 font-medium text-white shadow-2xs'
                    : isError
                      ? 'rounded-bl-xs border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
                      : 'rounded-bl-xs border border-slate-200/90 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-100 shadow-2xs'
                    }`}
                >
                  {sanitizeChatText(message.text)}
                </div>

                {isUser && (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 shadow-2xs">
                    <FaUser className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pl-9"
          >
            <FaSpinner className="h-3.5 w-3.5 animate-spin text-sky-600 dark:text-sky-400" />
            <span>Analyzing trip data...</span>
          </motion.div>
        )}

        {/* QUICK PROMPTS CHIPS */}
        {isFirstMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-2xl bg-sky-50/80 dark:bg-slate-800/60 border border-sky-200/80 dark:border-slate-700/80 space-y-2"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              <FaLightbulb className="text-amber-400 h-3 w-3" /> Suggested Questions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  disabled={loading}
                  className="
                    text-xs
                    font-semibold
                    px-2.5
                    py-1
                    rounded-full
                    bg-white
                    dark:bg-slate-900
                    text-sky-700
                    dark:text-sky-300
                    border
                    border-sky-200
                    dark:border-slate-700
                    hover:bg-sky-100
                    dark:hover:bg-slate-800
                    transition-all
                    cursor-pointer
                    disabled:opacity-40
                  "
                >
                  {question}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* FOOTER INPUT */}
      <div
        data-testid="ai-copilot-composer-dock"
        className="flex-shrink-0 border-t border-slate-200/80 bg-white/90 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/90 backdrop-blur-md"
      >
        <AICopilotInput
          input={input}
          setInput={setInput}
          onSend={sendMessage}
          loading={loading}
          tripId={tripId}
        />
      </div>
    </div>
  );
};

export { AICopilotTab };
export default AICopilotTab;