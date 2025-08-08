'use client';
import { useState } from 'react';
import NavItem from './NavItem';
import { 
    FiHome, 
    FiDatabase, 
    FiBookmark, 
    FiArchive, 
    FiClock,
    FiUser,
    FiSettings,
    FiChevronLeft,
    FiChevronRight
  } from 'react-icons/fi';
import { BsGraphUp } from "react-icons/bs";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import logo from './assets/k-logo.jpg'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', icon: <FiHome className="w-6 h-6" />, label: 'Dashboard' },
    { href: '/dashboard/data', icon: <FiDatabase className="w-6 h-6" />, label: 'Data' },
    { 
      href: '/dashboard/machine-learning', 
      icon: <BsGraphUp className="w-6 h-6" />, 
      label: 'Machine Learning' 
    },
    { href: '/dashboard/settings', icon: <FiSettings className="w-6 h-6" />, label: 'Settings' },
  ];

  return (
    <div className={`h-full bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>
      <div className="h-full flex flex-col">
        {/* Brand Section */}
        <div className="p-4 flex items-center justify-between border-b">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center">
              <div className="w-10 h-10 relative">
              <Image
                src={logo} // Update with your logo path
                alt=""
                fill
                className="object-contain"
              />
            </div>
              <span className="ml-3 text-xl font-semibold">Kodi</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            {collapsed ? (
              <div className="w-10 h-10 relative">
              <Image
                src={logo} // Use a simplified version if needed
                alt="Toggle Menu"
                fill
                className="object-contain"
              />
            </div>
            ) : (
              <FiChevronLeft className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.href}
              isCollapsed={collapsed}
            />
          ))}
        </div>

        {/* Account Section */}
        <div className="p-4 border-t">
          <NavItem
            href="#account"
            icon={<FiUser className="w-6 h-6" />}
            label="Account"
            isCollapsed={collapsed}
          />
        </div>
      </div>
    </div>
  );
}