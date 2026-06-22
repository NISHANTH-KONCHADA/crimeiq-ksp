import React from 'react';
import { X, Mic } from 'lucide-react';

export default function VoiceOverlay({ isActive, status, onClose, transcript, inputLang, onToggleLang }) {
  if (!isActive) return null;

  // Determine styles based on status
  let orbClasses = "w-32 h-32 rounded-full transition-all duration-500 ease-in-out shadow-2xl flex items-center justify-center ";
  let statusText = "Initializing...";
  let ringClasses = "absolute inset-0 rounded-full animate-ping opacity-20 ";

  switch (status) {
    case 'LISTENING':
      orbClasses += "bg-blue-500 scale-100";
      ringClasses += "bg-blue-500 animation-delay-0";
      statusText = "Listening...";
      break;
    case 'THINKING':
      orbClasses += "bg-purple-500 scale-90 animate-pulse";
      ringClasses += "bg-purple-500 animation-delay-200";
      statusText = "Thinking...";
      break;
    case 'SPEAKING':
      orbClasses += "bg-green-500 scale-110 animate-bounce";
      ringClasses += "bg-green-500 animation-delay-0";
      statusText = "Speaking...";
      break;
    case 'ERROR':
      orbClasses += "bg-red-500 scale-100";
      ringClasses += "bg-red-500 animation-delay-0";
      statusText = "Error communicating. Try again.";
      break;
    default:
      orbClasses += "bg-slate-500";
      ringClasses += "bg-slate-500";
      break;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md text-white">
      {/* Header Controls */}
      <div className="absolute top-6 w-full px-8 flex justify-between items-center">
        <div className="text-sm font-semibold tracking-widest uppercase text-slate-400">
          CrimeIQ Voice
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
          title="Exit Voice Mode"
        >
          <X size={24} className="text-slate-300" />
        </button>
      </div>

      {/* Visualizer Center */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-6">
        <div className="relative mb-12">
          {/* Pulsing rings */}
          <div className={ringClasses} style={{ animationDuration: '2s' }}></div>
          <div className={ringClasses} style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
          
          {/* Core Orb */}
          <div className={orbClasses}>
            {status === 'LISTENING' && <Mic size={40} className="text-white/80" />}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center space-y-4 w-full">
          <h2 className="text-2xl font-light text-slate-300">{statusText}</h2>
          
          {/* Transcript Display */}
          <div className="min-h-[80px] w-full bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
            <p className="text-lg md:text-xl font-medium text-white/90 leading-relaxed text-center">
              {transcript || <span className="text-slate-500 italic">Waiting for voice input...</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="absolute bottom-8 w-full flex justify-center">
        <button
          onClick={onToggleLang}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full transition-all shadow-lg"
        >
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Dictation Lang:</span>
          <span className="text-base font-bold text-blue-400">{inputLang}</span>
        </button>
      </div>
    </div>
  );
}
