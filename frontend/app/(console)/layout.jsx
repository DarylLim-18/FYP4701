'use client';
import Topbar from '../components/Topbar/Topbar';

export default function ConsoleLayout({ children }) {
  return (
    <div className="relative h-screen overflow-hidden">
      {/* Background */}
      <div className="console-background"></div>

      {/* Fixed Topbar (h-14 = 56px) */}
      <Topbar />

      {/* Scrollable content below Topbar (+8px gap) */}
      <main className="absolute inset-x-0 bottom-0 top-14 overflow-y-auto px-6 pb-6 pt-4">
        {children}
      </main>
    </div>
  );
}
