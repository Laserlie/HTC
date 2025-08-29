'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Clock } from 'lucide-react';
import { ReactNode } from 'react';

// รายการเมนูสำหรับ Sidebar
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
  { href: '/report', label: 'Report', icon: <FileText className="w-5 h-5" /> },
  { href: '/report2', label: 'Report Weekly', icon: <Clock className="w-5 h-5" /> },
  // { href: '/settings/wecom', label: 'WeCom Settings', icon: <Settings className="w-5 h-5" /> },
];

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl p-6 space-y-6">
        <div className="text-2xl font-extrabold tracking-tight text-blue-900">
          HTC <span className="text-blue-600">FaceScan</span>
        </div>

        <nav className="space-y-2.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-blue-100 ${
                  isActive
                    ? 'bg-blue-200 text-blue-800 font-semibold'
                    : 'text-gray-700'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ml-64 p-6">{children}</main>
    </div>
  );
}