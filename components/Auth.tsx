import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Atom, LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { showToast } from '../utils/notificationUtils';

interface AuthProps {
    onLogin: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Direct table lookup for Login
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error('Invalid username or password');
        }
        
        showToast(`Welcome back, ${data.username}!`, 'success');
        onLogin(data);
      } else {
        // Direct table insert for Signup
        // First check if username exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existing) {
            throw new Error('Username already taken');
        }

        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                username, 
                password, 
                interests: ''
            }])
            .select()
            .single();

        if (error) throw error;
        
        showToast('Signup successful! Logging you in...', 'success');
        onLogin(data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col items-center justify-center relative overflow-hidden text-white">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black animate-pulse" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '2s'}}></div>

      <div className="z-10 w-full max-w-md p-8 glass-panel rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4 group">
                <Atom size={64} className="text-cyan-400 animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-0 border-4 border-cyan-400 rounded-full animate-ping opacity-20"></div>
            </div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300">
                Science Buddy
            </h1>
            <p className="text-white/50 text-sm tracking-wider mt-2">Class 8 Revision Pod</p>
            <p className="text-[10px] text-white/30 mt-1 font-mono">Made By Akshaj</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-sm text-red-200">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-white/60 mb-1 ml-1 uppercase">Username</label>
                <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-black/40 transition-all"
                    placeholder="ScienceWizard123"
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-white/60 mb-1 ml-1 uppercase">Password</label>
                <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-black/40 transition-all"
                    placeholder="••••••••"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
            >
                {loading ? (
                    <Loader2 className="animate-spin" />
                ) : isLogin ? (
                    <><LogIn size={20} /> Login</>
                ) : (
                    <><UserPlus size={20} /> Create Account</>
                )}
            </button>
        </form>

        <div className="mt-6 text-center">
            <button
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="text-sm text-white/50 hover:text-white hover:underline transition-colors"
            >
                {isLogin ? "New here? Create Account" : "Already have an account? Login"}
            </button>
        </div>
      </div>
    </div>
  );
};