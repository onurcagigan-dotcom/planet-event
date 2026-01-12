
import React from 'react';
import { User } from '../types';
import { EVENT_DATE } from '../constants';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const formattedDate = new Date(EVENT_DATE).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100 transform rotate-3">P</div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none tracking-tight uppercase">PLANET TRACKER</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Management System</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              {user.isAdmin && (
                <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">ADMIN</span>
              )}
              <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{user.nickname}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${user.isAdmin ? 'bg-green-500' : 'bg-amber-400'}`}></span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{user.isAdmin ? 'Full Access' : 'View Only'}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <button 
            onClick={onLogout}
            className="p-2.5 text-slate-400 hover:text-red-600 transition-all bg-slate-50 hover:bg-red-50 rounded-xl border border-slate-100"
            title="Exit System"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
};
