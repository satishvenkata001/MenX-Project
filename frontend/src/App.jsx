import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 font-bold text-2xl border border-amber-500/20">
          MX
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">MENX</h1>
          <p className="text-sm text-gray-400 mt-2">
            Mobile-First Men&apos;s Fashion &amp; Retail Management
          </p>
        </div>
        <div className="text-xs bg-gray-800/80 rounded-lg p-3 text-gray-300 text-left space-y-1">
          <p className="font-semibold text-amber-400">Project Status: Initialized</p>
          <p>• Architecture &amp; security policies documented</p>
          <p>• Ready for database schema design phase</p>
        </div>
      </div>
    </div>
  );
}
