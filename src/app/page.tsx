"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Send,
  Users,
  Radio,
  FileText,
  History,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Phone,
  MapPin,
  Smartphone,
  Plus,
  Upload,
  Trash2,
  Edit2,
  Pencil,
  Copy,
  Lock,
  LogOut,
  User,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";

interface LocalityStat {
  name: string;
  count: number;
}

interface Template {
  id: string;
  title: string;
  category: string;
  content: string;
}

interface Constituent {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  electoral_area: string;
  gender?: string;
  occupation?: string;
}

interface Campaign {
  id: string;
  title: string;
  sender_id: string;
  message: string;
  target_type: string;
  target_localities: string[];
  total_recipients: number;
  successful_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

export default function Home() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App Tabs & States
  const [activeTab, setActiveTab] = useState<"broadcast" | "constituents" | "templates" | "history">("broadcast");
  const [stats, setStats] = useState<{
    balance: number;
    balanceAccount: string;
    totalConstituents: number;
    totalCampaigns: number;
    totalMessagesSent: number;
    localities: LocalityStat[];
  } | null>(null);

  const [loadingStats, setLoadingStats] = useState(true);

  // Broadcast Form State
  const [campaignTitle, setCampaignTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "localities" | "custom">("all");
  const [selectedLocalities, setSelectedLocalities] = useState<string[]>([]);
  const [customNumbers, setCustomNumbers] = useState("");
  const [senderId, setSenderId] = useState("KOBBYMP");
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<any>(null);
  const [sendError, setSendError] = useState("");

  // Test SMS State
  const [testPhone, setTestPhone] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateCategory, setTemplateCategory] = useState("General");
  const [templateContent, setTemplateContent] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Constituents list tab
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [selectedLocalityFilter, setSelectedLocalityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalConstituentsCount, setTotalConstituentsCount] = useState(0);
  const [isLoadingConstituents, setIsLoadingConstituents] = useState(false);

  // Add Constituent Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newArea, setNewArea] = useState("Amanful West");

