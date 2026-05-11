'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕! 나는 송악고등학교 인공지능 도우미 송악이야. 🏫\n급식, 시간표, 학사일정 등 궁금한 건 뭐든지 물어봐!' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e, customText) => {
    if (e) e.preventDefault();
    const text = customText || input;
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했어. 나중에 다시 시도해줘!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    "오늘 급식 뭐야?",
    "내일 시간표 알려줘",
    "이번 주 학사일정",
    "오늘 1학년 1반 시간표"
  ];

  return (
    <div className="container">
      <header>
        <h1>📘 송악이</h1>
        <p>송악고등학교 스마트 챗봇</p>
      </header>

      <div className="chat-box">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role === 'user' ? 'user' : 'bot'}`}>
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="typing">송악이가 생각 중...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="quick-actions">
        {quickActions.map((action, i) => (
          <button 
            key={i} 
            className="action-btn" 
            onClick={() => handleSubmit(null, action)}
            disabled={isLoading}
          >
            {action}
          </button>
        ))}
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="송악이에게 질문하기..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          전송
        </button>
      </form>
    </div>
  );
}
