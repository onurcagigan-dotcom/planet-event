
import React, { useState } from 'react';

interface NicknameModalProps {
  onJoin: (nickname: string, isAdmin: boolean) => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({ onJoin }) => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const isLoggingAsAdmin = nickname.trim().toLowerCase() === 'admin' && password === 'wetlands';
    onJoin(nickname.trim(), isLoggingAsAdmin);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300 border border-slate-100">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-200">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Access Portal</h2>
        <p className="text-slate-500 text-sm mb-8 font-medium">Identify yourself to enter the tracking system.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Username</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. admin or your name"
              required
              autoFocus
              className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-semibold text-slate-700 bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password (Admin Only)</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-semibold text-slate-700 bg-slate-50/50"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] uppercase tracking-widest mt-4"
          >
            Authenticate & Launch
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-2">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Cloud Persistence Active
          </p>
          <p className="text-[9px] text-slate-300 font-medium">
            Guest access is Read-Only.
          </p>
        </div>
      </div>
    </div>
  );
};
