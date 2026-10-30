import { getSession, clearSession, getUserPermissions } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import StaffSidebar from './StaffSidebar';
import FirstTimePasswordModal from '@/components/FirstTimePasswordModal';

export default async function StaffLayout({ children }) {
  const session = await getSession();
  const permissions = await getUserPermissions(session);
  const sessionWithPermissions = session ? { ...session, permissions } : null;

  // Real-time check from DB if user must change password
  let mustChangePassword = !!session?.must_change_password;
  if (session?.id) {
    try {
      const userRows = await query('SELECT must_change_password FROM users WHERE id = ?', [session.id]);
      if (userRows && userRows.length > 0) {
        mustChangePassword = userRows[0].must_change_password === 1 || userRows[0].must_change_password === true;
      }
    } catch (e) {
      console.error('Failed to check live must_change_password status:', e);
    }
  }

  const handleLogout = async () => {
    'use server';
    await clearSession();
    redirect('/login');
  };

  const getDesignationLabel = (des) => {
    switch (des) {
      case 'TASK_COMPLETION':
        return 'Production Task Completer';
      case 'INVOICE_CREATION':
        return 'Accounts Invoice Creator';
      case 'INVOICE_COURIER':
        return 'Logistics Courier Agent';
      default:
        return des || 'Staff';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-950">
      {/* First Time Password Change Modal */}
      <FirstTimePasswordModal mustChangePassword={mustChangePassword} />

      {/* Staff Sidebar Left Navigation */}
      <StaffSidebar session={sessionWithPermissions} handleLogoutAction={handleLogout} />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto pt-14 lg:pt-0">
        <header className="hidden lg:flex h-16 border-b border-zinc-200 bg-white items-center justify-between px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-brand-orange animate-pulse" />
            <p className="text-xs text-zinc-550 font-semibold uppercase tracking-wider">
              Staff Portal &bull; {getDesignationLabel(sessionWithPermissions?.designation)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-md">
              Role: Portal Staff
            </span>
          </div>
        </header>

        <div className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
