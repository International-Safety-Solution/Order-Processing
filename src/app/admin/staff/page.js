'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, KeyRound, CheckCircle2, AlertCircle, RefreshCw, Pencil, Trash2, ShieldCheck, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal toggle & modes
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null); // { id, name }
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');
  const [designation, setDesignation] = useState('TASK_COMPLETION');
  const [scopes, setScopes] = useState([]);
  const [selectedScopes, setSelectedScopes] = useState([]);

  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Table Sorting State (A-Z / Z-A)
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc'); // A to Z default

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff');
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (e) {
      console.error('Error fetching staff:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchScopes = async () => {
    try {
      const res = await fetch('/api/admin/scopes');
      if (res.ok) {
        const data = await res.json();
        setScopes(data);
      }
    } catch (e) {
      console.error('Error fetching scopes:', e);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchScopes();
  }, []);

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('STAFF');
    setDesignation('TASK_COMPLETION');
    setSelectedScopes([]);
    setMessage({ text: '', type: '' });
    setShowFormModal(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const openEditModal = (member) => {
    setIsEditMode(true);
    setEditingId(member.id);
    setName(member.name);
    setEmail(member.email);
    setPassword(''); // Keep blank unless updating password
    setRole(member.role || 'STAFF');
    setDesignation(member.designation || 'TASK_COMPLETION');
    
    // Parse permission scopes
    const scopesStr = member.permission_scopes || '';
    const parsedScopes = scopesStr.split(',').map(s => parseInt(s.trim())).filter(id => !isNaN(id));
    setSelectedScopes(parsedScopes);
    
    setMessage({ text: '', type: '' });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const url = isEditMode ? `/api/admin/staff/${editingId}` : '/api/admin/staff';
      const method = isEditMode ? 'PUT' : 'POST';

      const payload = { 
        name, 
        email, 
        role,
        designation: role === 'ADMIN' ? null : designation,
        permissionScopes: selectedScopes.join(',')
      };
      if (!isEditMode) {
        payload.password = password;
      } else if (password && password.trim() !== '') {
        payload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }

      setMessage({
        text: isEditMode ? 'User account updated successfully!' : 'User account successfully created!',
        type: 'success'
      });

      fetchStaff();

      setTimeout(() => {
        setShowFormModal(false);
        setMessage({ text: '', type: '' });
        if (isEditMode) {
          window.location.reload();
        }
      }, 1200);

    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteStaff = (id, staffName) => {
    setStaffToDelete({ id, name: staffName });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/staff/${staffToDelete.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setShowDeleteModal(false);
      setStaffToDelete(null);
      fetchStaff();
    } catch (err) {
      setShowDeleteModal(false);
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getDesignationLabel = (member) => {
    if (member.role === 'ADMIN' || !member.designation) {
      return (
        <span className="px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold rounded-md flex items-center gap-1 shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
          System Admin (Full Access)
        </span>
      );
    }
    switch (member.designation) {
      case 'TASK_COMPLETION':
        return <span className="px-2 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold rounded-md">Phase 1: Task Completion (DC Upload)</span>;
      case 'INVOICE_CREATION':
        return <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-md">Phase 2: Invoice Creation</span>;
      case 'INVOICE_COURIER':
        return <span className="px-2 py-1 bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold rounded-md">Phase 3: Courier (Tracking ID)</span>;
      default:
        return <span className="px-2 py-1 bg-zinc-100 border border-zinc-200 text-zinc-500 text-xs font-semibold rounded-md">{member.designation}</span>;
    }
  };

  const sortedStaff = [...staff].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (sortField === 'email') {
      const emailA = (a.email || '').toLowerCase();
      const emailB = (b.email || '').toLowerCase();
      comparison = emailA.localeCompare(emailB);
    } else if (sortField === 'role') {
      const roleA = (a.role === 'ADMIN' ? 'Admin' : (a.designation || 'Staff')).toLowerCase();
      const roleB = (b.role === 'ADMIN' ? 'Admin' : (b.designation || 'Staff')).toLowerCase();
      comparison = roleA.localeCompare(roleB);
    } else if (sortField === 'scopes') {
      const scopeA = (a.permission_scopes || '').toLowerCase();
      const scopeB = (b.permission_scopes || '').toLowerCase();
      comparison = scopeA.localeCompare(scopeB);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-black tracking-tight font-sans">Staff Workspace Management</h1>
          <p className="text-zinc-500 text-sm mt-1">Register new team members and manage their designated order workflow access levels.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors shadow-md cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Registry Table */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-brand-black flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-orange" />
            Registered Staff Members
          </h2>
          <button
            onClick={fetchStaff}
            className="text-xs font-semibold text-zinc-500 hover:text-brand-orange cursor-pointer"
          >
            Refresh List
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-brand-orange mb-3" />
            <p className="text-sm">Loading staff members...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <p className="text-sm font-semibold">No staff registered yet.</p>
            <p className="text-xs mt-1">Create accounts using the button above.</p>
          </div>
        ) : (
          <>
            {/* ── MOBILE STAFF CARD LIST ── */}
            <div className="lg:hidden divide-y divide-zinc-100">
              {sortedStaff.map((member) => (
                <div key={member.id} className="p-4 space-y-3">
                  {/* Row 1: Name + ID */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-zinc-950 truncate">{member.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{member.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${member.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-zinc-100 text-zinc-650'}`}>
                      {member.role === 'ADMIN' ? 'Admin' : 'Staff'}
                    </span>
                  </div>

                  {/* Row 2: Designation Badge */}
                  <div className="flex flex-wrap gap-1.5">
                    {getDesignationLabel(member)}
                  </div>

                  {/* Row 3: Scopes Badges */}
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[9px] font-bold text-zinc-400 mr-1 uppercase tracking-wider">Scopes:</span>
                    {(() => {
                      if (member.role === 'ADMIN') {
                        return <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded">Full Access</span>;
                      }
                      const ids = (member.permission_scopes || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                      const assigned = scopes.filter(s => ids.includes(s.id));
                      if (assigned.length === 0) {
                        return (
                          <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-600 text-[10px] font-semibold rounded">
                            Standard: {member.designation === 'TASK_COMPLETION' ? 'Phase 1' : member.designation === 'INVOICE_CREATION' ? 'Phase 2' : 'Phase 3'}
                          </span>
                        );
                      }
                      return assigned.map(s => (
                        <span key={s.id} className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange text-[9px] font-bold rounded">
                          {s.name}
                        </span>
                      ));
                    })()}
                  </div>

                  {/* Row 4: Actions Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEditModal(member)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-brand-orange rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit Member</span>
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(member.id, member.name)}
                      className="p-1.5 border border-zinc-200 bg-white hover:bg-red-50 text-zinc-500 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                      title="Delete Staff"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DESKTOP STAFF TABLE ── */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-200">
                  <tr>
                    {/* Name */}
                    <th 
                      onClick={() => handleSort('name')}
                      className="whitespace-nowrap px-6 py-4 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'name' ? (sortDirection === 'asc' ? 'Name: A to Z' : 'Name: Z to A') : 'Sort by Member Name'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Name</span>
                        {sortField === 'name' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-350 opacity-50 group-hover:opacity-100 group-hover:text-zinc-600 transition-opacity shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Email */}
                    <th 
                      onClick={() => handleSort('email')}
                      className="whitespace-nowrap px-6 py-4 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'email' ? (sortDirection === 'asc' ? 'Email: A to Z' : 'Email: Z to A') : 'Sort by Email Address'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Email</span>
                        {sortField === 'email' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-350 opacity-50 group-hover:opacity-100 group-hover:text-zinc-600 transition-opacity shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Role & Designation */}
                    <th 
                      onClick={() => handleSort('role')}
                      className="whitespace-nowrap px-6 py-4 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'role' ? (sortDirection === 'asc' ? 'Role: A to Z' : 'Role: Z to A') : 'Sort by Role & Phase'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Role & Designation</span>
                        {sortField === 'role' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-350 opacity-50 group-hover:opacity-100 group-hover:text-zinc-600 transition-opacity shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Permissions Scope */}
                    <th 
                      onClick={() => handleSort('scopes')}
                      className="whitespace-nowrap px-6 py-4 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'scopes' ? (sortDirection === 'asc' ? 'Scopes: A to Z' : 'Scopes: Z to A') : 'Sort by Permissions Scope'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Permissions Scope</span>
                        {sortField === 'scopes' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-350 opacity-50 group-hover:opacity-100 group-hover:text-zinc-600 transition-opacity shrink-0" />
                        )}
                      </div>
                    </th>

                    <th className="whitespace-nowrap px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 bg-white">
                  {sortedStaff.map((member) => (
                    <tr key={member.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 font-bold text-zinc-900">
                        {member.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-zinc-600">
                        {member.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {getDesignationLabel(member)}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {(() => {
                            if (member.role === 'ADMIN') {
                              return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded">Full Access</span>;
                            }
                            const ids = (member.permission_scopes || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                            const assigned = scopes.filter(s => ids.includes(s.id));
                            if (assigned.length === 0) {
                              return (
                                <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-650 text-[10px] font-semibold rounded-md">
                                  Standard: {member.designation === 'TASK_COMPLETION' ? 'Phase 1' : member.designation === 'INVOICE_CREATION' ? 'Phase 2' : 'Phase 3'}
                                </span>
                              );
                            }
                            return assigned.map(s => (
                              <span key={s.id} className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange text-[10px] font-bold rounded">
                                {s.name}
                              </span>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(member)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 hover:border-brand-orange bg-white text-zinc-700 hover:text-brand-orange rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member.id, member.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-100 hover:border-red-600 bg-red-50/50 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Staff Modal Form */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full mx-3 sm:mx-0 shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <h3 className="text-base sm:text-lg font-bold">
                {isEditMode ? `Edit Profile: ${name}` : 'Register New Staff'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form — scrollable */}
            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">

              {message.text && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm border ${message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-brand-green'
                    : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                  {message.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Zahid Ali"
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@company.com"
                    className="block w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    {isEditMode ? 'Password (leave blank to keep current)' : 'Temporary Password'}
                  </label>
                  {!isEditMode && (
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] font-bold text-brand-orange hover:text-orange-700 cursor-pointer flex items-center gap-1"
                    >
                      <span>🎲 Generate Password</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <KeyRound className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="text"
                    required={!isEditMode}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditMode ? '•••••••• (optional)' : 'e.g. Pass@9821 or click Generate'}
                    className="block w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                  />
                </div>
                {!isEditMode && (
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Employee will be required to change this temporary password upon first login.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Account Role & Privileges</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                >
                  <option value="STAFF">Staff Member (Restricted Workflow Access)</option>
                  <option value="ADMIN">System Administrator (Full Master Access)</option>
                </select>
              </div>

              {role === 'ADMIN' ? (
                <div className="p-3.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-purple-700">
                    <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0" />
                    Full Master Admin Privileges Active
                  </p>
                  <p className="text-purple-700/90 leading-relaxed">
                    System Administrators have full master access across all 3 order phases (DC, Invoice, Courier), client management, staff accounts, order creation, and settings panels. Fallback Task Phase is not required.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">Fallback Task Phase</label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange bg-[image:none]"
                  >
                    <option value="TASK_COMPLETION">Phase 1: Task Completion (Delivery Challan Upload)</option>
                    <option value="INVOICE_CREATION">Phase 2: Invoice Creation (Invoice Upload)</option>
                    <option value="INVOICE_COURIER">Phase 3: Courier Dispatch (Tracking ID Entry)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Granted Access Scopes</label>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg max-h-36 overflow-y-auto space-y-2.5">
                  {scopes.map(scope => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label key={scope.id} className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScopes(prev => [...prev, scope.id]);
                            } else {
                              setSelectedScopes(prev => prev.filter(id => id !== scope.id));
                            }
                          }}
                          className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                        />
                        <span>{scope.name}</span>
                      </label>
                    );
                  })}
                  {scopes.length === 0 && <span className="text-zinc-400 italic text-xs">No scopes loaded. Please sync scopes.</span>}
                </div>
                <p className="mt-1 text-[10px] text-zinc-400">
                  Enable one or multiple scopes to activate matching tabs and permissions for this staff member.
                </p>
              </div>

              {/* Action buttons */}
              <div className="border-t border-zinc-100 pt-3 flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? 'Submitting...' : isEditMode ? 'Save Changes' : 'Register Member'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setStaffToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={staffToDelete ? `Delete Account "${staffToDelete.name}"?` : "Delete Staff Member Account"}
        message={staffToDelete ? `Are you sure you want to delete staff member "${staffToDelete.name}"? If active orders are assigned to them, deletion will be safely blocked.` : ''}
        confirmText="Confirm & Delete"
        loading={deleteLoading}
      />

    </div>
  );
}
