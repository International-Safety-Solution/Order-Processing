'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled application runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="h-14 w-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600 shadow-xs">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-950 font-sans tracking-tight">Something went wrong</h2>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            An unexpected error occurred while processing this page. Your data is safe.
          </p>
        </div>

        {error?.message && (
          <div className="bg-zinc-50 border border-zinc-200 text-zinc-700 p-3 rounded-lg text-xs font-mono text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-semibold border border-zinc-200 transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-zinc-500" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

