import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Settings, Clock } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: <Home size={18} /> },
  { name: 'Report', href: '/report', icon: <FileText size={18} /> },
  { name: 'Report Weekly', href: '/report2', icon: <Clock size={18} /> },
  { name: 'WeCom Settings', href: '/settings/wecom', icon: <Settings size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[color:var(--primary-color-dark)] text-white min-h-screen shadow-md">
      <div className="p-4 text-lg font-bold border-b border-white/20">
        บริษัทของคุณ
      </div>
      <nav className="flex flex-col p-4 gap-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition 
                ${active ? 'bg-white text-[color:var(--primary-color-dark)] font-semibold' : 'hover:bg-[color:var(--primary-color-light)] hover:text-white'}`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}