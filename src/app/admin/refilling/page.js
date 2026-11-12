'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Search,
  Filter,
  CheckSquare,
  Square,
  SlidersHorizontal,
  X,
  RefreshCw,
  Building2,
  ExternalLink,
  ChevronDown,
  Layers,
  Phone,
  AlertCircle,
  Mail,
  Send,
  Zap,
  Check,
  UserX,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

export default function RefillingFollowUpPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    selectedTypeIds: [],
    allOrderTypes: [],
    automationRules: [],
    orders: [],
    counts: { total: 0, critical: 0, warning: 0, approaching: 0, safe: 0 }
  });

  // Modal State: Select Order Types
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [tempSelectedTypes, setTempSelectedTypes] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Modal State: Email Automation Settings
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [tempAutomationRules, setTempAutomationRules] = useState([]);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [automationSaveMsg, setAutomationSaveMsg] = useState('');
  const [runningAutomation, setRunningAutomation] = useState(false);

  // Selection & Email Sending State
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeSendingId, setActiveSendingId] = useState(null); // specific row sending

  // Modals for Feedback & Missing Email
  const [missingEmailModal, setMissingEmailModal] = useState(null); // { open: true, clientName, orderId }
  const [reminderResultModal, setReminderResultModal] = useState(null); // { open: true, ...results }

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAlertFilter, setActiveAlertFilter] = useState('ALL'); // 'ALL', 'CRITICAL', 'WARNING', 'APPROACHING', 'SAFE'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'COMPLETED', 'IN_PROGRESS'

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/refilling');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setTempSelectedTypes(json.selectedTypeIds || []);
        setTempAutomationRules(json.automationRules || []);
      }
    } catch (err) {
      console.error('Failed to load refilling follow-up data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open configuration modal
  const handleOpenConfigModal = () => {
    setTempSelectedTypes([...(data.selectedTypeIds || [])]);
    setSaveSuccessMsg('');
    setConfigModalOpen(true);
  };

  // Toggle single order type in modal
  const toggleTypeSelection = (typeId) => {
    const id = Number(typeId);
    setTempSelectedTypes(prev => {
      if (prev.includes(id)) {
        return prev.filter(t => t !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Select all order types
  const handleSelectAllTypes = () => {
    const allIds = (data.allOrderTypes || []).map(t => Number(t.id));
    setTempSelectedTypes(allIds);
  };

  // Deselect all order types
  const handleDeselectAllTypes = () => {
    setTempSelectedTypes([]);
  };

  // Save selected order types
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setSaveSuccessMsg('');
    try {
      const res = await fetch('/api/admin/refilling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderTypeIds: tempSelectedTypes })
      });
      const resData = await res.json();
      if (res.ok) {
        setSaveSuccessMsg('Settings saved successfully!');
        await fetchData();
        setTimeout(() => {
          setConfigModalOpen(false);
          setSaveSuccessMsg('');
        }, 800);
      } else {
        alert(resData.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Failed to save refilling config:', err);
      alert('An error occurred while saving.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Open Automation Settings Modal
  const handleOpenAutomationModal = () => {
    setTempAutomationRules([...(data.automationRules || [])]);
    setAutomationSaveMsg('');
    setAutomationModalOpen(true);
  };

  // Toggle automation rule checkbox
  const toggleAutomationRule = (ruleKey) => {
    setTempAutomationRules(prev => {
      if (prev.includes(ruleKey)) {
        return prev.filter(r => r !== ruleKey);
      } else {
        return [...prev, ruleKey];
      }
    });
  };

  // Save Automation Rules
  const handleSaveAutomation = async () => {
    setSavingAutomation(true);
    setAutomationSaveMsg('');
    try {
      const res = await fetch('/api/admin/refilling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationRules: tempAutomationRules })
      });
      const resData = await res.json();
      if (res.ok) {
        setAutomationSaveMsg('Automation rules saved successfully!');
        await fetchData();
        setTimeout(() => {
          setAutomationModalOpen(false);
          setAutomationSaveMsg('');
        }, 800);
      } else {
        alert(resData.error || 'Failed to save automation rules');
      }
    } catch (err) {
      console.error('Failed to save automation rules:', err);
      alert('An error occurred while saving.');
    } finally {
      setSavingAutomation(false);
    }
  };

  // Run Automation Now on demand
  const handleRunAutomationNow = async () => {
    setRunningAutomation(true);
    try {
      const res = await fetch('/api/admin/refilling/run-automation', {
        method: 'POST'
      });
      const resData = await res.json();
      if (res.ok) {
        setAutomationModalOpen(false);
        setReminderResultModal({
          open: true,
          ...resData
        });
      } else {
        alert(resData.message || resData.error || 'Failed to execute automation.');
      }
    } catch (err) {
      console.error('Failed to run automation:', err);
      alert('An error occurred while running automation.');
    } finally {
      setRunningAutomation(false);
    }
  };

  // Format date helper: DD-MMM-YYYY
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '-';
    }
  };

  // Filtered orders list based on search and alert filter
  const filteredOrders = useMemo(() => {
    return (data.orders || []).filter(order => {
      // Alert level filter
      if (activeAlertFilter !== 'ALL' && order.alert_level !== activeAlertFilter) {
        return false;
      }

      // Order status filter
      if (statusFilter === 'COMPLETED' && order.status !== 'COMPLETED') {
        return false;
      }
      if (statusFilter === 'IN_PROGRESS' && order.status === 'COMPLETED') {
        return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const clientMatch = (order.client_name || '').toLowerCase().includes(queryLower);
        const typeMatch = (order.order_type_name || '').toLowerCase().includes(queryLower);
        const idMatch = String(order.id).includes(queryLower);
        const phoneMatch = (order.client_phone || '').toLowerCase().includes(queryLower);
        if (!clientMatch && !typeMatch && !idMatch && !phoneMatch) {
          return false;
        }
      }

      return true;
    });
  }, [data.orders, activeAlertFilter, statusFilter, searchQuery]);

  // Master Checkbox Logic
  const allFilteredIds = useMemo(() => filteredOrders.map(o => o.id), [filteredOrders]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedOrderIds.includes(id));
  const isSomeSelected = allFilteredIds.some(id => selectedOrderIds.includes(id)) && !isAllSelected;

  const toggleSelectAllFiltered = () => {
    if (isAllSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // Send single reminder email
  const handleSendSingleReminder = async (order) => {
    const email = (order.client_email || '').trim();
    if (!email || !email.includes('@')) {
      setMissingEmailModal({
        open: true,
        clientName: order.client_name,
        orderId: order.id
      });
      return;
    }

    setActiveSendingId(order.id);
    try {
      const res = await fetch('/api/admin/refilling/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [order.id] })
      });
      const resData = await res.json();
      setReminderResultModal({
        open: true,
        ...resData
      });
    } catch (err) {
      console.error('Failed to send reminder:', err);
      alert('An error occurred while sending reminder email.');
    } finally {
      setActiveSendingId(null);
    }
  };

  // Send bulk reminder emails
  const handleSendBulkReminders = async () => {
    if (selectedOrderIds.length === 0) return;
    setSendingEmail(true);
    try {
      const res = await fetch('/api/admin/refilling/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedOrderIds })
      });
      const resData = await res.json();
      setReminderResultModal({
        open: true,
        ...resData
      });
      setSelectedOrderIds([]);
    } catch (err) {
      console.error('Failed to send bulk reminders:', err);
      alert('An error occurred while sending bulk reminder emails.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-100/70 border border-orange-200/50 flex items-center justify-center text-brand-orange">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
              Refilling Follow Up
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500">
            Track 1-year service expiry & proactive refilling alerts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-center">
          <button
            onClick={fetchData}
            title="Refresh Table"
            className="p-2.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-50 transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Email Automation Settings Button */}
          <button
            onClick={handleOpenAutomationModal}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span>Email Automation</span>
            {data.automationRules && data.automationRules.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-zinc-950 rounded-full">
                {data.automationRules.length}
              </span>
            )}
          </button>

          {/* Select Order Types Button */}
          <button
            onClick={handleOpenConfigModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-semibold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Select Order Types</span>
            {data.selectedTypeIds && data.selectedTypeIds.length > 0 && (
              <span className="px-1.5 py-0.5 text-[11px] font-bold bg-white/20 rounded-full">
                {data.selectedTypeIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Selected Order Types & Automation Pills */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1 text-xs">
        <div className="flex items-center flex-wrap gap-2">
          {data.selectedTypeIds && data.selectedTypeIds.length > 0 ? (
            <>
              <span className="font-semibold text-zinc-500">Active Follow-Up Types:</span>
              {data.allOrderTypes
                .filter(t => data.selectedTypeIds.includes(Number(t.id)))
                .map(t => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/70"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    {t.name}
                  </span>
                ))}
              <button
                onClick={handleOpenConfigModal}
                className="text-brand-orange hover:underline font-semibold cursor-pointer ml-1"
              >
                Edit
              </button>
            </>
          ) : (
            <span className="text-zinc-400 italic">No follow-up order types selected yet.</span>
          )}
        </div>

        {/* Active Automation Rules Summary */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-500">Auto Reminders:</span>
          {data.automationRules && data.automationRules.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {data.automationRules.includes('CRITICAL') && (
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold text-[11px]">
                  🔴 Red (≤5d)
                </span>
              )}
              {data.automationRules.includes('WARNING') && (
                <span className="px-2 py-0.5 rounded-md bg-[#fbf4eb] text-[#78350f] border border-[#b45309]/30 font-bold text-[11px]">
                  🟤 Brown (15d)
                </span>
              )}
              {data.automationRules.includes('APPROACHING') && (
                <span className="px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-900 border border-yellow-300/60 font-bold text-[11px]">
                  🟡 Yellow (30d)
                </span>
              )}
              <button
                onClick={handleOpenAutomationModal}
                className="text-zinc-600 hover:underline font-semibold cursor-pointer ml-1"
              >
                Configure
              </button>
            </div>
          ) : (
            <span className="text-zinc-400">
              Disabled (
              <button
                onClick={handleOpenAutomationModal}
                className="text-brand-orange hover:underline font-semibold cursor-pointer"
              >
                Enable
              </button>
              )
            </span>
          )}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by client name, order #, phone, or order type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-semibold whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-xl border border-zinc-200 bg-white text-zinc-700 focus:outline-hidden focus:border-brand-orange cursor-pointer"
            >
              <option value="ALL">All (Completed &amp; Incomplete)</option>
              <option value="COMPLETED">Completed Only</option>
              <option value="IN_PROGRESS">In Progress / Pending</option>
            </select>
          </div>
        </div>

        {/* Alert Filter Quick Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar border-t border-zinc-100">
          <span className="text-xs font-semibold text-zinc-400 mr-1 whitespace-nowrap">Alert Filter:</span>

          <button
            onClick={() => setActiveAlertFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeAlertFilter === 'ALL'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-100'
              }`}
          >
            All ({data.counts.total})
          </button>

          <button
            onClick={() => setActiveAlertFilter('CRITICAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeAlertFilter === 'CRITICAL'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/60'
              }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>&le; 5 Days ({data.counts.critical})</span>
          </button>

          <button
            onClick={() => setActiveAlertFilter('WARNING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeAlertFilter === 'WARNING'
              ? 'bg-[#78350f] text-white shadow-xs'
              : 'text-[#78350f] bg-[#fbf4eb] hover:bg-[#f5e6d6] border border-[#b45309]/40'
              }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-[#b45309]" />
            <span>6 - 15 Days ({data.counts.warning})</span>
          </button>

          <button
            onClick={() => setActiveAlertFilter('APPROACHING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeAlertFilter === 'APPROACHING'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300'
              }`}
          >
            <Calendar className="h-3.5 w-3.5 text-amber-600" />
            <span>1 Month Before ({data.counts.approaching})</span>
          </button>

          <button
            onClick={() => setActiveAlertFilter('SAFE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${activeAlertFilter === 'SAFE'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Safe &gt; 30d ({data.counts.safe})</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
            <RefreshCw className="h-7 w-7 animate-spin text-brand-orange" />
            <p className="text-sm font-semibold text-zinc-600">Loading refilling follow-up data...</p>
          </div>
        ) : (!data.selectedTypeIds || data.selectedTypeIds.length === 0) ? (
          /* Empty State: No order types selected */
          <div className="text-center py-16 px-4 max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 bg-orange-100/70 border border-orange-200/60 text-brand-orange rounded-2xl flex items-center justify-center mx-auto">
              <SlidersHorizontal className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-950">No Order Types Selected</h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Please select the order types (e.g. Fire Extinguisher Refilling, Maintenance) that require 1-year follow-up tracking.
              </p>
            </div>
            <button
              onClick={handleOpenConfigModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-semibold text-sm shadow-md shadow-orange-500/20 cursor-pointer transition-all"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Select Order Types</span>
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          /* Empty State: No matching orders */
          <div className="text-center py-16 px-4 max-w-md mx-auto space-y-3 text-zinc-500">
            <div className="h-12 w-12 bg-zinc-100 text-zinc-400 rounded-2xl flex items-center justify-center mx-auto">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-950">No Matching Orders</h3>
            <p className="text-xs text-zinc-500">
              No orders found matching your current search query or filter selection.
            </p>
            {(searchQuery || activeAlertFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveAlertFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-xs text-brand-orange hover:underline font-bold cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          /* Orders Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[11px] tracking-wider">
                  {/* Master Checkbox Header */}
                  <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      title={isAllSelected ? 'Deselect All' : 'Select All Filtered'}
                      className="cursor-pointer inline-flex items-center justify-center text-zinc-400 hover:text-brand-orange transition-colors"
                    >
                      {isAllSelected ? (
                        <div className="h-4 w-4 rounded bg-brand-orange text-white flex items-center justify-center">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      ) : isSomeSelected ? (
                        <div className="h-4 w-4 rounded bg-orange-200 border border-brand-orange flex items-center justify-center">
                          <span className="h-1.5 w-2 bg-brand-orange rounded-xs" />
                        </div>
                      ) : (
                        <div className="h-4 w-4 rounded border border-zinc-300 bg-white" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Order #</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Client Name</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Order Type</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">Qty</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Order Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Expiry Date (1 Yr)</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Alert / Status</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">Order Status</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60">
                {filteredOrders.map((order) => {
                  const isChecked = selectedOrderIds.includes(order.id);
                  const isRowSending = activeSendingId === order.id;
                  const hasEmail = Boolean(order.client_email && order.client_email.includes('@'));

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-zinc-50/80 transition-colors ${isChecked
                        ? 'bg-orange-50/40'
                        : order.alert_level === 'CRITICAL'
                          ? 'bg-red-50/20'
                          : order.alert_level === 'WARNING'
                            ? 'bg-[#fbf4eb]/30'
                            : order.alert_level === 'APPROACHING'
                              ? 'bg-yellow-50/20'
                              : ''
                        }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSelectOrder(order.id)}
                          className="cursor-pointer inline-flex items-center justify-center text-zinc-400 hover:text-brand-orange transition-colors"
                        >
                          {isChecked ? (
                            <div className="h-4 w-4 rounded bg-brand-orange text-white flex items-center justify-center">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded border border-zinc-300 bg-white hover:border-brand-orange" />
                          )}
                        </button>
                      </td>

                      {/* Order # */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2.5 py-0.5 text-xs font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-md">
                          {order.id}
                        </span>
                      </td>

                      {/* Client Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-950 leading-tight">
                            {order.client_name}
                          </p>
                          <div className="flex items-center flex-wrap gap-2 text-[11px] text-zinc-400">
                            {order.client_phone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="h-3 w-3 text-zinc-400" />
                                {order.client_phone}
                              </span>
                            )}
                            {hasEmail ? (
                              <span className="text-zinc-500 font-mono text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded">
                                {order.client_email}
                              </span>
                            ) : (
                              <span className="text-amber-600 text-[10px] font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                                No email
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Order Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                          {order.order_type_name}
                        </span>
                      </td>

                      {/* QTY */}
                      <td className="py-3.5 px-4 text-center font-bold text-zinc-800 whitespace-nowrap">
                        {order.qty}
                      </td>

                      {/* Order Date (Initiation Date) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-zinc-700 text-xs font-medium">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{formatDate(order.order_date)}</span>
                        </div>
                      </td>

                      {/* Expiry Date (1 Year later minus 1 day) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          <span className={order.alert_level === 'CRITICAL' ? 'text-red-700' : 'text-zinc-900'}>
                            {formatDate(order.expiry_date)}
                          </span>
                        </div>
                      </td>

                      {/* Alert / Countdown Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.is_expired ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-300 shadow-xs">
                            <Clock className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                            <span>Expired ({Math.abs(order.diff_days)}d ago)</span>
                          </span>
                        ) : order.alert_level === 'CRITICAL' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-50 text-red-700 border border-red-200 shadow-xs">
                            <Clock className="h-3.5 w-3.5 text-red-600 animate-pulse" />
                            <span>
                              {order.diff_days === 0
                                ? 'Expiring Today!'
                                : `${order.diff_days} day${order.diff_days > 1 ? 's' : ''} left`}
                            </span>
                          </span>
                        ) : order.alert_level === 'WARNING' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fbf4eb] text-[#78350f] border border-[#b45309]/30 shadow-2xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-[#b45309]" />
                            <span>{order.diff_days} days left</span>
                          </span>
                        ) : order.alert_level === 'APPROACHING' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                            <Calendar className="h-3.5 w-3.5 text-amber-600" />
                            <span>{order.diff_days} days left</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{order.diff_days} days left</span>
                          </span>
                        )}
                      </td>

                      {/* Current Order Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${order.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                            }`}
                        >
                          {order.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                        </span>
                      </td>

                      {/* Action Button: Send Mail Icon */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isRowSending || sendingEmail}
                          onClick={() => handleSendSingleReminder(order)}
                          title={hasEmail ? `Send reminder email to ${order.client_email}` : 'Email not available for this client'}
                          className={`inline-flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shadow-xs ${isRowSending
                            ? 'bg-orange-100 text-brand-orange animate-pulse'
                            : hasEmail
                              ? 'bg-orange-50 hover:bg-brand-orange text-brand-orange hover:text-white border border-orange-200/80 hover:border-brand-orange'
                              : 'bg-zinc-100 hover:bg-amber-100 text-zinc-400 hover:text-amber-700 border border-zinc-200 hover:border-amber-300'
                            }`}
                        >
                          {isRowSending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer Summary */}
        {!loading && filteredOrders.length > 0 && (
          <div className="px-6 py-3.5 bg-zinc-50/70 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500 font-medium">
            <span>
              Showing <strong className="text-zinc-800">{filteredOrders.length}</strong> of{' '}
              <strong className="text-zinc-800">{data.orders.length}</strong> total orders for selected types
            </span>
            <div className="flex items-center flex-wrap gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-red-600 font-bold">
                <Clock className="h-3 w-3" /> Red Alert: &le; 5 Days
              </span>
              <span className="flex items-center gap-1.5 text-[#78350f] font-bold">
                <AlertTriangle className="h-3 w-3 text-[#b45309]" /> Brown: 15 Days
              </span>
              <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                <Calendar className="h-3 w-3 text-amber-600" /> Yellow: 30 Days
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Safe: &gt; 30 Days (Green)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Bar: Send Reminder (N) */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-950/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-zinc-800 flex items-center gap-4 animate-scale-up max-w-xl w-[92%] sm:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-brand-orange text-white flex items-center justify-center font-bold text-xs">
              {selectedOrderIds.length}
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'Order' : 'Orders'} Selected
              </p>
              <p className="text-[11px] text-zinc-400">Ready to dispatch refilling reminder emails</p>
            </div>
          </div>

          <div className="h-7 w-px bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={sendingEmail}
              onClick={handleSendBulkReminders}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/30 transition-all cursor-pointer whitespace-nowrap"
            >
              {sendingEmail ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Reminder ({selectedOrderIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Missing Client Email Alert Modal */}
      {missingEmailModal && missingEmailModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-red-200 shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-red-100 text-red-600 border border-red-200 flex items-center justify-center mx-auto shadow-inner">
                <UserX className="h-7 w-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-zinc-950">
                  Email Address Not Available
                </h3>
                <p className="text-sm font-semibold text-red-600 bg-red-50 py-1.5 px-3 rounded-lg border border-red-200/60">
                  is client ki email available nahi hai
                </p>
                <p className="text-xs text-zinc-500 pt-2 leading-relaxed">
                  Client <strong className="text-zinc-800">{missingEmailModal.clientName}</strong> (Order #{missingEmailModal.orderId}) does not have an active email address registered in Client Management.
                </p>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-left text-xs text-zinc-600 space-y-1">
                <p className="font-semibold text-zinc-800 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-brand-orange" />
                  How to resolve:
                </p>
                <p className="text-[11px] text-zinc-500">
                  Navigate to <strong>Client Management</strong>, edit this client profile, and add their official email address. Once added, automated and manual follow-up reminders can be dispatched immediately.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setMissingEmailModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <Link
                  href="/admin/clients"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-semibold text-xs shadow-md shadow-orange-500/20 transition-all"
                >
                  <span>Go to Client Management</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reminder Dispatch Results Modal */}
      {reminderResultModal && reminderResultModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-100 text-brand-orange flex items-center justify-center">
                  <Mail className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-zinc-950 text-base">Reminder Dispatch Summary</h3>
              </div>
              <button
                onClick={() => setReminderResultModal(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Alert Banner: When SMTP is not configured */}
              {(reminderResultModal.smtpConfigured === false || (reminderResultModal.results || []).some(r => r.error && r.error.toLowerCase().includes('smtp'))) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs sm:text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      SMTP Server Not Configured
                    </span>
                    <Link
                      href="/admin/settings/integration"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors shrink-0 shadow-xs"
                    >
                      <span>Configure SMTP</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Aap ka SMTP email server configure nahi hai jis ki wajah se reminder email deliver nahi ho saki. Emails dispatch karne k liye pehle <strong>Settings &rarr; Integration</strong> me ja kar SMTP host aur email credentials set karein.
                  </p>
                </div>
              )}

              {/* Stat Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-xl font-extrabold text-emerald-700">
                    {reminderResultModal.sentCount || 0}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-800">Sent Successfully</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-xl font-extrabold text-amber-700">
                    {reminderResultModal.skippedCount || 0}
                  </p>
                  <p className="text-[11px] font-semibold text-amber-800">Skipped (No Email)</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-xl font-extrabold text-red-700">
                    {reminderResultModal.failedCount || 0}
                  </p>
                  <p className="text-[11px] font-semibold text-red-800">Failed / Error</p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Per-Order Breakdown:</p>
                <div className="space-y-1.5">
                  {(reminderResultModal.results || []).map((res, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${res.status === 'SENT'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : res.status === 'SKIPPED'
                          ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                          : 'bg-red-50/60 border-red-200 text-red-950'
                        }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">Order #{res.orderId}</span>
                          <span className="text-zinc-650 font-semibold">{res.clientName}</span>
                        </div>
                        {res.email && (
                          <p className="text-[11px] text-zinc-500 font-mono">{res.email}</p>
                        )}
                        {res.error && (
                          <p className="text-[11px] font-bold text-red-600">
                            {res.error}
                          </p>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${res.status === 'SENT'
                          ? 'bg-emerald-600 text-white'
                          : res.status === 'SKIPPED'
                            ? 'bg-amber-500 text-white'
                            : 'bg-red-600 text-white'
                          }`}
                      >
                        {res.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setReminderResultModal(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Email Automation Settings Modal */}
      {automationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Zap className="h-5 w-5 fill-amber-500 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-950 text-base">Refilling Email Automation</h3>
                  <p className="text-[11px] text-zinc-500">
                    Configure automated email triggers across safety alert stages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAutomationModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {automationSaveMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{automationSaveMsg}</span>
                </div>
              )}

              <p className="text-xs text-zinc-500 leading-relaxed">
                Select alert stages to automatically send client reminder emails at each deadline.
              </p>

              {/* Alert Stage Triggers Checkbox List */}
              <div className="space-y-2.5">
                {/* 1. Red Alert */}
                <label
                  onClick={() => toggleAutomationRule('CRITICAL')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${tempAutomationRules.includes('CRITICAL')
                    ? 'bg-red-50/80 border-red-300 text-red-950 font-semibold shadow-xs'
                    : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                    }`}
                >
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${tempAutomationRules.includes('CRITICAL')
                      ? 'bg-red-600 text-white'
                      : 'border border-zinc-300 bg-white'
                      }`}
                  >
                    {tempAutomationRules.includes('CRITICAL') && <CheckSquare className="h-3.5 w-3.5" />}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-red-700">🔴 Red Alert Trigger</span>
                      <span className="text-[10px] uppercase font-extrabold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        5 Days EARLY
                      </span>
                    </div>
                  </div>
                </label>

                {/* 2. Brown Alert (15 Days) */}
                <label
                  onClick={() => toggleAutomationRule('WARNING')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${tempAutomationRules.includes('WARNING')
                    ? 'bg-[#fbf4eb] border-[#b45309]/50 text-[#78350f] font-semibold shadow-xs'
                    : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                    }`}
                >
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${tempAutomationRules.includes('WARNING')
                      ? 'bg-[#78350f] text-white'
                      : 'border border-zinc-300 bg-white'
                      }`}
                  >
                    {tempAutomationRules.includes('WARNING') && <CheckSquare className="h-3.5 w-3.5" />}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#78350f]">🟤 Brown Alert Trigger</span>
                      <span className="text-[10px] uppercase font-extrabold bg-[#f3e5d7] text-[#78350f] px-2 py-0.5 rounded">
                        15-Day EARLY
                      </span>
                    </div>
                  </div>
                </label>

                {/* 3. Yellow Alert (30 Days) */}
                <label
                  onClick={() => toggleAutomationRule('APPROACHING')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${tempAutomationRules.includes('APPROACHING')
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-semibold shadow-xs'
                    : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                    }`}
                >
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${tempAutomationRules.includes('APPROACHING')
                      ? 'bg-amber-500 text-white'
                      : 'border border-zinc-300 bg-white'
                      }`}
                  >
                    {tempAutomationRules.includes('APPROACHING') && <CheckSquare className="h-3.5 w-3.5" />}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-900">🟡 Yellow Alert Trigger</span>
                      <span className="text-[10px] uppercase font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                        30-Day Early
                      </span>
                    </div>
                  </div>
                </label>
              </div>

              {/* Template Customization Link Note */}
              <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs text-zinc-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                    <SettingsIcon className="h-3.5 w-3.5 text-brand-orange" />
                    Customize Email Template:
                  </span>
                  <Link
                    href="/admin/settings/integration"
                    className="text-brand-orange hover:underline font-bold text-[11px] flex items-center gap-1"
                  >
                    <span>Edit in Settings</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Email subject &amp; body are pulled from the <strong>Integration Settings</strong> template and can be edited anytime.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={runningAutomation || tempAutomationRules.length === 0}
                onClick={handleRunAutomationNow}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {runningAutomation ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-700" />
                ) : (
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span>Trigger Automation Now</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutomationModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-650 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAutomation}
                  onClick={handleSaveAutomation}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  {savingAutomation && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Automation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Select Order Types Modal */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/60">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-100 text-brand-orange flex items-center justify-center">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-950 text-base">Select Order Types</h3>
                  <p className="text-[11px] text-zinc-500">
                    Choose which order types require 1-year refilling follow up
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Quick action buttons */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-zinc-100">
                <span className="text-zinc-500 font-semibold">
                  {tempSelectedTypes.length} of {(data.allOrderTypes || []).length} types selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllTypes}
                    className="text-brand-orange hover:underline font-bold cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllTypes}
                    className="text-zinc-500 hover:underline font-medium cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Order Types Checkbox List */}
              <div className="space-y-2">
                {(!data.allOrderTypes || data.allOrderTypes.length === 0) ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">
                    No order types available in system.
                  </p>
                ) : (
                  data.allOrderTypes.map((type) => {
                    const isChecked = tempSelectedTypes.includes(Number(type.id));
                    return (
                      <label
                        key={type.id}
                        onClick={() => toggleTypeSelection(type.id)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${isChecked
                          ? 'bg-orange-50/70 border-brand-orange/60 text-zinc-950 font-bold shadow-xs'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-5 w-5 rounded-md flex items-center justify-center transition-colors ${isChecked
                              ? 'bg-brand-orange text-white'
                              : 'border border-zinc-300 bg-white'
                              }`}
                          >
                            {isChecked && <CheckSquare className="h-3.5 w-3.5" />}
                          </div>
                          <span className="text-sm">{type.name}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs sm:text-sm font-semibold text-zinc-650 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingConfig}
                onClick={handleSaveConfig}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                {savingConfig && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Selection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
