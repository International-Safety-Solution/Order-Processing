'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  Hourglass,
  FileText,
  Image as ImageIcon,
  Truck,
  Upload,
  Lock,
  Save,
  AlertCircle,
  Download,
  CheckSquare,
  RefreshCw,
  Calendar,
  Layers,
  UserCheck
} from 'lucide-react';
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

function getKarachiDateObj(dateInput = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(dateInput);
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  const str = `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;
  return new Date(str);
}

function parsePKTDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return getKarachiDateObj(dateInput);
  }
  const formatted = dateInput.includes('T') ? dateInput : dateInput.replace(' ', 'T');
  return new Date(formatted);
}

export default function StaffDashboard() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [reuploadBufferTime, setReuploadBufferTime] = useState(20);
  const [maxReuploadCount, setMaxReuploadCount] = useState(3);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // File upload states
  const [uploadingOrder, setUploadingOrder] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({}); // { [orderId]: [{ file, previewUrl }] }
  const [editingOrders, setEditingOrders] = useState({});
  const [trackingIds, setTrackingIds] = useState({});
  const [receivedByNames, setReceivedByNames] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const handleReceivedByNameChange = (orderId, val) => {
    setReceivedByNames(prev => ({
      ...prev,
      [orderId]: val
    }));
  };

  const fetchSessionAndOrders = async (isBackground = false) => {
    if (isBackground) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // 1. Fetch session
      const userRes = await fetch('/api/auth/session');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      // 2. Fetch orders
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }

      // 3. Fetch settings
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setReuploadBufferTime(settingsData.reupload_buffer_time || 20);
        setMaxReuploadCount(settingsData.max_reupload_count !== undefined ? parseInt(settingsData.max_reupload_count) : 3);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessionAndOrders();
  }, []);

  const handleFilesSelect = async (e, orderId) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const isInvoice = user?.permissions?.phases?.accounts ?? (user?.designation === 'INVOICE_CREATION');

    // Allowed extensions check
    const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const allowedPdfTypes = ['application/pdf'];
    const allowedTypes = isInvoice ? [...allowedImageTypes, ...allowedPdfTypes] : allowedImageTypes;

    const filteredFiles = files.filter(f =>
      allowedTypes.includes(f.type) ||
      (isInvoice ? /\.(png|jpe?g|webp|pdf)$/i.test(f.name) : /\.(png|jpe?g|webp)$/i.test(f.name))
    );

    if (filteredFiles.length < files.length) {
      setErrorMessage(
        isInvoice
          ? 'Only JPG, JPEG, PNG, WEBP images and PDF documents are supported.'
          : 'Only JPG, JPEG, PNG, and WEBP image formats are supported.'
      );
    }

    if (filteredFiles.length === 0) return;

    setUploadingOrder(orderId);
    setErrorMessage('');

    try {
      // Process files: WebP conversion for images, keep PDFs as is
      const processedFiles = await Promise.all(
        filteredFiles.map(async (file) => {
          const isPdfFile = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
          if (isPdfFile) {
            return {
              file,
              previewUrl: '',
              isPdf: true
            };
          }

          try {
            const webpFile = await convertToWebP(file);
            return {
              file: webpFile,
              previewUrl: URL.createObjectURL(webpFile),
              isPdf: false
            };
          } catch (err) {
            console.error('WebP conversion failed for:', file.name, err);
            return {
              file,
              previewUrl: URL.createObjectURL(file),
              isPdf: false
            };
          }
        })
      );

      setSelectedFiles(prev => ({
        ...prev,
        [orderId]: [...(prev[orderId] || []), ...processedFiles]
      }));
    } catch (err) {
      setErrorMessage('Failed to process one or more files.');
    } finally {
      setUploadingOrder(null);
    }
  };

  const handleRemoveFile = (orderId, idxToRemove) => {
    setSelectedFiles(prev => {
      const list = prev[orderId] || [];
      if (list[idxToRemove] && !list[idxToRemove].isPdf) {
        URL.revokeObjectURL(list[idxToRemove].previewUrl);
      }
      const updatedList = list.filter((_, idx) => idx !== idxToRemove);
      return {
        ...prev,
        [orderId]: updatedList
      };
    });
  };

  const handleFilesSubmit = async (orderId, actionType) => {
    const list = selectedFiles[orderId] || [];
    if (list.length === 0) {
      setErrorMessage('Please select at least one image file.');
      return;
    }

    const currentOrder = orders.find(o => o.id === orderId);
    let receivedBy = '';
    if (actionType === 'COMPLETE_TASK_1') {
      receivedBy = (receivedByNames[orderId] !== undefined ? receivedByNames[orderId] : (currentOrder?.received_by || '')).trim();
      if (!receivedBy) {
        setErrorMessage('Please enter the name of the person who received the delivery (Received By).');
        return;
      }
    } else if (actionType === 'SAVE_DRAFT_DC') {
      receivedBy = (receivedByNames[orderId] !== undefined ? receivedByNames[orderId] : (currentOrder?.received_by || '')).trim();
    }

    setUploadingOrder(orderId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const isInvoice = actionType === 'COMPLETE_TASK_2' || actionType === 'REUPLOAD_TASK_2';
      const docType = isInvoice ? 'Invoice' : 'DC';
      const clientName = currentOrder ? currentOrder.client_name : '';

      // Upload files in parallel
      const uploadPromises = list.map(async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);
        formData.append('orderNo', orderId);
        if (clientName) formData.append('clientName', clientName);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload image file');
        }
        return data.filePath;
      });

      const filePaths = await Promise.all(uploadPromises);
      const commaSeparatedPaths = filePaths.join(',');

      // Send updates
      const updateRes = await fetch(`/api/orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          value: commaSeparatedPaths,
          receivedBy: receivedBy
        })
      });

      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        throw new Error(updateData.error || 'Failed to process order action');
      }

      if (actionType === 'SAVE_DRAFT_DC') {
        setSuccessMessage('Delivery Challan saved as draft. You can upload remaining DCs later.');
      } else {
        setSuccessMessage('Task completed successfully!');
      }
      setEditingOrders(prev => ({ ...prev, [orderId]: false }));

      // Clean preview
      setSelectedFiles(prev => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });

      fetchSessionAndOrders();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setUploadingOrder(null);
    }
  };

  const handleCompleteWithSavedDc = async (orderId) => {
    const currentOrder = orders.find(o => o.id === orderId);
    const receivedBy = (receivedByNames[orderId] !== undefined ? receivedByNames[orderId] : (currentOrder?.received_by || '')).trim();
    if (!receivedBy) {
      setErrorMessage('Please enter the name of the person who received the delivery (Received By).');
      return;
    }

    setUploadingOrder(orderId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_TASK_1',
          value: '',
          receivedBy: receivedBy
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete Stage 1');
      }

      setSuccessMessage('Stage 1 completed successfully! Re-upload buffer is now active.');
      setEditingOrders(prev => ({ ...prev, [orderId]: false }));
      setSelectedFiles(prev => {
        const updated = { ...prev };
        delete updated[orderId];
        return updated;
      });
      fetchSessionAndOrders();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setUploadingOrder(null);
    }
  };

  const handleCourierSubmit = async (orderId) => {
    const trackingId = trackingIds[orderId];
    if (!trackingId || !trackingId.trim()) {
      setErrorMessage('Please enter a valid Tracking ID');
      return;
    }

    setUploadingOrder(orderId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COMPLETE_TASK_3',
          value: trackingId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit tracking details');
      }

      setSuccessMessage('Courier dispatch tracking registered, order complete!');
      setEditingOrders(prev => ({ ...prev, [orderId]: false }));
      fetchSessionAndOrders();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setUploadingOrder(null);
    }
  };

  const handleTrackingIdChange = (orderId, val) => {
    setTrackingIds(prev => ({
      ...prev,
      [orderId]: val
    }));
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-orange mb-3" />
        <p className="text-sm">Loading your task console...</p>
      </div>
    );
  }

  const currentTab = searchParams.get('tab') || 'dashboard';

  const isTask1 = user?.permissions?.phases?.production ?? (user?.designation === 'TASK_COMPLETION');
  const isTask2 = user?.permissions?.phases?.accounts ?? (user?.designation === 'INVOICE_CREATION');
  const isTask3 = user?.permissions?.phases?.logistics ?? (user?.designation === 'INVOICE_COURIER');

  const getIsCurrentPhaseActive = (order) => {
    const isOrderStage1Active = order.status === 'PENDING_TASK';
    const isOrderStage2Active = order.status === 'PENDING_INVOICE';
    const isOrderStage3Active = order.status === 'PENDING_COURIER';

    const bufferMs = reuploadBufferTime * 60 * 1000;
    const currentKarachiTime = getKarachiDateObj(now);

    // Check if edit limit is reached for each stage
    const stage1EditCount = parseInt(order.stage1_edit_count || 0);
    const isTask1EditLimitReached = maxReuploadCount >= 0 && stage1EditCount >= maxReuploadCount;
    const elapsed1 = order.stage1_completed_at ? (currentKarachiTime - parsePKTDate(order.stage1_completed_at)) : null;
    const isBuffer1Active = elapsed1 !== null && elapsed1 < bufferMs && !isTask1EditLimitReached;

    const stage2EditCount = parseInt(order.stage2_edit_count || 0);
    const isTask2EditLimitReached = maxReuploadCount >= 0 && stage2EditCount >= maxReuploadCount;
    const elapsed2 = order.stage2_completed_at ? (currentKarachiTime - parsePKTDate(order.stage2_completed_at)) : null;
    const isBuffer2Active = elapsed2 !== null && elapsed2 < bufferMs && !isTask2EditLimitReached;

    const stage3EditCount = parseInt(order.stage3_edit_count || 0);
    const isTask3EditLimitReached = maxReuploadCount >= 0 && stage3EditCount >= maxReuploadCount;
    const elapsed3 = order.stage3_completed_at ? (currentKarachiTime - parsePKTDate(order.stage3_completed_at)) : null;
    const isBuffer3Active = elapsed3 !== null && elapsed3 < bufferMs && !isTask3EditLimitReached;

    const canAct1 = isTask1 && Number(order.assigned_staff_1_id) === Number(user?.id);
    const canAct2 = isTask2 && Number(order.assigned_staff_2_id) === Number(user?.id);
    const canAct3 = isTask3 && Number(order.assigned_staff_3_id) === Number(user?.id);

    const active1 = canAct1 && (isOrderStage1Active || (isOrderStage2Active && isBuffer1Active));
    const active2 = canAct2 && ((isOrderStage2Active && !isBuffer1Active) || (isOrderStage3Active && isBuffer2Active));
    const active3 = canAct3 && ((isOrderStage3Active && !isBuffer2Active) || (order.status === 'COMPLETED' && isBuffer3Active));

    return active1 || active2 || active3;
  };

  // Filtered lists depending on selected tab
  let displayedActiveOrders = [];
  let displayedCompletedOrders = [];

  const isOrderCompletedForStaff = (o) => {
    return o.status === 'COMPLETED' && !getIsCurrentPhaseActive(o);
  };

  // Show ALL orders assigned to this staff member — regardless of which phase the order is in.
  // Staff can track order progress at every stage; the action forms are separately gated
  // by canActPhase1/2/3 which only opens when it is their specific turn.
  const isOrderRelevantForStaff = (o) => {
    const isS1 = isTask1 && Number(o.assigned_staff_1_id) === Number(user?.id);
    const isS2 = isTask2 && Number(o.assigned_staff_2_id) === Number(user?.id);
    const isS3 = isTask3 && Number(o.assigned_staff_3_id) === Number(user?.id);
    return isS1 || isS2 || isS3;
  };

  if (currentTab === 'dashboard') {
    displayedActiveOrders = orders.filter(o => isOrderRelevantForStaff(o) && !isOrderCompletedForStaff(o));
    displayedCompletedOrders = orders.filter(o => isOrderRelevantForStaff(o) && isOrderCompletedForStaff(o));
  } else if (currentTab === 'pending') {
    displayedActiveOrders = orders.filter(o => isOrderRelevantForStaff(o) && getIsCurrentPhaseActive(o));
    displayedCompletedOrders = [];
  } else if (currentTab === 'in-progress') {
    displayedActiveOrders = orders.filter(o => isOrderRelevantForStaff(o) && !isOrderCompletedForStaff(o) && !getIsCurrentPhaseActive(o));
    displayedCompletedOrders = [];
  } else if (currentTab === 'completed') {
    displayedActiveOrders = [];
    displayedCompletedOrders = orders.filter(o => isOrderRelevantForStaff(o) && isOrderCompletedForStaff(o));
  }


  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 font-sans">
            {currentTab === 'pending'
              ? 'Your Pending Actions Queue'
              : currentTab === 'in-progress'
                ? 'Your In Progress Orders'
                : currentTab === 'completed'
                  ? 'Your Completed Task History'
                  : 'Your Assigned Tasks Queue'}
          </h1>
          <p className="text-xs text-zinc-550 mt-1">Review orders and perform workflow actions assigned to your designation.</p>
        </div>
        <button
          onClick={() => fetchSessionAndOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-lg text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-brand-orange' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-xs">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 text-brand-green rounded-lg flex items-center gap-2 text-xs">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-brand-green" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Active Work Queue */}
      {(displayedActiveOrders.length > 0 || currentTab !== 'completed') && (
        <div className="space-y-6">
          <h2 className="text-sm font-bold text-brand-orange uppercase tracking-wider font-sans">
            {currentTab === 'pending'
              ? 'Pending Assignments (Action Required)'
              : currentTab === 'in-progress'
                ? 'In Progress (Waiting for Other Phases)'
                : 'Active Assignments'}
          </h2>

          {displayedActiveOrders.length === 0 ? (
            <div className="bg-white border border-zinc-200 p-12 text-center text-zinc-500 rounded-xl shadow-sm">
              <CheckSquare className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
              <p className="text-sm font-bold text-zinc-800">
                {currentTab === 'pending'
                  ? 'No pending actions! You are all caught up.'
                  : currentTab === 'in-progress'
                    ? 'No orders are currently in progress.'
                    : 'All caught up! No active orders assigned.'}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">Admin will assign tasks as new client orders arrive.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayedActiveOrders.map((order) => {
                const isTask1 = user?.permissions?.phases?.production ?? (user?.designation === 'TASK_COMPLETION');
                const isTask2 = user?.permissions?.phases?.accounts ?? (user?.designation === 'INVOICE_CREATION');
                const isTask3 = user?.permissions?.phases?.logistics ?? (user?.designation === 'INVOICE_COURIER');

                const isOrderStage1Active = order.status === 'PENDING_TASK';
                const isOrderStage2Active = order.status === 'PENDING_INVOICE';
                const isOrderStage3Active = order.status === 'PENDING_COURIER';

                // Edit counts and limits — checked BEFORE buffer so limit-reached can cancel the buffer
                const stage1EditCount = parseInt(order.stage1_edit_count || 0);
                const stage2EditCount = parseInt(order.stage2_edit_count || 0);
                const stage3EditCount = parseInt(order.stage3_edit_count || 0);
                const isTask1EditLimitReached = maxReuploadCount >= 0 && stage1EditCount >= maxReuploadCount;
                const isTask2EditLimitReached = maxReuploadCount >= 0 && stage2EditCount >= maxReuploadCount;
                const isTask3EditLimitReached = maxReuploadCount >= 0 && stage3EditCount >= maxReuploadCount;

                // Buffer active checks — buffer is NOT active if edit limit is already reached
                const bufferMs = reuploadBufferTime * 60 * 1000;
                const currentKarachiTime = getKarachiDateObj(now);

                const elapsed1 = order.stage1_completed_at ? (currentKarachiTime - parsePKTDate(order.stage1_completed_at)) : null;
                const isBuffer1Active = elapsed1 !== null && elapsed1 < bufferMs && !isTask1EditLimitReached;

                const elapsed2 = order.stage2_completed_at ? (currentKarachiTime - parsePKTDate(order.stage2_completed_at)) : null;
                const isBuffer2Active = elapsed2 !== null && elapsed2 < bufferMs && !isTask2EditLimitReached;

                const elapsed3 = order.stage3_completed_at ? (currentKarachiTime - parsePKTDate(order.stage3_completed_at)) : null;
                const isBuffer3Active = elapsed3 !== null && elapsed3 < bufferMs && !isTask3EditLimitReached;

                // Determine effective phase based on ORDER ASSIGNMENT
                // Even if user has multiple role permissions, they can only act
                // on the specific phase they are assigned to for THIS order.
                const canActPhase1 = isTask1 && (Number(order.assigned_staff_1_id) === Number(user?.id));
                const canActPhase2 = isTask2 && (Number(order.assigned_staff_2_id) === Number(user?.id));
                const canActPhase3 = isTask3 && (Number(order.assigned_staff_3_id) === Number(user?.id));

                const isTask1Pending = canActPhase1 && order.status === 'PENDING_TASK';
                const isTask1Editing = canActPhase1 && isBuffer1Active && !!order.dc_image_path && !!editingOrders[order.id];
                const isTask1FormVisible = isTask1Pending || isTask1Editing;
                const isTask1ShowReuploadButton = canActPhase1 && isBuffer1Active && order.status === 'PENDING_INVOICE' && !editingOrders[order.id] && !isTask1EditLimitReached;

                const isTask2Editing = canActPhase2 && isBuffer2Active && !!order.invoice_image_path && !!editingOrders[order.id];
                const isTask2FormVisible = canActPhase2 && (
                  (!order.invoice_image_path && order.status === 'PENDING_INVOICE' && !isBuffer1Active) ||
                  (!!order.invoice_image_path && isBuffer2Active && !!editingOrders[order.id])
                );
                const isTask2ShowReuploadButton = canActPhase2 && isBuffer2Active && !!order.invoice_image_path && !editingOrders[order.id] && !isTask2EditLimitReached;

                const isTask3Editing = canActPhase3 && isBuffer3Active && !!order.tracking_id && !!editingOrders[order.id];
                const isTask3FormVisible = canActPhase3 && (
                  (!order.tracking_id && order.status === 'PENDING_COURIER' && !isBuffer2Active) ||
                  (!!order.tracking_id && isBuffer3Active && !!editingOrders[order.id])
                );
                const isTask3ShowReuploadButton = canActPhase3 && isBuffer3Active && !!order.tracking_id && !editingOrders[order.id] && !isTask3EditLimitReached;


                // Determine which phase is currently active for this order
                // Phase 1: DC upload needed (PENDING_TASK, or PENDING_INVOICE during buffer1)
                // Phase 2: Invoice upload needed (PENDING_INVOICE after buffer1, or PENDING_COURIER during buffer2)
                // Phase 3: Courier dispatch needed (PENDING_COURIER after buffer2, or COMPLETED during buffer3)
                const activePhase =
                  (order.status === 'PENDING_TASK') || (order.status === 'PENDING_INVOICE' && isBuffer1Active) ? 1 :
                    (order.status === 'PENDING_INVOICE' && !isBuffer1Active) || (order.status === 'PENDING_COURIER' && isBuffer2Active) ? 2 :
                      (order.status === 'PENDING_COURIER' && !isBuffer2Active) || (order.status === 'COMPLETED' && isBuffer3Active) ? 3 :
                        'completed';

                // Card is highlighted in orange when initial action is needed or they are actively editing
                const isCurrentPhaseActive =
                  (canActPhase1 && activePhase === 1) || isTask1Editing ||
                  (canActPhase2 && activePhase === 2) || isTask2Editing ||
                  (canActPhase3 && activePhase === 3) || isTask3Editing;

                // Calculate countdown text if a buffer is active for the current user's task
                let countdownText = null;
                if (canActPhase1 && isBuffer1Active && order.stage1_completed_at) {
                  const diff = bufferMs - elapsed1;
                  if (diff > 0) {
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    countdownText = `${mins}m ${secs}s`;
                  }
                } else if (canActPhase2 && isBuffer2Active && order.stage2_completed_at) {
                  const diff = bufferMs - elapsed2;
                  if (diff > 0) {
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    countdownText = `${mins}m ${secs}s`;
                  }
                } else if (canActPhase3 && isBuffer3Active && order.stage3_completed_at) {
                  const diff = bufferMs - elapsed3;
                  if (diff > 0) {
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    countdownText = `${mins}m ${secs}s`;
                  }
                }

                const chosenFiles = selectedFiles[order.id] || [];

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl overflow-hidden transition-all duration-200 group
                      ${isCurrentPhaseActive
                        ? 'border-2 border-orange-400 shadow-[0_4px_24px_-4px_rgba(249,115,22,0.25)] hover:shadow-[0_8px_32px_-4px_rgba(249,115,22,0.35)] hover:-translate-y-0.5'
                        : 'border border-zinc-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 opacity-80 hover:opacity-100'
                      }`}
                  >
                    {/* ── Card Header ── */}
                    <div className={`relative px-5 pt-4 pb-4 overflow-hidden
                      ${isCurrentPhaseActive
                        ? 'bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300'
                        : 'bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-600'
                      }`}>
                      {/* Decorative background circle */}
                      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />
                      <div className="absolute -right-2 top-8 h-10 w-10 rounded-full bg-white/5 pointer-events-none" />

                      <div className="relative flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-black/20 text-white/90 font-mono">
                              #{order.id}
                            </span>
                            {order.order_type_name && (
                              <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-white/15 text-white/80 truncate max-w-[120px]">
                                {order.order_type_name}
                              </span>
                            )}
                          </div>
                          <h3 className="font-extrabold text-white text-lg leading-tight tracking-tight">{order.client_name}</h3>
                          <p className="text-[10px] text-white/65 mt-0.5 font-medium tracking-wide">{order.client_phone}</p>
                        </div>
                        <div className="shrink-0 mt-0.5">
                          {isCurrentPhaseActive ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold bg-white text-orange-500 shadow-md">
                              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping inline-block" />
                              {countdownText ? 'RE-UPLOAD OPEN' : 'ACTION REQUIRED'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold bg-white/15 text-white/70 border border-white/20">
                              ◌ WAITING
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Phase Progress Steps */}
                      <div className="relative flex items-center mt-4 gap-0">
                        {[
                          { label: 'Production', done: !!order.stage1_completed_at, num: '1' },
                          { label: 'Accounts', done: !!order.stage2_completed_at, num: '2' },
                          { label: 'Dispatch', done: !!order.stage3_completed_at, num: '3' },
                        ].map((step, i, arr) => {
                          const isActive = !step.done && (i === 0 ? !arr[0].done : arr[i - 1].done);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center relative">
                              {/* Connector line */}
                              {i > 0 && (
                                <div className={`absolute left-0 right-1/2 top-2.5 h-px -translate-y-1/2
                                  ${arr[i - 1].done ? 'bg-white/70' : 'bg-white/25'}`} />
                              )}
                              {i < arr.length - 1 && (
                                <div className={`absolute left-1/2 right-0 top-2.5 h-px -translate-y-1/2
                                  ${step.done ? 'bg-white/70' : 'bg-white/25'}`} />
                              )}
                              {/* Step circle */}
                              <div className={`relative z-10 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold mb-1 border-2 transition-all
                                ${step.done
                                  ? 'bg-white border-white text-orange-500'
                                  : isActive
                                    ? 'bg-white/20 border-white text-white animate-pulse'
                                    : 'bg-transparent border-white/30 text-white/40'
                                }`}>
                                {step.done ? '✓' : step.num}
                              </div>
                              <span className={`text-[8px] font-semibold tracking-wide
                                ${step.done ? 'text-white' : isActive ? 'text-white/80' : 'text-white/35'}`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Info Strip ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-zinc-100 bg-zinc-50/10">
                      {/* Col 1: Quantity */}
                      <div className="flex items-center gap-2 px-4 py-3 border-r border-b sm:border-b-0 border-zinc-100">
                        <Layers className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                        <div>
                          <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-400">Quantity</span>
                          <span className="block text-sm font-extrabold text-zinc-900 leading-tight">{order.qty || '—'}</span>
                        </div>
                      </div>
                      {/* Col 2: Deadline */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b sm:border-b-0 sm:border-r border-zinc-100">
                        <Calendar className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <div>
                          <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-400">Deadline</span>
                          <span className="block text-sm font-extrabold text-zinc-900 leading-tight">{formatDate(order.deadline_date)}</span>
                        </div>
                      </div>
                      {/* Col 3: PO No. */}
                      <div className="flex items-center gap-2 px-4 py-3 border-r border-zinc-100">
                        <FileText className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-400">PO No.</span>
                          <span className="block text-xs font-extrabold text-violet-600 leading-tight truncate">
                            {order.po_no || '—'}
                          </span>
                        </div>
                      </div>
                      {/* Col 4: Created By */}
                      <div className="flex items-center gap-2 px-4 py-3">
                        <UserCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-400">Created By</span>
                          <span className="block text-xs font-extrabold text-zinc-700 leading-tight truncate">
                            {order.created_by_name || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── Demand Details ── */}
                    <div className="px-4 py-3 border-b border-zinc-100">
                      <div className="flex justify-between items-center mb-1.5">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">Order Details</p>
                        <div className="flex items-center gap-1.5">
                          {order.po_file_path && order.po_file_path.split(',').map((path, idx) => (
                            <a
                              key={idx}
                              href={getSafeFileUrl(path)}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                if (!/\.pdf$/i.test(path)) {
                                  e.preventDefault();
                                  setPreviewImageUrl(getSafeFileUrl(path));
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-brand-orange rounded text-[9px] font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <Download className="h-2.5 w-2.5" />
                              <span>Download PO {order.po_file_path.split(',').length > 1 ? `#${idx + 1}` : ''}</span>
                            </a>
                          ))}
                          <OrderDocumentDropdown
                            order={order}
                            onPreviewImage={(url) => setPreviewImageUrl(url)}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">{order.details}</p>
                    </div>

                    {/* ── Action Zone ── */}
                    <div className="bg-zinc-50 border-t border-zinc-100">
                      {/* Action zone header */}
                      <div className="px-4 pt-2.5 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isCurrentPhaseActive ? 'bg-brand-orange animate-pulse' : 'bg-zinc-300'}`} />
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                            {canActPhase1 ? 'Phase 1 · Delivery Challan Upload'
                              : canActPhase2 ? 'Phase 2 · Invoice Upload'
                                : canActPhase3 ? 'Phase 3 · Courier Dispatch'
                                  : activePhase === 1 ? 'Phase 1 · Delivery Challan Upload'
                                    : activePhase === 2 ? 'Phase 2 · Invoice Upload'
                                      : 'Phase 3 · Courier Dispatch'}
                          </p>
                        </div>
                      </div>

                      {/* Countdown Warning Banner */}
                      {countdownText && (
                        <div className="mx-4 mb-3 p-2.5 bg-orange-50 border border-orange-200 text-brand-orange rounded-xl flex items-center gap-2.5 text-[10px] font-bold animate-pulse">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
                          <span>RE-UPLOAD BUFFER ACTIVE: {countdownText} REMAINING</span>
                        </div>
                      )}

                      <div className="px-4 pb-4 space-y-2.5">

                        {/* 1. TASK_COMPLETION staff action — only show if activePhase === 1 */}
                        {canActPhase1 && activePhase === 1 && (
                          <div className="space-y-2">
                            {isTask1FormVisible ? (
                              <div className="space-y-2.5">
                                {/* Previously Saved Delivery Challans (Locked) */}
                                {(() => {
                                  const existingDcList = order.dc_image_path ? order.dc_image_path.split(',').map(s => s.trim()).filter(Boolean) : [];
                                  if (existingDcList.length === 0 || isTask1Editing) return null;
                                  return (
                                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                                          <Lock className="h-3.5 w-3.5 text-amber-600" />
                                          <span>Previously Saved Delivery Challans ({existingDcList.length})</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                                          Locked (Cannot be deleted)
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2 pt-0.5">
                                        {existingDcList.map((path, idx) => (
                                          <div
                                            key={idx}
                                            className="relative rounded-lg overflow-hidden border border-amber-200 bg-white shadow-2xs group/dc cursor-pointer"
                                            onClick={() => setPreviewImageUrl(getSafeFileUrl(path))}
                                          >
                                            <img
                                              src={getSafeFileUrl(path)}
                                              alt={`DC ${idx + 1}`}
                                              className="w-14 h-14 object-cover hover:scale-105 transition-transform"
                                            />
                                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5">
                                              DC #{idx + 1}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      <p className="text-[10px] text-amber-800/80 leading-tight">
                                        ℹ️ Uploaded in a previous partial session. You can attach additional DC pictures below, then save another draft or submit to complete.
                                      </p>
                                    </div>
                                  );
                                })()}

                                <input
                                  type="text"
                                  required
                                  value={receivedByNames[order.id] !== undefined ? receivedByNames[order.id] : (order.received_by || '')}
                                  onChange={(e) => handleReceivedByNameChange(order.id, e.target.value)}
                                  placeholder="👤 Received by (required)..."
                                  className="w-full px-3 py-2.5 border border-zinc-200 bg-white text-zinc-900 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 placeholder:text-zinc-400"
                                />

                                <label className="flex items-center gap-3 px-3 py-3 border-2 border-dashed border-zinc-200 hover:border-orange-400 bg-white hover:bg-orange-50/30 rounded-xl cursor-pointer transition-all group/upload">
                                  <div className="h-9 w-9 rounded-xl bg-orange-100 group-hover/upload:bg-orange-500 flex items-center justify-center shrink-0 transition-all">
                                    <Upload className="h-4 w-4 text-orange-500 group-hover/upload:text-white transition-colors" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-zinc-800 block">
                                      {isTask1Editing
                                        ? 'Update / Re-upload DC Pictures'
                                        : (order.dc_image_path ? 'Attach Additional / Remaining DC Pictures' : 'Upload DC Pictures')}{' '}
                                      <span className="text-red-500">*</span>
                                    </span>
                                    <span className="text-[9px] text-zinc-400">JPG · PNG · WEBP · Must include client signature</span>
                                  </div>
                                  <span className="text-zinc-300 group-hover/upload:text-orange-400 transition-colors text-lg">→</span>
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/png, image/jpeg, image/jpg, image/webp"
                                    className="hidden"
                                    disabled={uploadingOrder === order.id}
                                    onChange={(e) => handleFilesSelect(e, order.id)}
                                  />
                                </label>

                                {chosenFiles.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-zinc-200 rounded-xl">
                                      {chosenFiles.map((fileObj, idx) => (
                                        <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 shrink-0 ring-1 ring-zinc-200">
                                          <img
                                            src={fileObj.previewUrl}
                                            alt=""
                                            className="h-full w-full object-cover cursor-pointer"
                                            onClick={() => setPreviewImageUrl(fileObj.previewUrl)}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveFile(order.id, idx)}
                                            className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[8px] font-bold cursor-pointer shadow"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>

                                    {isTask1Editing ? (
                                      <button
                                        onClick={() => handleFilesSubmit(order.id, 'COMPLETE_TASK_1')}
                                        disabled={uploadingOrder === order.id}
                                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-orange-300/40 cursor-pointer active:scale-95"
                                      >
                                        {uploadingOrder === order.id ? '⏳ Uploading…' : `✓ Submit Re-upload · ${chosenFiles.length} file${chosenFiles.length > 1 ? 's' : ''}`}
                                      </button>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleFilesSubmit(order.id, 'SAVE_DRAFT_DC')}
                                          disabled={uploadingOrder === order.id}
                                          className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-xl text-xs transition-all border border-zinc-300/80 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        >
                                          <Save className="h-3.5 w-3.5 text-zinc-600" />
                                          <span>{uploadingOrder === order.id ? 'Saving…' : '💾 Save DC (Draft)'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleFilesSubmit(order.id, 'COMPLETE_TASK_1')}
                                          disabled={uploadingOrder === order.id}
                                          className="py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-orange-300/40 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        >
                                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                          <span>{uploadingOrder === order.id ? 'Submitting…' : '✓ Submit & Complete Stage 1'}</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* If no new files chosen but previous DCs exist and NOT editing */}
                                {chosenFiles.length === 0 && !isTask1Editing && !!order.dc_image_path && order.status === 'PENDING_TASK' && (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCompleteWithSavedDc(order.id)}
                                      disabled={uploadingOrder === order.id}
                                      className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-orange-300/40 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                      <span>{uploadingOrder === order.id ? 'Submitting…' : `✓ Submit & Complete Stage 1 (With Saved DCs)`}</span>
                                    </button>
                                  </div>
                                )}

                                {isTask1Editing && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrders(prev => ({ ...prev, [order.id]: false }))}
                                    className="w-full py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-xl">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-semibold text-emerald-700 block">Stage complete</span>
                                    {order.received_by && <span className="text-[9px] text-emerald-600">Received by: <b>{order.received_by}</b></span>}
                                  </div>
                                </div>

                                {isTask1ShowReuploadButton && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrders(prev => ({ ...prev, [order.id]: true }))}
                                    className="w-full py-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
                                  >
                                    <span>✏️ Re-upload / Edit</span>
                                    <span className="text-[9px] text-orange-500 font-bold font-mono">({countdownText} left)</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Task1 staff sees lock banner when order is NOT in phase 1 */}
                        {canActPhase1 && activePhase !== 1 && (
                          <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-200 px-3 py-2.5 rounded-xl">
                            <span className="text-base">🔒</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold text-zinc-500 block">
                                {activePhase === 'completed' ? 'Order fully completed.' : `Phase ${activePhase} in progress — your task is done.`}
                              </span>
                              {order.received_by && <span className="text-[9px] text-zinc-400">Received by: <b>{order.received_by}</b></span>}
                            </div>
                          </div>
                        )}

                        {/* 2. INVOICE_CREATION staff action — only show if activePhase === 2 */}
                        {canActPhase2 && activePhase === 2 && (
                          <div className="space-y-2">
                            {isTask2FormVisible ? (
                              <div className="space-y-2">
                                {order.dc_image_path && (
                                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-zinc-200 rounded-xl">
                                    <span className="w-full text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Delivery Challans to review:</span>
                                    {order.dc_image_path.split(',').map((path, idx) => (
                                      <a key={idx} href={path} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => {
                                          if (!/\.pdf$/i.test(path)) {
                                            e.preventDefault();
                                            setPreviewImageUrl(path);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 border border-orange-200 text-brand-orange text-[10px] font-bold rounded-full hover:bg-orange-100 transition-colors">
                                        <Download className="h-3 w-3" /> DC {idx + 1}
                                      </a>
                                    ))}
                                    {order.received_by && <span className="text-[9px] text-zinc-500 w-full mt-0.5">Recieved by: <b className="text-zinc-700">{order.received_by}</b></span>}
                                  </div>
                                )}
                                <label className="flex items-center gap-3 px-3 py-3 border-2 border-dashed border-zinc-200 hover:border-orange-400 bg-white hover:bg-orange-50/30 rounded-xl cursor-pointer transition-all group/upload">
                                  <div className="h-9 w-9 rounded-xl bg-orange-100 group-hover/upload:bg-orange-500 flex items-center justify-center shrink-0 transition-all">
                                    <Upload className="h-4 w-4 text-orange-500 group-hover/upload:text-white transition-colors" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-zinc-800 block">
                                      {isTask2Editing ? 'Update / Re-upload Invoice Files' : 'Upload Invoice Files'}
                                    </span>
                                    <span className="text-[9px] text-zinc-400">JPG · PNG · WEBP · PDF accepted</span>
                                  </div>
                                  <span className="text-zinc-300 group-hover/upload:text-orange-400 transition-colors text-lg">→</span>
                                  <input type="file" multiple accept="image/png, image/jpeg, image/jpg, image/webp, application/pdf" className="hidden"
                                    disabled={uploadingOrder === order.id} onChange={(e) => handleFilesSelect(e, order.id)} />
                                </label>

                                {chosenFiles.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-zinc-200 rounded-xl">
                                      {chosenFiles.map((fileObj, idx) => (
                                        <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 shrink-0 ring-1 ring-zinc-200 flex items-center justify-center">
                                          {fileObj.isPdf ? (
                                            <div className="flex flex-col items-center h-full w-full bg-red-50 justify-center">
                                              <FileText className="h-6 w-6 text-red-500" />
                                              <span className="text-[8px] font-bold text-red-600">PDF</span>
                                            </div>
                                          ) : (
                                            <img src={fileObj.previewUrl} alt="" className="h-full w-full object-cover" />
                                          )}
                                          <button type="button" onClick={() => handleRemoveFile(order.id, idx)}
                                            className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[8px] font-bold cursor-pointer shadow">✕</button>
                                        </div>
                                      ))}
                                    </div>
                                    <button onClick={() => handleFilesSubmit(order.id, 'COMPLETE_TASK_2')} disabled={uploadingOrder === order.id}
                                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-orange-300/40 cursor-pointer active:scale-95">
                                      {uploadingOrder === order.id ? '⏳ Uploading…' : `✓ Submit Invoice · ${chosenFiles.length} file${chosenFiles.length > 1 ? 's' : ''}`}
                                    </button>
                                  </div>
                                )}

                                {isTask2Editing && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrders(prev => ({ ...prev, [order.id]: false }))}
                                    className="w-full py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-xl">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                  <span className="text-xs font-semibold text-emerald-700">Stage complete — Invoice submitted.</span>
                                </div>

                                {isTask2ShowReuploadButton && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrders(prev => ({ ...prev, [order.id]: true }))}
                                    className="w-full py-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
                                  >
                                    <span>✏️ Re-upload / Edit Invoice</span>
                                    <span className="text-[9px] text-orange-500 font-bold font-mono">({countdownText} left)</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Task2 staff sees lock banner when order is NOT in phase 2 */}
                        {canActPhase2 && activePhase !== 2 && (
                          <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-200 px-3 py-2.5 rounded-xl">
                            <span className="text-base">🔒</span>
                            <span className="text-xs font-semibold text-zinc-500">
                              {activePhase === 1
                                ? 'Waiting for Phase 1 (DC upload) to complete.'
                                : activePhase === 3
                                  ? 'Your phase is done — Phase 3 in progress.'
                                  : 'Order fully completed.'}
                            </span>
                          </div>
                        )}

                        {/* 3. INVOICE_COURIER staff action — only show if activePhase === 3 */}
                        {canActPhase3 && activePhase === 3 && (
                          <div className="space-y-2">
                            {isTask3FormVisible ? (
                              <div className="space-y-2">
                                {order.invoice_image_path && (
                                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-white border border-zinc-200 rounded-xl">
                                    <span className="w-full text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Invoices:</span>
                                    {order.invoice_image_path.split(',').map((path, idx) => (
                                      <a key={idx} href={path} target="_blank" rel="noopener noreferrer"
                                        onClick={(e) => {
                                          if (!/\.pdf$/i.test(path)) {
                                            e.preventDefault();
                                            setPreviewImageUrl(path);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 border border-orange-200 text-brand-orange text-[10px] font-bold rounded-full hover:bg-orange-100 transition-colors">
                                        <Download className="h-3 w-3" /> Invoice {idx + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="🚚 TCS / Leopards Tracking ID..."
                                    value={trackingIds[order.id] || ''}
                                    onChange={(e) => handleTrackingIdChange(order.id, e.target.value)}
                                    className="flex-1 px-3 py-2.5 border border-zinc-200 bg-white text-zinc-900 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 placeholder:text-zinc-400"
                                  />
                                  <button onClick={() => handleCourierSubmit(order.id)} disabled={uploadingOrder === order.id}
                                    className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all">
                                    {uploadingOrder === order.id ? '…' : isTask3Editing ? 'Update' : '✓ Dispatch'}
                                  </button>
                                </div>

                                {isTask3Editing && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrders(prev => ({ ...prev, [order.id]: false }))}
                                    className="w-full py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-xl">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-semibold text-emerald-700 block">Stage complete — Dispatched</span>
                                    {order.tracking_id && <span className="text-[9px] text-emerald-600">Tracking ID: <b>{order.tracking_id}</b></span>}
                                  </div>
                                </div>

                                {isTask3ShowReuploadButton && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingOrders(prev => ({ ...prev, [order.id]: true }))}
                                    className="w-full py-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98"
                                  >
                                    <span>✏️ Edit Tracking ID</span>
                                    <span className="text-[9px] text-orange-500 font-bold font-mono">({countdownText} left)</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Task3 staff sees lock banner when order is NOT in phase 3 */}
                        {canActPhase3 && activePhase !== 3 && (
                          <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-200 px-3 py-2.5 rounded-xl">
                            <span className="text-base">🔒</span>
                            <span className="text-xs font-semibold text-zinc-500">
                              {activePhase === 1
                                ? 'Waiting for Phase 1 & 2 to complete.'
                                : activePhase === 2
                                  ? 'Waiting for Phase 2 (Invoice) to complete.'
                                  : 'Order fully completed.'}
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Completed History Queue */}
      {(displayedCompletedOrders.length > 0 || currentTab === 'completed' || currentTab === 'dashboard') && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider font-sans">
            {currentTab === 'completed' ? 'Completed History' : 'Completed Archive'}
          </h2>

          {displayedCompletedOrders.length === 0 ? (
            <p className="text-xs text-zinc-450 italic">No completed orders in this view.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedCompletedOrders.map((order) => (
                <div key={order.id} className="bg-white border border-zinc-200 p-4 sm:p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">

                  {/* Card Header */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="font-extrabold text-sm sm:text-base text-zinc-950 tracking-tight block truncate">
                          {order.client_name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] font-mono font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                            #{order.id}
                          </span>
                          {order.order_type_name && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-orange-50 text-brand-orange rounded border border-orange-100">
                              {order.order_type_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-brand-green rounded-full text-[10px] font-bold shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        COMPLETED
                      </span>
                    </div>

                    <p className="text-xs text-zinc-650 leading-relaxed font-normal">{order.details}</p>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-zinc-100 text-[11px] text-zinc-550 font-medium">
                    <div>
                      <span className="text-zinc-400">Quantity:</span> <span className="font-bold text-zinc-805">{order.qty || '0'}</span>
                    </div>
                    {order.created_by_name && (
                      <div>
                        <span className="text-zinc-400">Created By:</span> <span className="font-bold text-orange-500 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full text-[9px]">{order.created_by_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Workflow Deliverables Badges */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-zinc-100">

                    {/* PO File Deliverable */}
                    {order.po_no && (
                      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-[10px] font-bold text-zinc-700">
                        <span>PO: {order.po_no}</span>
                        {order.po_file_path && order.po_file_path.split(',').map((path, idx) => (
                          <a
                            key={idx}
                            href={path}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!/\.pdf$/i.test(path)) {
                                e.preventDefault();
                                setPreviewImageUrl(path);
                              }
                            }}
                            className="inline-flex items-center justify-center p-1 bg-white hover:bg-orange-50 border border-zinc-200 hover:border-brand-orange text-zinc-400 hover:text-brand-orange rounded transition-colors shadow-xs cursor-pointer"
                            title={`Download PO File ${idx + 1}`}
                          >
                            <Download className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* DC Deliverable */}
                    {order.dc_image_path && (
                      <div className="flex flex-col gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-[10px] text-zinc-700 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Delivery Challan</span>
                          {order.dc_image_path.split(',').map((path, idx) => (
                            <a
                              key={idx}
                              href={path}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                if (!/\.pdf$/i.test(path)) {
                                  e.preventDefault();
                                  setPreviewImageUrl(path);
                                }
                              }}
                              className="inline-flex items-center justify-center p-1 bg-white hover:bg-orange-50 border border-zinc-200 hover:border-brand-orange text-zinc-400 hover:text-brand-orange rounded transition-colors shadow-xs cursor-pointer"
                              title={`View DC Image ${idx + 1}`}
                            >
                              <Download className="h-2.5 w-2.5" />
                            </a>
                          ))}
                        </div>
                        {order.received_by && (
                          <span className="text-[9px] text-zinc-500 truncate pl-3">
                            Rcvd by: <b className="text-zinc-700 font-semibold">{order.received_by}</b>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Invoice Deliverable */}
                    {order.invoice_image_path && (
                      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-[10px] font-bold text-zinc-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Invoice</span>
                        {order.invoice_image_path.split(',').map((path, idx) => (
                          <a
                            key={idx}
                            href={path}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!/\.pdf$/i.test(path)) {
                                e.preventDefault();
                                setPreviewImageUrl(path);
                              }
                            }}
                            className="inline-flex items-center justify-center p-1 bg-white hover:bg-orange-50 border border-zinc-200 hover:border-brand-orange text-zinc-400 hover:text-brand-orange rounded transition-colors shadow-xs cursor-pointer"
                            title={`View Invoice ${idx + 1}`}
                          >
                            <Download className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Courier Dispatch Deliverable */}
                    {order.tracking_id && (
                      <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 text-[10px] font-bold text-zinc-700">
                        <Truck className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                        <span className="text-zinc-500 font-semibold">TCS Trk:</span>
                        <span className="text-brand-orange font-extrabold">{order.tracking_id}</span>
                      </div>
                    )}

                  </div>

                </div>
              ))}
            </div>
          )}
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

