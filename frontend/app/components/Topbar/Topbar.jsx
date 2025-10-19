'use client';
import Link from 'next/link';
import Image from 'next/image';
import { FaLungs } from 'react-icons/fa'
import { usePathname, useRouter } from 'next/navigation';
import { FiHome, FiDatabase, FiSettings, FiBarChart, FiMap } from 'react-icons/fi';
import { BsGraphUp } from 'react-icons/bs';

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleBrandClick = (event) => {
    event.preventDefault();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('hasVisitedLanding');
    }
    router.push('/');
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <FiHome className="w-4 h-4" /> },
    { href: '/data', label: 'Data', icon: <FiDatabase className="w-4 h-4" /> },
    { href: '/machine-learning', label: 'Machine Learning', icon: <BsGraphUp className="w-4 h-4" /> },
    { href: '/modular-map', label: 'Spatial Analysis', icon: <FiMap className="w-4 h-4" /> },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-20 border-b border-white/10 bg-gray-900/70 backdrop-blur-md">
      <div className="w-full h-14 pl-8 pr-4 flex items-center justify-between">
        {/* Brand */}
        <a href="/" className="flex items-center gap-2" onClick={handleBrandClick}>
          <div className="bg-teal-600 text-white rounded-full">
            <FaLungs size={30} />
          </div>
          <div
            style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', gap: '8px' }}
          ></div>
          <span className="text-2xl font-bold text-white">
            AsthmaAssist
          </span>
        </a>

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