  // Bulk Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importAreaDefault, setImportAreaDefault] = useState("Amanful West");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Edit Constituent Modal State
  const [editingConstituent, setEditingConstituent] = useState<Constituent | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editArea, setEditArea] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Campaigns & Logs tab
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Character calculation
  const charCount = message.length;
  const isUnicode = /[^\u0000-\u00ff]/.test(message);
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;
  const pageCount = charCount === 0 ? 0 : charCount <= singleLimit ? 1 : Math.ceil(charCount / multiLimit);
  const remainingInPage = charCount === 0 ? singleLimit : (pageCount * (pageCount === 1 ? singleLimit : multiLimit)) - charCount;

  // Compute estimated audience size
  const estimatedAudience =
    targetType === "all"
      ? stats?.totalConstituents || 0
      : targetType === "localities"
      ? (stats?.localities || [])
          .filter((l) => selectedLocalities.includes(l.name))
          .reduce((sum, curr) => sum + curr.count, 0)
      : customNumbers
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 9).length;

  // Verify Auth Status
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated === true);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      setIsAuthenticated(true);
      fetchStats();
      fetchTemplates();
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      setIsAuthenticated(false);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateTitle("");
    setTemplateCategory("General");
    setTemplateContent("");
    setShowTemplateModal(true);
  };

  const handleOpenEditTemplate = (tpl: Template) => {
    setEditingTemplate(tpl);
    setTemplateTitle(tpl.title);
    setTemplateCategory(tpl.category || "General");
    setTemplateContent(tpl.content);
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim() || !templateContent.trim()) {
      alert("Please enter template title and message content.");
      return;
    }

    try {
      setIsSavingTemplate(true);
      const isEdit = !!editingTemplate;
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit
        ? { id: editingTemplate.id, title: templateTitle, category: templateCategory, content: templateContent }
        : { title: templateTitle, category: templateCategory, content: templateContent };

      const res = await fetch("/api/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");

      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateTitle("");
      setTemplateContent("");
      fetchTemplates();
      alert(isEdit ? "Template updated successfully!" : "Template created successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the template "${title}"?`)) {
      return;
    }

    try {
      setDeletingTemplateId(id);
      const res = await fetch(`/api/templates?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete template");

      fetchTemplates();
    } catch (err: any) {
      alert(err.message || "Failed to delete template");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const fetchConstituents = async () => {
    try {
      setIsLoadingConstituents(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });
      if (selectedLocalityFilter !== "all") {
        params.set("locality", selectedLocalityFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      const res = await fetch(`/api/constituents?${params.toString()}`);
      const data = await res.json();
      setConstituents(data.constituents || []);
      setTotalConstituentsCount(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingConstituents(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setRecentLogs(data.recentLogs || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchTemplates();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === "constituents") {
        fetchConstituents();
      } else if (activeTab === "history") {
        fetchHistory();
      }
    }
  }, [activeTab, page, selectedLocalityFilter, searchQuery, isAuthenticated]);

  // Handle Send Bulk Message
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError("");
    setSendSuccess(null);

    if (!message.trim()) {
      setSendError("Please enter message text to broadcast.");
      return;
    }

    if (targetType === "localities" && selectedLocalities.length === 0) {
      setSendError("Please select at least one Takoradi locality or electoral area.");
      return;
    }

    if (targetType === "custom" && !customNumbers.trim()) {
      setSendError("Please enter recipient phone numbers.");
      return;
    }

    const confirmMsg = `Are you sure you want to broadcast this message to ${estimatedAudience} constituent(s) using Sender ID "${senderId}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSending(true);
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: campaignTitle || `Broadcast - ${new Date().toLocaleDateString("en-GB")}`,
          message,
          target_type: targetType,
          target_localities: selectedLocalities,
          custom_numbers: customNumbers,
          sender_id: senderId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to broadcast SMS");
      }

      setSendSuccess(data);
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
      });
      fetchStats();
    } catch (err: any) {
      setSendError(err.message || "Failed to broadcast message");
    } finally {
      setIsSending(false);
    }
  };

  // Handle Send Test
  const handleSendTest = async () => {
    if (!testPhone.trim() || !message.trim()) {
      alert("Please provide both a test phone number and a message.");
      return;
    }

    try {
      setIsSendingTest(true);
      setTestResult(null);
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhone,
          message,
          sender_id: senderId,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      fetchStats();
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleAddConstituent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/constituents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newFirstName,
          last_name: newLastName,
          phone_number: newPhone,
          electoral_area: newArea,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAddModal(false);
      setNewFirstName("");
      setNewLastName("");
      setNewPhone("");
      fetchConstituents();
      fetchStats();
      alert("Constituent saved successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to save constituent");
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportResult(null);

    // Parse pasted lines: e.g. "Kofi, Mensah, 0244123456, Beach Road" or "0244123456"
    const lines = importText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      alert("Please enter constituent data or upload a CSV file to import.");
      return;
    }

    const records = lines.map((line) => {
      const parts = line.split(/[,\t]+/).map((p) => p.trim());
      if (parts.length === 1) {
        // Just phone number
        return {
          first_name: "Constituent",
          last_name: "",
          phone_number: parts[0],
          electoral_area: importAreaDefault,
        };
      } else if (parts.length === 2) {
        // Name, Phone
        const nameParts = parts[0].split(" ");
        return {
          first_name: nameParts[0] || "Constituent",
          last_name: nameParts.slice(1).join(" ") || "",
          phone_number: parts[1],
          electoral_area: importAreaDefault,
        };
      } else {
        // First Name, Last Name, Phone, Locality
        return {
          first_name: parts[0],
          last_name: parts[1],
          phone_number: parts[2],
          electoral_area: parts[3] || importAreaDefault,
        };
      }
    });

    try {
      setIsImporting(true);
      const res = await fetch("/api/constituents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk import failed");

      setImportResult({
        success: true,
        count: data.importedCount || records.length,
      });

      fetchConstituents();
      fetchStats();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch (err: any) {
      setImportResult({ success: false, error: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleOpenEdit = (c: Constituent) => {
    setEditingConstituent(c);
    setEditFirstName(c.first_name || "");
    setEditLastName(c.last_name || "");
    setEditPhone(c.phone_number || "");
    setEditArea(c.electoral_area || "Other");
  };

  const handleUpdateConstituent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConstituent) return;

    try {
      setIsUpdating(true);
      const res = await fetch("/api/constituents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingConstituent.id,
          first_name: editFirstName,
          last_name: editLastName,
          phone_number: editPhone,
          electoral_area: editArea,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEditingConstituent(null);
      fetchConstituents();
      fetchStats();
      alert("Constituent updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update constituent");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteConstituent = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name} from the constituency directory?`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/constituents?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      fetchConstituents();
      fetchStats();
    } catch (err: any) {
      alert(err.message || "Failed to delete constituent");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleLocality = (localityName: string) => {
    setSelectedLocalities((prev) =>
      prev.includes(localityName)
        ? prev.filter((item) => item !== localityName)
        : [...prev, localityName]
    );
  };

  const selectAllLocalities = () => {
    if (stats?.localities) {
      setSelectedLocalities(stats.localities.map((l) => l.name));
    }
  };

  const clearLocalities = () => {
    setSelectedLocalities([]);
  };

  // Initial loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#fbf9f5] flex items-center justify-center text-stone-600">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-600 mr-2" />
        <span className="font-medium text-sm">Verifying security credentials...</span>
      </div>
    );
  }

  // LOGIN SCREEN: Elegant White, Off-white & Cream Palette
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fbf9f5] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white border border-[#eae3d2] shadow-xl shadow-[#eae3d2]/40 rounded-3xl p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-[#efe7d3] shadow-md mb-4 bg-[#f8f5ee]">
              <Image
                src="/mp-portrait.jpeg"
                alt="Hon. Kwabena Okyere Darko-Mensah"
                fill
                className="object-cover"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ece1] border border-[#e5d8c3] text-stone-700 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Takoradi MP Portal
            </div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Administrative Access
            </h1>
            <p className="text-xs text-stone-500 mt-1 max-w-xs">
              Constituency Messaging Platform for Hon. Kwabena Okyere Darko-Mensah
            </p>
          </div>

          {loginError && (
            <div className="mt-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Admin Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter administrator username"
                  className="w-full bg-[#faf7f2] border border-[#e8dfcf] focus:border-amber-700 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter secure password"
                  className="w-full bg-[#faf7f2] border border-[#e8dfcf] focus:border-amber-700 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-[#faf7f2] font-semibold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  Verifying...
                </>
              ) : (
                <>
                  <span>Sign In to SMS Gateway</span>
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#f0e9dc] text-center">
            <span className="text-[11px] text-stone-400 font-medium">
              Official Sender ID: <strong className="text-stone-700">KOBBYMP</strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // MAIN PORTAL: Warm Off-White, Cream, and Soft Sand Theme
  return (
    <div className="flex flex-col min-h-screen bg-[#fbf9f5] text-stone-800">
      {/* Header Bar */}
      <header className="border-b border-[#eae3d2] bg-white/90 backdrop-blur sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#d9ccb6] shadow-sm bg-[#faf6ee]">
              <Image
                src="/mp-portrait.jpeg"
                alt="Hon. Kwabena Okyere Darko-Mensah"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-stone-900 tracking-tight">
                  KOBBYMP
                </span>
                <span className="bg-[#f2ebe0] text-stone-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-[#e3d7c3]">
                  Takoradi Constituency
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Hon. Kwabena Okyere Darko-Mensah • Constituent Bulk SMS Tool
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Gateway Balance Card */}
            <div className="bg-[#fbf9f4] border border-[#e5dccb] rounded-xl px-4 py-2 flex items-center gap-3 shadow-xs">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-800 border border-emerald-200">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  SMS Gateway Balance
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-stone-900">
                    {loadingStats ? "..." : (stats?.balance ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-stone-500">Credits</span>
                  <button
                    onClick={fetchStats}
                    title="Refresh Balance"
                    className="text-stone-400 hover:text-stone-700 transition-colors ml-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition border border-stone-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-[#eee7d8] overflow-x-auto">
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`py-3 px-4 font-semibold text-xs tracking-wide uppercase flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "broadcast"
                ? "border-stone-900 text-stone-900 bg-[#f7f2e7]"
                : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-[#fbf9f4]"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Send Broadcast
          </button>
          <button
            onClick={() => setActiveTab("constituents")}
            className={`py-3 px-4 font-semibold text-xs tracking-wide uppercase flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "constituents"
                ? "border-stone-900 text-stone-900 bg-[#f7f2e7]"
                : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-[#fbf9f4]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Constituents & Localities ({stats?.totalConstituents || 0})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`py-3 px-4 font-semibold text-xs tracking-wide uppercase flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "templates"
                ? "border-stone-900 text-stone-900 bg-[#f7f2e7]"
                : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-[#fbf9f4]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Message Templates
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 font-semibold text-xs tracking-wide uppercase flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "history"
                ? "border-stone-900 text-stone-900 bg-[#f7f2e7]"
                : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-[#fbf9f4]"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Delivery Logs & History
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: BROADCAST MESSAGING */}
        {activeTab === "broadcast" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 8 Cols: Composer Form */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-[#eae2d0] rounded-3xl p-6 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between pb-5 border-b border-[#f1eae0]">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                      <Send className="w-5 h-5 text-amber-700" />
                      Compose Constituency Message
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">
                      Deliver official announcements, townhall invitations, and community alerts straight to constituents.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-[#f8f4ec] px-3 py-1.5 rounded-xl border border-[#e5dac5]">
                    <span className="text-xs text-stone-500">Sender ID:</span>
                    <span className="text-xs font-mono font-bold text-stone-900">
                      {senderId}
                    </span>
                  </div>
                </div>

                {sendSuccess && (
                  <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-900">
                        Broadcast Completed Successfully!
                      </p>
                      <p className="text-xs mt-1 text-emerald-700">
                        Dispatched to {sendSuccess.successful} recipient(s) out of {sendSuccess.total} targeted.
                      </p>
                    </div>
                  </div>
                )}

                {sendError && (
                  <div className="mt-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-rose-900">Broadcast Error</p>
                      <p className="text-xs mt-1 text-rose-700">{sendError}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendBroadcast} className="mt-6 space-y-6">
                  {/* Campaign Title / Reference */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                      Campaign Subject / Internal Reference
                    </label>
                    <input
                      type="text"
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      placeholder="e.g. Takoradi Road Rehabilitation Update or Kundu Festival Greetings"
                      className="w-full bg-[#fcfbf8] border border-[#e8dfcf] rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-stone-800 transition"
                    />
                  </div>

                  {/* Audience Targeting Modes */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                      Target Audience Segment
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setTargetType("all")}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          targetType === "all"
                            ? "bg-[#f5ede0] border-[#d8c7ad] shadow-xs"
                            : "bg-[#fcfbf9] border-[#e8dfcf] text-stone-600 hover:border-[#d9cbba]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-stone-900">All Constituents</span>
                          <Users className="w-4 h-4 text-stone-700" />
                        </div>
                        <p className="text-xs text-stone-500">
                          Reach all registered constituents across 17 Takoradi localities ({stats?.totalConstituents || 0}).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetType("localities")}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          targetType === "localities"
                            ? "bg-[#f5ede0] border-[#d8c7ad] shadow-xs"
                            : "bg-[#fcfbf9] border-[#e8dfcf] text-stone-600 hover:border-[#d9cbba]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-stone-900">By Localities</span>
                          <MapPin className="w-4 h-4 text-stone-700" />
                        </div>
                        <p className="text-xs text-stone-500">
                          Select specific electoral areas like Amanful, Zenith, Beach Road, etc.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetType("custom")}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          targetType === "custom"
                            ? "bg-[#f5ede0] border-[#d8c7ad] shadow-xs"
                            : "bg-[#fcfbf9] border-[#e8dfcf] text-stone-600 hover:border-[#d9cbba]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-stone-900">Custom Numbers</span>
                          <Smartphone className="w-4 h-4 text-stone-700" />
                        </div>
                        <p className="text-xs text-stone-500">
                          Paste or enter specific numbers (committee members, elders, etc.).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Locality Multi-select Pills */}
                  {targetType === "localities" && (
                    <div className="p-4 bg-[#f8f5ee] border border-[#e8ded0] rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700">
                          Select Takoradi Electoral Areas ({selectedLocalities.length} selected)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selectAllLocalities}
                            className="text-[11px] font-semibold text-amber-800 hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-stone-300">|</span>
                          <button
                            type="button"
                            onClick={clearLocalities}
                            className="text-[11px] text-stone-500 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                        {(stats?.localities || []).map((loc) => {
                          const isSelected = selectedLocalities.includes(loc.name);
                          return (
                            <button
                              key={loc.name}
                              type="button"
                              onClick={() => toggleLocality(loc.name)}
                              className={`text-xs px-3 py-1.5 rounded-xl border font-medium flex items-center gap-2 transition-all ${
                                isSelected
                                  ? "bg-stone-900 text-white border-stone-900"
                                  : "bg-white border-[#e5d9c7] text-stone-700 hover:border-[#cbba9f]"
                              }`}
                            >
                              <span>{loc.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                  isSelected ? "bg-stone-700 text-stone-200" : "bg-[#f2ebe0] text-stone-600"
                                }`}
                              >
                                {loc.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom Numbers Textarea */}
                  {targetType === "custom" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                        Recipient Numbers (Comma or Newline separated)
                      </label>
                      <textarea
                        rows={3}
                        value={customNumbers}
                        onChange={(e) => setCustomNumbers(e.target.value)}
                        placeholder="024XXXXXXX, 055XXXXXXX, 020XXXXXXX"
                        className="w-full bg-[#fcfbf8] border border-[#e8dfcf] rounded-xl px-4 py-2.5 text-sm text-stone-900 font-mono focus:outline-none focus:border-stone-800"
                      />
                    </div>
                  )}

                  {/* Message Composer & Character Stats */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                        SMS Content
                      </label>
                      <div className="flex items-center gap-3 text-xs text-stone-500">
                        <span>
                          Characters: <strong className="text-stone-900">{charCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Pages:{" "}
                          <strong className={pageCount > 1 ? "text-amber-800 font-bold" : "text-emerald-700 font-bold"}>
                            {pageCount}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>{remainingInPage} left in page</span>
                      </div>
                    </div>

                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message here. You can use {name} for personalizing each constituent's name..."
                      className="w-full bg-[#fcfbf8] border border-[#e8dfcf] rounded-2xl p-4 text-sm text-stone-900 focus:outline-none focus:border-stone-800 transition leading-relaxed"
                    />

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                      <p>
                        Tip: Place <code>{"{name}"}</code> to auto-personalize greetings (e.g. &quot;Dear {"{name}"}...&quot;)
                      </p>
                      <span className="font-semibold text-stone-700">Official Sender ID: KOBBYMP</span>
                    </div>
                  </div>

                  {/* Quick Template Picker */}
                  <div>
                    <span className="text-xs font-semibold text-stone-600 block mb-2">
                      Load Message Template:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {templates.slice(0, 4).map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setMessage(tpl.content);
                            setCampaignTitle(tpl.title);
                          }}
                          className="p-3 text-left bg-[#fcfbf9] border border-[#e8dfcf] rounded-xl hover:border-stone-400 hover:bg-[#f6efe4] transition text-xs group"
                        >
                          <div className="font-semibold text-stone-800 group-hover:text-stone-900">
                            {tpl.title}
                          </div>
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            {tpl.content}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submission Action */}
                  <div className="pt-4 border-t border-[#f1eae0] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm">
                      <span className="text-stone-500">Audience: </span>
                      <strong className="text-stone-900 text-base font-bold">
                        {estimatedAudience.toLocaleString()} Constituents
                      </strong>
                    </div>

                    <button
                      type="submit"
                      disabled={isSending || estimatedAudience === 0}
                      className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          Sending via KOBBYMP...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-amber-400" />
                          Broadcast via KOBBYMP
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right 4 Cols: Phone Preview & Test Send */}
            <div className="lg:col-span-4 space-y-6">
              {/* Smartphone Preview Mockup */}
              <div className="bg-white border border-[#eae2d0] rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-[#f1eae0] mb-4">
                  <h3 className="font-bold text-sm text-stone-800 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-stone-600" />
                    Recipient SMS Preview
                  </h3>
                  <span className="text-[10px] uppercase font-mono bg-[#f4ede0] px-2 py-0.5 rounded text-stone-700 font-semibold">
                    KOBBYMP
                  </span>
                </div>

                {/* iPhone style bubble with off-white and cream tones */}
                <div className="mx-auto w-full max-w-[280px] bg-[#fbf9f5] rounded-3xl border border-[#e2d6c3] p-4 shadow-sm relative">
                  <div className="w-14 h-2.5 bg-[#e5dbc9] rounded-full mx-auto mb-3"></div>
                  <div className="text-center pb-2 border-b border-[#ece3d3] mb-3">
                    <p className="text-[11px] font-bold text-stone-900 font-mono">
                      KOBBYMP
                    </p>
                    <p className="text-[9px] text-stone-500">Takoradi Constituency MP</p>
                  </div>

                  <div className="min-h-[140px] flex flex-col justify-end">
                    <div className="bg-[#efe7d6] text-stone-800 rounded-2xl rounded-tl-none p-3.5 text-xs leading-relaxed border border-[#e2d5bf] shadow-xs">
                      {message || (
                        <span className="text-stone-400 italic">
                          Message text will appear here as it will display on constituent phones...
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-stone-400 text-right mt-1.5">Just now</div>
                  </div>
                </div>

                {/* Test SMS Box */}
                <div className="mt-6 pt-5 border-t border-[#f1eae0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-700">
                      Send Quick Test Message
                    </span>
                    <span className="text-[10px] text-stone-400">1 credit</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="Enter mobile (e.g. 0244123456)"
                      className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-stone-800"
                    />

                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={isSendingTest || !message.trim()}
                      className="w-full py-2.5 bg-[#f5ede0] hover:bg-[#ece2d1] text-stone-800 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 border border-[#dfd2be] disabled:opacity-50"
                    >
                      {isSendingTest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Sending Test...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-stone-700" />
                          Send Test to My Phone
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl text-xs border ${
                        testResult.success
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50 border-rose-200 text-rose-800"
                      }`}
                    >
                      {testResult.success ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Delivered successfully via KOBBYMP!</span>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold">Test failed:</p>
                          <p className="text-[11px] opacity-90">{testResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Takoradi MP Profile Card */}
              <div className="bg-white border border-[#eae2d0] rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-[#d9ccb6]">
                    <Image
                      src="/mp-portrait.jpeg"
                      alt="MP Takoradi"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">
                      Hon. Kwabena Okyere Darko-Mensah
                    </h4>
                    <p className="text-xs text-amber-800 font-medium">Member of Parliament, Takoradi</p>
                  </div>
                </div>
                <p className="text-xs text-stone-500 mt-3 leading-relaxed">
                  Direct SMS channel ensuring consistent, transparent, and direct communication with all residents and constituents across Sekondi-Takoradi Metropolis.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONSTITUENTS & LOCALITIES DIRECTORY */}
        {activeTab === "constituents" && (
          <div className="space-y-6">
            {/* Top filter & action bar */}
            <div className="bg-white border border-[#eae2d0] rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by name or phone..."
                    className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl pl-9 pr-4 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                  />
                </div>

                <select
                  value={selectedLocalityFilter}
                  onChange={(e) => {
                    setSelectedLocalityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-stone-800"
                >
                  <option value="all">All Localities ({stats?.totalConstituents || 0})</option>
                  {(stats?.localities || []).map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name} ({loc.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#f4ede0] hover:bg-[#eae0cf] text-stone-800 font-semibold text-sm flex items-center gap-2 transition border border-[#e4d6c0]"
                >
                  <Upload className="w-4 h-4 text-stone-600" />
                  Import / Bulk Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm flex items-center gap-2 transition shadow-xs"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  Register Constituent
                </button>
              </div>
            </div>

            {/* Constituents Table */}
            <div className="bg-white border border-[#eae2d0] rounded-3xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#f1eae0] flex items-center justify-between">
                <h3 className="font-bold text-sm text-stone-900">
                  Constituent Directory ({totalConstituentsCount.toLocaleString()} total)
                </h3>
                <span className="text-xs text-stone-500">
                  Page {page} of {Math.ceil(totalConstituentsCount / 50) || 1}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-stone-700">
                  <thead className="bg-[#f9f6f0] text-stone-500 text-xs uppercase border-b border-[#ece3d3]">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">Name</th>
                      <th className="px-6 py-3.5 font-semibold">Phone Number</th>
                      <th className="px-6 py-3.5 font-semibold">Takoradi Locality</th>
                      <th className="px-6 py-3.5 font-semibold">Gender</th>
                      <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2ebd9]">
                    {isLoadingConstituents ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-stone-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-600" />
                          Loading directory...
                        </td>
                      </tr>
                    ) : constituents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-stone-500">
                          No constituents found.
                        </td>
                      </tr>
                    ) : (
                      constituents.map((c) => (
                        <tr key={c.id} className="hover:bg-[#faf7f2] transition group">
                          <td className="px-6 py-3.5 font-medium text-stone-900">
                            {c.first_name} {c.last_name}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-stone-600 text-xs">
                            {c.phone_number}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="bg-[#f4eee2] border border-[#e4d7c3] px-2.5 py-1 rounded-lg text-xs text-stone-700">
                              {c.electoral_area}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-stone-500">
                            {c.gender || "—"}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Quick SMS */}
                              <button
                                onClick={() => {
                                  setTargetType("custom");
                                  setCustomNumbers(c.phone_number);
                                  setActiveTab("broadcast");
                                }}
                                title="Compose SMS to this constituent"
                                className="px-2.5 py-1 rounded-lg bg-[#f4ede0] hover:bg-[#eae0cf] text-stone-800 text-xs font-semibold transition border border-[#e4d6c0] flex items-center gap-1"
                              >
                                <Send className="w-3 h-3 text-stone-600" />
                                <span>SMS</span>
                              </button>

                              {/* Edit Constituent */}
                              <button
                                onClick={() => handleOpenEdit(c)}
                                title="Edit constituent details"
                                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition border border-stone-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Constituent */}
                              <button
                                onClick={() => handleDeleteConstituent(c.id, `${c.first_name} ${c.last_name}`)}
                                disabled={deletingId === c.id}
                                title="Delete constituent"
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition border border-rose-200 disabled:opacity-50"
                              >
                                {deletingId === c.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-[#f1eae0] flex items-center justify-between text-xs text-stone-500">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-lg bg-[#f4ede0] hover:bg-[#ece2d1] text-stone-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  disabled={page * 50 >= totalConstituentsCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#f4ede0] hover:bg-[#ece2d1] text-stone-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TEMPLATES */}
        {activeTab === "templates" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Constituency Message Templates</h3>
                <p className="text-xs text-stone-500">
                  Pre-configured messages for townhalls, infrastructure announcements, festivals, and alerts.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenNewTemplate}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm flex items-center gap-2 transition self-start sm:self-auto shadow-xs"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                Create Template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.length === 0 ? (
                <div className="col-span-2 p-8 text-center bg-white border border-[#eae2d0] rounded-3xl text-stone-400 text-sm">
                  No message templates found. Click "Create Template" to add one.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-white border border-[#eae2d0] rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between group hover:border-[#dbcbb5] transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-sm text-stone-900 truncate">{tpl.title}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#f4ede0] text-stone-700 border border-[#e4d7c3]">
                            {tpl.category}
                          </span>
                          {/* Edit Template */}
                          <button
                            onClick={() => handleOpenEditTemplate(tpl)}
                            title="Edit template"
                            className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete Template */}
                          <button
                            onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                            disabled={deletingTemplateId === tpl.id}
                            title="Delete template"
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition disabled:opacity-50"
                          >
                            {deletingTemplateId === tpl.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed bg-[#fbf9f5] p-3 rounded-2xl border border-[#efe7d8]">
                        {tpl.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#f4ede0]">
                      <span className="text-[11px] text-stone-400">
                        {tpl.content.length} characters • {Math.ceil(tpl.content.length / 160)} page(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(tpl.content);
                          setCampaignTitle(tpl.title);
                          setActiveTab("broadcast");
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5 text-amber-400" />
                        Use in Broadcast
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DELIVERY LOGS & CAMPAIGN HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-stone-900">Broadcast Campaigns History</h3>
              <p className="text-xs text-stone-500">
                Audit trail of messages broadcasted via Sender ID KOBBYMP.
              </p>
            </div>

            <div className="bg-white border border-[#eae2d0] rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-stone-700">
                  <thead className="bg-[#f9f6f0] text-stone-500 text-xs uppercase border-b border-[#ece3d3]">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">Subject / Campaign</th>
                      <th className="px-6 py-3.5 font-semibold">Audience Type</th>
                      <th className="px-6 py-3.5 font-semibold">Targeted</th>
                      <th className="px-6 py-3.5 font-semibold">Delivered</th>
                      <th className="px-6 py-3.5 font-semibold">Status</th>
                      <th className="px-6 py-3.5 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2ebd9]">
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-stone-500">
                          No broadcast campaigns dispatched yet.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((camp) => (
                        <tr key={camp.id} className="hover:bg-[#faf7f2] transition">
                          <td className="px-6 py-3.5 font-medium text-stone-900">
                            <div>{camp.title}</div>
                            <div className="text-[11px] text-stone-500 truncate max-w-xs">
                              {camp.message}
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="capitalize text-xs bg-[#f4ede0] px-2.5 py-1 rounded-lg">
                              {camp.target_type}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs">
                            {camp.total_recipients}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs text-emerald-700 font-bold">
                            {camp.successful_count}
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                                camp.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {camp.status}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-stone-500">
                            {new Date(camp.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Recent Logs */}
            <div className="bg-white border border-[#eae2d0] rounded-3xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-sm text-stone-800">
                Recent Gateway SMS Logs (Last 50 Dispatches)
              </h4>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-[#fbf9f5] rounded-2xl border border-[#efe7d8] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-stone-900 mr-2">{log.recipient_name || "Constituent"}</span>
                      <span className="font-mono text-stone-600">{log.phone_number}</span>
                      <span className="text-stone-300 mx-2">•</span>
                      <span className="text-stone-500">{log.electoral_area || "Takoradi"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-semibold ${
                          log.status === "sent" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="text-stone-400 text-[11px]">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Register Constituent */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#eae2d0] rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-stone-900">Add Takoradi Constituent</h3>
            <form onSubmit={handleAddConstituent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Surname / Last Name
                </label>
                <input
                  type="text"
                  required
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="024XXXXXXX"
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Takoradi Locality / Electoral Area
                </label>
                <select
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  {(stats?.localities || []).map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#f1eae0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#f4ede0] text-stone-700 text-sm hover:bg-[#ece2d1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-stone-800"
                >
                  Save Constituent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Constituent */}
      {editingConstituent && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#eae2d0] rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-stone-900">Update Constituent Details</h3>
            <form onSubmit={handleUpdateConstituent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Surname / Last Name
                </label>
                <input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="024XXXXXXX"
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Takoradi Locality / Electoral Area
                </label>
                <select
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  {(stats?.localities || []).map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#f1eae0]">
                <button
                  type="button"
                  onClick={() => setEditingConstituent(null)}
                  className="px-4 py-2 rounded-xl bg-[#f4ede0] text-stone-700 text-sm hover:bg-[#ece2d1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      Saving...
                    </>
                  ) : (
                    "Update Constituent"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Bulk Import Constituents */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#eae2d0] rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1eae0]">
              <div>
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-stone-700" />
                  Import Constituents
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Paste contact rows or upload a CSV / TXT list.
                </p>
              </div>
            </div>

            {importResult && (
              <div
                className={`p-3.5 rounded-xl text-xs border ${
                  importResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {importResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Successfully imported/updated {importResult.count} constituents!</span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold">Import error:</span> {importResult.error}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleBulkImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Default Locality / Electoral Area
                </label>
                <select
                  value={importAreaDefault}
                  onChange={(e) => setImportAreaDefault(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  {(stats?.localities || []).map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-stone-400 mt-1 block">
                  Assigned if a constituent row does not specify their locality.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">
                    Constituent Data (Paste or Upload)
                  </label>
                  <label className="text-xs text-amber-800 hover:underline cursor-pointer font-semibold flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    Choose File (.csv, .txt)
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={6}
                  required
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Supported formats per row:\n1. 024XXXXXXX\n2. Kwame Mensah, 024XXXXXXX\n3. Kwame, Mensah, 024XXXXXXX, Amanful West`}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-2xl p-3 text-xs text-stone-900 font-mono focus:outline-none focus:border-stone-800 leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1">
                  <span>Duplicates with existing phone numbers will automatically update.</span>
                  <span>{importText.split("\n").filter((l) => l.trim()).length} line(s)</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#f1eae0]">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#f4ede0] text-stone-700 text-sm hover:bg-[#ece2d1]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importText.trim()}
                  className="px-5 py-2 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-amber-400" />
                      Run Import
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Create / Edit Message Template */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#eae2d0] rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1eae0]">
              <div>
                <h3 className="font-bold text-lg text-stone-900">
                  {editingTemplate ? "Update Message Template" : "Create New Template"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Save reusable message drafts for quick constituent broadcasts.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Template Title / Subject
                </label>
                <input
                  type="text"
                  required
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  placeholder="e.g. Townhall Invitation or Flood Alert"
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Category
                </label>
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-800"
                >
                  <option value="General">General</option>
                  <option value="Townhall">Townhall / Meeting</option>
                  <option value="Development">Development / Projects</option>
                  <option value="Announcement">Announcement</option>
                  <option value="Festival">Festival / Holiday</option>
                  <option value="Emergency">Emergency Alert</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">
                    SMS Message Content
                  </label>
                  <span className="text-[11px] text-stone-400">
                    {templateContent.length} chars ({Math.ceil(templateContent.length / 160) || 1} page)
                  </span>
                </div>
                <textarea
                  rows={5}
                  required
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  placeholder="Enter message text... (tip: use {name} for constituent's name)"
                  className="w-full bg-[#fbf9f5] border border-[#e8dfcf] rounded-2xl p-3 text-xs text-stone-900 focus:outline-none focus:border-stone-800 leading-relaxed"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#f1eae0]">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#f4ede0] text-stone-700 text-sm hover:bg-[#ece2d1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="px-5 py-2 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingTemplate ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      Saving...
                    </>
                  ) : editingTemplate ? (
                    "Update Template"
                  ) : (
                    "Save Template"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
