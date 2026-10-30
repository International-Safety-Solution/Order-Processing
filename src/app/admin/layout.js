import { getSession, clearSession, getUserPermissions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import StaffSidebar from '@/app/staff/StaffSidebar';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  const permissions = await getUserPermissions(session);
  const userWithPermissions = session ? { ...session, permissions } : null;

  const handleLogout = async () => {
    'use server';
    await clearSession();
    redirect('/login');
  };

  const isStaff = userWithPermissions?.role === 'STAFF';

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-950">
      {/* Dynamic Sidebar Navigation */}
      {isStaff ? (
        <StaffSidebar session={userWithPermissions} handleLogoutAction={handleLogout} />
      ) : (
        <AdminSidebar user={userWithPermissions} />
      )}

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto pt-14 lg:pt-0">
        {/* Desktop-only status header */}
        <header className="hidden lg:flex h-16 border-b border-zinc-200 bg-white items-center justify-between px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full animate-pulse ${isStaff ? 'bg-brand-orange' : 'bg-brand-green'}`} />
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
              {isStaff ? `Staff Workspace: ${userWithPermissions?.name}` : 'System Live & Connected'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-md">
              Role: {isStaff ? 'Portal Staff' : 'System Administrator'}
            </span>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
