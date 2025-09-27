'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FiHome, FiDatabase, FiSettings, FiBarChart, FiMap } from 'react-icons/fi';
import { BsGraphUp } from 'react-icons/bs';

export default function Topbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <FiHome className="w-4 h-4" /> },
    { href: '/data', label: 'Data', icon: <FiDatabase className="w-4 h-4" /> },
    { href: '/machine-learning', label: 'Machine Learning', icon: <BsGraphUp className="w-4 h-4" /> },
    { href: '/data-analysis', label: 'Data Analysis', icon: <FiBarChart className="w-4 h-4" /> },
    { href: '/modular-map', label: 'Modular Map', icon: <FiMap className="w-4 h-4" /> },
    { href: '/settings', label: 'Settings', icon: <FiSettings className="w-4 h-4" /> },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-20 border-b border-white/10 bg-gray-900/70 backdrop-blur-md">
      <div className="w-full h-14 pl-8 pr-4 flex items-center justify-between">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="relative w-8 h-8">
            <Image src="/k-logo.jpg" alt="Kodi" fill className="object-contain rounded" />
          </div>
          <span className="text-white font-semibold">Kodi</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-2 text-sm">
          {navItems.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition
                  ${active ? 'bg-white/10 text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
              >
                {icon}
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
