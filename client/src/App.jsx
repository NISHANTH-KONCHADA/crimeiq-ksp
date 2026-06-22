import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Shield, FileText, Users, MapPin, Loader2, Download, LogOut, Volume2 } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import NetworkGraph from './NetworkGraph';
import jsPDF from 'jspdf';
import Login from './Login';
import VoiceOverlay from './VoiceOverlay';
import './App.css';

// const CHAT_FUNCTION_URL = '/api/chat';

// We will dynamically check localhost in the component instead of defining a global URL

const SUGGESTED_QUERIES = [
  "Show me theft cases in Bengaluru",
  "List open cybercrime cases",
  "🚨 Generate Threat Alerts",
  "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಇತ್ತೀಚಿನ ಅಪರಾಧಗಳನ್ನು ತೋರಿಸಿ",
];

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello, I'm CrimeIQ — your AI assistant for the KSP Crime Database. Ask me about FIRs, accused, victims, or crime patterns in natural language.",
      data: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [activeTab, setActiveTab] = useState('Data'); // 'Data' or 'Audit'
  const [inputLang, setInputLang] = useState('EN');
  const [voiceOverlayActive, setVoiceOverlayActive] = useState(false);
  const [voiceState, setVoiceState] = useState('IDLE'); // 'LISTENING', 'THINKING', 'SPEAKING', 'ERROR'
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceOverlayActiveRef = useRef(false);
  const voiceStateRef = useRef('IDLE');
  const availableVoicesRef = useRef([]);

  // Sync state to refs for event listeners
  useEffect(() => {
    voiceOverlayActiveRef.current = voiceOverlayActive;
  }, [voiceOverlayActive]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const loadVoices = () => {
      if (window.speechSynthesis) {
        availableVoicesRef.current = window.speechSynthesis.getVoices();
      }
    };
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        const text = transcript.trim();
        if (!text) return;

        const wordCount = text.split(/\s+/).length;

        if (voiceStateRef.current === 'SPEAKING') {
          // Barge-in Interruption! Only interrupt if 2+ words (avoid noise)
          if (wordCount < 2) return;

          window.speechSynthesis.cancel();
          setVoiceState('THINKING');
          setInput(text);
          sendQuery(text);
        } else if (voiceOverlayActiveRef.current) {
          setInput(text);
          setVoiceState('THINKING');
          recognition.stop();
          sendQuery(text);
        } else {
          setInput(text);
          setIsListening(false);
        }
      };
      recognition.onerror = () => {
        if (!voiceOverlayActiveRef.current) setIsListening(false);
      };
      recognition.onend = () => {
        if (voiceOverlayActiveRef.current && (voiceStateRef.current === 'LISTENING' || voiceStateRef.current === 'SPEAKING')) {
          // Restart if it stopped listening but we are still in listening or speaking state
          try { recognition.start(); } catch (e) { }
        } else if (!voiceOverlayActiveRef.current) {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice input not supported in this browser. Try Chrome.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = inputLang === 'KN' ? 'kn-IN' : 'en-IN';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const startVoiceListening = () => {
    if (!recognitionRef.current) return;
    setVoiceState('LISTENING');
    recognitionRef.current.lang = inputLang === 'KN' ? 'kn-IN' : 'en-IN';
    try { recognitionRef.current.start(); } catch (e) { }
  };

  const toggleVoiceOverlay = () => {
    if (!voiceOverlayActive) {
      setVoiceOverlayActive(true);
      startVoiceListening();
    } else {
      setVoiceOverlayActive(false);
      setVoiceState('IDLE');
      window.speechSynthesis.cancel();
      try { recognitionRef.current.stop(); } catch (e) { }
    }
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Strip markdown formatting for cleaner audio
    const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^[-*+]\s/gm, '').replace(/#{1,6}\s/g, '');
    const isKannada = /[\u0C80-\u0CFF]/.test(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = isKannada ? 'kn-IN' : 'en-IN';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = availableVoicesRef.current;
    const matchingLang = voices.filter(v => v.lang.startsWith(isKannada ? 'kn' : 'en'));

    let preferredVoice = null;
    if (!isKannada) {
      preferredVoice = matchingLang.find(v => v.name === 'Google UK English Female' || v.name === 'Google US English') ||
        matchingLang.find(v => v.name.includes('Google')) ||
        matchingLang.find(v => v.name.includes('Natural') || v.name.includes('Neural')) ||
        matchingLang.find(v => v.lang === 'en-IN' || v.lang === 'en-GB');
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    } else if (matchingLang.length > 0) {
      utterance.voice = matchingLang[0];
    }

    utterance.onend = () => {
      if (voiceOverlayActiveRef.current && voiceStateRef.current === 'SPEAKING') {
        // Add a short 400ms ambient pause before resuming listening
        setTimeout(() => {
          if (voiceOverlayActiveRef.current) startVoiceListening();
        }, 400);
      }
    };

    window.speechSynthesis.speak(utterance);

    // Keep mic alive during speaking for Barge-In
    if (voiceOverlayActiveRef.current) {
      try { recognitionRef.current.start(); } catch (e) { }
    }
  };

  const sendQuery = async (queryText) => {
    const question = queryText || input;
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question, data: null }]);
    setInput('');
    setLoading(true);

    try {
      // Build history from last 6 messages (excluding the welcome message), Groq format
      const recentHistory = messages
        .slice(1) // skip welcome message
        .slice(-6)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      let parsed;
      if (window.location.hostname === 'localhost') {
        const res = await axios.get('/api/chat', {
          params: {
            q: question,
            history: JSON.stringify(recentHistory),
            isVoiceMode: voiceOverlayActiveRef.current,
          },
        });
        const raw = res.data.output || res.data;
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else {
        const res = await axios.get('https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute', {
          params: {
            q: question,
            history: JSON.stringify(recentHistory),
            isVoiceMode: voiceOverlayActiveRef.current,
          }
        });
        const raw = res.data?.output || res.data;
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: parsed.answer,
          voice_summary: parsed.voice_summary,
          data: parsed.data,
          queryCount: parsed.query_count,
          audit_trail: parsed.audit_trail,
        },
      ]);
      if (parsed.data || parsed.audit_trail) {
        setSelectedResult({
          data: parsed.data,
          audit_trail: parsed.audit_trail
        });
        setActiveTab('Data');
      }

      if (voiceOverlayActiveRef.current) {
        setVoiceState('SPEAKING');
        speakText(parsed.voice_summary || parsed.answer);
      }
    } catch (err) {
      if (voiceOverlayActiveRef.current) setVoiceState('ERROR');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Error connecting to CrimeIQ backend: ${err.message}`,
          data: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    let y = 60;

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('CrimeIQ — Conversation Export', margin, y);
    y += 18;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Karnataka State Police — KSP Crime Intelligence Assistant`, margin, y);
    y += 12;
    doc.text(`Exported: ${new Date().toLocaleString('en-IN')}`, margin, y);
    y += 8;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 24;
    doc.setTextColor(20);

    messages.forEach((msg) => {
      if (y > 760) {
        doc.addPage();
        y = 60;
      }

      const label = msg.role === 'user' ? 'Investigator' : 'CrimeIQ AI';
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(msg.role === 'user' ? 30 : 37, msg.role === 'user' ? 41 : 99, msg.role === 'user' ? 59 : 235);
      doc.text(label, margin, y);
      y += 14;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(40);

      // Strip markdown symbols for clean PDF text
      const plainText = msg.text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/^[-*+]\s/gm, '• ')
        .replace(/#{1,6}\s/g, '');

      const lines = doc.splitTextToSize(plainText, maxWidth);
      lines.forEach((line) => {
        if (y > 780) {
          doc.addPage();
          y = 60;
        }
        doc.text(line, margin, y);
        y += 13;
      });

      if (msg.queryCount) {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`(${msg.queryCount} database records referenced)`, margin, y);
        y += 12;
      }

      y += 12;
    });

    // Footer note
    if (y > 740) {
      doc.addPage();
      y = 60;
    }
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text('Generated by CrimeIQ — for authorized law enforcement use only.', margin, y);

    doc.save(`CrimeIQ-Conversation-${Date.now()}.pdf`);
  };

  const handleLogout = () => {
    if (window.catalyst?.auth) {
      window.catalyst.auth.signOut(window.location.origin + window.location.pathname);
    } else {
      setAuthUser(null);
    }
  };

  if (!authUser) {
    return <Login onAuthenticated={setAuthUser} />;
  }

  return (
    <div className="h-screen w-screen flex bg-white text-slate-800 overflow-hidden font-sans">
      <VoiceOverlay
        isActive={voiceOverlayActive}
        status={voiceState}
        onClose={toggleVoiceOverlay}
        transcript={input}
        inputLang={inputLang}
        onToggleLang={() => setInputLang(prev => prev === 'EN' ? 'KN' : 'EN')}
      />
      {/* LEFT: Chat Panel */}
      <div className="flex flex-col w-full md:w-[55%] border-r border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <img src="https://ksp.karnataka.gov.in/frontend/opt1/images/center_logo/kar_main_logo.png" alt="KSP" className="h-10 object-contain drop-shadow-sm" />
            <div className="border-l-2 border-amber-400 pl-3 py-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="font-extrabold text-lg tracking-tight text-slate-900">Crime<span className="text-blue-600">IQ</span></h1>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Karnataka State Police Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <Shield size={11} />
              {authUser.role} · {authUser.fullName}
            </div>
            <button
              onClick={toggleVoiceOverlay}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${voiceOverlayActive
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900'
                }`}
              title="Start Immersive Voice Mode"
            >
              <Mic size={13} />
              Voice Mode
            </button>
            {messages.length > 1 && (
              <button
                onClick={exportToPDF}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-colors"
                title="Export conversation as PDF"
              >
                <Download size={13} />
                Export PDF
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-md whitespace-pre-wrap'
                    : 'bg-white text-slate-700 rounded-bl-md border border-slate-200 shadow-sm'
                  }`}
              >
                {msg.role === 'user' ? (
                  msg.text
                ) : (
                  <div className="prose-chat">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                        li: ({ children }) => <li className="text-slate-700">{children}</li>,
                        h1: ({ children }) => <p className="font-semibold text-slate-900 mb-1">{children}</p>,
                        h2: ({ children }) => <p className="font-semibold text-slate-900 mb-1">{children}</p>,
                        h3: ({ children }) => <p className="font-semibold text-slate-900 mb-1">{children}</p>,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-2.5">
                  {msg.data && (
                    <button
                      onClick={() => {
                        setSelectedResult({ data: msg.data, audit_trail: msg.audit_trail });
                        setActiveTab('Data');
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <FileText size={12} />
                      View {msg.queryCount} record{msg.queryCount !== 1 ? 's' : ''}
                    </button>
                  )}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => speakText(msg.voice_summary || msg.text)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                      title="Read aloud"
                    >
                      <Volume2 size={12} />
                      Speak
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-slate-500 shadow-sm">
                <Loader2 size={14} className="animate-spin" />
                Searching crime database...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Suggested queries */}
        {messages.length === 1 && (
          <div className="px-6 py-3 flex flex-wrap gap-2 bg-slate-50 border-t border-slate-100">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendQuery(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-colors bg-white"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-slate-900/10">
            <button
              onClick={() => setInputLang(prev => prev === 'EN' ? 'KN' : 'EN')}
              className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 bg-slate-200 rounded border border-slate-300"
              title="Toggle Input Language (English / Kannada)"
            >
              {inputLang}
            </button>
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              title="Voice input"
            >
              {isListening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about FIRs, accused, crime patterns..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
            />
            <button
              onClick={() => sendQuery()}
              disabled={loading || !input.trim()}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors text-white"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Results Panel */}
      <div className="hidden md:flex flex-col w-[45%] bg-white">
        <div className="flex items-center gap-6 px-6 py-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('Data')}
            className={`font-semibold text-sm ${activeTab === 'Data' ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-4' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Data View
          </button>
          <button
            onClick={() => setActiveTab('Audit')}
            className={`font-semibold text-sm ${activeTab === 'Audit' ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-4' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Audit Trail
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {!selectedResult ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
              <MapPin size={36} className="opacity-30" />
              <span>Results and Audit Logs will appear here</span>
            </div>
          ) : activeTab === 'Audit' ? (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Explainable AI Audit Log</h3>
                <p className="text-xs text-slate-500 mb-4">
                  These are the exact ZCQL queries executed by the CrimeIQ AI to gather the data for this response. This ensures transparency and traceability of the AI's conclusions.
                </p>
                {selectedResult.audit_trail?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedResult.audit_trail.map((audit, i) => (
                      <div key={i} className="bg-slate-900 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          Query: {audit.type}
                        </div>
                        <div className="p-3">
                          <code className="text-xs text-green-400 font-mono break-words whitespace-pre-wrap">
                            {audit.query}
                          </code>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No database queries were executed for this response.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedResult.data?.Alerts?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-red-500" />
                    <h3 className="text-xs font-bold text-red-600 uppercase tracking-wide">
                      Predictive Threat Alerts
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {selectedResult.data.Alerts.map((alert, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 font-medium flex gap-2">
                        <span>🚨</span>
                        {alert.alert}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedResult.data?.Accused?.length > 0 && selectedResult.data?.CriminalLink?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={13} className="text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                      Criminal Network Graph
                    </h3>
                  </div>
                  <div className="border border-slate-200 rounded-xl bg-white p-1 shadow-sm overflow-hidden">
                    <NetworkGraph accused={selectedResult.data.Accused} links={selectedResult.data.CriminalLink} />
                  </div>
                </div>
              )}
              {Object.entries(selectedResult.data || {})
                .filter(([key]) => key !== '_note' && key !== 'Alerts')
                .map(([type, rows]) => (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={13} className="text-slate-500" />
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                        {type} Database Records ({rows.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {rows.map((row, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-xl p-3.5 text-xs border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {Object.entries(row)
                            .filter(([k]) => !['ROWID', 'CREATORID', 'CREATEDTIME', 'MODIFIEDTIME'].includes(k))
                            .map(([k, v]) => (
                              <div key={k} className="flex gap-2 py-0.5">
                                <span className="text-slate-400 font-medium min-w-[110px] capitalize">
                                  {k.replace(/_/g, ' ')}:
                                </span>
                                <span className="text-slate-800">{String(v)}</span>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

