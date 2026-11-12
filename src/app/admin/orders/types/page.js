'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Edit2, Trash2, Layers, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

export default function OrderTypesPage() {
  const [types, setTypes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null); // { id, name }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // Form states
  const [typeName, setTypeName] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  const fetchOrderTypes = async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const [sessionRes, typesRes, ordersRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/admin/order-types'),
        fetch('/api/admin/orders')
      ]);

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setUser(sessionData.user);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setTypes(data);
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      }
    } catch (e) {
      console.error('Error fetching order types:', e);
      setGlobalError('Failed to load order types. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderTypes();
  }, []);

  const handleOpenAddModal = () => {
    setTypeName('');
    setFormError('');
    setFormSuccess(false);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (type) => {
    setSelectedType(type);
    setTypeName(type.name);
    setFormError('');
    setFormSuccess(false);
    setShowEditModal(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess(false);

    try {
      const res = await fetch('/api/admin/order-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typeName.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create order type');
      }

      setFormSuccess(true);
      fetchOrderTypes();

      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess(false);
      }, 1000);

    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess(false);

    try {
      const res = await fetch(`/api/admin/order-types/${selectedType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typeName.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order type');
      }

      setFormSuccess(true);
      fetchOrderTypes();

      setTimeout(() => {
        setShowEditModal(false);
        setFormSuccess(false);
      }, 1000);

    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (type) => {
    setTypeToDelete(type);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/order-types/${typeToDelete.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setShowDeleteModal(false);
        setTypeToDelete(null);
        fetchOrderTypes();
      } else {
        const data = await res.json();
        setShowDeleteModal(false);
        setGlobalError(data.error || 'Failed to delete order type');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setGlobalError('Network error while deleting order type');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const canCreate = isAdmin || !!user?.permissions?.order_types?.create;
  const canEdit = isAdmin || !!user?.permissions?.order_types?.edit;
  const canDelete = isAdmin || !!user?.permissions?.order_types?.delete;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-zinc-950 tracking-tight font-sans">Order Types</h1>
          <p className="text-zinc-500 text-xs lg:text-sm mt-1">Configure and manage service categories.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOrderTypes}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 bg-white text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-50 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-brand-orange' : ''}`} />
            <span>Reload</span>
          </button>
          {canCreate && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-3.5 py-2 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-orange-500/20 cursor-pointer active:scale-[0.98]"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Order Type</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span className="font-semibold">{globalError}</span>
          </div>
          <button onClick={() => setGlobalError('')} className="text-red-500 hover:text-red-800 font-bold px-2 py-0.5">✕</button>
        </div>
      )}

      {/* Grid of Enterprise Cards */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <RefreshCw className="h-7 w-7 animate-spin mx-auto text-brand-orange mb-3" />
          <p className="text-sm font-medium">Loading service categories...</p>
        </div>
      ) : types.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 bg-white border border-zinc-200 rounded-2xl shadow-xs">
          <div className="h-12 w-12 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center mx-auto mb-3">
            <Layers className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-zinc-900">No order types created yet</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">Add service categories like Refilling, Installation, or Maintenance to categorize client demands.</p>
          {canCreate && (
            <button
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Category</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {types.map((type) => {
            const linkedCount = orders.filter(o => o.order_type_id === type.id).length;
            return (
              <div
                key={type.id}
                className="bg-white border border-zinc-200/90 hover:border-brand-orange/40 rounded-xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100/80 flex items-center justify-center text-brand-orange shrink-0 group-hover:scale-105 transition-transform">
                      <Layers className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active Category
                    </span>
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-bold text-zinc-950 truncate text-sm leading-tight tracking-tight">{type.name}</h3>
                    <p className="text-[11px] font-medium text-zinc-500 mt-1 flex items-center gap-1">
                      <span>{linkedCount} {linkedCount === 1 ? 'order' : 'orders'} registered</span>
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                {(canEdit || canDelete) && (
                  <div className="flex gap-2 pt-4 mt-4 border-t border-zinc-100">
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEditModal(type)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteClick(type)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-red-100 hover:border-red-200 bg-red-50/50 hover:bg-red-50 text-red-650 hover:text-red-750 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-slide-up">

            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold">Add Order Type</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Define a new service category for orders</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-green-50 border border-green-200 text-brand-green p-3 rounded-lg flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Order Type created successfully!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fire Hydrant Testing"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div className="border-t border-zinc-100 pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-slide-up">

            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold">Edit Order Type</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Modify service category title</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-green-50 border border-green-200 text-brand-green p-3 rounded-lg flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Order Type updated successfully!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Category Name</label>
                <input
                  type="text"
                  required
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                />
              </div>

              <div className="border-t border-zinc-100 pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
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
          setTypeToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={typeToDelete ? `Delete "${typeToDelete.name}"?` : 'Delete Order Category'}
        message={typeToDelete ? `Are you sure you want to delete order category "${typeToDelete.name}"?\nExisting orders with this category will remain intact.` : 'Are you sure you want to delete this category?'}
        confirmText="Confirm & Delete"
        loading={deleteLoading}
      />

    </div>
  );
}
