'use client';

import { useState, useEffect } from 'react';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  Hourglass,
  Eye,
  FileText,
  Image as ImageIcon,
  Truck,
  RefreshCw,
  RotateCcw,
  Trash2,
  Search,
  Users,
  Building,
  Layers,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';
import { getSafeFileUrl } from '@/lib/fileUtils';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [showDcHistoryModal, setShowDcHistoryModal] = useState(false);
  const [confirmReopenModal, setConfirmReopenModal] = useState({ open: false, stage: null, clearFiles: false, loading: false });
  const [confirmRemoveFileModal, setConfirmRemoveFileModal] = useState({ open: false, fileType: null, filePath: null, loading: false });

  // Table Sorting State (Numeric: Low/High, Alphabets: A-Z / Z-A)
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc'); // Low to High default (1, 2, 3...)

  const handleExecuteReopenStage = async () => {
    if (!selectedOrder || !confirmReopenModal.stage) return;
    setConfirmReopenModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REOPEN_STAGE',
          stage: confirmReopenModal.stage,
          clearFiles: confirmReopenModal.clearFiles
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reopen stage');

      setConfirmReopenModal({ open: false, stage: null, clearFiles: false, loading: false });
      
      // Update selectedOrder locally so modal reflects instantly
      if (confirmReopenModal.stage === 1) {
        setSelectedOrder(prev => ({
          ...prev,
          status: 'PENDING_TASK',
          stage1_completed_at: null,
          stage2_opened_at: null,
          stage2_completed_at: null,
          stage3_opened_at: null,
          stage3_completed_at: null,
          dc_image_path: confirmReopenModal.clearFiles ? null : prev.dc_image_path,
          stage1_upload_history: confirmReopenModal.clearFiles ? null : prev.stage1_upload_history
        }));
      } else if (confirmReopenModal.stage === 2) {
        setSelectedOrder(prev => ({
          ...prev,
          status: 'PENDING_INVOICE',
          stage2_completed_at: null,
          stage3_opened_at: null,
          stage3_completed_at: null,
          invoice_image_path: confirmReopenModal.clearFiles ? null : prev.invoice_image_path
        }));
      } else if (confirmReopenModal.stage === 3) {
        setSelectedOrder(prev => ({
          ...prev,
          status: 'PENDING_COURIER',
          stage3_completed_at: null,
          tracking_id: confirmReopenModal.clearFiles ? null : prev.tracking_id
        }));
      }

      fetchOrders();
    } catch (err) {
      alert(err.message);
      setConfirmReopenModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExecuteRemoveFile = async () => {
    if (!selectedOrder || !confirmRemoveFileModal.fileType) return;
    setConfirmRemoveFileModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REMOVE_FILE',
          fileType: confirmRemoveFileModal.fileType,
          filePath: confirmRemoveFileModal.filePath
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove file');

      setConfirmRemoveFileModal({ open: false, fileType: null, filePath: null, loading: false });

      if (confirmRemoveFileModal.fileType === 'DC') {
        setSelectedOrder(prev => ({
          ...prev,
          dc_image_path: data.dc_image_path,
          stage1_upload_history: data.stage1_upload_history
        }));
      } else if (confirmRemoveFileModal.fileType === 'INVOICE') {
        setSelectedOrder(prev => ({
          ...prev,
          invoice_image_path: data.invoice_image_path
        }));
      } else if (confirmRemoveFileModal.fileType === 'TRACKING') {
        setSelectedOrder(prev => ({
          ...prev,
          tracking_id: null
        }));
      }

      fetchOrders();
    } catch (err) {
      alert(err.message);
      setConfirmRemoveFileModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Stats computation
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status !== 'COMPLETED').length;
  const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;

  const pendingTaskCount = orders.filter(o => o.status === 'PENDING_TASK').length;
  const pendingInvoiceCount = orders.filter(o => o.status === 'PENDING_INVOICE').length;
  const pendingCourierCount = orders.filter(o => o.status === 'PENDING_COURIER').length;

  const sortedOrders = [...orders].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'id') {
      comparison = (Number(a.id) || 0) - (Number(b.id) || 0);
    } else if (sortField === 'client') {
      const clientA = (a.client_name || '').toLowerCase();
      const clientB = (b.client_name || '').toLowerCase();
      comparison = clientA.localeCompare(clientB);
    } else if (sortField === 'details') {
      const detA = (a.details || '').toLowerCase();
      const detB = (b.details || '').toLowerCase();
      comparison = detA.localeCompare(detB);
    } else if (sortField === 'status') {
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();
      comparison = statusA.localeCompare(statusB);
    } else if (sortField === 'team') {
      const teamA = (a.staff_1_name || '').toLowerCase();
      const teamB = (b.staff_1_name || '').toLowerCase();
      comparison = teamA.localeCompare(teamB);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredOrders = sortedOrders.filter(order => {
    const matchesSearch =
      order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toString().includes(searchTerm) ||
      order.details?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    return order.status === statusFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_TASK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange animate-pulse" />
            Phase 1: Task Completion
          </span>
        );
      case 'PENDING_INVOICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Phase 2: Invoice Creation
          </span>
        );
      case 'PENDING_COURIER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-700">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
            Phase 3: Courier Dispatch
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 border border-green-200 text-brand-green">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Order Completed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateStr).toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr;
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  // Format date and time explicitly for Pakistan/Karachi timezone
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      let parsedDate;
      if (dateStr.includes('T')) {
        parsedDate = new Date(dateStr);
      } else {
        parsedDate = new Date(dateStr.replace(' ', 'T'));
      }

      const day = String(parsedDate.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[parsedDate.getMonth()];

      let hours = parsedDate.getHours();
      const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

      return `${day}-${month} ${timeStr}`;
    } catch (e) {
      return dateStr;
    }
  };

  const parseDcUploadHistory = (order) => {
    if (!order) return [];
    if (order.stage1_upload_history) {
      try {
        const parsed = typeof order.stage1_upload_history === 'string'
          ? JSON.parse(order.stage1_upload_history)
          : order.stage1_upload_history;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Error parsing stage1_upload_history:', e);
      }
    }
    if (order.dc_image_path) {
      const files = order.dc_image_path.split(',').map(s => s.trim()).filter(Boolean);
      if (files.length > 0) {
        return [{
          batch: 1,
          timestamp: order.stage1_completed_at || order.created_at,
          files: files,
          received_by: order.received_by,
          type: 'FINAL'
        }];
      }
    }
    return [];
  };

  return (
    <div className="space-y-5 lg:space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-brand-black tracking-tight font-sans">System Dashboard</h1>
          <p className="text-zinc-500 text-xs lg:text-sm mt-1">Real-time status overview of active client demands and staff workflows.</p>
        </div>
      </div>

      {/* Analytics Cards — inline strip */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-zinc-200">
          {/* Total Active */}
          <div className="flex flex-col items-center justify-center gap-2 py-5 px-3 text-center">
            <div className="h-10 w-10 rounded-xl bg-zinc-950 flex items-center justify-center text-white shadow-md shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase text-zinc-400 tracking-widest leading-snug">Total<br className="sm:hidden" /> Orders</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-zinc-950 mt-0.5">{totalOrders}</p>
            </div>
          </div>
          {/* Pending */}
          <div className="flex flex-col items-center justify-center gap-2 py-5 px-3 text-center">
            <div className="h-10 w-10 rounded-xl bg-brand-orange flex items-center justify-center text-white shadow-md shrink-0">
              <Hourglass className="h-5 w-5 animate-pulse-orange" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase text-zinc-400 tracking-widest leading-snug">Pending<br className="sm:hidden" /> Phases</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-zinc-950 mt-0.5">{pendingOrders}</p>
            </div>
          </div>
          {/* Completed */}
          <div className="flex flex-col items-center justify-center gap-2 py-5 px-3 text-center">
            <div className="h-10 w-10 rounded-xl bg-brand-green flex items-center justify-center text-white shadow-md shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase text-zinc-400 tracking-widest leading-snug">Completed<br className="sm:hidden" /> Orders</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-zinc-950 mt-0.5">{completedOrders}</p>
            </div>
          </div>
        </div>
      </div>


      {/* Sub-status Progress Counters */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-zinc-200">
          <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
            <div className="flex items-center justify-center min-h-[2.5rem]">
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 leading-snug">
                Pending Task<span className="hidden sm:inline"> (Phase 1)</span>
              </p>
            </div>
            <p className="text-2xl font-extrabold text-orange-600 mt-1">{pendingTaskCount}</p>
          </div>
          <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
            <div className="flex items-center justify-center min-h-[2.5rem]">
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 leading-snug">
                Pending Invoice<span className="hidden sm:inline"> (Phase 2)</span>
              </p>
            </div>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{pendingInvoiceCount}</p>
          </div>
          <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
            <div className="flex items-center justify-center min-h-[2.5rem]">
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 leading-snug">
                Pending Courier<span className="hidden sm:inline"> (Phase 3)</span>
              </p>
            </div>
            <p className="text-2xl font-extrabold text-sky-600 mt-1">{pendingCourierCount}</p>
          </div>
        </div>
      </div>

      {/* Orders Filter & Table */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 lg:p-6 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-zinc-50/50">
          <h2 className="text-base lg:text-lg font-bold text-brand-black">Client Orders Registry</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search orders or clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
            />
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1">Status:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${statusFilter === 'ALL'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-white border border-zinc-200 text-zinc-650 hover:bg-zinc-100'
            }`}
          >
            All ({totalOrders})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING_TASK')}
            className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${statusFilter === 'PENDING_TASK'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'
            }`}
          >
            Phase 1: Task ({pendingTaskCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING_INVOICE')}
            className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${statusFilter === 'PENDING_INVOICE'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Phase 2: Invoice ({pendingInvoiceCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING_COURIER')}
            className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${statusFilter === 'PENDING_COURIER'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white border border-sky-200 text-sky-700 hover:bg-sky-50'
            }`}
          >
            Phase 3: Courier ({pendingCourierCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${statusFilter === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Completed ({completedOrders})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-10 text-center text-zinc-500">
            <RefreshCw className="h-7 w-7 animate-spin mx-auto text-brand-orange mb-3" />
            <p className="text-sm">Loading orders list...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <p className="text-sm font-semibold">No orders found.</p>
            <p className="text-xs text-zinc-400 mt-1">Create a new order to begin the workflow.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-zinc-100">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">#{order.id}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="font-bold text-zinc-950 mt-1.5">{order.client_name}</p>
                      <p className="text-xs text-zinc-400">{order.client_phone}</p>
                    </div>
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Track</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2">{order.details}</p>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="bg-zinc-50 border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded font-medium">Task: {order.staff_1_name}</span>
                    <span className="bg-zinc-50 border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded font-medium">Invoice: {order.staff_2_name}</span>
                    <span className="bg-zinc-50 border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded font-medium">Courier: {order.staff_3_name}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto relative min-h-[380px] pb-16">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-200">
                  <tr>
                    {/* ID */}
                    <th 
                      onClick={() => handleSort('id')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group w-16"
                      title={sortField === 'id' ? (sortDirection === 'asc' ? 'Order ID: Low to High' : 'Order ID: High to Low') : 'Sort by Order ID'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>ID</span>
                        {sortField === 'id' ? (
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

                    {/* Client */}
                    <th 
                      onClick={() => handleSort('client')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'client' ? (sortDirection === 'asc' ? 'Client: A to Z' : 'Client: Z to A') : 'Sort by Client Name'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Client</span>
                        {sortField === 'client' ? (
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

                    {/* Order Details */}
                    <th 
                      onClick={() => handleSort('details')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'details' ? (sortDirection === 'asc' ? 'Details: A to Z' : 'Details: Z to A') : 'Sort by Order Details'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Order Details</span>
                        {sortField === 'details' ? (
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

                    {/* Current Status */}
                    <th 
                      onClick={() => handleSort('status')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'status' ? (sortDirection === 'asc' ? 'Status: A to Z' : 'Status: Z to A') : 'Sort by Status'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Current Status</span>
                        {sortField === 'status' ? (
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

                    {/* Assigned Team */}
                    <th 
                      onClick={() => handleSort('team')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'team' ? (sortDirection === 'asc' ? 'Team: A to Z' : 'Team: Z to A') : 'Sort by Assigned Staff'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Assigned Team</span>
                        {sortField === 'team' ? (
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

                    {/* Actions - Sticky Pinned */}
                    <th className="whitespace-nowrap px-4 py-3.5 text-right sticky right-0 bg-zinc-50 z-20 border-l border-zinc-200 shadow-[-6px_0_10px_rgba(0,0,0,0.03)] w-36">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {filteredOrders.map((order, rowIdx) => {
                    const isUnassigned = (!order.staff_1_name || order.staff_1_name.includes('Unassigned')) &&
                                         (!order.staff_2_name || order.staff_2_name.includes('Unassigned')) &&
                                         (!order.staff_3_name || order.staff_3_name.includes('Unassigned'));
                    const openUpwards = filteredOrders.length > 3 && rowIdx >= filteredOrders.length - 2;

                    return (
                      <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors group/row">
                        <td className="whitespace-nowrap px-4 py-3.5 font-bold text-zinc-950">#{order.id}</td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-zinc-950">{order.client_name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">{order.client_phone}</div>
                        </td>
                        <td className="px-4 py-3.5 max-w-xs truncate text-zinc-600">{order.details}</td>
                        <td className="whitespace-nowrap px-4 py-3.5">{getStatusBadge(order.status)}</td>

                        {/* Assigned Team Popover */}
                        <td className="px-4 py-3.5">
                          <div className="relative group/crew inline-block">
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                                isUnassigned 
                                  ? 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100' 
                                  : 'bg-orange-50/70 border-orange-200/80 text-brand-orange hover:bg-orange-100/70'
                              }`}
                            >
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span className="whitespace-nowrap font-medium">
                                {isUnassigned ? 'Unassigned' : 'Assigned Team'}
                              </span>
                              <span className={`h-1.5 w-1.5 rounded-full ${isUnassigned ? 'bg-zinc-350' : 'bg-brand-orange animate-pulse'}`} />
                            </button>

                            {/* Floating Tooltip Card */}
                            <div className={`pointer-events-none opacity-0 group-hover/crew:opacity-100 group-hover/crew:pointer-events-auto transition-all duration-200 delay-75 absolute right-0 sm:left-0 z-50 w-64 bg-zinc-950 text-white p-3 rounded-xl shadow-2xl border border-zinc-800 text-xs ${
                              openUpwards 
                                ? 'bottom-full mb-2.5 after:absolute after:-bottom-2.5 after:left-0 after:w-full after:h-2.5 after:content-[\'\']' 
                                : 'top-full mt-2.5 before:absolute before:-top-2.5 before:left-0 before:w-full before:h-2.5 before:content-[\'\']'
                            }`}>
                              <div className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                                <span>Assigned Workflow Crew</span>
                                <span className="text-brand-orange text-[9px] font-mono">Phase Matrix</span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" /> Phase 1: Task Completion
                                  </span>
                                  <div className="pl-3 mt-0.5">
                                    {!order.staff_1_name || order.staff_1_name.includes('Unassigned') || order.staff_1_name.includes('Deleted') ? (
                                      <span className="text-zinc-500 italic text-[11px]">Not assigned</span>
                                    ) : (
                                      <span className="font-semibold text-zinc-100 text-xs">{order.staff_1_name}</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" /> Phase 2: Invoice Creation
                                  </span>
                                  <div className="pl-3 mt-0.5">
                                    {!order.staff_2_name || order.staff_2_name.includes('Unassigned') || order.staff_2_name.includes('Deleted') ? (
                                      <span className="text-zinc-500 italic text-[11px]">Not assigned</span>
                                    ) : (
                                      <span className="font-semibold text-zinc-100 text-xs">{order.staff_2_name}</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" /> Phase 3: Courier Tracking
                                  </span>
                                  <div className="pl-3 mt-0.5">
                                    {!order.staff_3_name || order.staff_3_name.includes('Unassigned') || order.staff_3_name.includes('Deleted') ? (
                                      <span className="text-zinc-500 italic text-[11px]">Not assigned</span>
                                    ) : (
                                      <span className="font-semibold text-zinc-100 text-xs">{order.staff_3_name}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Pointer Arrow */}
                              {openUpwards ? (
                                <div className="absolute top-full sm:left-4 right-4 -mt-1 border-4 border-transparent border-t-zinc-950 pointer-events-none" />
                              ) : (
                                <div className="absolute bottom-full sm:left-4 right-4 -mb-1 border-4 border-transparent border-b-zinc-950 pointer-events-none" />
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Actions Sticky */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-right sticky right-0 bg-white group-hover/row:bg-zinc-50 transition-colors z-20 border-l border-zinc-200/80 shadow-[-6px_0_10px_rgba(0,0,0,0.03)]">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Track Flow</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Progress Timeline Tracking Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-t-2xl sm:rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Order Live Pipeline</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Tracking Order #{selectedOrder.id} for {selectedOrder.client_name}</p>
              </div>
              <button
                onClick={() => { setShowModal(false); setShowDcHistoryModal(false); }}
                className="text-zinc-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">

              {/* Order Details Header Panel */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <span className="font-semibold text-zinc-900">Demand Details:</span>
                  <div className="flex gap-4 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 px-3 py-1 rounded shadow-sm">
                    <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-brand-orange" /> Qty: {selectedOrder.qty || '—'}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-brand-green" /> Deadline: {formatDate(selectedOrder.deadline_date)}</span>
                  </div>
                </div>
                <p className="text-zinc-650 bg-white border border-zinc-150 p-2.5 rounded-lg">{selectedOrder.details}</p>
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-zinc-500">
                  <div>
                    <span className="font-semibold text-zinc-700">Client Address:</span>
                    <p className="mt-0.5 text-zinc-600">{selectedOrder.client_address}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-700">Client Contact:</span>
                    <p className="mt-0.5 text-zinc-600">
                      {selectedOrder.client_phone || 'No phone provided'}
                      {selectedOrder.client_email ? ` • ${selectedOrder.client_email}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Landscape Horizontal Grid Workflow Pipeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 font-sans">
                  Workflow Pipeline Progress
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">

                  {/* Stage 1 Card */}
                  <div className={`p-4 rounded-xl border transition-all ${selectedOrder.dc_image_path
                    ? 'bg-green-50/20 border-green-200'
                    : selectedOrder.status === 'PENDING_TASK'
                      ? 'bg-orange-50/20 border-brand-orange ring-1 ring-brand-orange'
                      : 'bg-zinc-50/50 border-zinc-200 opacity-60'
                    }`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Stage 1</div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {selectedOrder.status !== 'PENDING_TASK' && (
                          <button
                            type="button"
                            onClick={() => setConfirmReopenModal({ open: true, stage: 1, clearFiles: false, loading: false })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Reopen Stage 1 (locks Stage 2 & 3 for staff)"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            <span>Reopen Stage 1</span>
                          </button>
                        )}
                        {selectedOrder.stage1_completed_at ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-green-50 border border-green-200 text-brand-green rounded">Done</span>
                        ) : selectedOrder.status === 'PENDING_TASK' ? (
                          selectedOrder.dc_image_path ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-700 rounded animate-pulse">Draft Saved</span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-orange-50 border border-brand-orange/30 text-brand-orange rounded animate-pulse">Active</span>
                          )
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-400 rounded">Locked</span>
                        )}
                      </div>
                    </div>

                    <h5 className="font-extrabold text-sm text-zinc-950 flex items-center gap-1.5 flex-wrap">
                      <span>Production</span>
                      {selectedOrder.stage1_completed_at && (
                        <span className="text-[10px] font-medium text-zinc-550 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                          {formatDateTime(selectedOrder.stage1_completed_at)}
                        </span>
                      )}
                    </h5>

                    <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-2">
                      <div>Assigned: <span className="font-semibold text-zinc-800">{selectedOrder.staff_1_name}</span></div>
                      {selectedOrder.received_by && (
                        <div className="text-[11px] font-semibold text-zinc-650">
                          Received By: <span className="font-extrabold text-zinc-850">{selectedOrder.received_by}</span>
                        </div>
                      )}

                      {/* DC Upload History View Button */}
                      {(() => {
                        const dcHistory = parseDcUploadHistory(selectedOrder);
                        if (dcHistory.length === 0) return null;
                        return (
                          <div className="mt-3 pt-2.5 border-t border-zinc-200/70">
                            <button
                              type="button"
                              onClick={() => setShowDcHistoryModal(true)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 hover:bg-orange-100/90 border border-orange-200/90 rounded-xl text-xs font-bold text-brand-orange transition-all cursor-pointer shadow-2xs group/btn active:scale-98"
                            >
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                                <span>DC Upload Batches</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-white text-orange-600 px-2.5 py-0.5 rounded-full border border-orange-200 shadow-2xs">
                                <span>{dcHistory.length} {dcHistory.length === 1 ? 'Batch' : 'Batches'}</span>
                                <Eye className="h-3 w-3 ml-0.5 group-hover/btn:scale-110 transition-transform" />
                              </span>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stage 2 Card */}
                  <div className={`p-4 rounded-xl border transition-all ${selectedOrder.invoice_image_path
                    ? 'bg-green-50/20 border-green-200'
                    : selectedOrder.status === 'PENDING_INVOICE'
                      ? 'bg-orange-50/20 border-brand-orange ring-1 ring-brand-orange'
                      : 'bg-zinc-50/50 border-zinc-200 opacity-60'
                    }`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Stage 2</div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {(selectedOrder.status === 'PENDING_COURIER' || selectedOrder.status === 'COMPLETED' || selectedOrder.stage2_completed_at) && (
                          <button
                            type="button"
                            onClick={() => setConfirmReopenModal({ open: true, stage: 2, clearFiles: false, loading: false })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Reopen Stage 2 (locks Stage 3 for staff)"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            <span>Reopen Stage 2</span>
                          </button>
                        )}
                        {selectedOrder.invoice_image_path ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-green-50 border border-green-200 text-brand-green rounded">Done</span>
                        ) : selectedOrder.status === 'PENDING_INVOICE' ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-orange-50 border border-brand-orange/30 text-brand-orange rounded animate-pulse">Active</span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-400 rounded">
                            {selectedOrder.status === 'PENDING_TASK' ? 'Locked' : 'Waiting'}
                          </span>
                        )}
                      </div>
                    </div>

                    <h5 className="font-extrabold text-sm text-zinc-950 flex items-center gap-1.5 flex-wrap">
                      <span>Accounts Invoice</span>
                      {selectedOrder.stage2_completed_at && (
                        <span className="text-[10px] font-medium text-zinc-550 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                          {formatDateTime(selectedOrder.stage2_completed_at)}
                        </span>
                      )}
                    </h5>

                    <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-2">
                      <div>Assigned: <span className="font-semibold text-zinc-800">{selectedOrder.staff_2_name}</span></div>

                      {selectedOrder.invoice_image_path && (
                        <div className="space-y-1.5 mt-2">
                          {selectedOrder.invoice_image_path.split(',').map((path, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <a
                                href={getSafeFileUrl(path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  if (!/\.pdf$/i.test(path)) {
                                    e.preventDefault();
                                    setPreviewImageUrl(getSafeFileUrl(path));
                                  }
                                }}
                                className="flex-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70 text-xs text-emerald-700 font-bold transition-all shadow-2xs truncate"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">Tax Invoice #{idx + 1}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveFileModal({ open: true, fileType: 'INVOICE', filePath: path, loading: false })}
                                className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Remove Invoice File (allows staff to re-upload)"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage 3 Card */}
                  <div className={`p-4 rounded-xl border transition-all ${selectedOrder.tracking_id
                    ? 'bg-green-50/20 border-green-200'
                    : selectedOrder.status === 'PENDING_COURIER'
                      ? 'bg-orange-50/20 border-brand-orange ring-1 ring-brand-orange'
                      : 'bg-zinc-50/50 border-zinc-200 opacity-60'
                    }`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Stage 3</div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {(selectedOrder.status === 'COMPLETED' || selectedOrder.stage3_completed_at) && (
                          <button
                            type="button"
                            onClick={() => setConfirmReopenModal({ open: true, stage: 3, clearFiles: false, loading: false })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Reopen Stage 3 (marks order in-progress)"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            <span>Reopen Stage 3</span>
                          </button>
                        )}
                        {selectedOrder.tracking_id ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-green-50 border border-green-200 text-brand-green rounded">Done</span>
                        ) : selectedOrder.status === 'PENDING_COURIER' ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-orange-50 border border-brand-orange/30 text-brand-orange rounded animate-pulse">Active</span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-400 rounded">
                            {selectedOrder.status === 'COMPLETED' ? 'Done' : 'Locked'}
                          </span>
                        )}
                      </div>
                    </div>

                    <h5 className="font-extrabold text-sm text-zinc-950 flex items-center gap-1.5 flex-wrap">
                      <span>Logistics Dispatch</span>
                      {selectedOrder.stage3_completed_at && (
                        <span className="text-[10px] font-medium text-zinc-550 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                          {formatDateTime(selectedOrder.stage3_completed_at)}
                        </span>
                      )}
                    </h5>

                    <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-2">
                      <div>Assigned: <span className="font-semibold text-zinc-800">{selectedOrder.staff_3_name}</span></div>

                      {selectedOrder.tracking_id && (
                        <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs mt-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <Truck className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                            <span className="font-mono font-bold text-zinc-800 truncate">Trk: {selectedOrder.tracking_id}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveFileModal({ open: true, fileType: 'TRACKING', filePath: selectedOrder.tracking_id, loading: false })}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer ml-1"
                            title="Remove Tracking ID (allows courier staff to re-enter)"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      )}

            {/* Landscape DC Upload History Modal */}
      {showDcHistoryModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-[70] animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold">Delivery Challan Upload History</h3>
                    <span className="text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded">
                      Order #{selectedOrder.id}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Client: <span className="text-zinc-200 font-semibold">{selectedOrder.client_name}</span> · Sequential record of all DC uploads & drafts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDcHistoryModal(false)}
                className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Summary Stats Strip */}
            <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-zinc-600">
                <div>
                  <span className="text-zinc-400 font-medium">Assigned Staff: </span>
                  <span className="font-bold text-zinc-800">{selectedOrder.staff_1_name}</span>
                </div>
                <div className="h-3.5 w-px bg-zinc-200" />
                <div>
                  <span className="text-zinc-400 font-medium">Total Batches: </span>
                  <span className="font-extrabold text-orange-600 font-mono">
                    {parseDcUploadHistory(selectedOrder).length}
                  </span>
                </div>
                <div className="h-3.5 w-px bg-zinc-200" />
                <div>
                  <span className="text-zinc-400 font-medium">Total DC Files: </span>
                  <span className="font-bold text-zinc-800 font-mono">
                    {selectedOrder.dc_image_path ? selectedOrder.dc_image_path.split(',').filter(Boolean).length : 0}
                  </span>
                </div>
                {selectedOrder.received_by && (
                  <>
                    <div className="h-3.5 w-px bg-zinc-200" />
                    <div>
                      <span className="text-zinc-400 font-medium">Latest Receiver: </span>
                      <span className="font-bold text-zinc-800">{selectedOrder.received_by}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-orange animate-pulse" />
                <span>Horizontal Landscape Timeline</span>
              </div>
            </div>

            {/* Landscape Horizontal Batches Scroll Area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-6 bg-zinc-100/60">
              {(() => {
                const dcHistory = parseDcUploadHistory(selectedOrder);
                if (dcHistory.length === 0) {
                  return (
                    <div className="text-center py-16 text-zinc-400">
                      <FileText className="h-12 w-12 mx-auto text-zinc-300 mb-2" />
                      <p className="text-sm font-semibold">No DC upload batches found for this order.</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-row items-stretch gap-5 min-w-max pb-3 pt-1">
                    {dcHistory.map((batch, bIdx) => {
                      const isDraft = batch.type === 'DRAFT';
                      const isReupload = batch.type === 'REUPLOAD';
                      const badgeText = isDraft ? 'Partial Draft' : isReupload ? 'Buffer Re-upload' : 'Final Submit';
                      const badgeColor = isDraft
                        ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200'
                        : isReupload
                          ? 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200';
                      
                      const cardAccent = isDraft
                        ? 'border-amber-300/80 shadow-amber-500/5'
                        : isReupload
                          ? 'border-blue-300/80 shadow-blue-500/5'
                          : 'border-emerald-300/80 shadow-emerald-500/5';

                      return (
                        <div key={bIdx} className="flex items-center gap-4">
                          {/* Batch Card in Landscape Flow */}
                          <div className={`w-[320px] sm:w-[350px] shrink-0 bg-white border-2 ${cardAccent} rounded-2xl p-4 shadow-md flex flex-col justify-between hover:shadow-lg transition-all`}>
                            
                            {/* Batch Card Header */}
                            <div>
                              <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-100">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-sm text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">
                                      Batch #{batch.batch || bIdx + 1}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                      {badgeText}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-2 font-mono">
                                    <Clock className="h-3 w-3 text-zinc-400 shrink-0" />
                                    <span>{formatDateTime(batch.timestamp)}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400 font-mono bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
                                  {bIdx + 1} / {dcHistory.length}
                                </span>
                              </div>

                              {/* Receiver Info */}
                              <div className="py-2 px-3 bg-zinc-50 border border-zinc-150 rounded-xl mt-3 text-xs space-y-0.5">
                                <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Receiver Info:</div>
                                <div className="font-extrabold text-zinc-800 text-xs flex items-center gap-1.5">
                                  <span>👤</span>
                                  <span>{batch.received_by || 'Not specified'}</span>
                                </div>
                              </div>

                              {/* Files Gallery */}
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    Attached Pictures ({batch.files?.length || 0}):
                                  </span>
                                </div>

                                {Array.isArray(batch.files) && batch.files.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {batch.files.map((file, fIdx) => (
                                      <div
                                        key={fIdx}
                                        className="group/img relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-2xs hover:border-orange-400 transition-all cursor-pointer"
                                        onClick={() => setPreviewImageUrl(getSafeFileUrl(file))}
                                      >
                                        <img
                                          src={getSafeFileUrl(file)}
                                          alt={`DC ${fIdx + 1}`}
                                          className="h-24 w-full object-cover group-hover/img:scale-105 transition-transform"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 flex items-center justify-between">
                                          <span className="text-[9px] font-bold text-white truncate">
                                            DC #{fIdx + 1}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-white/80 bg-white/20 px-1 rounded">
                                              View 🔍
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmRemoveFileModal({ open: true, fileType: 'DC', filePath: file, loading: false });
                                              }}
                                              className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors shadow cursor-pointer"
                                              title="Remove this DC file (allows staff to re-upload)"
                                            >
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-zinc-400 italic bg-zinc-50 p-3 rounded-xl border border-dashed border-zinc-200 text-center">
                                    No additional files attached in this finalization step.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Footer status info */}
                            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                              <span>{isDraft ? '💾 Incomplete / Partial' : isReupload ? '🔄 Buffer Edit' : '✓ Final Batch'}</span>
                              <span className="font-mono">{Array.isArray(batch.files) ? `${batch.files.length} file(s)` : '0 files'}</span>
                            </div>

                          </div>

                          {/* Arrow connector between batches in landscape orientation */}
                          {bIdx < dcHistory.length - 1 && (
                            <div className="shrink-0 flex flex-col items-center justify-center text-zinc-400 px-1">
                              <div className="h-8 w-8 rounded-full bg-white border border-zinc-300 shadow-xs flex items-center justify-center text-brand-orange font-bold text-sm">
                                →
                              </div>
                              <span className="text-[9px] font-mono text-zinc-400 mt-1 font-semibold">Next</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Landscape Modal Footer */}
            <div className="bg-white border-t border-zinc-200 px-6 py-3.5 shrink-0 flex items-center justify-between">
              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                <span>💡</span>
                <span>Tip: Scroll horizontally (left/right) to track the step-by-step upload progress across days.</span>
              </p>
              <button
                type="button"
                onClick={() => setShowDcHistoryModal(false)}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Close History
              </button>
            </div>

          </div>
        </div>
      )}

            {/* Confirm Reopen Stage Modal */}
      {confirmReopenModal.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-zinc-900">Reopen Stage {confirmReopenModal.stage}?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Order #{selectedOrder?.id} · Workflow Reversal</p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2">
              <p>
                {confirmReopenModal.stage === 1
                  ? 'Reopening Stage 1 will set order status back to Production. Subsequent stages (Accounts Invoice & Courier Dispatch) will be locked again until Stage 1 is re-completed.'
                  : confirmReopenModal.stage === 2
                    ? 'Reopening Stage 2 will set order status back to Accounts Invoice. Stage 3 (Courier Dispatch) will be locked again until Stage 2 is re-completed.'
                    : 'Reopening Stage 3 will revert the order from Completed back to Courier Dispatch in-progress.'}
              </p>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmReopenModal.clearFiles}
                  onChange={(e) => setConfirmReopenModal(prev => ({ ...prev, clearFiles: e.target.checked }))}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <span className="font-semibold text-amber-950 text-[11px]">
                  Also delete uploaded files for this stage so staff can upload fresh files
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmReopenModal({ open: false, stage: null, clearFiles: false, loading: false })}
                disabled={confirmReopenModal.loading}
                className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReopenStage}
                disabled={confirmReopenModal.loading}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{confirmReopenModal.loading ? 'Reopening…' : `Confirm & Reopen Stage ${confirmReopenModal.stage}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove File Modal */}
      {confirmRemoveFileModal.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-zinc-900">Remove Uploaded {confirmRemoveFileModal.fileType === 'DC' ? 'Delivery Challan' : confirmRemoveFileModal.fileType === 'INVOICE' ? 'Invoice' : 'Tracking ID'}?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Order #{selectedOrder?.id}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
              Are you sure you want to remove this item? Once removed, the assigned staff member will be able to re-upload their document when the stage is active or reopened.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveFileModal({ open: false, fileType: null, filePath: null, loading: false })}
                disabled={confirmRemoveFileModal.loading}
                className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRemoveFile}
                disabled={confirmRemoveFileModal.loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{confirmRemoveFileModal.loading ? 'Removing…' : 'Confirm & Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all duration-300 animate-fade-in"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(null); }}
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 w-10 flex items-center justify-center text-lg font-bold shadow-lg transition-colors cursor-pointer"
              title="Close Preview"
            >
              ✕
            </button>
            <img 
              src={previewImageUrl} 
              alt="Preview" 
              onClick={(e) => e.stopPropagation()} 
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl border border-white/10 animate-scale-up" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
