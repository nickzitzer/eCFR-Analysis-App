"use client";

import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, CloseIcon, ChatIcon } from './Icons';

const FloatingChatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ from: 'user' | 'ai', text: string }[]>([]);
    const [input, setInput] = useState('');
    const chatBoxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages([{ from: 'ai', text: 'Hello! I am the eCFR AI assistant. How can I help you today?' }]);
    }, []);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { from: 'user' as const, text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: input }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response from AI');
            }

            const data = await response.json();
            const aiMessage = { from: 'ai' as const, text: data.text };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error fetching AI response:', error);
            const errorMessage = { from: 'ai' as const, text: 'Sorry, I am having trouble connecting. Please try again later.' };
            setMessages(prev => [...prev, errorMessage]);
        }
    };

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-opacity-90 transition-transform hover:scale-110 z-100" aria-label="Open AI Assistant">
                <ChatIcon />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-lg shadow-2xl flex flex-col border border-gray-300 z-100" role="dialog" aria-labelledby="ai-assistant-heading">
            <header className="flex justify-between items-center p-3 bg-primary text-white rounded-t-lg">
                <h3 id="ai-assistant-heading" className="font-bold flex items-center"><SparklesIcon /> AI Assistant</h3>
                <button onClick={() => setIsOpen(false)} aria-label="Close AI Assistant"><CloseIcon /></button>
            </header>
            <div ref={chatBoxRef} className="flex-grow p-4 overflow-y-auto" aria-live="polite">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex mb-3 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`rounded-lg px-3 py-2 max-w-xs ${msg.from === 'user' ? 'bg-primary text-white' : 'bg-gray-200'}`}>{msg.text}</div>
                    </div>
                ))}
            </div>
            <form onSubmit={handleSend} className="p-3 border-t">
                <div className="flex">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} className="flex-grow p-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-accent" placeholder="Ask a question..." />
                    <button type="submit" className="bg-primary text-white px-4 rounded-r-md font-semibold">Send</button>
                </div>
            </form>
        </div>
    );
};

export default FloatingChatbot;