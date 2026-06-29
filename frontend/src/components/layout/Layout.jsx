import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NavBar from './NavBar';
import ThemeToggle from './ThemeToggle';
import Watchlist from '../Watchlist';
import PushNotificationToggle from '../PushNotificationToggle';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HomeIcon({ className = 'w-5 h-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  );
}


function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sidebar content — shared between desktop panel and mobile drawer
// ---------------------------------------------------------------------------

function SidebarContent({ onNav }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const navItems = [
    { to: '/', icon: <HomeIcon className="w-4 h-4 shrink-0" />, label: 'Home' },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {/* Logo */}
      <Link
        to="/"
        onClick={onNav}
        className="flex items-center h-12 px-5 border-b border-slate-200 dark:border-slate-800 shrink-0"
      >
        <span className="text-sm font-medium tracking-tight text-slate-900 dark:text-slate-100">
          StockView
        </span>
      </Link>

      {/* Nav */}
      <nav className="px-3 pt-3 pb-2 space-y-0.5 shrink-0">
        {navItems.map(({ to, icon, label, badge }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={onNav}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {icon}
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto text-[10px] font-medium bg-rose-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Watchlist */}
      <div className="flex-1 overflow-y-auto px-3 py-3 border-t border-slate-200 dark:border-slate-800 min-h-0">
        <Watchlist inSidebar />
      </div>

      {/* User / logout */}
      <div className="shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 text-xs text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
          >
            Esci
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <PushNotificationToggle />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 dark:text-slate-600">v2.1</span>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const bottomNavItems = [
    { to: '/', label: 'Home', icon: HomeIcon },
  ];

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={closeDrawer}
        />
      )}

      {/* Sidebar — desktop: static panel; mobile: fixed drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-64 flex flex-col',
          'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800',
          'transition-transform duration-200 ease-in-out',
          'md:relative md:w-60 md:translate-x-0 md:shrink-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent onNav={closeDrawer} />
      </aside>

      {/* Right column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <NavBar />
        {/* Content — pb-16 on mobile makes room for bottom nav */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0 flex flex-col">
          {children}
        </div>
      </div>

      {/* Bottom navigation — mobile only */}
      <nav className="fixed bottom-0 inset-x-0 z-10 h-16 flex items-stretch md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        {bottomNavItems.map(({ to, label, icon: Icon, badge }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative ${
                isActive
                  ? 'text-sky-500 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
              {badge > 0 && (
                <span className="absolute top-2 left-[calc(50%+6px)] min-w-[14px] h-[14px] px-[3px] text-[8px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center leading-none">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen((o) => !o)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 active:text-slate-700 dark:active:text-slate-200"
        >
          <MenuIcon />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </nav>
    </div>
  );
}
