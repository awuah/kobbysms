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
  Sparkles,
  Smartphone,
  ChevronRight,
  Upload,
  Plus,
  Trash2,
  Copy,
  Info,
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

  // Test SMS modal/popover
  const [testPhone, setTestPhone] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);

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
    fetchStats();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === "constituents") {
      fetchConstituents();
    } else if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, page, selectedLocalityFilter, searchQuery]);

  // Handle Send Bulk Message
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError("");
    setSendSuccess(null);

    if (!message.trim()) {
      setSendError("Please enter a message text to broadcast.");
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
        particleCount: 100,
        spread: 70,
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
      alert("Constituent registered successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to save constituent");
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Civic Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500 shadow-md shadow-amber-500/20">
              <Image
                src="/mp-portrait.jpeg"
                alt="Hon. Kwabena Okyere Darko-Mensah"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">
                  KOBBYMP
                </span>
                <span className="bg-amber-500/20 text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30">
                  Takoradi Constituency
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hon. Kwabena Okyere Darko-Mensah • Constituent Broadcast System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Gateway Balance Card */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  SMS Gateway Balance
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-emerald-400">
                    {loadingStats ? "..." : (stats?.balance ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400">Credits</span>
                  <button
                    onClick={fetchStats}
                    title="Refresh Balance"
                    className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Sender ID: <strong>KOBBYMP</strong></span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`py-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "broadcast"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Send className="w-4 h-4" />
            Send Broadcast
          </button>
          <button
            onClick={() => setActiveTab("constituents")}
            className={`py-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "constituents"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Users className="w-4 h-4" />
            Constituents & Localities ({stats?.totalConstituents || 0})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`py-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "templates"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            Message Templates
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === "history"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <History className="w-4 h-4" />
            Delivery Logs & History
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: BROADCAST MESSAGING */}
        {activeTab === "broadcast" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 8 Cols: Composer Form */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Send className="w-5 h-5 text-amber-500" />
                      Compose Constituency Message
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Deliver urgent announcements, townhall invitations, and community updates straight to constituents.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-400">Sender ID:</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {senderId}
                    </span>
                  </div>
                </div>

                {sendSuccess && (
                  <div className="mt-5 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-start gap-3 text-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-300">
                        Broadcast Completed Successfully!
                      </p>
                      <p className="text-xs mt-1">
                        Delivered to {sendSuccess.successful} recipient(s) out of {sendSuccess.total} targeted.
                      </p>
                    </div>
                  </div>
                )}

                {sendError && (
                  <div className="mt-5 p-4 bg-rose-950/60 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-200">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-rose-300">Failed to Broadcast</p>
                      <p className="text-xs mt-1">{sendError}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendBroadcast} className="mt-6 space-y-6">
                  {/* Campaign Title / Reference */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Campaign Subject / Internal Reference
                    </label>
                    <input
                      type="text"
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      placeholder="e.g. Takoradi Road Modernization Update or Kundu Festival Greetings"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  {/* Audience Targeting Modes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Target Constituency Audience Segment
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setTargetType("all")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          targetType === "all"
                            ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/5"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">All Constituents</span>
                          <Users className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-xs text-slate-400">
                          Reach everyone registered across all 17 Takoradi localities ({stats?.totalConstituents || 0}).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetType("localities")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          targetType === "localities"
                            ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/5"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">By Localities / Areas</span>
                          <MapPin className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-xs text-slate-400">
                          Select specific electoral areas like Amanful, Zenith, Beach Road, etc.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetType("custom")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          targetType === "custom"
                            ? "bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/5"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">Direct / Custom Numbers</span>
                          <Smartphone className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-xs text-slate-400">
                          Paste or enter specific phone numbers (committee members, elders, etc.).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Locality Multi-select Pills (if targetType === 'localities') */}
                  {targetType === "localities" && (
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          Select Takoradi Electoral Areas ({selectedLocalities.length} selected)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selectAllLocalities}
                            className="text-[11px] text-amber-400 hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-slate-600">|</span>
                          <button
                            type="button"
                            onClick={clearLocalities}
                            className="text-[11px] text-slate-400 hover:underline"
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
                              className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-2 transition-all ${
                                isSelected
                                  ? "bg-amber-500/20 border-amber-500/80 text-amber-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <span>{loc.name}</span>
                              <span className="bg-slate-800/80 text-[10px] px-1.5 py-0.5 rounded-full text-slate-300 font-mono">
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
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Recipient Numbers (Comma or Newline separated)
                      </label>
                      <textarea
                        rows={3}
                        value={customNumbers}
                        onChange={(e) => setCustomNumbers(e.target.value)}
                        placeholder="024XXXXXXX, 055XXXXXXX, 020XXXXXXX"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  {/* Message Composer & Character Stats */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        SMS Content
                      </label>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>
                          Characters: <strong className="text-white">{charCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Pages:{" "}
                          <strong className={pageCount > 1 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                            {pageCount}
                          </strong>
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          {remainingInPage} chars left in page
                        </span>
                      </div>
                    </div>

                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message here. You can use {name} for personalizing each constituent's name..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
                    />

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <p>
                        Tip: Place <code>{"{name}"}</code> to auto-personalize greetings (e.g. &quot;Dear {"{name}"}...&quot;)
                      </p>
                      <span className="text-amber-500/80">Sender ID KOBBYMP is pre-configured</span>
                    </div>
                  </div>

                  {/* Quick Template Picker */}
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-2">
                      Quick Load Template:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.slice(0, 4).map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setMessage(tpl.content);
                            setCampaignTitle(tpl.title);
                          }}
                          className="p-2.5 text-left bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition text-xs group"
                        >
                          <div className="font-semibold text-slate-300 group-hover:text-amber-400">
                            {tpl.title}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {tpl.content}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submission Action & Audience Summary */}
                  <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="text-slate-400">Total Audience: </span>
                        <strong className="text-amber-400 text-base font-bold">
                          {estimatedAudience.toLocaleString()} Constituents
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        type="submit"
                        disabled={isSending || estimatedAudience === 0}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Dispatching Messages...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Broadcast via KOBBYMP
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Right 4 Cols: Phone Preview & Test Send */}
            <div className="lg:col-span-4 space-y-6">
              {/* Smartphone Preview Mockup */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-500" />
                    Recipient SMS Preview
                  </h3>
                  <span className="text-[10px] uppercase font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                    KOBBYMP
                  </span>
                </div>

                {/* iPhone style bubble */}
                <div className="mx-auto w-full max-w-[280px] bg-slate-950 rounded-2xl border-2 border-slate-800 p-4 shadow-2xl relative">
                  <div className="w-16 h-3 bg-slate-800 rounded-full mx-auto mb-3"></div>
                  <div className="text-center pb-2 border-b border-slate-800/80 mb-3">
                    <p className="text-[11px] font-bold text-amber-400 font-mono">
                      KOBBYMP
                    </p>
                    <p className="text-[9px] text-slate-500">Takoradi Constituency MP</p>
                  </div>

                  <div className="min-h-[140px] flex flex-col justify-end">
                    <div className="bg-slate-800/90 text-slate-100 rounded-2xl rounded-tl-none p-3 text-xs leading-relaxed border border-slate-700/60 shadow-md">
                      {message || (
                        <span className="text-slate-500 italic">
                          Message text will appear here as it will display on constituent phones...
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500 text-right mt-1">Just now</div>
                  </div>
                </div>

                {/* Test SMS Box */}
                <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Send Quick Test Message
                    </span>
                    <span className="text-[10px] text-slate-500">1 credit</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="Enter mobile (e.g. 0244123456)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />

                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={isSendingTest || !message.trim()}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 border border-slate-700 disabled:opacity-50"
                    >
                      {isSendingTest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Sending Test...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-amber-400" />
                          Send Test to My Phone
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-lg text-xs border ${
                        testResult.success
                          ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
                          : "bg-rose-950/50 border-rose-500/30 text-rose-300"
                      }`}
                    >
                      {testResult.success ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-700">
                    <Image
                      src="/mp-portrait.jpeg"
                      alt="MP Takoradi"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Hon. Kwabena Okyere Darko-Mensah
                    </h4>
                    <p className="text-xs text-amber-400">Member of Parliament, Takoradi</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by name or phone..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={selectedLocalityFilter}
                  onChange={(e) => {
                    setSelectedLocalityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500"
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
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  Register Constituent
                </button>
              </div>
            </div>

            {/* Constituents Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200">
                  Constituent Directory ({totalConstituentsCount.toLocaleString()} total)
                </h3>
                <span className="text-xs text-slate-500">
                  Page {page} of {Math.ceil(totalConstituentsCount / 50) || 1}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Phone Number</th>
                      <th className="px-6 py-3 font-semibold">Takoradi Locality</th>
                      <th className="px-6 py-3 font-semibold">Gender</th>
                      <th className="px-6 py-3 font-semibold text-right">Quick SMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {isLoadingConstituents ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                          Loading constituents database...
                        </td>
                      </tr>
                    ) : constituents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          No constituents found matching query.
                        </td>
                      </tr>
                    ) : (
                      constituents.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-6 py-3 font-medium text-white">
                            {c.first_name} {c.last_name}
                          </td>
                          <td className="px-6 py-3 font-mono text-amber-400/90 text-xs">
                            {c.phone_number}
                          </td>
                          <td className="px-6 py-3">
                            <span className="bg-slate-800 border border-slate-700/60 px-2.5 py-1 rounded-md text-xs text-slate-300">
                              {c.electoral_area}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs text-slate-400">
                            {c.gender || "—"}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => {
                                setTargetType("custom");
                                setCustomNumbers(c.phone_number);
                                setActiveTab("broadcast");
                              }}
                              className="text-xs text-amber-400 hover:text-amber-300 hover:underline font-semibold"
                            >
                              Compose SMS
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  disabled={page * 50 >= totalConstituentsCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Constituency Message Templates</h3>
                <p className="text-xs text-slate-400">
                  Pre-approved templates for Townhall meetings, announcements, festivals, and project updates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{tpl.title}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {tpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    {tpl.content}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500">
                      {tpl.content.length} characters • {Math.ceil(tpl.content.length / 160)} page(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(tpl.content);
                        setCampaignTitle(tpl.title);
                        setActiveTab("broadcast");
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Use in Broadcast
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: DELIVERY LOGS & CAMPAIGN HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Broadcast Campaigns History</h3>
              <p className="text-xs text-slate-400">
                Audit trail of messages broadcasted via Sender ID KOBBYMP with delivery rates.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Subject / Campaign</th>
                      <th className="px-6 py-3 font-semibold">Audience Type</th>
                      <th className="px-6 py-3 font-semibold">Total Targeted</th>
                      <th className="px-6 py-3 font-semibold">Delivered</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Date Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                          No broadcast campaigns dispatched yet.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((camp) => (
                        <tr key={camp.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-6 py-3 font-medium text-white">
                            <div>{camp.title}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {camp.message}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="capitalize text-xs bg-slate-800 px-2.5 py-1 rounded">
                              {camp.target_type}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-mono text-xs">
                            {camp.total_recipients}
                          </td>
                          <td className="px-6 py-3 font-mono text-xs text-emerald-400 font-bold">
                            {camp.successful_count}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                camp.status === "completed"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {camp.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs text-slate-400">
                            {new Date(camp.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual SMS Logs sample */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h4 className="font-bold text-sm text-slate-200">
                Recent Gateway SMS Logs (Last 50 Dispatches)
              </h4>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white mr-2">{log.recipient_name || "Constituent"}</span>
                      <span className="font-mono text-amber-400/90">{log.phone_number}</span>
                      <span className="text-slate-500 mx-2">•</span>
                      <span className="text-slate-400">{log.electoral_area || "Takoradi"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-semibold ${
                          log.status === "sent" ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="text-slate-500 text-[11px]">
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Add Takoradi Constituent</h3>
            <form onSubmit={handleAddConstituent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Surname / Last Name
                </label>
                <input
                  type="text"
                  required
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="024XXXXXXX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Takoradi Locality / Electoral Area
                </label>
                <select
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {(stats?.localities || []).map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400"
                >
                  Save Constituent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
