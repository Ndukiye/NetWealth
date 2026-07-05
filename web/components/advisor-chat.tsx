'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, SendHorizonal } from 'lucide-react';
import { Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { ChatReply } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'advisor';
  text: string;
}

const INTRO: ChatMessage = {
  role: 'advisor',
  text: "Hi — I'm your NetWealth advisor. I answer from your actual accounts, income and spending. Ask me about retiring, investing, saving, or whether you can afford something.",
};

const INITIAL_SUGGESTIONS = [
  'Can I retire at 45?',
  'What should I invest in?',
  'How much should I be saving?',
  'How am I doing financially?',
];

export function AdvisorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setSending(true);
    try {
      const res = await api.post<ChatReply>('/planner/chat', { message: trimmed });
      setMessages((m) => [...m, { role: 'advisor', text: res.reply }]);
      if (res.suggestions?.length) setSuggestions(res.suggestions);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'advisor',
          text: err instanceof ApiError ? err.message : "Sorry — I couldn't process that. Try again?",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <MessageCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Ask the advisor</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Type a question in plain English — answers are computed from your real data (rule-based for
        this MVP; swaps to an LLM behind the same interface).
      </p>

      <div
        ref={scrollRef}
        className="mb-3 flex max-h-96 min-h-[160px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-white/[0.02]"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'self-end rounded-br-md bg-gradient-to-b from-emerald-400 to-emerald-500 text-slate-950'
                : 'self-start rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {msg.text}
          </div>
        ))}
        {sending && (
          <div className="flex gap-1.5 self-start rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => void send(sug)}
              disabled={sending}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-400"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "I have ₦1m and want to retire at 40 — what should I do?"'
          maxLength={500}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex items-center justify-center rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 text-slate-950 shadow-md shadow-emerald-500/20 transition hover:from-emerald-300 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizonal size={16} />
        </button>
      </form>
    </Card>
  );
}
