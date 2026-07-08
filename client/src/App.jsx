import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Shield, FileText, Users, MapPin, Loader2, Download, LogOut, Volume2 } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import NetworkGraph from './NetworkGraph';
import jsPDF from 'jspdf';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Login from './Login';
import VoiceOverlay from './VoiceOverlay';
import GeospatialMap from './GeospatialMap';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
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
  const [hotspots, setHotspots] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [globalAuditData, setGlobalAuditData] = useState(null);
  const [mapData, setMapData] = useState(null);
  
  // Phase 4 Modals
  const [reportModalData, setReportModalData] = useState(null);
  const [predictorModalData, setPredictorModalData] = useState(null);
  const [showKannada, setShowKannada] = useState(false);

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
    const fetchHotspots = async () => {
      try {
        const url = window.location.hostname === 'localhost' 
          ? '/api/chat' 
          : 'https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute';
        const res = await axios.get(url, { params: { q: 'Generate Threat Alerts' } });
        const raw = res.data?.output || res.data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed.data?.Alerts) setHotspots(parsed.data.Alerts);
      } catch (err) {}
    };
    fetchHotspots();
    const interval = setInterval(fetchHotspots, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const fetchTimeline = async () => {
      try {
        const url = window.location.hostname === 'localhost' 
          ? '/api/chat' 
          : 'https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute';
        const res = await axios.get(url, { params: { q: 'ACTION_GET_TIMELINE', userEmail: authUser.email } });
        const raw = res.data?.output || res.data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed.data?.Timeline) setTimeline(parsed.data.Timeline);
      } catch (err) {}
    };
    fetchTimeline();
  }, [authUser]);

  useEffect(() => {
    if (selectedResult?.data?.Narrative) {
      setReportModalData({ english: selectedResult.data.Narrative, kannada: null });
      setShowKannada(false);
    }
    if (selectedResult?.data?.TranslatedNarrative && reportModalData) {
      setReportModalData({ ...reportModalData, kannada: selectedResult.data.TranslatedNarrative });
    }
    if (selectedResult?.data?.Predictions) {
      setPredictorModalData({ 
        predictions: selectedResult.data.Predictions,
        rationale: messages[messages.length - 1]?.text || 'Predicted based on network geometry and district boundaries.'
      });
    }
  }, [selectedResult]);

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

  const sendQuery = async (queryText, customHistory = null) => {
    const question = queryText || input;
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question, data: null }]);
    setInput('');
    setLoading(true);

    try {
      // Build history from last 6 messages (excluding the welcome message), Groq format
      const recentHistory = customHistory || messages
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
            userEmail: authUser.fullName || 'Unknown Officer'
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
            userEmail: authUser.fullName || 'Unknown Officer'
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
          suggested_followups: parsed.suggested_followups,
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

      if (parsed.data?.FIR && parsed.data.FIR.length === 1 && !question.startsWith('ACTION_FIND_SIMILAR_')) {
        // Automatically track single FIR query in timeline
        try {
          const url = window.location.hostname === 'localhost' 
            ? '/api/chat' 
            : 'https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute';
          await axios.get(url, { params: { q: `ACTION_TRACK_FIR_${parsed.data.FIR[0].fir_number}`, userEmail: authUser.email } });
          setTimeline(prev => [parsed.data.FIR[0].fir_number, ...prev.filter(f => f !== parsed.data.FIR[0].fir_number)].slice(0, 20));
        } catch(e) {}
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

    const role = authUser?.role || 'Investigator';

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`CrimeIQ — ${role} Report`, margin, y);
    y += 18;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Karnataka State Police — ${role === 'Admin' ? 'Audit Log Export' : 'Case Investigation Trail'}`, margin, y);
    y += 12;
    doc.text(`Exported: ${new Date().toLocaleString('en-IN')} by ${authUser?.email}`, margin, y);
    y += 8;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 24;
    doc.setTextColor(20);

    // Role-specific templates
    if (role === 'Investigator') {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text("Investigator Checklist:", margin, y);
      y += 14;
      doc.setFont(undefined, 'normal');
      doc.text("[ ] Review extracted FIR details", margin, y); y += 12;
      doc.text("[ ] Analyze accused network links", margin, y); y += 12;
      doc.text("[ ] Submit physical evidence to Forensics", margin, y); y += 18;
    } else if (role === 'Supervisor') {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text("Supervisor Overview:", margin, y);
      y += 14;
      doc.setFont(undefined, 'normal');
      doc.text(`Total queries executed: ${messages.length - 1}`, margin, y); y += 18;
    }

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

  const batchExportFIRs = (format, firs) => {
    if (!firs || !firs.length) return;
    
    if (format === 'CSV') {
      const headers = Object.keys(firs[0]).filter(k => !['ROWID', 'CREATORID', 'CREATEDTIME', 'MODIFIEDTIME'].includes(k));
      const rows = firs.map(f => headers.map(h => `"${f[h] || ''}"`).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CrimeIQ_BatchExport_${Date.now()}.csv`;
      a.click();
    } else if (format === 'GEOJSON') {
      const geojson = {
        type: "FeatureCollection",
        features: firs.filter(f => f.latitude && f.longitude).map(f => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [parseFloat(f.longitude), parseFloat(f.latitude)] },
          properties: { ...f }
        }))
      };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CrimeIQ_BatchGeoJSON_${Date.now()}.json`;
      a.click();
    }
  };

  const handleLogout = () => {
    if (window.catalyst?.auth) {
      window.catalyst.auth.signOut(window.location.origin + window.location.pathname);
    } else {
      setAuthUser(null);
    }
  };

  const saveRoleUpdate = async (updatedUser) => {
    try {
      const params = new URLSearchParams({
        user_id: updatedUser.user_id,
        role: updatedUser.role,
        full_name: updatedUser.fullName,
      });
      const base = window.location.hostname === 'localhost'
        ? '/api/role'
        : 'https://crimeiq-60074288350.development.catalystserverless.in/server/role-function/execute';
      await axios.get(`${base}?${params.toString()}`);
      localStorage.setItem('ksp_role', updatedUser.role);
      localStorage.setItem('ksp_name', updatedUser.fullName);
    } catch(e) {
      console.error("Failed to update role in DB", e);
    }
  };

  const T = {
    chat_title: inputLang === 'EN' ? "CrimeIQ" : "ಕ್ರೈಮ್‌ಐಕ್ಯೂ",
    ksp_subtitle: inputLang === 'EN' ? "Karnataka State Police Intelligence" : "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ ಗುಪ್ತಚರ",
    voice_mode: inputLang === 'EN' ? "Voice Mode" : "ಧ್ವನಿ ಮೋಡ್",
    export_pdf: inputLang === 'EN' ? "Export PDF" : "ಪಿಡಿಎಫ್ ರಫ್ತು",
    placeholder: inputLang === 'EN' ? "Ask about FIRs, accused, crime patterns..." : "ಎಫ್ಐಆರ್, ಆರೋಪಿಗಳು, ಅಪರಾಧಗಳ ಬಗ್ಗೆ ಕೇಳಿ...",
    data_view: inputLang === 'EN' ? "Data View" : "ಡೇಟಾ ನೋಟಿಸ್",
    audit_trail: inputLang === 'EN' ? "Audit Trail" : "ಆಡಿಟ್ ಟ್ರೈಲ್",
    empty_data: inputLang === 'EN' ? "Results and Audit Logs will appear here" : "ಫಲಿತಾಂಶಗಳು ಮತ್ತು ಲಾಗ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸಿಕೊಳ್ಳುತ್ತವೆ",
    searching: inputLang === 'EN' ? "Searching crime database..." : "ಡೇಟಾಬೇಸ್ ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
    view_records: inputLang === 'EN' ? "View" : "ವೀಕ್ಷಿಸಿ",
    speak: inputLang === 'EN' ? "Speak" : "ಮಾತನಾಡು",
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
      <PanelGroup direction="horizontal">
        {/* EXTREME LEFT: Officer Timeline */}
        <Panel defaultSize={20} minSize={15} maxSize={30} className="!hidden lg:!flex bg-slate-900 text-white flex-col shadow-xl z-20 shrink-0">
        <div className="p-5 border-b border-slate-800 flex flex-col gap-2 text-center group relative">
          <Shield size={24} className="text-amber-500 mx-auto mb-1" />
          <input 
            value={authUser?.fullName || ''}
            onChange={(e) => setAuthUser({...authUser, fullName: e.target.value})}
            onBlur={() => saveRoleUpdate(authUser)}
            className="font-bold text-sm bg-transparent text-center border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none transition-colors w-full px-1"
            title="Click to edit name"
          />
          <select 
            value={authUser?.role || 'Investigator'}
            onChange={(e) => {
              const newRole = e.target.value;
              const updatedUser = {...authUser, role: newRole};
              setAuthUser(updatedUser);
              saveRoleUpdate(updatedUser);
            }}
            className="text-[10px] uppercase tracking-wider text-slate-400 bg-transparent border border-slate-700 hover:border-slate-500 rounded px-2 py-1 mx-auto outline-none cursor-pointer text-center appearance-none"
            title="Click to change role"
          >
            <option value="Investigator" className="bg-slate-900 text-slate-300">Investigator</option>
            <option value="Analyst" className="bg-slate-900 text-slate-300">Analyst</option>
            <option value="Supervisor" className="bg-slate-900 text-slate-300">Supervisor</option>
            <option value="Admin" className="bg-slate-900 text-slate-300">Admin</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Recent Cases</div>
          {timeline.length === 0 ? (
            <div className="text-xs text-slate-500 italic text-center py-4">No recent cases tracked.</div>
          ) : (
            timeline.map(fir => (
              <button 
                key={fir}
                onClick={() => sendQuery(fir)}
                className="w-full text-left bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 transition-colors truncate"
              >
                {fir}
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-xs font-bold transition-colors">
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-blue-500 cursor-col-resize transition-colors !hidden lg:!block z-30" />

        {/* LEFT: Chat Panel */}
        <Panel defaultSize={45} minSize={30} className="flex flex-col w-full h-full bg-white z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white z-10 shadow-sm relative">
          <div className="flex items-center gap-3">
            <img src="https://ksp.karnataka.gov.in/frontend/opt1/images/center_logo/kar_main_logo.png" alt="KSP" className="h-10 object-contain drop-shadow-sm" />
            <div className="border-l-2 border-amber-400 pl-3 py-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="font-extrabold text-lg tracking-tight text-slate-900">{T.chat_title}</h1>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{T.ksp_subtitle}</p>
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
              {T.voice_mode}
            </button>
            {messages.length > 1 && (
              <button
                onClick={exportToPDF}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-colors"
                title="Export conversation as PDF"
              >
                <Download size={13} />
                {T.export_pdf}
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
        
        {/* Real-Time Threats Ticker */}
        {hotspots.length > 0 && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-2 flex items-center gap-3 overflow-hidden shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider whitespace-nowrap bg-red-100 px-2 py-0.5 rounded">
              <span className="animate-pulse">🔴</span> Live Alerts
            </div>
            <div className="flex gap-6 overflow-x-auto no-scrollbar text-xs font-medium text-red-900 pb-1">
              {hotspots.map((h, i) => (
                <span key={i} className="whitespace-nowrap flex items-center gap-1.5">
                  <Shield size={12} className="text-red-400" />
                  {h.alert}
                </span>
              ))}
            </div>
          </div>
        )}

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
                      {T.view_records} {msg.queryCount} record{msg.queryCount !== 1 ? 's' : ''}
                    </button>
                  )}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => speakText(msg.voice_summary || msg.text)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                      title="Read aloud"
                    >
                      <Volume2 size={12} />
                      {T.speak}
                    </button>
                  )}
                </div>
                {/* Suggested Follow-ups (AI Coach) */}
                {msg.suggested_followups?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Suggested Follow-ups</span>
                    {msg.suggested_followups.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendQuery(suggestion)}
                        className="text-left text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-slate-500 shadow-sm">
                <Loader2 size={14} className="animate-spin" />
                {T.searching}
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
              placeholder={T.placeholder}
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
        </Panel>
        <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-blue-500 cursor-col-resize transition-colors !hidden md:!block z-30" />

        {/* RIGHT: Results Panel */}
        <Panel defaultSize={35} minSize={20} className="!hidden md:!flex flex-col bg-slate-50 h-full relative overflow-hidden">
        <div className="flex items-center gap-6 px-6 py-4 border-b border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('Data')}
            className={`font-semibold text-sm ${activeTab === 'Data' ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-4' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {T.data_view}
          </button>
          <button
            onClick={async () => {
              setActiveTab('Map');
              if (!mapData) {
                try {
                  const url = window.location.hostname === 'localhost' ? '/api/chat' : 'https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute';
                  const res = await axios.get(url, { params: { q: 'ACTION_GET_MAP_DATA' } });
                  const raw = res.data?.output || res.data;
                  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                  if (parsed.data) setMapData(parsed.data.MapFIRs);
                } catch(e) {}
              }
            }}
            className={`font-semibold text-sm ${activeTab === 'Map' ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-4' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Map View
          </button>
          <button
            onClick={() => setActiveTab('Audit')}
            className={`font-semibold text-sm ${activeTab === 'Audit' ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-4' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {T.audit_trail}
          </button>
          {authUser.role === 'Admin' && (
            <button
              onClick={async () => {
                setActiveTab('GlobalAudit');
                try {
                  const url = window.location.hostname === 'localhost' ? '/api/chat' : 'https://crimeiq-60074288350.development.catalystserverless.in/server/chat-function/execute';
                  const res = await axios.get(url, { params: { q: 'ACTION_GET_AUDIT_LOGS' } });
                  const raw = res.data?.output || res.data;
                  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                  if (parsed.data) setGlobalAuditData(parsed.data.AuditLogs);
                } catch(e) {}
              }}
              className={`font-semibold text-sm ${activeTab === 'GlobalAudit' ? 'text-blue-600 border-b-2 border-blue-600 pb-4 -mb-4' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Global Audit
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {!selectedResult ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
              <MapPin size={36} className="opacity-30" />
              <span>{T.empty_data}</span>
            </div>
          ) : activeTab === 'Map' ? (
            <GeospatialMap />
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
          ) : activeTab === 'GlobalAudit' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Compliance & Audit Logs</h3>
                  <p className="text-xs text-slate-500">Global ledger of all system interactions</p>
                </div>
                <Shield size={24} className="text-slate-300" />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Officer Name</th>
                      <th className="px-4 py-3">Query Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {globalAuditData?.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-[10px] whitespace-nowrap">{log.CREATEDTIME}</td>
                        <td className="px-4 py-3 font-medium">{log.user_email}</td>
                        <td className="px-4 py-3 text-slate-500">{log.details}</td>
                      </tr>
                    )) || <tr><td colSpan="3" className="text-center py-8">Loading logs...</td></tr>}
                  </tbody>
                </table>
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
              {selectedResult.data?.Accused?.length > 0 && (
                (() => {
                  const caseToAccused = {};
                  selectedResult.data.Accused.forEach(accused => {
                    const caseId = accused.CaseMasterID;
                    if (caseId) {
                       if (!caseToAccused[caseId]) caseToAccused[caseId] = [];
                       if (!caseToAccused[caseId].includes(accused.ROWID)) caseToAccused[caseId].push(accused.ROWID);
                    }
                  });
                  const links = [];
                  Object.values(caseToAccused).forEach(accusedGroup => {
                     for (let i = 0; i < accusedGroup.length; i++) {
                       for (let j = i + 1; j < accusedGroup.length; j++) {
                          links.push({ accused_id_1: accusedGroup[i], accused_id_2: accusedGroup[j], link_type: 'prior_co-accused' });
                       }
                     }
                  });
                  // if (links.length === 0) return null; // Removed so graph renders even with just unconnected nodes
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={13} className="text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Criminal Network Graph
                        </h3>
                      </div>
                      <div className="border border-slate-200 rounded-xl bg-white p-1 shadow-sm overflow-hidden">
                        <NetworkGraph accused={selectedResult.data.Accused} links={links} />
                      </div>
                    </div>
                  );
                })()
              )}
              {Object.entries(selectedResult.data || {})
                .filter(([key]) => !['_note', 'Alerts', 'Narrative', 'TranslatedNarrative', 'Predictions'].includes(key))
                .map(([type, rows]) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                          {type} Database Records ({rows.length})
                        </h3>
                      </div>
                      {type === 'CaseMaster' && rows.length > 0 && (
                        <div className="flex gap-2">
                          <button onClick={() => batchExportFIRs('CSV', rows)} className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded">
                            CSV
                          </button>
                          <button onClick={() => batchExportFIRs('GEOJSON', rows)} className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded">
                            GeoJSON
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {rows.map((row, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-xl p-3.5 text-xs border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {Object.entries(row)
                            .filter(([k]) => !['ROWID', 'CREATORID', 'CREATEDTIME', 'MODIFIEDTIME'].includes(k))
                            .map(([k, v]) => {
                              if (k === 'similarityScore') {
                                return (
                                  <div key={k} className="flex items-center justify-between py-1 border-t border-slate-100 mt-1 pt-2">
                                    <span className="text-blue-600 font-bold uppercase text-[10px] tracking-widest">Similarity Match:</span>
                                    <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs">{v}% Match</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={k} className="flex gap-2 py-0.5">
                                  <span className="text-slate-400 font-medium min-w-[110px] capitalize">
                                    {k.replace(/_/g, ' ')}:
                                  </span>
                                  <span className="text-slate-800">{String(v)}</span>
                                </div>
                              );
                            })}
                          {type === 'CaseMaster' && !row.similarityScore && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-2">
                              <button 
                                onClick={() => sendQuery(`ACTION_GENERATE_NARRATIVE_FIR_${row.CrimeNo}`)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                              >
                                Generate Case Report 📖
                              </button>
                              <button 
                                onClick={() => sendQuery(`ACTION_FIND_SIMILAR_${row.CrimeNo}`)}
                                className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded transition-colors"
                              >
                                Find Similar Cases 🔎
                              </button>
                            </div>
                          )}
                          {type === 'Accused' && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                              <button 
                                onClick={() => sendQuery(`ACTION_PREDICT_ESCAPE_ACCUSED_${row.ROWID}`)}
                                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors"
                              >
                                Predict Escape Route 🎯
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>

      {/* Narrative Report Modal */}
      {reportModalData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <FileText className="text-blue-600" size={24} />
                <h2 className="text-lg font-bold text-slate-800">Official Investigation Report</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!showKannada && !reportModalData.kannada) {
                      sendQuery(`ACTION_TRANSLATE_NARRATIVE_KN`, [{role: 'user', content: reportModalData.english}]);
                    }
                    setShowKannada(!showKannada);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                >
                  {showKannada ? 'Show English' : 'Translate to Kannada (ಕನ್ನಡ)'}
                </button>
                <button
                  onClick={() => {
                    if (showKannada && reportModalData.kannada) {
                      alert("Note: Standard PDF fonts do not support Kannada script. The PDF may show blank or garbage characters for Kannada text.");
                    }
                    const doc = new jsPDF();
                    doc.setFontSize(10);
                    let textToPrint = showKannada && reportModalData.kannada ? reportModalData.kannada : reportModalData.english;
                    
                    // Sanitize text for jsPDF default standard fonts (remove markdown, swap box drawing chars)
                    textToPrint = textToPrint
                      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
                      .replace(/═/g, '=')
                      .replace(/━/g, '-')
                      .replace(/✓/g, '>')
                      .replace(/[\u2018\u2019]/g, "'")
                      .replace(/[\u201C\u201D]/g, '"');
                      
                    const splitText = doc.splitTextToSize(textToPrint, 180);
                    doc.text(splitText, 15, 20);
                    doc.save('KSP_Investigation_Report.pdf');
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                >
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => setReportModalData(null)} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors">
                  Close
                </button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto bg-white flex-1">
              {showKannada && !reportModalData.kannada ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <p>Translating to Kannada via CrimeIQ AI...</p>
                </div>
              ) : (
                <pre className="font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {showKannada ? reportModalData.kannada : reportModalData.english}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Escape Predictor Modal */}
      {predictorModalData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <MapPin className="text-red-600" size={24} />
                <h2 className="text-lg font-bold text-slate-800">Geo-Based Escape Predictor 🎯</h2>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    sendQuery("Alerting checkpoints..."); 
                    setPredictorModalData(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm animate-pulse"
                >
                  🚨 Alert All Checkpoints
                </button>
                <button onClick={() => setPredictorModalData(null)} className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors">
                  Close
                </button>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/3 bg-white border-r border-slate-200 p-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">AI Rationale</h3>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 leading-relaxed mb-6 font-medium">
                  {predictorModalData.rationale}
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Predicted Destinations</h3>
                <div className="space-y-3">
                  {predictorModalData.predictions.map((p, i) => (
                    <div key={i} className={`p-4 border rounded-xl flex items-center justify-between ${
                      p.risk === 'Red' ? 'bg-red-50 border-red-200' : 
                      p.risk === 'Yellow' ? 'bg-orange-50 border-orange-200' : 
                      'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          p.risk === 'Red' ? 'bg-red-500' : 
                          p.risk === 'Yellow' ? 'bg-orange-500' : 'bg-green-500'
                        }`} />
                        <span className={`font-bold ${
                          p.risk === 'Red' ? 'text-red-900' : 
                          p.risk === 'Yellow' ? 'text-orange-900' : 'text-green-900'
                        }`}>{p.district}</span>
                      </div>
                      <div className="text-xs font-black uppercase opacity-60">
                        {p.score}% Prob
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-2/3 bg-slate-100 relative">
                <MapContainer center={[14.0, 76.5]} zoom={7} className="w-full h-full" zoomControl={false}>
                  <TileLayer url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png" />
                  {predictorModalData.predictions.map((p, i) => {
                    const coords = {
                      'Mysuru': [12.2958, 76.6394],
                      'Tumakuru': [13.3379, 77.1173],
                      'Kolar': [13.1367, 78.1292],
                      'Ramanagara': [12.7150, 77.2813],
                      'Chikkaballapur': [13.4325, 77.7274],
                      'Hassan': [13.0033, 76.1004],
                      'Mandya': [12.5218, 76.8951],
                      'Chitradurga': [14.2251, 76.3980]
                    }[p.district] || [14.0, 76.5];
                    
                    const color = p.risk === 'Red' ? '#ef4444' : p.risk === 'Yellow' ? '#f97316' : '#22c55e';
                    
                    return (
                      <CircleMarker 
                        key={i} 
                        center={coords} 
                        radius={p.risk === 'Red' ? 40 : p.risk === 'Yellow' ? 25 : 15}
                        pathOptions={{ color: color, fillColor: color, fillOpacity: 0.3, weight: 2 }}
                      >
                        <Popup>
                          <strong>{p.district}</strong><br/>Probability: {p.score}%
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

