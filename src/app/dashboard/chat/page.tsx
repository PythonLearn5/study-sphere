'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Trash2,
  RotateCcw,
  Square,
  Sparkles,
  Plus,
  Paperclip,
  Image,
  FileText,
  Zap,
} from 'lucide-react';
import { FiTrash2 } from 'react-icons/fi';

interface ChatMessage {
  id: string;
  content: string;
  role: 'User' | 'Assistant';
  createdAt: Date;
}

function makeId() {
  return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function formatTime(timestamp: Date) {
  try {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function detectLanguage(text: string): string {
  const zh = /[\u4e00-\u9fa5]/;
  return zh.test(text) ? 'zh' : 'en';
}

export default function StudySphereChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFullChat, setShowFullChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ id: string; prompt: string; response: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const savedPairs = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 加载历史会话
  useEffect(() => {
    fetch('/api/chats')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setChatHistory(data.slice().reverse());
      })
      .catch(() => {});
  }, []);

  // 对话结束后保存一条问答对到本地 chats 表
  useEffect(() => {
    if (messages.length < 2 || isLoading) return;
    const last = messages[messages.length - 1];
    const secondLast = messages[messages.length - 2];
    if (secondLast.role !== 'User' || last.role !== 'Assistant' || !last.content || !secondLast.content) return;
    const key = `${secondLast.id}__${last.id}`;
    if (savedPairs.current.has(key)) return;
    savedPairs.current.add(key);
    fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: secondLast.content, response: last.content }),
    }).catch(() => {});
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || isLoading) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'User',
      content,
      createdAt: new Date(),
    };
    const assistantMsg: ChatMessage = {
      id: makeId(),
      role: 'Assistant',
      content: '',
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputValue('');
    setShowFullChat(true);
    setIsLoading(true);

    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    console.log('[Chat Debug] send user message:', content);

    // 准备上下文（只带最近 N 条，避免上下文太长）
    const historyForAPI: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of messages.slice(-20)) {
      historyForAPI.push({ role: m.role === 'User' ? 'user' : 'assistant', content: m.content });
    }
    historyForAPI.push({ role: 'user', content });

    const lang = detectLanguage(content);
    const typingHint =
      lang === 'zh' ? '（正在思考…如果 15 秒没反应请检查 Vercel Gateway 配置）' : 'Thinking...';

    try {
      const res = await fetch('/api/chat/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForAPI, stream: true }),
        signal: ctrl.signal,
      });

      console.log(
        `[Chat Debug] /api/chat/completion status=${res.status} ${res.statusText} content-type=${res.headers.get('content-type')}`,
      );

      if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        let errText = '';
        try {
          errText = await res.clone().text();
        } catch {}
        let msg = `Request failed (status ${res.status})`;
        try {
          const parsed = JSON.parse(errText);
          msg = parsed.details || parsed.message || parsed.error || msg;
          if (parsed.baseURL) msg += ` (baseURL=${parsed.baseURL})`;
          if (parsed.model) msg += ` model=${parsed.model}`;
        } catch {}
        console.error('[Chat Debug] /api/chat/completion non-2xx body:', errText.slice(0, 1500));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: '❌ ' + msg, createdAt: new Date() }
              : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let totalDelta = '';

      // 先写一个"正在思考"提示，避免 SSE 冷启动慢的那段时间看起来卡死
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: typingHint } : m,
        ),
      );

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim();
          if (!line || line === '[DONE]') continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'delta' && typeof evt.delta === 'string') {
              totalDelta += evt.delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: totalDelta } : m,
                ),
              );
            } else if (evt.type === 'done') {
              // 最后确认内容（部分流可能把整句留给 done，不过我们前面已经累加过了）
            } else if (evt.type === 'error') {
              console.error('[Chat Debug] SSE error event:', evt);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        content:
                          '❌ ' +
                          (evt.message || 'Stream error') +
                          (evt.details ? ' — ' + evt.details : '') +
                          (evt.status ? ` (HTTP ${evt.status})` : ''),
                      }
                    : m,
                ),
              );
              return;
            }
          } catch {
            // 忽略 parse 失败的单帧
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log('[Chat Debug] generation stopped by user');
      } else {
        console.error('[Chat Debug] sendMessage error:', err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: '❌ ' + (err?.message || 'Unknown error') }
              : m,
          ),
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, messages]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = useCallback(() => {
    stopGeneration();
    setMessages([]);
    setShowFullChat(false);
  }, [stopGeneration]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  if (!showFullChat && messages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-xl">
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-bold text-foreground mb-4">What can I help you study?</h1>
            <p className="text-muted-foreground text-lg">
              Your AI-powered study companion is ready to help with anything
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative mb-8">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI study assistant a question..."
                rows={1}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all duration-200 min-h-[60px] max-h-32"
                style={{ height: 'auto', minHeight: '60px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
                disabled={isLoading}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-black transition-colors rounded-lg hover:bg-gray-100"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 bg-black hover:bg-gray-800 disabled:bg-gray-300 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Zap, label: 'Study Tips', desc: 'Get effective study strategies' },
              { icon: FileText, label: 'Essay Help', desc: 'Writing and structure guidance' },
              { icon: Plus, label: 'Create Quiz', desc: 'Generate quiz questions' },
              { icon: Image, label: 'Concept Maps', desc: 'Visual learning aids' },
            ].map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={() => sendMessage(`Help me with ${action.label.toLowerCase()}`)}
                className="p-4 bg-card hover:bg-card/80 border border-border hover:border-border/80 rounded-xl transition-all duration-200 text-left group shadow-sm hover:shadow-md"
              >
                <action.icon className="w-6 h-6 text-foreground mb-2 group-hover:text-muted-foreground transition-colors" />
                <div className="text-foreground font-medium mb-1">{action.label}</div>
                <div className="text-muted-foreground text-sm">{action.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'Create a quiz about quantum physics',
              'Help with essay writing',
              'Generate quiz questions from my notes',
              'Create study schedules',
            ].map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl text-left transition-all duration-200 group"
              >
                <div className="text-black font-medium group-hover:text-gray-700 transition-colors">
                  {suggestion}
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="fixed bottom-6 left-6 bg-black text-white px-4 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-all z-50"
        >
          Previous Chats
        </button>

        {showHistory && (
          <div className="fixed bottom-20 left-6 bg-card border border-border shadow-lg rounded-lg w-80 max-h-96 overflow-y-auto z-50">
            <div className="p-4 border-b font-semibold text-gray-700 flex justify-between items-center">
              Chat History
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-sm text-gray-400 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="divide-y">
              {chatHistory.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No previous chats</div>
              ) : (
                chatHistory.map((chat) => (
                  <div key={chat.id} className="group relative p-3 hover:bg-gray-50">
                    <div className="text-sm font-medium text-black truncate pr-6">{chat.prompt}</div>
                    <div className="text-xs text-gray-500 line-clamp-2 pr-6">{chat.response}</div>
                    <button
                      type="button"
                      title="Delete chat"
                      onClick={async () => {
                        try {
                          await fetch('/api/chats', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: chat.id }),
                          });
                          setChatHistory((prev) => prev.filter((c) => c.id !== chat.id));
                        } catch (err) {
                          console.error('Error deleting chat:', err);
                        }
                      }}
                      className="absolute right-2 top-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex items-center justify-between p-6 border-b border-border bg-background">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">StudySphere AI</h1>
            <p className="text-sm text-muted-foreground font-medium">Your AI Study Assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={clearChat}
            className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-all duration-200 border border-border hover:border-border/80"
            title="New chat"
          >
            <RotateCcw className="w-5 h-5 text-secondary-foreground" />
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-all duration-200 border border-border hover:border-border/80"
            title="Clear chat"
          >
            <Trash2 className="w-5 h-5 text-secondary-foreground" />
          </button>
          {isLoading && (
            <button
              type="button"
              onClick={stopGeneration}
              className="p-3 rounded-2xl bg-primary hover:bg-primary/90 transition-all duration-200 border border-border"
              title="Stop generation"
            >
              <Square className="w-5 h-5 text-primary-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'User' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] ${message.role === 'User' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-4`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                  message.role === 'User' ? 'bg-primary ml-4' : 'bg-card border-2 border-border mr-4'
                }`}>
                  {message.role === 'User' ? (
                    <User className="w-5 h-5 text-primary-foreground" />
                  ) : (
                    <Bot className="w-5 h-5 text-foreground" />
                  )}
                </div>
                <div className="flex flex-col space-y-2">
                  <div className={`rounded-3xl px-6 py-4 shadow-lg ${
                    message.role === 'User'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground border border-border'
                  }`}>
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {message.content || <span className="opacity-40">…</span>}
                    </div>
                  </div>
                  <div className={`text-xs px-2 ${
                    message.role === 'User' ? 'text-right text-muted-foreground' : 'text-left text-muted-foreground'
                  }`}>
                    {formatTime(message.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading &&
            !messages[messages.length - 1]?.content && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] items-start space-x-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-card border-2 border-border mr-4 flex items-center justify-center shadow-lg">
                    <Bot className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="bg-card border border-border rounded-3xl px-6 py-4 shadow-lg">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-6 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-end space-x-4">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your studies..."
                rows={1}
                className="w-full px-6 py-4 bg-input border border-border rounded-3xl text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 min-h-[56px] max-h-32"
                style={{ height: 'auto', minHeight: '56px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-14 h-14 bg-black hover:bg-gray-800 disabled:bg-gray-400 rounded-2xl flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </form>
          <div className="flex items-center justify-center mt-4">
            <p className="text-sm text-gray-500 font-medium">
              Press Enter to send • Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
