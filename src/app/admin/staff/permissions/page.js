'use client';

import { useState, useEffect } from 'react';
import { Shield, PlusCircle, Trash2, Pencil, RefreshCw, AlertCircle, CheckCircle2, Save, Info } from 'lucide-react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function PermissionsScopeManagement() {
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scopeToDelete, setScopeToDelete] = useState(null); // { id, name }
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [orderProcessing, setOrderProcessing] = useState({ view: false, create: false, edit: false, delete: false });
  const [orderTypes, setOrderTypes] = useState({ view: false, create: false, edit: false, delete: false });
  const [clientManagement, setClientManagement] = useState({ view: false, create: false, edit: false, delete: false });
  const [phases, setPhases] = useState({ production: false, accounts: false, logistics: false });

  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchScopes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scopes');
      if (res.ok) {
        const data = await res.json();
        setScopes(data);
      }
    } catch (e) {
      console.error('Error fetching scopes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScopes();
  }, []);

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setName('');
    setOrderProcessing({ view: false, create: false, edit: false, delete: false });
    setOrderTypes({ view: false, create: false, edit: false, delete: false });
    setClientManagement({ view: false, create: false, edit: false, delete: false });
    setPhases({ production: false, accounts: false, logistics: false });
    setMessage({ text: '', type: '' });
    setShowFormModal(true);
  };

  const openEditModal = (scope) => {
    setIsEditMode(true);
    setEditingId(scope.id);
    setName(scope.name);
    
    const perms = scope.permissions || {};
    setOrderProcessing({
      view: perms.order_processing?.view || false,
      create: perms.order_processing?.create || false,
      edit: perms.order_processing?.edit || false,
      delete: perms.order_processing?.delete || false,
    });
    setOrderTypes({
      view: perms.order_types?.view || false,
      create: perms.order_types?.create || false,
      edit: perms.order_types?.edit || false,
      delete: perms.order_types?.delete || false,
    });
    setClientManagement({
      view: perms.client_management?.view || false,
      create: perms.client_management?.create || false,
      edit: perms.client_management?.edit || false,
      delete: perms.client_management?.delete || false,
    });
    setPhases({
      production: perms.phases?.production || false,
      accounts: perms.phases?.accounts || false,
      logistics: perms.phases?.logistics || false,
    });

    setMessage({ text: '', type: '' });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const url = isEditMode ? `/api/admin/scopes/${editingId}` : '/api/admin/scopes';
      const method = isEditMode ? 'PUT' : 'POST';

      const payload = {
        name,
        permissions: {
          order_processing: orderProcessing,
          order_types: orderTypes,
          client_management: clientManagement,
          phases: phases
        }
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save permission scope');
      }

      setMessage({
        text: isEditMode ? 'Permission scope updated successfully!' : 'Permission scope created successfully!',
        type: 'success'
      });

      fetchScopes();

      setTimeout(() => {
        setShowFormModal(false);
        setMessage({ text: '', type: '' });
      }, 1500);

    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteScope = (id, scopeName) => {
    setScopeToDelete({ id, name: scopeName });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/scopes/${scopeToDelete.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete permission scope');
      }

      setShowDeleteModal(false);
      setScopeToDelete(null);
      fetchScopes();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-black tracking-tight font-sans">Permissions Scope Registry</h1>
          <p className="text-zinc-500 text-sm mt-1">Configure access groups and functional permissions templates for staff roles.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors shadow-md cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create Access Scope</span>
        </button>
      </div>

      {/* Scopes Grid */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-brand-black flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-orange" />
            Active Permission Scopes
          </h2>
          <button
            onClick={fetchScopes}
            className="text-xs font-semibold text-zinc-500 hover:text-brand-orange cursor-pointer"
          >
            Refresh Registry
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-brand-orange mb-3" />
            <p className="text-sm">Loading custom scopes...</p>
          </div>
        ) : scopes.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <p className="text-sm font-semibold">No permission scopes defined yet.</p>
            <p className="text-xs mt-1">Add access scopes using the button above.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {scopes.map((scope) => {
              const op = scope.permissions?.order_processing || {};
              const ot = scope.permissions?.order_types || {};
              const cl = scope.permissions?.client_management || {};
              const ph = scope.permissions?.phases || {};

              return (
                <div key={scope.id} className="p-6 hover:bg-zinc-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-zinc-950 text-base">{scope.name}</span>
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 px-2 py-0.5 rounded-full">Permission Scope</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      {/* Order Processing perms */}
                      <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-150">
                        <span className="font-bold text-zinc-800 block mb-1 text-[11px] uppercase tracking-wider">Orders Processing</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {op.view && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">View</span>}
                          {op.create && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">Create</span>}
                          {op.edit && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">Edit</span>}
                          {op.delete && <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-red-650 font-bold text-[10px] rounded">Delete</span>}
                          {!op.view && !op.create && !op.edit && !op.delete && <span className="text-zinc-400 italic">No Access</span>}
                        </div>
                      </div>

                      {/* Client Management perms */}
                      <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-150">
                        <span className="font-bold text-zinc-800 block mb-1 text-[11px] uppercase tracking-wider">Client Management</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {cl.view && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">View</span>}
                          {cl.create && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">Create</span>}
                          {cl.edit && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">Edit</span>}
                          {cl.delete && <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-red-650 font-bold text-[10px] rounded">Delete</span>}
                          {!cl.view && !cl.create && !cl.edit && !cl.delete && <span className="text-zinc-400 italic">No Access</span>}
                        </div>
                      </div>

                      {/* Order Types perms */}
                      <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-150">
                        <span className="font-bold text-zinc-800 block mb-1 text-[11px] uppercase tracking-wider">Order Types (Settings)</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {ot.view && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">View</span>}
                          {ot.create && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">Create</span>}
                          {ot.edit && <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange font-bold text-[10px] rounded">Edit</span>}
                          {ot.delete && <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-red-650 font-bold text-[10px] rounded">Delete</span>}
                          {!ot.view && !ot.create && !ot.edit && !ot.delete && <span className="text-zinc-400 italic">No Access</span>}
                        </div>
                      </div>

                      {/* Phase dashboards perms */}
                      <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-150">
                        <span className="font-bold text-zinc-800 block mb-1 text-[11px] uppercase tracking-wider">Staff Phase Dashboards</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {ph.production && <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-brand-green font-bold text-[10px] rounded">Production (Phase 1)</span>}
                          {ph.accounts && <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-brand-green font-bold text-[10px] rounded">Accounts (Phase 2)</span>}
                          {ph.logistics && <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-brand-green font-bold text-[10px] rounded">Logistics (Phase 3)</span>}
                          {!ph.production && !ph.accounts && !ph.logistics && <span className="text-zinc-400 italic">No Access</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => openEditModal(scope)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-zinc-200 hover:border-brand-orange bg-white text-zinc-700 hover:text-brand-orange rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit Scope</span>
                    </button>
                    <button
                      onClick={() => handleDeleteScope(scope.id, scope.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-100 hover:border-red-650 bg-red-50/50 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Scope Modal Form */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-5 flex justify-between items-center">
              <h3 className="text-base font-bold">
                {isEditMode ? `Edit Scope Settings: ${name}` : 'Create Custom Permission Scope'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Feedback messages */}
              {message.text && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm border ${
                  message.type === 'success' ? 'bg-green-50 border-green-200 text-brand-green' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Scope Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">Scope Title / Role Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Accounts Supervisor"
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              <div className="border-t border-zinc-200 pt-4 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Configure Access Rights</h4>

                {/* 1. Order Processing Checkboxes */}
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-150 space-y-2">
                  <span className="font-extrabold text-zinc-950 text-xs block">Orders Processing Option</span>
                  <p className="text-[10px] text-zinc-400 mb-2">Configure staff capabilities inside the Order Management pipeline list.</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderProcessing.view}
                        onChange={(e) => setOrderProcessing(prev => ({ ...prev, view: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>View Orders List</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderProcessing.create}
                        onChange={(e) => setOrderProcessing(prev => ({ ...prev, create: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Create New Orders</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderProcessing.edit}
                        onChange={(e) => setOrderProcessing(prev => ({ ...prev, edit: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Edit Orders Details</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderProcessing.delete}
                        onChange={(e) => setOrderProcessing(prev => ({ ...prev, delete: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Delete Orders</span>
                    </label>
                  </div>
                </div>

                {/* 2. Client Management Checkboxes */}
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-150 space-y-2">
                  <span className="font-extrabold text-zinc-950 text-xs block">Client Management Option</span>
                  <p className="text-[10px] text-zinc-400 mb-2">Configure staff capabilities inside the Corporate Clients directory list.</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={clientManagement.view}
                        onChange={(e) => setClientManagement(prev => ({ ...prev, view: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>View Clients List</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={clientManagement.create}
                        onChange={(e) => setClientManagement(prev => ({ ...prev, create: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Create New Clients</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={clientManagement.edit}
                        onChange={(e) => setClientManagement(prev => ({ ...prev, edit: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Edit Clients Details</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={clientManagement.delete}
                        onChange={(e) => setClientManagement(prev => ({ ...prev, delete: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Delete Clients</span>
                    </label>
                  </div>
                </div>

                {/* 3. Order Types Checkboxes */}
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-150 space-y-2">
                  <span className="font-extrabold text-zinc-950 text-xs block">Order Types Configuration</span>
                  <p className="text-[10px] text-zinc-400 mb-2">Configure permissions to manage and structure different service types.</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderTypes.view}
                        onChange={(e) => setOrderTypes(prev => ({ ...prev, view: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>View Order Types</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderTypes.create}
                        onChange={(e) => setOrderTypes(prev => ({ ...prev, create: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Create Order Types</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderTypes.edit}
                        onChange={(e) => setOrderTypes(prev => ({ ...prev, edit: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Edit Order Types</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={orderTypes.delete}
                        onChange={(e) => setOrderTypes(prev => ({ ...prev, delete: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Delete Order Types</span>
                    </label>
                  </div>
                </div>

                {/* 3. Phase Dashboards Checkboxes */}
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-150 space-y-2">
                  <span className="font-extrabold text-zinc-950 text-xs block">Assigned Workflow Steps (Dashboards)</span>
                  <p className="text-[10px] text-zinc-400 mb-2">Enable specific workflow completion screens for staff assignments.</p>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2.5 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={phases.production}
                        onChange={(e) => setPhases(prev => ({ ...prev, production: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Production (Phase 1) — Delivery Challan Uploads</span>
                    </label>
                    <label className="flex items-center gap-2.5 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={phases.accounts}
                        onChange={(e) => setPhases(prev => ({ ...prev, accounts: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Accounts (Phase 2) — Invoice Creation & Uploads</span>
                    </label>
                    <label className="flex items-center gap-2.5 font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={phases.logistics}
                        onChange={(e) => setPhases(prev => ({ ...prev, logistics: e.target.checked }))}
                        className="rounded border-zinc-300 text-brand-orange focus:ring-brand-orange h-4 w-4"
                      />
                      <span>Logistics (Phase 3) — Courier Tracking Dispatch</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex gap-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition-colors shadow disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{formLoading ? 'Saving...' : 'Save Scope'}</span>
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
          setScopeToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Permission Scope Group"
        message={scopeToDelete ? `Are you sure you want to delete permission scope "${scopeToDelete.name}"? \nExisting staff members referencing it will fall back to their default designations.` : ''}
        confirmText="Confirm & Delete"
        loading={deleteLoading}
      />

    </div>
  );
}
