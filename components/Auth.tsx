
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Atom, LogIn, UserPlus, Loader2, AlertCircle, GraduationCap, School, AlertTriangle, ShieldAlert, Ban } from 'lucide-react';
import { showToast } from '../utils/notificationUtils';

interface AuthProps {
    onLogin: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // New State Fields
  const [email, setEmail] = useState('');
  const [studentClass, setStudentClass] = useState('8');
  const [section, setSection] = useState('A');
  const [teacherConfirmation, setTeacherConfirmation] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Secure Login via RPC
        const { data, error } = await supabase.rpc('login_user', {
            username_input: username,
            password_input: password
        });

        if (error) throw error;
        
        if (!data.success) {
            throw new Error(data.message || 'Login failed');
        }

        const userData = data.user;
        
        // Basic check to ensure role matches if required
        if (userData.role && userData.role !== role) {
             showToast(`Warning: You are logging in as a ${role}, but your account is marked as ${userData.role}.`, 'info');
        }
        
        showToast(`Welcome back, ${userData.username}!`, 'success');
        onLogin(userData);

      } else {
        // --- SIGNUP VALIDATION ---
        
        // 1. Gurukul Email Validation
        if (!email.endsWith('@gurukultheschool.com')) {
             throw new Error("Email must be a valid @gurukultheschool.com address.");
        }

        if (role === 'student') {
            // Regex: Starts with letters, followed by exactly 4 digits, then @gurukultheschool.com
            const studentEmailRegex = /^[a-zA-Z]+\d{4}@gurukultheschool\.com$/;
            
            if (!studentEmailRegex.test(email)) {
                throw new Error("Student email must format: name1234@gurukultheschool.com");
            }
        } else if (role === 'teacher') {
             // 1. Check Confirmation
             if (!teacherConfirmation) {
                 throw new Error("You must confirm you are a teacher to proceed.");
             }

             // Teacher regex: Flexible name part NO NUMBERS, strictly gurukultheschool.com domain
             // e.g. akshaj@gurukultheschool.com
             // Using character class that excludes 0-9
             const teacherEmailRegex = /^[a-zA-Z._%+-]+@gurukultheschool\.com$/;
             if (!teacherEmailRegex.test(email)) {
                 throw new Error("Teacher email must contain only letters (no numbers) before @gurukultheschool.com");
             }
        }

        // Secure Signup via RPC
        // Note: The RPC must be updated to accept email, class, and section
        const { data, error } = await supabase.rpc('signup_user', {
            username_input: username,
            password_input: password,
            role_input: role,
            email_input: email,
            class_input: role === 'student' ? studentClass : null,
            section_input: role === 'student' ? section : null
        });

        if (error) throw error;

        if (!data.success) {
            throw new Error(data.message || 'Signup failed');
        }

        showToast(`Signup successful! Welcome, ${role === 'teacher' ? 'Professor' : 'Student'}!`, 'success');
        onLogin(data.user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred');
      showToast(err.message || 'Authentication failed', 'error');
      // Clear password on error so user can retype easily
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full text-white bg-black overflow-hidden font-sans">
      {/* Background Atmosphere - Fixed */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black animate-pulse" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-pulse pointer-events-none" style={{animationDelay: '2s'}}></div>

      {/* Scrollable Content Wrapper */}
      <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
        <div className="min-h-full flex items-center justify-center p-4 py-10">
          
          {/* Main Card */}
          <div className="z-10 w-full max-w-[360px] md:max-w-sm p-6 glass-panel rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-300 relative">
            <div className="flex flex-col items-center mb-6">
                <div className="relative mb-3 group">
                    <Atom size={48} className="text-cyan-400 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-0 border-4 border-cyan-400 rounded-full animate-ping opacity-20"></div>
                </div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300">
                    Science Buddy
                </h1>
            </div>

            {/* Role Switcher */}
            <div className="flex bg-black/20 p-1 rounded-xl mb-6">
                <button 
                    type="button" 
                    onClick={() => { setRole('student'); setTeacherConfirmation(false); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${role === 'student' ? 'bg-cyan-600 text-white shadow-lg' : 'text-white/50 hover:bg-white/5'}`}
                >
                    <GraduationCap size={16} /> Student
                </button>
                <button 
                    type="button" 
                    onClick={() => { setRole('teacher'); setError(null); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${role === 'teacher' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/50 hover:bg-white/5'}`}
                >
                    <School size={16} /> Teacher
                </button>
            </div>

            {/* TEACHER WARNING */}
            {!isLogin && role === 'teacher' && (
                <div className="mb-6 p-5 bg-[#1a0505] border-2 border-red-600 rounded-xl flex flex-col gap-4 animate-in fade-in zoom-in duration-300 shadow-[0_0_50px_rgba(220,38,38,0.4)] relative overflow-hidden">
                    {/* Pulsing overlay */}
                    <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>
                    
                    <div className="flex gap-3 relative z-10">
                        <div className="shrink-0">
                            <ShieldAlert className="text-red-500 animate-[pulse_1s_infinite]" size={32} />
                        </div>
                        <div>
                            <h4 className="text-red-500 font-black text-sm uppercase mb-2 tracking-widest border-b border-red-900/50 pb-1 flex items-center gap-2">
                                RESTRICTED ACCESS
                            </h4>
                            <p className="text-[11px] text-red-200 leading-relaxed font-semibold">
                                <span className="text-white bg-red-600 px-1 rounded mr-1">STOP</span>
                                Impersonating faculty is a <span className="underline decoration-red-500 decoration-2">Level 4 Cyber Violation</span>.
                            </p>
                            <div className="mt-3 space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] text-red-300">
                                    <Ban size={12} /> <span>Immediate Permanent Suspension</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-red-300">
                                    <AlertTriangle size={12} /> <span>Report sent to Principal & Parents</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-red-300">
                                    <AlertCircle size={12} /> <span>Device IP & Location Logged</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <label className="relative z-10 flex items-start gap-3 p-3 bg-red-950/50 rounded-lg border border-red-500/50 cursor-pointer hover:bg-red-900/40 transition-colors group">
                        <input 
                            type="checkbox" 
                            checked={teacherConfirmation} 
                            onChange={(e) => setTeacherConfirmation(e.target.checked)}
                            className="mt-0.5 w-5 h-5 accent-red-600 bg-black/50 border-red-500 rounded focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-red-100 select-none group-hover:text-white transition-colors">
                            I am a verified Faculty Member. I understand that false impersonation will result in severe disciplinary action.
                        </span>
                    </label>
                </div>
            )}

            <form onSubmit={handleAuth} className="space-y-3">
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 p-2.5 rounded-lg flex items-center gap-2 text-xs text-red-200 animate-in slide-in-from-top-1">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-[10px] font-bold text-white/60 mb-1 ml-1 uppercase">Username</label>
                    <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-black/40 transition-all text-sm"
                        placeholder={role === 'teacher' ? "Mr. Sharma" : "ScienceWizard123"}
                    />
                </div>

                {/* Email Field for Signup (Both Roles) */}
                {!isLogin && (
                    <div>
                        <label className="block text-[10px] font-bold text-white/60 mb-1 ml-1 uppercase">Gurukul Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-black/40 transition-all text-sm"
                            placeholder={role === 'teacher' ? "name@gurukultheschool.com" : "name1234@gurukultheschool.com"}
                        />
                    </div>
                )}

                {/* Additional Fields for Student Signup */}
                {!isLogin && role === 'student' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-white/60 mb-1 ml-1 uppercase">Class</label>
                            <select 
                                value={studentClass}
                                onChange={(e) => setStudentClass(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400/50 transition-all text-sm appearance-none"
                            >
                                <option value="6" className="bg-slate-900">Class 6</option>
                                <option value="7" className="bg-slate-900">Class 7</option>
                                <option value="8" className="bg-slate-900">Class 8</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-white/60 mb-1 ml-1 uppercase">Section</label>
                            <select 
                                value={section}
                                onChange={(e) => setSection(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400/50 transition-all text-sm appearance-none"
                            >
                                {['A', 'B', 'C', 'D', 'E', 'F', 'G']
                                    .filter(sec => !(studentClass === '8' && sec === 'G')) // Remove G if Class 8
                                    .map(sec => (
                                    <option key={sec} value={sec} className="bg-slate-900">Section {sec}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
                
                <div>
                    <label className="block text-[10px] font-bold text-white/60 mb-1 ml-1 uppercase">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-black/40 transition-all text-sm"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full font-bold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 mt-2 text-sm text-white ${role === 'teacher' ? 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700' : 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500'}`}
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                    ) : isLogin ? (
                        <><LogIn size={16} /> Login as {role === 'student' ? 'Student' : 'Teacher'}</>
                    ) : (
                        <><UserPlus size={16} /> Create {role === 'student' ? 'Student' : 'Teacher'} Account</>
                    )}
                </button>
            </form>

            <div className="mt-4 text-center">
                <button
                    onClick={() => { setIsLogin(!isLogin); setError(null); }}
                    className="text-xs text-white/50 hover:text-white hover:underline transition-colors"
                >
                    {isLogin ? "New here? Create Account" : "Already have an account? Login"}
                </button>
                
                <div className="mt-6 pt-4 border-t border-white/10">
                    <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">Developed By Akshaj</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
