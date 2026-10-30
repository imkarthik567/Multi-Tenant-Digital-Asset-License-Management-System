import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Maximize2,
  Minimize2,
  Loader2,
  Bot,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
}

export const GeminiChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const userKey = user?.id || user?.email || null;
  const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name || 'MEMBER';

  const getWelcomeMessage = (): ChatMessage => ({
    role: 'model',
    content: user
      ? `Hi **${user.fullName || user.email}**! I'm your **AssetVault Copilot**.\n\nAsk me to summarize your allocated licenses, check upcoming renewals, or explore workspace assets.`
      : `Hi! I'm your **AssetVault Copilot**. How can I help you today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [getWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([getWelcomeMessage()]);
    setInput('');
  }, [userKey]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-gemini-chat', handleOpen);
    return () => window.removeEventListener('open-gemini-chat', handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!promptText) setInput('');
    setIsLoading(true);

    try {
      const res: any = await api.post('/ai/chat', {
        prompt: text,
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        history: messages
          .filter((m) => m.content && m.content.trim())
          .map((m) => ({ role: m.role, text: m.content })),
        modelType: 'general',
        mode: 'copilot',
        userId: user?.id,
        userName: user?.fullName,
        userEmail: user?.email,
        userRole,
      });
      const payload = res?.data ?? res;
      const replyText = payload?.reply || payload?.text || 'I processed your request.';
      const replyMsg: ChatMessage = {
        role: 'model',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        err?.response?.data?.message ||
        'Unable to reach the assistant right now. Please try again in a moment.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts =
    userRole === 'MEMBER'
      ? [
          'Summarize my profile & active seats',
          'Which digital assets can I access?',
          'When do my software keys expire?',
        ]
      : [
          'Summarize my profile & workspace health',
          'Show licenses expiring in 30 days',
          'Identify underutilized software seats',
        ];

  const formatMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const boldParsed = line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 rounded bg-white/[0.08] text-indigo-300 font-mono text-[11px]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={i} className="ml-4 list-disc text-slate-200 my-0.5">
            {boldParsed}
          </li>
        );
      }
      return (
        <p key={i} className="my-1 leading-relaxed">
          {boldParsed}
        </p>
      );
    });
  };

  if (!user) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 border border-white/15 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copilot</span>
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-[#090e1c]/95 backdrop-blur-2xl border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'bottom-4 right-4 left-4 top-16 sm:left-auto sm:w-[560px] sm:h-[680px]'
              : 'bottom-5 right-5 w-[380px] max-w-[calc(100vw-2rem)] h-[520px]'
          }`}
        >
          {/* Sleek Studio Header */}
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white leading-none">
                  AssetVault Copilot
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Personalized for {user.fullName || user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([getWelcomeMessage()])}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-white/[0.05] text-slate-200 border border-white/[0.07] rounded-bl-xs'
                  }`}
                >
                  {formatMarkdown(msg.content)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs px-2 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggested Prompts */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-white/[0.07] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-white/[0.07] bg-white/[0.02] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Copilot about your workspace..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
