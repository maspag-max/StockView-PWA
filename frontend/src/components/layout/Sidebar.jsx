import Watchlist from '../Watchlist';

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-y-auto overflow-x-hidden p-4">
      <Watchlist inSidebar />
    </aside>
  );
}
