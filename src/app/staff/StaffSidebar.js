'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { 
  Building2, 
  ChevronDown, 
  ChevronUp,
  User, 
  Key, 
  LogOut, 
  Lock, 
  Mail, 
  UserCheck, 
  AlertCircle,
  CheckCircle2,
  X,
  LayoutDashboard,
  Clock,
  Hourglass,
  CheckCircle2 as CheckCircleIcon,
  FolderPlus,
  Menu,
  UserSquare2
} from 'lucide-react';

export default function StaffSidebar({ session, handleLogoutAction }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentTab = searchParams.get('tab') || 'dashboard';

  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Profile form states
  const [name, setName] = useState(session?.name || '');
  const [email, setEmail] = useState(session?.email || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [settings, setSettings] = useState({ app_name: 'ISS PORTAL', app_logo: null, logo_width: 150 });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) {
          setSettings({
            app_name: data.app_name || 'ISS PORTAL',
            app_logo: data.app_logo || null,
            logo_width: data.logo_width || 150
          });
        }
      })
      .catch(err => console.error('Failed to fetch staff sidebar branding settings:', err));

    const handleWidthEvent = (e) => {
      setSettings(prev => ({ ...prev, logo_width: e.detail }));
    };
    const handleImageEvent = (e) => {
      setSettings(prev => ({ ...prev, app_logo: e.detail }));
    };
    const handleNameEvent = (e) => {
      setSettings(prev => ({ ...prev, app_name: e.detail }));
    };

    window.addEventListener('logo-width-change', handleWidthEvent);
    window.addEventListener('logo-image-change', handleImageEvent);
    window.addEventListener('logo-name-change', handleNameEvent);

    return () => {
      window.removeEventListener('logo-width-change', handleWidthEvent);
      window.removeEventListener('logo-image-change', handleImageEvent);
      window.removeEventListener('logo-name-change', handleNameEvent);
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/admin/orders')) {
      setOrdersExpanded(true);
    }
  }, [pathname]);

  // Close mobile drawer on route/tab change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchParams]);

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

  const showClientOrdersDropdown = !!(session?.permissions?.order_processing?.view || session?.permissions?.order_types?.view);
  const showOrderProcessing = !!session?.permissions?.order_processing?.view;
  const showOrderTypes = !!session?.permissions?.order_types?.view;
  const showClients = !!session?.permissions?.client_management?.view;

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setProfileSuccess('Profile updated successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: session?.name, 
          email: session?.email, 
          password: newPassword 
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Active states check
  const isDashboardActive = pathname === '/staff' && currentTab === 'dashboard';
  const isPendingActive = pathname === '/staff' && currentTab === 'pending';
  const isInProgressActive = pathname === '/staff' && currentTab === 'in-progress';
  const isCompletedActive = pathname === '/staff' && currentTab === 'completed';

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-200 gap-3 shrink-0">
        {settings.app_logo ? (
          <div className="flex items-center justify-center w-full">
            <img 
              src={settings.app_logo} 
              alt="Logo" 
              style={{ width: `${settings.logo_width || 150}px`, height: 'auto' }} 
              className="object-contain max-h-12" 
            />
          </div>
        ) : (
          <>
            <div className="h-8 w-8 rounded-lg bg-brand-orange flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 truncate">
              <h1 className="font-extrabold text-sm tracking-tight text-zinc-950 truncate">{settings.app_name}</h1>
              <p className="text-[9px] text-zinc-455 font-bold uppercase tracking-wider truncate">
                {getDesignationLabel(session?.designation)}
              </p>
            </div>
          </>
        )}
        {/* Mobile close button */}
        <button
          className="lg:hidden text-zinc-400 hover:text-zinc-700 cursor-pointer p-1"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Sidebar */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 bg-zinc-50/30 overflow-y-auto">
        {/* Dashboard Link */}
        <Link
          href="/staff"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isDashboardActive
            ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
            : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent'
            }`}
        >
          <LayoutDashboard className={`h-4.5 w-4.5 ${isDashboardActive ? 'text-white' : 'text-zinc-400'}`} />
          <span>Dashboard</span>
        </Link>

        {/* Pending Orders Link */}
        <Link
          href="/staff?tab=pending"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isPendingActive
            ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
            : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent'
            }`}
        >
          <Clock className={`h-4.5 w-4.5 ${isPendingActive ? 'text-white' : 'text-zinc-400'}`} />
          <span>Pending Orders</span>
        </Link>

        {/* In Progress Orders Link */}
        <Link
          href="/staff?tab=in-progress"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isInProgressActive
            ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
            : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent'
            }`}
        >
          <Hourglass className={`h-4.5 w-4.5 ${isInProgressActive ? 'text-white' : 'text-zinc-400'}`} />
          <span>In Progress</span>
        </Link>

        {/* Completed Orders Link */}
        <Link
          href="/staff?tab=completed"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isCompletedActive
            ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
            : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent'
            }`}
        >
          <CheckCircleIcon className={`h-4.5 w-4.5 ${isCompletedActive ? 'text-white' : 'text-zinc-400'}`} />
          <span>Completed Orders</span>
        </Link>

        {/* Client Orders Dropdown (Permissions scoped) */}
        {showClientOrdersDropdown && (
          <div className="space-y-1">
            <button
              onClick={() => setOrdersExpanded(!ordersExpanded)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${pathname.startsWith('/admin/orders')
                ? 'text-zinc-950 bg-zinc-100/50'
                : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
            >
              <div className="flex items-center gap-3">
                <FolderPlus className={`h-4.5 w-4.5 ${pathname.startsWith('/admin/orders') ? 'text-brand-orange' : 'text-zinc-400'}`} />
                <span>Client Orders</span>
              </div>
              {ordersExpanded ? (
                <ChevronUp className="h-4 w-4 text-zinc-450" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-450" />
              )}
            </button>

            {/* Sub menu list */}
            {ordersExpanded && (
              <div className="pl-6 border-l border-zinc-200 ml-5 mt-1 space-y-1.5 animate-fade-in">
                {showOrderProcessing && (
                  <Link
                    href="/admin/orders"
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${pathname === '/admin/orders'
                      ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
                      : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100'
                      }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${pathname === '/admin/orders' ? 'bg-white' : 'bg-zinc-400'}`} />
                    <span>Orders Processing</span>
                  </Link>
                )}
                {showOrderTypes && (
                  <Link
                    href="/admin/orders/types"
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${pathname === '/admin/orders/types'
                      ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
                      : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100'
                      }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${pathname === '/admin/orders/types' ? 'bg-white' : 'bg-zinc-400'}`} />
                    <span>Order Types</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Client Management Link */}
        {showClients && (
          <Link
            href="/admin/clients"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${pathname === '/admin/clients'
              ? 'bg-brand-orange text-white shadow-sm shadow-orange-500/20'
              : 'text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent'
              }`}
          >
            <UserSquare2 className={`h-4.5 w-4.5 ${pathname === '/admin/clients' ? 'text-white' : 'text-zinc-400'}`} />
            <span>Client Management</span>
          </Link>
        )}
      </nav>

      {/* Profile / Account Settings Footer */}
      <div className="p-3 border-t border-zinc-200 bg-white shrink-0">
        <div className="mb-2 px-1 space-y-1.5">
          <div className="truncate">
            <p className="text-xs font-bold text-zinc-950 truncate">{session?.name}</p>
            <p className="text-[10px] text-zinc-500 truncate">{session?.email}</p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setProfileModalOpen(true); setProfileError(''); setProfileSuccess(''); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold border border-zinc-200 cursor-pointer transition-colors"
            >
              <User className="h-3 w-3" />
              <span>Profile</span>
            </button>
            <button
              onClick={() => { setPasswordModalOpen(true); setPasswordError(''); setPasswordSuccess(''); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold border border-zinc-200 cursor-pointer transition-colors"
            >
              <Key className="h-3 w-3" />
              <span>Password</span>
            </button>
          </div>
        </div>
        <form action={handleLogoutAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-red-650 hover:text-red-750 bg-red-50/50 hover:bg-red-50 border border-red-100 hover:border-red-200 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile Top Bar (hamburger) ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-brand-orange flex items-center justify-center shadow-sm">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm text-zinc-950 tracking-tight">PORTAL STAFF</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-650 rounded-md border border-zinc-200 uppercase tracking-wide">
            Staff
          </span>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-64 bg-white text-zinc-800 flex-col shrink-0 border-r border-zinc-200 h-screen sticky top-0 overflow-hidden">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={(e) => { if (e.target === e.currentTarget) setMobileOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] bg-white h-screen shadow-2xl flex flex-col z-10 overflow-hidden">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {/* ── EDIT PROFILE MODAL ── */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full mx-3 sm:mx-0 shadow-2xl overflow-hidden animate-slide-up">
            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">Update Account Details</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Manage your personal staff registry information</p>
              </div>
              <button onClick={() => setProfileModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer p-1">
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-brand-green rounded-lg flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4.5 w-4.5 text-brand-green shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                  <UserCheck className="h-4 w-4 text-zinc-450" /> Full Name
                </label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Zahid Khan"
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                  <Mail className="h-4 w-4 text-zinc-450" /> Email Address
                </label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. task@company.com"
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange" />
              </div>
              <div className="border-t border-zinc-100 pt-3 flex gap-2 mt-2">
                <button type="button" onClick={() => setProfileModalOpen(false)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={profileLoading}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-60">
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full mx-3 sm:mx-0 shadow-2xl overflow-hidden animate-slide-up">
            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">Change Password</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Protect your portal staff account</p>
              </div>
              <button onClick={() => setPasswordModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer p-1">
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-5 space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-750 rounded-lg flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 text-brand-green rounded-lg flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4.5 w-4.5 text-brand-green shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                  <Lock className="h-4 w-4 text-zinc-450" /> New Password
                </label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters..."
                  className="block w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                  <Lock className="h-4 w-4 text-zinc-450" /> Confirm New Password
                </label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password..."
                  className="block w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange" />
              </div>
              <div className="border-t border-zinc-100 pt-3 flex gap-2 mt-2">
                <button type="button" onClick={() => setPasswordModalOpen(false)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={passwordLoading}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-60">
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
