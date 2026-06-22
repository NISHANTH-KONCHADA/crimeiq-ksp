import { useEffect, useState, useRef } from 'react';
import { Shield, Lock, ArrowRight, User } from 'lucide-react';

const ROLES = ['Investigator', 'Analyst', 'Supervisor', 'Admin'];
const KSP_LOGO = 'https://ksp.karnataka.gov.in/frontend/opt1/images/center_logo/kar_main_logo.png';

export default function Login({ onAuthenticated }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [needsRole, setNeedsRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Investigator');
  const [fullName, setFullName] = useState('');
  const [user, setUser] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const loginDivRef = useRef(null);
  const sdkLoaded = useRef(false);

  // Poll for an active Catalyst session
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (window.catalyst?.auth) {
        try {
          const currentUser = await window.catalyst.auth.isUserAuthenticated();
          if (currentUser) {
            setUser(currentUser);
            clearInterval(interval);
            await checkRole(currentUser);
            return;
          }
        } catch (e) {
          // not authenticated yet
        }
      }
      if (attempts > 6 && !sdkLoaded.current) {
        sdkLoaded.current = true;
        setCheckingSession(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Render Catalyst Auth inside the modal when requested
  useEffect(() => {
    if (showAuthModal && window.catalyst?.auth) {
      try {
        window.catalyst.auth.signIn('loginDivElementId', {
          service_url: window.location.origin + window.location.pathname,
        });
      } catch (e) {
        console.error('Catalyst sign-in render failed:', e);
      }
    }
  }, [showAuthModal]);

  const checkRole = async (currentUser) => {
    setCheckingSession(true);
    
    // Check localStorage first for instant login bypass
    const cachedRole = localStorage.getItem('ksp_role');
    const cachedName = localStorage.getItem('ksp_name');
    
    if (cachedRole && cachedName) {
      onAuthenticated({ ...currentUser, role: cachedRole, fullName: cachedName });
      return;
    }

    try {
      let data;
      if (window.location.hostname === 'localhost') {
        const res = await fetch(`/api/role?user_id=${currentUser.user_id}`);
        data = await res.json();
      } else {
        const res = await fetch(`https://crimeiq-60074288350.development.catalystserverless.in/server/role-function/execute?user_id=${currentUser.user_id}`);
        const rawJson = await res.json();
        const rawOutput = rawJson.output || rawJson;
        data = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
      }

      if (data.role) {
        localStorage.setItem('ksp_role', data.role);
        localStorage.setItem('ksp_name', data.full_name);
        onAuthenticated({ ...currentUser, role: data.role, fullName: data.full_name });
      } else {
        setNeedsRole(true);
        setFullName(currentUser.first_name || currentUser.email_id || '');
        setCheckingSession(false);
      }
    } catch (e) {
      setNeedsRole(true);
      setCheckingSession(false);
    }
  };

  const saveRole = async () => {
    setSavingRole(true);
    try {
      const params = new URLSearchParams({
        user_id: user.user_id,
        role: selectedRole,
        full_name: fullName,
      });

      const base = window.location.hostname === 'localhost'
        ? '/api/role'
        : 'https://crimeiq-60074288350.development.catalystserverless.in/server/role-function/execute';

      await fetch(`${base}?${params.toString()}`);

      // Cache the role so they are never asked again
      localStorage.setItem('ksp_role', selectedRole);
      localStorage.setItem('ksp_name', fullName);
      onAuthenticated({ ...user, role: selectedRole, fullName: fullName });
    } catch (e) {
      alert('Failed to save role. Please try again.');
    } finally {
      setSavingRole(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <img src={KSP_LOGO} alt="KSP Logo" className="h-20 animate-pulse opacity-80" />
        <div className="text-slate-500 font-medium text-sm">Authenticating Secure Session...</div>
      </div>
    );
  }

  // 1. Role Selection Screen (Only shown once per user)
  if (needsRole) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-2">
              <User size={24} className="text-blue-600" />
            </div>
            <h1 className="font-bold text-xl text-slate-900">Officer Registration</h1>
            <p className="text-sm text-slate-500">Please establish your credentials for CrimeIQ access. This will be securely cached for future sessions.</p>
          </div>

          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Full Name / Badge Number</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm mb-6 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 focus:bg-white"
            placeholder="e.g. Inspector Ramesh Kumar"
          />

          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Clearance Level (Role)</label>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`text-sm font-medium px-4 py-3 rounded-xl border transition-all ${
                  selectedRole === role
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <button
            onClick={saveRole}
            disabled={savingRole || !fullName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-bold py-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-lg hover:shadow-xl"
          >
            {savingRole ? 'Establishing Credentials...' : 'Access CrimeIQ'}
            {!savingRole && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    );
  }

  // 2. Beautiful Government Landing Page
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <header className="w-full bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <img src={KSP_LOGO} alt="KSP Logo" className="h-12" />
          <div className="hidden sm:block border-l border-slate-200 pl-4">
            <h2 className="font-bold text-slate-900 tracking-tight leading-tight">Karnataka State Police</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Government of Karnataka</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Help Desk</a>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors shadow-md hover:shadow-lg"
          >
            <Lock size={14} />
            Officer Login
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 mt-[-5vh]">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider mb-8 border border-amber-200">
          <Shield size={14} />
          Authorized Personnel Only
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 max-w-4xl">
          CrimeIQ <span className="text-blue-600">Intelligence</span> System
        </h1>
        
        <p className="text-lg text-slate-600 mb-10 max-w-2xl leading-relaxed">
          The next-generation investigative platform for the Karnataka State Police. 
          Instantly query the CCTNS database, visualize criminal networks, and generate predictive threat alerts using secure natural language AI.
        </p>
        
        <button 
          onClick={() => setShowAuthModal(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-lg font-semibold px-8 py-4 rounded-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
        >
          <Lock size={18} />
          Authenticate Secure Session
        </button>
        
        <div className="mt-12 flex items-center gap-8 text-sm font-medium text-slate-400">
          <div className="flex items-center gap-2"><Shield size={16}/> End-to-End Encryption</div>
          <div className="flex items-center gap-2"><Lock size={16}/> Role-Based Access</div>
        </div>
      </main>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              ✕
            </button>
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Lock size={20} />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Secure Portal Access</h3>
              <p className="text-xs text-slate-500">Sign in via the Zoho Catalyst gateway to continue.</p>
            </div>
            {/* The Catalyst Widget embeds here */}
            <div id="loginDivElementId" ref={loginDivRef} className="w-full min-h-[450px] bg-white [&>iframe]:w-full [&>iframe]:min-h-[450px] [&>iframe]:border-none"></div>
          </div>
        </div>
      )}
    </div>
  );
}