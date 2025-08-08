'use client';
import Sidebar from '../components/Sidebar/Sidebar';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />   
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
