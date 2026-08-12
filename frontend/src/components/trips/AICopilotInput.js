import React, { useRef } from 'react';
import { FaPaperPlane, FaSpinner } from 'react-icons/fa';

const AICopilotInput = ({
  input,
  setInput,
  onSend,
  loading,
  tripId,
}) => {
  const inputRef = useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || loading || !tripId) return;

    onSend(value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const value = input.trim();
      if (!value || loading || !tripId) return;

      onSend(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className="
          flex
          items-end
          gap-2
          rounded-[22px]
          border
          border-sky-200/90
          bg-white/95
          p-2.5
          shadow-md
          backdrop-blur-xl
          transition-all
          focus-within:border-sky-500
          focus-within:ring-2
          focus-within:ring-sky-500/20
          dark:border-slate-700
          dark:bg-slate-900/95
        "
      >
        <label htmlFor="ai-copilot-input" className="sr-only">
          Ask the AI Financial Copilot
        </label>

        <textarea
          ref={inputRef}
          id="ai-copilot-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about this trip..."
          disabled={loading || !tripId}
          autoComplete="off"
          rows={1}
          maxLength={500}
          className="
            min-h-[38px]
            max-h-28
            min-w-0
            flex-1
            resize-none
            overflow-y-auto
            border-0
            bg-transparent
            py-1.5
            px-2
            text-xs
            sm:text-sm
            leading-relaxed
            text-slate-800
            outline-none
            shadow-none
            placeholder-slate-400
            focus:outline-none
            focus:ring-0
            dark:text-white
            dark:placeholder-slate-400
          "
        />

        <button
          type="submit"
          disabled={!input.trim() || loading || !tripId}
          aria-label="Send message"
          className="
            flex
            h-9
            w-9
            sm:h-10
            sm:w-10
            flex-shrink-0
            items-center
            justify-center
            rounded-xl
            bg-gradient-to-br
            from-sky-600
            to-primary-600
            text-white
            shadow-sm
            transition-all
            hover:from-sky-700
            hover:to-primary-700
            active:scale-95
            disabled:cursor-not-allowed
            disabled:opacity-40
            cursor-pointer
          "
        >
          {loading ? (
            <FaSpinner className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FaPaperPlane className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <p className="mt-1.5 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
        Smart insights for expenses, balances, and settlements
      </p>
    </form>
  );
};

export default AICopilotInput;