'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import Image from 'next/image';

// Componente de avatar da assistente com fallback
function AssistenteAvatar({
  size = 32,
  className = '',
  variant = 'bubble',
}: {
  size?: number;
  className?: string;
  variant?: 'floating' | 'header' | 'bubble';
}) {
  const [imgSrc, setImgSrc] = useState<string>('/images/assistente-emserh.png.png'); // Tenta primeiro com dupla extensão
  const [imgError, setImgError] = useState(false);
  
  const crop =
    variant === 'floating'
      ? {
          // Botão flutuante: foco no rosto, com zoom leve
          objectPosition: '50% 12%',
          scaleClass: 'scale-[1.85]',
        }
      : variant === 'header'
      ? {
          // Header: foco no rosto, zoom moderado
          objectPosition: '50% 14%',
          scaleClass: 'scale-[1.65]',
        }
      : {
          // Bolhas/mensagens: foco no rosto, zoom um pouco menor
          objectPosition: '50% 16%',
          scaleClass: 'scale-[1.55]',
        };

  // Fallback visual melhorado
  if (imgError) {
    return (
      <div 
        className={`rounded-full bg-gradient-to-br from-emerald-500 via-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md ${className}`} 
        style={{ width: size, height: size }}
      >
        {size >= 40 ? (
          <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        ) : (
          <span style={{ fontSize: size * 0.5 }}>A</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-full overflow-hidden bg-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={imgSrc}
        alt="Assistente Virtual EMSERH"
        width={size}
        height={size}
        className={`w-full h-full object-cover ${crop.scaleClass}`}
        style={{ objectPosition: crop.objectPosition }}
        onError={() => {
          // Se falhar com .png.png, tenta .png
          if (imgSrc.includes('.png.png')) {
            setImgSrc('/images/assistente-emserh.png');
          } else {
            setImgError(true);
          }
        }}
        unoptimized
      />
    </div>
  );
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const json = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: json.ok ? json.answer : `Erro: ${json.error || 'Erro desconhecido'}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erro ao processar sua pergunta: ${e?.message || String(e)}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Botão flutuante com imagem da assistente */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-white dark:bg-neutral-800 shadow-lg hover:shadow-xl transition-all flex items-center justify-center group overflow-hidden border-2 border-emerald-500 hover:border-emerald-600 dark:border-emerald-400 dark:hover:border-emerald-300 hover:scale-105"
          aria-label="Abrir chat com assistente virtual"
          title="Falar com a assistente virtual EMSERH"
        >
          <AssistenteAvatar
            size={64}
            variant="floating"
            className="ring-2 ring-emerald-500/20"
          />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-neutral-800 animate-pulse" />
        </button>
      )}

      {/* Widget de chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-12rem)] rounded-2xl border border-border bg-panel shadow-2xl flex flex-col overflow-hidden">
          {/* Header com imagem da assistente */}
          <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="border-2 border-white/30 flex-shrink-0">
                <AssistenteAvatar size={40} variant="header" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Assistente Virtual EMSERH</h3>
                <p className="text-xs text-emerald-50 opacity-90">Online • Pronta para ajudar</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
              aria-label="Fechar chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg/30">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <AssistenteAvatar size={32} variant="bubble" className="border border-border" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                      : 'bg-card border border-border text-text'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-emerald-100' : 'text-muted'}`}>
                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-1 text-white text-xs font-semibold">
                    Você
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start gap-2">
                <div className="flex-shrink-0">
                  <AssistenteAvatar size={32} variant="bubble" className="border border-border" />
                </div>
                <div className="bg-card border border-border rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted" />
                  <span className="text-xs text-muted">Digitando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-panel flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua pergunta..."
                disabled={loading}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                aria-label="Enviar mensagem"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted mt-2">
              Exemplos: "Quantos extintores tem na unidade X?", "Quantas entregas este mês?"
            </p>
          </div>
        </div>
      )}
    </>
  );
}
