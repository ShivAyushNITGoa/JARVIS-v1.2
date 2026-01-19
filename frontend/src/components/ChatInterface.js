'use client';

import { useState, useRef, useEffect } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentStatus, setAttachmentStatus] = useState('idle');
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const { 
    messages, 
    addMessage, 
    clearMessages,
    setProcessing,
    setSpeaking,
    addAttachmentHistory,
  } = useJarvisStore();

  const getAttachmentKind = (file) => {
    if (!file) return 'file';
    const name = file.name?.toLowerCase() || '';
    if (file.type?.startsWith('audio') || /\.(mp3|wav|m4a|webm|ogg)$/i.test(name)) {
      return 'audio';
    }
    if (file.type?.startsWith('image') || /\.(png|jpg|jpeg|webp)$/i.test(name)) {
      return 'image';
    }
    return 'file';
  };

  const attachmentStatusLabel = () => {
    if (attachmentStatus === 'transcribing') return 'Transcribing...';
    if (attachmentStatus === 'vision') return 'Analyzing image...';
    if (attachmentStatus === 'analyzing') return 'Analyzing...';
    return 'Ready';
  };

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !attachment) return;

    const userMessage = input.trim();
    setInput('');

    if (userMessage) {
      addMessage('user', userMessage);
    } else if (attachment) {
      addMessage('user', `Sent attachment: ${attachment.name}`);
    }

    setProcessing(true);

    let attachmentSummary = null;

    if (attachment) {
      const kind = getAttachmentKind(attachment);
      setAttachmentStatus(kind === 'audio' ? 'transcribing' : kind === 'image' ? 'vision' : 'analyzing');
      const analysis = await jarvisAPI.analyzeFile(attachment);

      if (analysis.success) {
        attachmentSummary = analysis.ai_summary || analysis.summary || analysis.preview;
        if (attachmentSummary) {
          addMessage('jarvis', `Attachment analyzed: ${attachmentSummary}`);
        } else {
          addMessage('jarvis', 'Attachment analyzed successfully.');
        }

        if (analysis.transcript) {
          addMessage('jarvis', `Transcript: ${analysis.transcript}`);
        }
      } else {
        addMessage('jarvis', `Attachment analysis failed: ${analysis.error}`);
      }

      addAttachmentHistory({
        id: Date.now(),
        name: attachment.name,
        type: attachment.type || 'unknown',
        size: attachment.size,
        summary: analysis.ai_summary || null,
        preview: analysis.preview || null,
        transcript: analysis.transcript || null,
        caption: analysis.caption || null,
        ocrText: analysis.ocr_text || null,
        status: analysis.success ? 'success' : 'error',
        error: analysis.success ? null : analysis.error,
        timestamp: new Date().toISOString(),
      });

      setAttachment(null);
      setAttachmentStatus('idle');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

    const payloadMessage = attachmentSummary
      ? `${userMessage || 'Please review this attachment.'}\n\nAttachment analysis:\n${attachmentSummary}`
      : userMessage;

    if (!payloadMessage) {
      setProcessing(false);
      return;
    }

    try {
      const response = await jarvisAPI.chat(payloadMessage);

      if (response.success) {
        addMessage('jarvis', response.response);

        if (window.speechSynthesis) {
          setSpeaking(true);
          const utterance = new SpeechSynthesisUtterance(response.response);
          utterance.onend = () => setSpeaking(false);
          window.speechSynthesis.speak(utterance);
        }
      } else {
        addMessage('jarvis', 'I encountered an error. Please try again.');
      }
    } catch (error) {
      addMessage('jarvis', 'Connection error. Please check your network.');
    }

    setProcessing(false);
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAttachment(file);
    setAttachmentStatus('ready');
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden h-[500px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-jarvis-blue/20 flex justify-between items-center">
        <h2 className="text-jarvis-blue font-semibold tracking-wider">
          COMMUNICATION LOG
        </h2>
        <button 
          onClick={clearMessages}
          className="text-white/40 hover:text-white text-sm"
        >
          Clear
        </button>
      </div>
      
      {/* Messages */}
      <div className="chat-container flex-1">
        {messages.length === 0 && (
          <div className="text-center text-white/40 py-8">
            <p>Say "Hey JARVIS" or type a message to begin...</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-sender">
              {msg.sender === 'jarvis' ? 'JARVIS' : 'YOU'}
            </div>
            <div className="text-white">{msg.text}</div>
          </div>
        ))}
        
        <div ref={chatEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-jarvis-blue/20">
        {attachment && (
          <div className="attachment-row">
            <span className="attachment-chip">
              {attachment.name} ({Math.round(attachment.size / 1024)} KB)
            </span>
            <span className="attachment-status">
              {attachmentStatusLabel()}
            </span>
            <button type="button" onClick={clearAttachment} className="attachment-remove">
              Remove
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-black/30 border border-jarvis-blue/30 rounded-full px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-jarvis-blue"
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.mp3,.wav,.m4a,.webm,.ogg"
            onChange={handleAttachmentChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
          >
            Attach
          </button>
          <button type="submit" className="btn-primary">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}