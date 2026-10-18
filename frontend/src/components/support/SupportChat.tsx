import { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  Bot,
  User,
  Copy,
  Check,
  HelpCircle,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { api } from '@/services/api';
import { useLocation } from 'react-router-dom';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const STORAGE_KEY = 'rastro_support_chat_history_v2';

function sanitizeChatContent(content: string): string {
  return content
    .replace(/,?\s*impulsionado pelo modelo \*\*DeepSeek[^\*]*\*\*\.?/gi, '.')
    .replace(/,?\s*impulsionado pelo modelo DeepSeek[^\n.]*\.?/gi, '.')
    .replace(/DeepSeek\s*(V4\.1\s*Flash)?/gi, 'Rastro IA');
}

const SUGGESTIONS = [
  '📊 Cruze meus proventos recebidos com meus gastos recentes',
  '📈 Qual o risco da minha carteira (Cripto vs Renda Fixa)?',
  '💰 Qual meu patrimônio total somando contas e investimentos?',
  '🏆 Qual foi meu melhor e pior investimento nas operações fechadas?',
  '📥 Como importar o extrato da B3 e sincronizar ações?',
];

function formatTime(isoStr: string) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Renderizador de Markdown simples e elegante para as respostas do suporte.
 */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-text-primary">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-sm sm:text-base text-accent-gold mt-3 mb-1">
              {trimmed.replace('### ', '')}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-base sm:text-lg text-text-primary border-b border-border/40 pb-1 mt-3.5 mb-1.5">
              {trimmed.replace('## ', '')}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="font-bold text-lg sm:text-xl text-text-primary mt-4 mb-2">
              {trimmed.replace('# ', '')}
            </h2>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <div key={idx} className="border-l-2 border-accent-gold/70 bg-accent-gold/10 px-3 py-1.5 rounded-r-md text-xs italic text-text-secondary my-1.5">
              {trimmed.replace('> ', '')}
            </div>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-accent-gold mt-1 text-xs">•</span>
              <span className="flex-1">{renderFormattedText(trimmed.substring(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^\d+\./)?.[0] ?? '';
          const content = trimmed.replace(/^\d+\.\s/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-bold text-accent-gold shrink-0">{num}</span>
              <span className="flex-1">{renderFormattedText(content)}</span>
            </div>
          );
        }
        if (trimmed === '---') {
          return <hr key={idx} className="border-border/50 my-2" />;
        }
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        return <p key={idx}>{renderFormattedText(line)}</p>;
      })}
    </div>
  );
}

function renderFormattedText(txt: string) {
  // Bold **texto**
  const parts = txt.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-accent-gold border border-border">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function SupportChat() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      localStorage.removeItem('rastro_support_chat_history_v1');
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMsg[];
        return parsed.map((m) => ({
          ...m,
          content: sanitizeChatContent(m.content),
        }));
      }
    } catch {}
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          '👋 Olá! Sou o **Assistente Inteligente do Rastro Finance**.\n\nPosso te ajudar com dúvidas sobre a plataforma e também realizar **análises avançadas cruzando seus dados reais** de contas bancárias, carteira de investimentos, operações encerradas, proventos, despesas e metas. O que você gostaria de analisar hoje?',
        timestamp: new Date().toISOString(),
      },
    ];
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, loading]);

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e.detail?.initialPrompt) {
        handleSendMessage(e.detail.initialPrompt);
      }
    };
    window.addEventListener('open-support-chat', handleOpen);
    return () => window.removeEventListener('open-support-chat', handleOpen);
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const payloadMessages = nextMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-10) // mantém os últimos 10 turnos de contexto para agilidade
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.sendSupportChatMessage(payloadMessages, location.pathname);

      const assistantMsg: ChatMsg = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMsg = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `❌ **Não foi possível obter resposta no momento.**\n${
          err.message || 'Verifique sua conexão ou tente novamente em instantes.'
        }`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja limpar todo o histórico desta conversa de suporte?')) {
      const welcome: ChatMsg = {
        id: String(Date.now()),
        role: 'assistant',
        content: 'Conversa reiniciada. Como posso te ajudar agora?',
        timestamp: new Date().toISOString(),
      };
      setMessages([welcome]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Botão Flutuante no Canto Inferior Direito (acima da MobileNav em mobile) */}
      <div className="fixed bottom-20 md:bottom-5 right-3 md:right-5 z-40 flex items-center">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 rounded-full bg-[#111827] border border-amber-500/60 hover:border-amber-400 px-3.5 py-2 sm:px-4 text-xs font-semibold text-white shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
            title="Abrir Suporte com Inteligência Artificial"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="tracking-wide font-semibold text-slate-100 hidden sm:inline">
              Suporte & Análise IA
            </span>
            <span className="tracking-wide font-semibold text-slate-100 sm:hidden">
              Suporte IA
            </span>
            <span className="hidden sm:inline-block rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-400">
              Online
            </span>
          </button>
        )}
      </div>

      {/* Janela de Chat Aberta */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0A0E1A] shadow-2xl transition-all duration-300 ${
            isExpanded
              ? 'inset-2 sm:inset-4 md:inset-10'
              : 'inset-x-2 bottom-20 top-16 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[460px] sm:h-[640px] sm:max-h-[90vh]'
          }`}
          style={{ backdropFilter: 'blur(16px)' }}
        >
          {/* Header do Chat */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#111827] px-4 py-3 select-none">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">Suporte Rastro Finance</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="text-amber-400 font-medium">Assistente Analítico & Suporte 24/7</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={handleClearHistory}
                className="rounded-lg p-1.5 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                title="Limpar histórico da conversa"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded-lg p-1.5 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer hidden sm:block"
                title={isExpanded ? 'Restaurar tamanho' : 'Maximizar'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
                title="Fechar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0A0E1A]">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div className={`relative group max-w-[85%] ${isAssistant ? 'w-full' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm text-xs sm:text-sm ${
                        isAssistant
                          ? 'bg-[#1C2333] border border-slate-700/80 text-slate-100'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold ml-auto rounded-tr-xs shadow-md'
                      }`}
                    >
                      {isAssistant ? (
                        <MarkdownContent text={msg.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-2 text-[10px] text-text-secondary/70 ${
                        isAssistant ? 'justify-start pl-1' : 'justify-end pr-1'
                      }`}
                    >
                      <span>{formatTime(msg.timestamp)}</span>
                      {isAssistant && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent-gold flex items-center gap-1 cursor-pointer"
                          title="Copiar resposta"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAssistant && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Indicador de Digitação / Pensando */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl bg-[#1C2333] border border-slate-700/80 px-4 py-3 flex items-center gap-2 text-xs text-slate-300 shadow-md">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span>Analisando dados da sua conta...</span>
                </div>
              </div>
            )}
          </div>

          {/* Sugestões Rápidas (Chips) */}
          <div className="border-t border-slate-800 bg-[#111827] p-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
              <span className="text-[10px] font-semibold text-slate-400 shrink-0 flex items-center gap-0.5">
                <HelpCircle className="h-3 w-3 text-amber-400" /> Sugestões:
              </span>
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendMessage(sug)}
                  className="whitespace-nowrap rounded-lg border border-slate-700/80 bg-[#1C2333] px-2.5 py-1 text-slate-300 hover:text-white hover:border-amber-400/60 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Campo de Entrada de Mensagem */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="border-t border-slate-800 bg-[#111827] p-3 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida sobre a plataforma..."
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-700 bg-[#0A0E1A] px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              title="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
