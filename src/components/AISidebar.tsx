'use client';

import { useState, useRef, useEffect } from 'react';
import { AIMessage, AISkill } from '@/types';
import { useAuth } from './AuthProvider';

const AI_SKILLS: AISkill[] = [
  {
    id: 'expand',
    name: 'Expand on this point',
    description: 'Generate a more detailed explanation',
    prompt: 'Please expand on this point with more detail and context:'
  },
  {
    id: 'summarize',
    name: 'Summarize this section',
    description: 'Provide a concise summary',
    prompt: 'Please provide a concise summary of this content:'
  },
  {
    id: 'extract_actions',
    name: 'Extract action items',
    description: 'Find all actionable tasks',
    prompt: 'Please extract all action items and tasks from this content. Look for phrases like "need to", "should", "must", "task:", "todo:", "follow up", etc.:'
  }
];

export function AISidebar() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<AISkill | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [avatarError, setAvatarError] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const isNearBottom = () => {
    const el = messagesRef.current;
    if (!el) return true;
    const threshold = 80; // px
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  useEffect(() => {
    // Only auto-scroll if the user is already near the bottom
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [messages]);

  const sendMessage = async (content: string, skill?: AISkill) => {
    if (!content.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: skill ? `${skill.prompt} ${content}` : content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    // User just sent a message: stick to bottom
    requestAnimationFrame(() => scrollToBottom('smooth'));

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          skill: skill?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const aiMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      const stick = isNearBottom();
      setMessages(prev => [...prev, aiMessage]);
      if (stick) {
        requestAnimationFrame(() => scrollToBottom('smooth'));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setSelectedSkill(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue, selectedSkill || undefined);
  };

  const handleSkillClick = (skill: AISkill) => {
    setSelectedSkill(skill);
    setInputValue('');
  };

  return (
    <div className="w-96 h-full min-h-0 overflow-hidden bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Thinking Partner
          </h2>
          <div className="flex items-center space-x-2">
            {(!user?.photoURL || avatarError) ? (
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold"
                role="img"
                aria-label={(user?.displayName || user?.email || 'User').charAt(0).toUpperCase()}
                title={user?.displayName || user?.email || 'User'}
              >
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            ) : (
              <img
                src={user.photoURL}
                alt={user.displayName || user.email || 'User avatar'}
                className="w-8 h-8 rounded-full object-cover"
                onError={() => setAvatarError(true)}
              />
            )}
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* AI Skills */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Actions:</p>
          {AI_SKILLS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => handleSkillClick(skill)}
              className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                selectedSkill?.id === skill.id
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-medium">{skill.name}</div>
              <div className="text-xs opacity-75">{skill.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p>Start a conversation with your AI thinking partner!</p>
            <p className="text-sm mt-2">Try using one of the quick actions above or ask any question.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-75 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* sentinel removed; we scroll the container directly */}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        {selectedSkill && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Using: <strong>{selectedSkill.name}</strong>
            </p>
            <button
              onClick={() => setSelectedSkill(null)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={selectedSkill ? "Enter content to analyze..." : "Ask me anything..."}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-3 py-2 text-white rounded-md transition-colors inline-flex items-center gap-1.5 bg-blue-500/85 hover:bg-blue-500/95 border border-white/20 shadow-sm backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
