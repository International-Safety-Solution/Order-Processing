'use client';

import { useState, useEffect } from 'react';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
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
  Search,
  Users,
  UserCheck,
  Receipt,
  AlertCircle,
  Calendar,
  Layers,
  Pencil,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';
import OrderDocumentDropdown from '@/components/OrderDocumentDropdown';
import { getSafeFileUrl } from '@/lib/fileUtils';

// Helper to convert images to WebP on the client side before upload
const convertToWebP = (file) => {
  return new Promise((resolve, reject) => {
    // If the file is already a webp, we don't need to process it
    if (file.type === 'image/webp') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = 2048;
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const webpFile = new File([blob], `${cleanName}.webp`, {
              type: 'image/webp'
            });
            resolve(webpFile);
          } else {
            reject(new Error('WebP compression failed'));
          }
        }, 'image/webp', 0.85); // 85% compression quality
      };
      img.onerror = () => reject(new Error('Failed to load image resource'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

const parseReuploadTimes = (timesStr) => {
  if (!timesStr) return [];
  try {
    if (typeof timesStr === 'object') return timesStr;
    return JSON.parse(timesStr);
  } catch (e) {
    if (timesStr.includes('[')) return [];
    return timesStr.split(',').filter(Boolean);
  }
};

export default function ClientOrders() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  // Table Sorting State (Numeric: Low/High, Alphabets: A-Z / Z-A)
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc'); // High to Low default

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // id & qty default to 'desc' (high to low), alphabetical fields to 'asc' (A to Z)
      setSortDirection(field === 'id' || field === 'qty' ? 'desc' : 'asc');
    }
  };

  // Modals toggle states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [showDcHistoryModal, setShowDcHistoryModal] = useState(false);
  const [confirmReopenModal, setConfirmReopenModal] = useState({ open: false, stage: null, clearFiles: false, loading: false });
  const [confirmRemoveFileModal, setConfirmRemoveFileModal] = useState({ open: false, fileType: null, filePath: null, loading: false });

  // Form states (Create Order)
  const [clientId, setClientId] = useState('');
  const [orderTypeId, setOrderTypeId] = useState('');
  const [details, setDetails] = useState('');
  const [qty, setQty] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [staff1Id, setStaff1Id] = useState('');
  const [staff2Id, setStaff2Id] = useState('');
  const [staff3Id, setStaff3Id] = useState('');
  const [poNo, setPoNo] = useState('');
  const [poFiles, setPoFiles] = useState([]); // [{ file, previewUrl, isPdf, isExisting, path }]

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Delete confirm modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderIdToDelete, setOrderIdToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchOrdersAndData = async () => {
    setLoading(true);
    try {
      const [sessionRes, ordersRes, clientsRes, staffRes, typesRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/admin/orders'),
        fetch('/api/admin/clients'),
        fetch('/api/admin/staff'),
        fetch('/api/admin/order-types')
      ]);

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setUser(sessionData.user);
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }
      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData);
      }
      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setOrderTypes(typesData);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndData();
  }, []);

  const isAdmin = user?.role === 'ADMIN';
  const canCreate = isAdmin || !!user?.permissions?.order_processing?.create;
  const canEdit = isAdmin || !!user?.permissions?.order_processing?.edit;
  const canDelete = isAdmin || !!user?.permissions?.order_processing?.delete;

  // Filter staff for dropdowns
  const taskStaff = staff.filter(s => s.designation === 'TASK_COMPLETION');
  const invoiceStaff = staff.filter(s => s.designation === 'INVOICE_CREATION');
  const courierStaff = staff.filter(s => s.designation === 'INVOICE_COURIER');

  const sortedOrders = [...orders].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'id') {
      comparison = (Number(a.id) || 0) - (Number(b.id) || 0);
    } else if (sortField === 'client') {
      const nameA = (a.client_name || '').toLowerCase();
      const nameB = (b.client_name || '').toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (sortField === 'qty') {
      comparison = (Number(a.qty) || 0) - (Number(b.qty) || 0);
    } else if (sortField === 'deadline') {
      const timeA = a.deadline_date ? new Date(a.deadline_date).getTime() : 0;
      const timeB = b.deadline_date ? new Date(b.deadline_date).getTime() : 0;
      comparison = timeA - timeB;
    } else if (sortField === 'status') {
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();
      comparison = statusA.localeCompare(statusB);
    } else if (sortField === 'crew') {
      const crewA = (a.staff_1_name || '').toLowerCase();
      const crewB = (b.staff_1_name || '').toLowerCase();
      comparison = crewA.localeCompare(crewB);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredOrders = sortedOrders.filter(order =>
    order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toString().includes(searchTerm) ||
    order.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.order_type_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreateModal = () => {
    setClientId('');
    setOrderTypeId('');
    setDetails('');
    setQty('');
    setDeadlineDate('');
    setPoNo('');
    setPoFiles([]);

    const tStaff = staff.filter(s => s.designation === 'TASK_COMPLETION');
    const iStaff = staff.filter(s => s.designation === 'INVOICE_CREATION');
    const cStaff = staff.filter(s => s.designation === 'INVOICE_COURIER');

    setStaff1Id(tStaff.length === 1 ? tStaff[0].id.toString() : '');
    setStaff2Id(iStaff.length === 1 ? iStaff[0].id.toString() : '');
    setStaff3Id(cStaff.length === 1 ? cStaff[0].id.toString() : '');

    setFormError('');
    setFormSuccess(false);
    setShowCreateModal(true);
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess(false);

    if (!clientId) {
      setFormError('Please select a client.');
      setFormLoading(false);
      return;
    }
    if (!orderTypeId) {
      setFormError('Please select an Order Type.');
      setFormLoading(false);
      return;
    }
    if (!details || !details.trim()) {
      setFormError('Please enter Order Requirements / Details.');
      setFormLoading(false);
      return;
    }
    if (!deadlineDate) {
      setFormError('Please select a Deadline Date.');
      setFormLoading(false);
      return;
    }
    if (!staff1Id || !staff2Id || !staff3Id) {
      setFormError('Please assign staff members for all 3 pipeline phases.');
      setFormLoading(false);
      return;
    }

    try {
      // Upload PO files if any
      let poFilePath = '';
      if (poFiles.length > 0) {
        const selectedClientObj = clients.find(c => c.id === parseInt(clientId));
        const clientName = selectedClientObj ? selectedClientObj.name : '';
        const existingIds = new Set((orders || []).map(o => o.id));
        let nextOrderNo = 1;
        while (existingIds.has(nextOrderNo)) {
          nextOrderNo++;
        }

        const uploadPromises = poFiles.map(async ({ file }) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('docType', 'PO');
          formData.append('orderNo', nextOrderNo);
          if (clientName) formData.append('clientName', clientName);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to upload purchase order file');
          }
          return data.filePath;
        });

        const uploadedPaths = await Promise.all(uploadPromises);
        poFilePath = uploadedPaths.join(',');
      }

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          orderTypeId,
          details,
          qty,
          deadlineDate,
          staff1Id,
          staff2Id,
          staff3Id,
          poNo,
          poFilePath
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      setFormSuccess(true);
      fetchOrdersAndData();

      setTimeout(() => {
        setShowCreateModal(false);
        setFormSuccess(false);
      }, 1500);

    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEditModal = (order) => {
    setEditingOrder(order);
    setClientId(order.client_id?.toString() || '');
    setOrderTypeId(order.order_type_id?.toString() || '');
    setDetails(order.details || '');
    setQty(order.qty?.toString() || '');
    
    // Format deadline date for date picker (YYYY-MM-DD)
    let formattedDate = '';
    if (order.deadline_date) {
      try {
        const d = new Date(order.deadline_date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        } else {
          formattedDate = order.deadline_date;
        }
      } catch (err) {
        formattedDate = order.deadline_date;
      }
    }
    setDeadlineDate(formattedDate);
    
    setStaff1Id(order.assigned_staff_1_id?.toString() || '');
    setStaff2Id(order.assigned_staff_2_id?.toString() || '');
    setStaff3Id(order.assigned_staff_3_id?.toString() || '');

    setPoNo(order.po_no || '');
    let existingPoFiles = [];
    if (order.po_file_path) {
      existingPoFiles = order.po_file_path.split(',').map((path, idx) => {
        const isPdf = /\.pdf$/i.test(path);
        return {
          isExisting: true,
          path: path,
          previewUrl: path,
          isPdf: isPdf,
          name: `PO File ${idx + 1}`
        };
      });
    }
    setPoFiles(existingPoFiles);

    setFormError('');
    setFormSuccess(false);
    setShowEditModal(true);
  };

  const handlePoFilesSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Allowed extensions check (same restrictions as invoice upload: Images & PDF allowed)
    const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const allowedPdfTypes = ['application/pdf'];
    const allowedTypes = [...allowedImageTypes, ...allowedPdfTypes];

    const filteredFiles = files.filter(f =>
      allowedTypes.includes(f.type) || /\.(png|jpe?g|webp|pdf)$/i.test(f.name)
    );

    if (filteredFiles.length < files.length) {
      alert('Only JPG, JPEG, PNG, WEBP images and PDF files are supported.');
    }

    if (filteredFiles.length === 0) return;

    setFormLoading(true);
    setFormError('');

    try {
      // Process files: WebP conversion for images, keep PDFs as is
      const processedFiles = await Promise.all(
        filteredFiles.map(async (file) => {
          const isPdfFile = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
          if (isPdfFile) {
            return {
              file,
              previewUrl: '',
              isPdf: true,
              isExisting: false
            };
          }

          try {
            const webpFile = await convertToWebP(file);
            return {
              file: webpFile,
              previewUrl: URL.createObjectURL(webpFile),
              isPdf: false,
              isExisting: false
            };
          } catch (err) {
            console.error('WebP conversion failed for:', file.name, err);
            return {
              file,
              previewUrl: URL.createObjectURL(file),
              isPdf: false,
              isExisting: false
            };
          }
        })
      );

      setPoFiles(prev => [...prev, ...processedFiles]);
    } catch (err) {
      setFormError('Failed to process one or more files.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRemovePoFile = (idxToRemove) => {
    setPoFiles(prev => {
      const list = prev || [];
      if (list[idxToRemove] && !list[idxToRemove].isPdf && !list[idxToRemove].isExisting) {
        URL.revokeObjectURL(list[idxToRemove].previewUrl);
      }
      return list.filter((_, idx) => idx !== idxToRemove);
    });
  };

  const handleEditOrderSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess(false);

    try {
      // Filter out existing and new files
      const existingPaths = poFiles.filter(f => f.isExisting).map(f => f.path);
      const newFilesToUpload = poFiles.filter(f => !f.isExisting);

      let poFilePath = '';

      if (newFilesToUpload.length > 0) {
        const selectedClientObj = clients.find(c => c.id === parseInt(clientId));
        const clientName = selectedClientObj ? selectedClientObj.name : (editingOrder?.client_name || '');

        const uploadPromises = newFilesToUpload.map(async ({ file }) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('docType', 'PO');
          if (editingOrder) formData.append('orderNo', editingOrder.id);
          if (clientName) formData.append('clientName', clientName);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to upload purchase order file');
          }
          return data.filePath;
        });

        const uploadedPaths = await Promise.all(uploadPromises);
        poFilePath = [...existingPaths, ...uploadedPaths].join(',');
      } else {
        poFilePath = existingPaths.join(',');
      }

      const res = await fetch(`/api/admin/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          orderTypeId,
          details,
          qty,
          deadlineDate,
          staff1Id,
          staff2Id,
          staff3Id,
          poNo,
          poFilePath
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order');
      }

      setFormSuccess(true);
      fetchOrdersAndData();

      setTimeout(() => {
        setShowEditModal(false);
        setFormSuccess(false);
        setEditingOrder(null);
      }, 1500);

    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteOrder = (orderId) => {
    setOrderIdToDelete(orderId);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteOrder = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderIdToDelete}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete order');
      }

      setShowDeleteModal(false);
      setOrderIdToDelete(null);
      fetchOrdersAndData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

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

      fetchOrdersAndData();
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

      fetchOrdersAndData();
    } catch (err) {
      alert(err.message);
      setConfirmRemoveFileModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleViewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

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
            Phase 2: Invoice Upload
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-brand-black tracking-tight font-sans">Client Orders</h1>
          <p className="text-zinc-500 text-xs lg:text-sm mt-1">Track and manage pipeline orders throughout production and billing workflows.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrdersAndData}
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 bg-white text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-md cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Filter & Table */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
        {/* Search header bar */}
        <div className="p-4 lg:p-6 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-zinc-50/50">
          <h2 className="text-base lg:text-lg font-bold text-brand-black font-sans">Orders Registry</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search orders, clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
            />
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="p-10 text-center text-zinc-500">
            <RefreshCw className="h-7 w-7 animate-spin mx-auto text-brand-orange mb-3" />
            <p className="text-sm">Loading client orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <p className="text-sm font-semibold">No orders registered yet.</p>
            <p className="text-xs text-zinc-400 mt-1">Use the "New Order" button to create one.</p>
          </div>
        ) : (
          <>
            {/* ── MOBILE CARD LIST ── */}
            <div className="lg:hidden divide-y divide-zinc-100">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 space-y-3">

                  {/* TOP ROW: ID + Client name + phone */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded shrink-0">#{order.id}</span>
                      <p className="font-bold text-sm text-zinc-950 truncate">{order.client_name}</p>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 pl-0.5">{order.client_phone}</p>
                  </div>

                  {/* BADGES ROW: Status + Order type + PO */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    {getStatusBadge(order.status)}
                    <span className="px-2 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange text-[9px] font-bold rounded">
                      {order.order_type_name || 'General'}
                    </span>
                    {order.po_no && (
                      <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-600 text-[9px] font-bold rounded">
                        PO: {order.po_no}
                      </span>
                    )}
                    {order.po_file_path && order.po_file_path.split(',').map((path, idx) => (
                      <a key={idx} href={path} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!/\.pdf$/i.test(path)) {
                            e.preventDefault();
                            setPreviewImageUrl(path);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[9px] text-brand-orange font-bold hover:underline">
                        <FileText className="h-2.5 w-2.5" /> PO File {idx + 1}
                      </a>
                    ))}
                  </div>

                  {/* INFO STRIP: QTY | Deadline | Created By */}
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl grid grid-cols-3 divide-x divide-zinc-200 overflow-hidden">
                    <div className="py-2.5 px-3 text-center">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">QTY</p>
                      <p className="text-base font-extrabold text-zinc-900 mt-0.5">{order.qty || '—'}</p>
                    </div>
                    <div className="py-2.5 px-3 text-center">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Deadline</p>
                      <p className="text-[10px] font-bold text-zinc-800 mt-0.5 leading-tight">{formatDate(order.deadline_date)}</p>
                    </div>
                    <div className="py-2.5 px-3 text-center">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Created By</p>
                      <p className="text-[10px] font-bold text-sky-700 mt-0.5 leading-tight break-words">{order.created_by_name || '—'}</p>
                    </div>
                  </div>

                  {/* CREW ROW — hidden on mobile */}
                  <div className="hidden flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 bg-orange-50 border border-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[10px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />Task: {order.staff_1_name}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Invoice: {order.staff_2_name}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-sky-50 border border-sky-100 text-sky-700 px-2.5 py-1 rounded-full text-[10px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />Courier: {order.staff_3_name}
                    </span>
                  </div>

                  {/* BOTTOM ACTION ROW */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleViewOrderDetails(order)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      <span>Track Flow</span>
                    </button>
                    <OrderDocumentDropdown 
                      order={order} 
                      onPreviewImage={(url) => setPreviewImageUrl(url)} 
                    />
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEditModal(order)}
                        className="p-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-brand-orange rounded-lg transition-colors cursor-pointer"
                        title="Edit Order"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-1.5 border border-zinc-200 bg-white hover:bg-red-50 text-zinc-500 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="Delete Order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* ── DESKTOP TABLE ── */}
            <div className="hidden lg:block overflow-x-auto relative min-h-[380px] pb-16">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-200">
                  <tr>
                    {/* Order ID */}
                    <th 
                      onClick={() => handleSort('id')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group w-20"
                      title={sortField === 'id' ? (sortDirection === 'asc' ? 'Order ID: Low to High' : 'Order ID: High to Low') : 'Sort by Order ID'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Order ID</span>
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

                    {/* Client / Type */}
                    <th 
                      onClick={() => handleSort('client')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'client' ? (sortDirection === 'asc' ? 'Client: A to Z' : 'Client: Z to A') : 'Sort by Client Name'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Client / Type</span>
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

                    {/* QTY */}
                    <th 
                      onClick={() => handleSort('qty')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group text-center w-16"
                      title={sortField === 'qty' ? (sortDirection === 'asc' ? 'Quantity: Low to High' : 'Quantity: High to Low') : 'Sort by Quantity'}
                    >
                      <div className="flex items-center justify-center gap-1 font-bold">
                        <span>QTY</span>
                        {sortField === 'qty' ? (
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

                    {/* Deadline / Created By */}
                    <th 
                      onClick={() => handleSort('deadline')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'deadline' ? (sortDirection === 'asc' ? 'Deadline: Earliest to Latest' : 'Deadline: Latest to Earliest') : 'Sort by Deadline Date'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Deadline / Creator</span>
                        {sortField === 'deadline' ? (
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

                    {/* Status Phase */}
                    <th 
                      onClick={() => handleSort('status')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'status' ? (sortDirection === 'asc' ? 'Status: A to Z' : 'Status: Z to A') : 'Sort by Status Phase'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Status Phase</span>
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

                    {/* Assigned Crew */}
                    <th 
                      onClick={() => handleSort('crew')}
                      className="whitespace-nowrap px-4 py-3.5 cursor-pointer select-none hover:bg-zinc-100 transition-colors group"
                      title={sortField === 'crew' ? (sortDirection === 'asc' ? 'Crew: A to Z' : 'Crew: Z to A') : 'Sort by Assigned Crew'}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Assigned Crew</span>
                        {sortField === 'crew' ? (
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
                    <th className="whitespace-nowrap px-4 py-3.5 text-right sticky right-0 bg-zinc-50 z-20 border-l border-zinc-200 shadow-[-6px_0_10px_rgba(0,0,0,0.03)] w-56">
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
                        {/* ID */}
                        <td className="whitespace-nowrap px-4 py-3.5 font-bold text-zinc-950">#{order.id}</td>

                        {/* Client / Type */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-zinc-950">{order.client_name}</div>
                          <div className="flex gap-2 items-center mt-0.5">
                            <span className="text-[11px] text-zinc-400 font-medium">{order.client_phone}</span>
                            <span className="h-1 w-1 bg-zinc-300 rounded-full" />
                            <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-brand-orange text-[9px] font-bold rounded">
                              {order.order_type_name || 'General Order'}
                            </span>
                          </div>
                          {(order.po_no || order.po_file_path) && (
                            <div className="flex items-center flex-wrap gap-1.5 mt-1 text-xs text-zinc-600">
                              {order.po_no && (
                                <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-800 text-[9px] font-mono font-semibold rounded">PO: {order.po_no}</span>
                              )}
                              {order.po_file_path && order.po_file_path.split(',').map((path, idx) => (
                                <a key={idx} href={getSafeFileUrl(path)} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!/.pdf$/i.test(path)) {
                                      e.preventDefault();
                                      setPreviewImageUrl(getSafeFileUrl(path));
                                    }
                                  }}
                                  className="text-[9px] text-brand-orange font-bold hover:underline">PO File {idx + 1} ↗</a>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* QTY */}
                        <td className="px-4 py-3.5 text-center font-bold text-zinc-900">{order.qty || '—'}</td>

                        {/* Deadline / Created By */}
                        <td className="px-4 py-3.5 text-zinc-700">
                          <div className="flex items-center gap-1 font-semibold text-zinc-900 text-xs">
                            <Calendar className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                            <span className="whitespace-nowrap">{formatDate(order.deadline_date)}</span>
                          </div>
                          {order.created_by_name && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-400">
                              <span>By:</span>
                              <span className="px-1.5 py-0.2 bg-sky-50 border border-sky-100 text-sky-700 font-bold rounded-full">{order.created_by_name}</span>
                            </div>
                          )}
                        </td>

                        {/* Status Phase */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {getStatusBadge(order.status)}
                        </td>

                        {/* Assigned Crew with Interactive Mousehover Tooltip Card */}
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
                                {isUnassigned ? 'Unassigned' : '3 Crew Members'}
                              </span>
                              <span className={`h-1.5 w-1.5 rounded-full ${isUnassigned ? 'bg-zinc-350' : 'bg-brand-orange animate-pulse'}`} />
                            </button>

                            {/* Floating Tooltip Card on Mouse Hover */}
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

                        {/* Actions: Sticky Pinned on Right */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-right sticky right-0 bg-white group-hover/row:bg-zinc-50 transition-colors z-20 border-l border-zinc-200/80 shadow-[-6px_0_10px_rgba(0,0,0,0.03)]">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleViewOrderDetails(order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs">
                              <Eye className="h-3.5 w-3.5" /><span>Track Flow</span>
                            </button>
                            <OrderDocumentDropdown 
                              order={order} 
                              onPreviewImage={(url) => setPreviewImageUrl(url)} 
                            />
                            {canEdit && (
                              <button onClick={() => handleOpenEditModal(order)}
                                title="Edit Order"
                                className="p-1.5 border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-brand-orange rounded-lg transition-colors cursor-pointer shrink-0">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDeleteOrder(order.id)}
                                title="Delete Order"
                                className="p-1.5 border border-zinc-200 bg-white hover:bg-red-50 text-zinc-700 hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* CREATE NEW ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full mx-3 sm:mx-0 shadow-2xl overflow-hidden animate-slide-up max-h-[95vh] flex flex-col">

            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold">Create New Pipeline Order</h3>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">Set client details and assign workflow stages</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form — scrollable */}
            <form onSubmit={handleCreateOrderSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-green-50 border border-green-200 text-brand-green p-3 rounded-lg flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                  <span>Order created and dispatched successfully!</span>
                </div>
              )}

              {/* Landscape Layout Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">

                {/* Left Column: Order Demand */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2 font-sans">
                    1. Client & Demand Details
                  </h4>

                  {/* Select Client & Select Order Type Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Select Client <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                      >
                        <option value="">-- Choose Client --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Order Type <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={orderTypeId}
                        onChange={(e) => setOrderTypeId(e.target.value)}
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                      >
                        <option value="">-- Choose Type --</option>
                        {orderTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Purchase Order Section — Premium card style */}
                  <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-amber-50/30 px-4 pt-3.5 pb-4">
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center h-5 w-5 rounded bg-orange-100">
                        <Receipt className="h-3 w-3 text-brand-orange" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700">Purchase Order Details</span>
                    </div>

                    {/* PO Number + Attach row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      {/* PO Number */}
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                          PO Number <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                            <FileText className="h-3.5 w-3.5 text-orange-300" />
                          </span>
                          <input
                            type="text"
                            value={poNo}
                            onChange={(e) => setPoNo(e.target.value)}
                            placeholder="e.g. PO-2026-001 (optional)"
                            className="block w-full pl-8 pr-3 py-2 border border-orange-200 rounded-lg text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange placeholder:text-zinc-300"
                          />
                        </div>
                      </div>

                      {/* Attach button */}
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                          Attach Document <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-white/80 hover:bg-orange-50 hover:border-brand-orange cursor-pointer transition-all group">
                          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-orange-100 group-hover:bg-orange-200 transition-colors shrink-0">
                            <Upload className="h-3.5 w-3.5 text-brand-orange" />
                          </div>
                          <span className="text-xs text-zinc-500 group-hover:text-zinc-700 font-medium truncate">Attach PO File</span>
                          <input
                            type="file"
                            multiple
                            accept="image/png, image/jpeg, image/jpg, image/webp, application/pdf"
                            className="hidden"
                            onChange={handlePoFilesSelect}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Attached file chips */}
                    {poFiles.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {poFiles.map((fileObj, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-full px-2.5 py-1 text-[10px] font-semibold text-zinc-700 shadow-xs cursor-pointer"
                            onClick={() => {
                              const path = fileObj.isExisting ? fileObj.path : fileObj.previewUrl;
                              if (!fileObj.isPdf) {
                                setPreviewImageUrl(path);
                              } else {
                                window.open(path, '_blank');
                              }
                            }}
                          >
                            {fileObj.isPdf ? (
                              <FileText className="h-3 w-3 text-red-500 shrink-0" />
                            ) : (
                              <img
                                src={fileObj.isExisting ? fileObj.path : fileObj.previewUrl}
                                alt=""
                                className="h-4 w-4 rounded-full object-cover border border-zinc-200 shrink-0"
                              />
                            )}
                            <span className="max-w-[80px] truncate hover:text-brand-orange transition-colors">
                              {fileObj.isPdf ? 'PDF Doc' : `Image ${idx + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePoFile(idx);
                              }}
                              className="ml-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-red-100 text-zinc-500 hover:text-red-600 transition-colors cursor-pointer text-[8px] font-bold shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Order Requirements / Details <span className="text-red-500">*</span></label>
                    <textarea
                      required
                      rows={4}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Specify ordered items, technical criteria, sizes, weights, and deliveries..."
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
                    />
                  </div>

                  {/* Quantity and Deadline Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Quantity (QTY) <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="e.g. 100 (optional)"
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange placeholder:text-zinc-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Deadline Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        required
                        value={deadlineDate}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Workflow Delegation */}
                <div className="space-y-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2 font-sans">
                    2. Pipeline Assignment (3 Staff Members)
                  </h4>

                  {/* Staff 1 Selection */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
                      <UserCheck className="h-4 w-4" />
                      Phase 1: Task Completion (Production)
                    </label>
                    <select
                      required
                      value={staff1Id}
                      onChange={(e) => setStaff1Id(e.target.value)}
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                    >
                      <option value="">-- Assign Phase 1 Staff --</option>
                      {taskStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Staff 2 Selection */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <Receipt className="h-4 w-4" />
                      Phase 2: Invoice Creation (Accounts)
                    </label>
                    <select
                      required
                      value={staff2Id}
                      onChange={(e) => setStaff2Id(e.target.value)}
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                    >
                      <option value="">-- Assign Phase 2 Staff --</option>
                      {invoiceStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Staff 3 Selection */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                      <Truck className="h-4 w-4" />
                      Phase 3: Dispatch Courier (Logistics)
                    </label>
                    <select
                      required
                      value={staff3Id}
                      onChange={(e) => setStaff3Id(e.target.value)}
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                    >
                      <option value="">-- Assign Phase 3 Staff --</option>
                      {courierStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>

                  {staff.length < 3 && (
                    <p className="text-[10px] text-red-500">
                      Ensure you have staff accounts for each of the 3 designations.
                    </p>
                  )}
                </div>

              </div>

              {/* Action buttons — sticky footer */}
              <div className="sticky bottom-0 bg-white border-t border-zinc-200 pt-3 pb-2 flex gap-2 mt-3 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-4 sm:px-6 z-10 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || clients.length === 0 || staff.length === 0}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? 'Dispatching...' : '✓ Dispatch Order'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full mx-3 sm:mx-0 shadow-2xl overflow-hidden animate-slide-up max-h-[95vh] flex flex-col">

            {/* Modal Header */}
            <div className="bg-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold">Update Pipeline Order #{editingOrder.id}</h3>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5">Modify client details and workflow stages</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOrder(null);
                }}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form — scrollable */}
            <form onSubmit={handleEditOrderSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-green-50 border border-green-200 text-brand-green p-3 rounded-lg flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                  <span>Order details updated successfully!</span>
                </div>
              )}

              {/* Landscape Layout Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">

                {/* Left Column: Order Demand */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2 font-sans">
                    1. Client & Demand Details
                  </h4>

                  {/* Select Client & Select Order Type Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Select Client</label>
                      <select
                        required
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                      >
                        <option value="">-- Choose Client --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Order Type</label>
                      <select
                        required
                        value={orderTypeId}
                        onChange={(e) => setOrderTypeId(e.target.value)}
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                      >
                        <option value="">-- Choose Type --</option>
                        {orderTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Purchase Order Section — Premium card style */}
                  <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-amber-50/30 px-4 pt-3.5 pb-4">
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center h-5 w-5 rounded bg-orange-100">
                        <Receipt className="h-3 w-3 text-brand-orange" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700">Purchase Order Details</span>
                    </div>

                    {/* PO Number + Attach row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      {/* PO Number */}
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                          PO Number <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                            <FileText className="h-3.5 w-3.5 text-orange-300" />
                          </span>
                          <input
                            type="text"
                            value={poNo}
                            onChange={(e) => setPoNo(e.target.value)}
                            placeholder="e.g. PO-2026-001 (optional)"
                            className="block w-full pl-8 pr-3 py-2 border border-orange-200 rounded-lg text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange placeholder:text-zinc-300"
                          />
                        </div>
                      </div>

                      {/* Attach button */}
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                          Attach Document <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-white/80 hover:bg-orange-50 hover:border-brand-orange cursor-pointer transition-all group">
                          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-orange-100 group-hover:bg-orange-200 transition-colors shrink-0">
                            <Upload className="h-3.5 w-3.5 text-brand-orange" />
                          </div>
                          <span className="text-xs text-zinc-500 group-hover:text-zinc-700 font-medium truncate">Attach PO File</span>
                          <input
                            type="file"
                            multiple
                            accept="image/png, image/jpeg, image/jpg, image/webp, application/pdf"
                            className="hidden"
                            onChange={handlePoFilesSelect}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Attached file chips */}
                    {poFiles.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {poFiles.map((fileObj, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-full px-2.5 py-1 text-[10px] font-semibold text-zinc-700 shadow-xs cursor-pointer"
                            onClick={() => {
                              const path = fileObj.isExisting ? fileObj.path : fileObj.previewUrl;
                              if (!fileObj.isPdf) {
                                setPreviewImageUrl(path);
                              } else {
                                window.open(path, '_blank');
                              }
                            }}
                          >
                            {fileObj.isPdf ? (
                              <FileText className="h-3 w-3 text-red-500 shrink-0" />
                            ) : (
                              <img
                                src={fileObj.isExisting ? fileObj.path : fileObj.previewUrl}
                                alt=""
                                className="h-4 w-4 rounded-full object-cover border border-zinc-200 shrink-0"
                              />
                            )}
                            <span className="max-w-[80px] truncate hover:text-brand-orange transition-colors">
                              {fileObj.isPdf ? 'PDF Doc' : `Image ${idx + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePoFile(idx);
                              }}
                              className="ml-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-red-100 text-zinc-500 hover:text-red-600 transition-colors cursor-pointer text-[8px] font-bold shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Order Requirements / Details</label>
                    <textarea
                      required
                      rows={4}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Specify ordered items, technical criteria, sizes, weights, and deliveries..."
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange resize-none"
                    />
                  </div>

                  {/* Quantity and Deadline Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Quantity (QTY) <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="e.g. 100 (optional)"
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange placeholder:text-zinc-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Deadline Date</label>
                      <input
                        type="date"
                        required
                        value={deadlineDate}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                        className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Workflow Delegation */}
                <div className="space-y-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-2 font-sans">
                    2. Pipeline Assignment (3 Staff Members)
                  </h4>

                  {/* Staff 1 Selection */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
                      <UserCheck className="h-4 w-4" />
                      Phase 1: Task Completion (Production)
                    </label>
                    <select
                      required
                      value={staff1Id}
                      onChange={(e) => setStaff1Id(e.target.value)}
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                    >
                      <option value="">-- Assign Phase 1 Staff --</option>
                      {taskStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Staff 2 Selection */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <Receipt className="h-4 w-4" />
                      Phase 2: Invoice Creation (Accounts)
                    </label>
                    <select
                      required
                      value={staff2Id}
                      onChange={(e) => setStaff2Id(e.target.value)}
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                    >
                      <option value="">-- Assign Phase 2 Staff --</option>
                      {invoiceStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Staff 3 Selection */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                      <Truck className="h-4 w-4" />
                      Phase 3: Dispatch Courier (Logistics)
                    </label>
                    <select
                      required
                      value={staff3Id}
                      onChange={(e) => setStaff3Id(e.target.value)}
                      className="block w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange"
                    >
                      <option value="">-- Assign Phase 3 Staff --</option>
                      {courierStaff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Action buttons — sticky footer */}
              <div className="sticky bottom-0 bg-white border-t border-zinc-200 pt-3 pb-2 flex gap-2 mt-3 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-4 sm:px-6 z-10 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingOrder(null);
                  }}
                  className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? 'Saving Changes...' : 'Save Order Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* VIEW ORDER TIMELINE MODAL */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-slide-up">

            <div className="bg-zinc-950 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Order Live Pipeline</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Tracking Order #{selectedOrder.id} for {selectedOrder.client_name}</p>
              </div>
              <button
                onClick={() => { setShowDetailModal(false); setShowDcHistoryModal(false); }}
                className="text-zinc-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Top Client info header */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <span className="font-semibold text-zinc-900">Demand Details:</span>
                  <div className="flex gap-4 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 px-3 py-1 rounded shadow-sm">
                    <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-brand-orange" /> Type: {selectedOrder.order_type_name || 'General Order'}</span>
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
                    <p className="mt-0.5 text-zinc-600">{selectedOrder.client_phone}</p>
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

                    <h5 className="font-extrabold text-sm text-zinc-950">
                      Production
                    </h5>

                    {/* Timeline & Edit tracking details */}
                    <div className="mt-2.5 space-y-1 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg p-2 border border-zinc-200/60">
                      <div className="flex justify-between">
                        <span>🔓 Access Opened:</span>
                        <span className="font-semibold text-zinc-700">{formatDateTime(selectedOrder.stage1_opened_at) || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🔒 Closed / Completed:</span>
                        <span className="font-semibold text-zinc-700">{formatDateTime(selectedOrder.stage1_completed_at) || '—'}</span>
                      </div>
                      {parseReuploadTimes(selectedOrder.stage1_reupload_times).map((time, idx) => (
                        <div key={idx} className="flex justify-between pl-2 text-[10px] text-amber-600 border-l border-amber-250 ml-1 mt-0.5">
                          <span>↳ Edit #{idx + 1}:</span>
                          <span className="font-semibold">{formatDateTime(time)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-zinc-200/60 pt-1 mt-1">
                        <span>🔄 Re-uploads / Edits:</span>
                        <span className={`font-bold font-mono px-1 rounded ${selectedOrder.stage1_edit_count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-650'}`}>
                          {selectedOrder.stage1_edit_count || 0}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-2">
                      <div>Assigned: <span className="font-semibold text-zinc-800">{selectedOrder.staff_1_name}</span></div>
                      {selectedOrder.received_by && (
                        <div className="text-[11px] font-semibold text-zinc-655">
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
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-white text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 shadow-2xs">
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

                    <h5 className="font-extrabold text-sm text-zinc-950">
                      Accounts Invoice
                    </h5>

                    {/* Timeline & Edit tracking details */}
                    <div className="mt-2.5 space-y-1 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg p-2 border border-zinc-200/60">
                      <div className="flex justify-between">
                        <span>🔓 Access Opened:</span>
                        <span className="font-semibold text-zinc-700">{formatDateTime(selectedOrder.stage2_opened_at) || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🔒 Closed / Completed:</span>
                        <span className="font-semibold text-zinc-700">{formatDateTime(selectedOrder.stage2_completed_at) || '—'}</span>
                      </div>
                      {parseReuploadTimes(selectedOrder.stage2_reupload_times).map((time, idx) => (
                        <div key={idx} className="flex justify-between pl-2 text-[10px] text-amber-600 border-l border-amber-250 ml-1 mt-0.5">
                          <span>↳ Edit #{idx + 1}:</span>
                          <span className="font-semibold">{formatDateTime(time)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-zinc-200/60 pt-1 mt-1">
                        <span>🔄 Re-uploads / Edits:</span>
                        <span className={`font-bold font-mono px-1 rounded ${selectedOrder.stage2_edit_count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-655'}`}>
                          {selectedOrder.stage2_edit_count || 0}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-2">
                      <div>Assigned: <span className="font-semibold text-zinc-800">{selectedOrder.staff_2_name}</span></div>

                      {selectedOrder.invoice_image_path && (
                        <div className="space-y-1.5 mt-1">
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
                                className="flex-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100/80 border border-orange-200/70 text-xs text-brand-orange font-bold transition-all shadow-2xs truncate"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">Invoice #{idx + 1}</span>
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

                    <h5 className="font-extrabold text-sm text-zinc-950">
                      Logistics Dispatch
                    </h5>

                    {/* Timeline & Edit tracking details */}
                    <div className="mt-2.5 space-y-1 text-[11px] text-zinc-500 bg-zinc-50 rounded-lg p-2 border border-zinc-200/60">
                      <div className="flex justify-between">
                        <span>🔓 Access Opened:</span>
                        <span className="font-semibold text-zinc-700">{formatDateTime(selectedOrder.stage3_opened_at) || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🔒 Closed / Completed:</span>
                        <span className="font-semibold text-zinc-700">{formatDateTime(selectedOrder.stage3_completed_at) || '—'}</span>
                      </div>
                      {parseReuploadTimes(selectedOrder.stage3_reupload_times).map((time, idx) => (
                        <div key={idx} className="flex justify-between pl-2 text-[10px] text-amber-600 border-l border-amber-250 ml-1 mt-0.5">
                          <span>↳ Edit #{idx + 1}:</span>
                          <span className="font-semibold">{formatDateTime(time)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-zinc-200/60 pt-1 mt-1">
                        <span>🔄 Re-uploads / Edits:</span>
                        <span className={`font-bold font-mono px-1 rounded ${selectedOrder.stage3_edit_count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-655'}`}>
                          {selectedOrder.stage3_edit_count || 0}
                        </span>
                      </div>
                    </div>

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

      {/* DELETE CONFIRMATION DIALOG */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setOrderIdToDelete(null);
        }}
        onConfirm={handleConfirmDeleteOrder}
        title="Delete Pipeline Order"
        message={`Are you sure you want to completely delete order #${orderIdToDelete}? \nThis will permanently remove the order record from the system registry.`}
        confirmText="Confirm & Delete"
        loading={deleteLoading}
      />

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
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
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
