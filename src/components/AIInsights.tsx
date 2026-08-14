import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, Bot } from 'lucide-react';

interface AIInsightsProps {
  tasks: any[];
  projects: any[];
  teamMembers: any[];
}

export function AIInsights({ tasks, projects, teamMembers }: AIInsightsProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('groq_api_key') || import.meta.env.VITE_GROQ_API_KEY || '');
  const [isKeySaved, setIsKeySaved] = useState(!!localStorage.getItem('groq_api_key') || !!import.meta.env.VITE_GROQ_API_KEY);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSystemPrompt = () => `You are Nyra AI, an intelligent project management assistant for the Nyghto OS dashboard. 
Your goal is to provide helpful, actionable insights based on the current state of tasks, projects, and the team.
CRITICAL RULE: Never suggest assigning Shahal's tasks to Amal. Shahal must do his own tasks. If asked about it, firmly refuse to reassign Shahal's work to Amal.

Current Data Context:
Projects: ${JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, status: p.status, progress: p.progress, priority: p.priority })))}
Tasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assigneeId: t.assigneeId })))}
Team Members: ${JSON.stringify(teamMembers.map(m => ({ id: m.id, name: m.name })))}

Provide brief, friendly responses. Format nicely using Markdown.`;

  const fetchGroq = async (chatHistory: { role: 'user' | 'model', text: string }[], newMessage: string) => {
    const groqMessages = [
      { role: "system", content: getSystemPrompt() },
      ...chatHistory.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
      { role: "user", content: newMessage }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: groqMessages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Failed to fetch from Groq");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  const startBriefing = async () => {
      setIsLoading(true);
      try {
        const text = await fetchGroq([], "Give me the initial daily briefing with 2-3 quick bullet points summarizing critical things like overdue tasks or stalled projects. Be concise.");
        setMessages([{ role: 'model', text }]);
      } catch (error: any) {
        console.error("Error initializing AI chat:", error);
        setMessages([{ role: 'model', text: `Error: ${error.message || "Could not connect to Groq API. Please check your API key and try again."}` }]);
      } finally {
        setIsLoading(false);
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    const currentMessages = [...messages];
    setMessages([...currentMessages, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const text = await fetchGroq(currentMessages, userMessage);
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: 'model', text: `Sorry, there was an error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[400px] border border-nyghto-orange/20 overflow-hidden mb-6">
      <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-nyghto-orange" />
        <h3 className="font-bold text-white">Nyra AI Assistant</h3>
      </div>
      
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!isKeySaved && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <Sparkles className="w-12 h-12 text-nyghto-orange" />
            <div>
              <p className="text-gray-300 font-medium">Connect Groq API</p>
              <p className="text-sm text-gray-500 max-w-xs mt-1">Please enter your Groq API Key to use the Llama 3 AI assistant for free. You can get one at console.groq.com</p>
            </div>
            <div className="flex w-full max-w-xs gap-2">
              <input
                type="password"
                placeholder="gsk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-nyghto-orange"
              />
              <button 
                onClick={() => {
                  if(apiKey.trim()) {
                    localStorage.setItem('groq_api_key', apiKey.trim());
                    setIsKeySaved(true);
                  }
                }}
                className="bg-nyghto-orange hover:bg-orange-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {isKeySaved && messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-80">
            <Bot className="w-12 h-12 text-nyghto-orange/50" />
            <div>
              <p className="text-gray-300 font-medium">Nyra AI is ready.</p>
              <p className="text-sm text-gray-500 max-w-xs mt-1">Get a quick summary of your active projects, pending tasks, and team updates.</p>
            </div>
            <div className="flex gap-3 mt-2">
              <button 
                onClick={startBriefing}
                className="px-4 py-2 bg-nyghto-orange hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Get Daily Briefing
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('groq_api_key');
                  setApiKey('');
                  setIsKeySaved(false);
                }}
                className="px-4 py-2 bg-transparent border border-white/20 hover:bg-white/5 text-gray-300 rounded-lg transition-colors text-sm font-medium"
              >
                Change API Key
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-nyghto-orange/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-nyghto-orange" />
              </div>
            )}
            <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-nyghto-orange text-white rounded-br-none' : 'bg-white/10 text-gray-200 rounded-bl-none'}`}>
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-nyghto-orange/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-nyghto-orange" />
            </div>
            <div className="p-3 rounded-2xl bg-white/10 text-gray-200 rounded-bl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-nyghto-orange" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        

      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-black/20 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Nyra about your projects..." 
          className="flex-1 bg-nyghto-dark border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-nyghto-orange transition-colors"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="p-2 bg-nyghto-orange hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
