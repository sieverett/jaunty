
import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10">
            <img 
              src="/logo.png" 
              alt="Jaunty Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-slate-900">Jaunty</span><span className="text-brand-600">Forecast</span>
          </h1>
        </div>
        
        <div className="flex items-center space-x-6">
          {user && (
            <div className="flex items-center pl-6 border-l border-slate-200 space-x-4">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                  {user.role}
                </span>
              </div>
              <div className="h-8 w-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700">
                <UserIcon className="w-4 h-4" />
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
