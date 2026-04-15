import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { 
  Plus, Edit2, Trash2, Search, Download, Upload, 
  CalendarClock, Repeat, ListOrdered, ChevronLeft, 
  ChevronRight, X, FolderInput 
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { Transaction, Budget, RecurringRule } from "../App";
import { getTodayStart, getStartOfDay, getDaysAgo, isDateBefore, parseDateInput, formatDateForInput } from "../utils/dateUtils";
import { useCSV } from "../hooks/Usecsv";
import { CSVMappingDialog } from "./CSVMappingDialog";
import { MoneyInput } from "./MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ExpenseTrackingProps {
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules?: RecurringRule[];
  onAddRecurringRule?: (rule: Omit<RecurringRule, "id" | "userId">) => Promise<void>;
  onDeleteRecurringRule?: (id: string) => Promise<void>;
  onOpenAddTransaction: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onImportTransactions: (rows: Omit<Transaction, "id">[]) => Promise<void>;
}

type DateRangeKey = "30d" | "90d" | "6m" | "1y" | "all";
type PageSize = 10 | 50 | 100;

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string; days: number | null }[] = [
  { key: "30d",  label: "30D",  days: 30   },
  { key: "90d",  label: "90D",  days: 90   },
  { key: "6m",   label: "6M",   days: 183  },
  { key: "1y",   label: "1Y",   days: 365  },
  { key: "all",  label: "All",  days: null },
];

export function ExpenseTracking({
  transactions,
  budgets,
  recurringRules = [],
  onAddRecurringRule,
  onDeleteRecurringRule,
  onOpenAddTransaction,
  onEdit,
  onDelete,
  onUpdateTransaction,
  onImportTransactions,
}: ExpenseTrackingProps) {

  // ─── STATE ─────────────────────────────────────────────────────────────
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);
  const [searchTerm, setSearchTerm]   = useState("");
  const [dateRange, setDateRange]     = useState<DateRangeKey>("90d");
  const [pageSize, setPageSize]       = useState<PageSize>(50);
  const [page, setPage]               = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    description: "",
    amount: 0,
    category: "",
    type: "expense" as "expense" | "income",
    frequency: "monthly" as "weekly" | "monthly" | "yearly",
    nextDueDate: formatDateForInput(new Date()),
  });

  const toggleSelectAll = () => {
  if (selectedIds.length === visibleTransactions.length) {
    setSelectedIds([]);
  } else {
    setSelectedIds(visibleTransactions.map(t => t.id));
  }
};

const handleBulkDelete = async () => {
  if (!window.confirm(`Delete ${selectedIds.length} transactions?`)) return;
  await Promise.all(selectedIds.map(id => onDelete(id)));
  setSelectedIds([]);
};

const handleBulkCategoryChange = async (newCategory: string) => {
  await Promise.all(selectedIds.map(id => onUpdateTransaction(id, { category: newCategory })));
  setSelectedIds([]);
};

  const {
    handleExport, handleImportClick, handleFileChange, fileInputRef,
    isMappingModalOpen, setIsMappingModalOpen, csvHeaders, executeFinalImport, generatePreview,
  } = useCSV({ transactions, budgets, onImportTransactions });

  // ─── DERIVED DATA ──────────────────────────────────────────────────────
  const rangeStart = useMemo(() => {
    const opt = DATE_RANGE_OPTIONS.find(o => o.key === dateRange)!;
    return opt.days === null ? null : getDaysAgo(opt.days);
  }, [dateRange]);

  // All non-archived transactions within the selected date range
  const rangeTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (t.archived) return false;
        if (rangeStart && isDateBefore(getStartOfDay(t.date), rangeStart)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, rangeStart]);

  // Further filtered by search term
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return rangeTransactions;
    const q = searchTerm.toLowerCase();
    return rangeTransactions.filter(t =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.amount.toString().includes(q)
    );
  }, [rangeTransactions, searchTerm]);

  // Pagination — reset to page 1 whenever filters change
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * pageSize;
  const visibleTransactions = filteredTransactions.slice(pageStart, pageStart + pageSize);

  // Transactions older than the selected range (for archive button)
  const archivableTransactions = useMemo(() => {
    if (!rangeStart) return []; // "All" range — nothing to archive
    return transactions.filter(
      t => !t.archived && isDateBefore(getStartOfDay(t.date), rangeStart)
    );
  }, [transactions, rangeStart]);

  // ─── LABEL for header ──────────────────────────────────────────────────
  const dateRangeLabel = useMemo(() => {
    if (!rangeStart) return "All time";
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    return `${fmt(rangeStart)} — ${fmt(getTodayStart())}`;
  }, [rangeStart]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────
  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(1);
  };

  const handleDateRangeChange = (key: DateRangeKey) => {
    setDateRange(key);
    setPage(1);
  };

  const handleArchiveClick = async () => {
    if (archivableTransactions.length === 0) return;
    const n   = archivableTransactions.length;
    const opt = DATE_RANGE_OPTIONS.find(o => o.key === dateRange)!;
    const msg = `Archive ${n} transaction${n === 1 ? "" : "s"} older than ${opt.label}?\n\n✓ Hidden from main list\n✓ Still counted in charts\n✓ Accessible in Settings → Archived`;
    if (!window.confirm(msg)) return;
    try {
      await Promise.all(archivableTransactions.map(t => onUpdateTransaction(t.id, { archived: true })));
      alert(`Archived ${n} transaction${n === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Archive failed:", err);
      alert("An error occurred while archiving.");
    }
  };

  const toggleSelectOne = (id: string) => {
  setSelectedIds(prev => 
    prev.includes(id) 
      ? prev.filter(i => i !== id) 
      : [...prev, id]
  );
};

  const handleAddRecurring = async () => {
    if (!onAddRecurringRule) return;
    if (!recurringForm.description || recurringForm.amount <= 0 || !recurringForm.category) {
      alert("Please fill out all fields.");
      return;
    }
    try {
      await onAddRecurringRule({
        description:  recurringForm.description,
        amount:       recurringForm.amount,
        category:     recurringForm.category,
        type:         recurringForm.type,
        frequency:    recurringForm.frequency,
        nextDueDate:  parseDateInput(recurringForm.nextDueDate),
      });
      setShowRecurringForm(false);
      setRecurringForm({ description: "", amount: 0, category: "", type: "expense", frequency: "monthly", nextDueDate: formatDateForInput(new Date()) });
    } catch (e) {
      console.error(e);
      alert("Failed to add recurring rule.");
    }
  };

  const getCategoryColor = (cat: string) => budgets.find(b => b.category === cat)?.color ?? "#9CA3AF";

  // ─── SHARED BUTTON STYLES ──────────────────────────────────────────────
  const segmentBtn = (active: boolean) => ({
    backgroundColor: active ? "var(--surface)" : "transparent",
    color:           active ? "var(--engine-navy)" : "var(--fortress-steel)",
    boxShadow:       active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
    border:          active ? "1px solid var(--border-subtle)" : "1px solid transparent",
  });

  return (
    <div className="space-y-6">

      <CSVMappingDialog
        open={isMappingModalOpen}
        onOpenChange={setIsMappingModalOpen}
        headers={csvHeaders}
        budgets={budgets}
        onGeneratePreview={generatePreview}
        onFinalImport={executeFinalImport}
        onAddRecurringRule={onAddRecurringRule|| (async () => {})}
      />
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {showRecurringPanel ? "Recurring Rules" : "Expense Tracking"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fortress-steel)" }}>
            {showRecurringPanel ? "Manage automated subscriptions and bills." : `Active view: ${dateRangeLabel}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {!showRecurringPanel && archivableTransactions.length > 0 && (
            <Button variant="outline" onClick={handleArchiveClick} size="sm"
              className="whitespace-nowrap font-bold uppercase tracking-wide text-xs"
              style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
            >
              Archive {archivableTransactions.length} Old
            </Button>
          )}

          <Button variant="outline" onClick={() => setShowRecurringPanel(!showRecurringPanel)} size="sm"
            className="font-bold uppercase tracking-wide text-xs gap-1.5"
            style={{ borderColor: "var(--border-subtle)", color: "var(--white)" }}
          >
            {showRecurringPanel ? <ListOrdered className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            {showRecurringPanel ? "Back to History" : "Recurring Rules"}
          </Button>

          {!showRecurringPanel && (
            <>
              <Button variant="outline" onClick={handleExport} size="sm"
                className="font-bold uppercase tracking-wide text-xs gap-1.5"
                style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="outline" onClick={handleImportClick} size="sm"
                className="font-bold uppercase tracking-wide text-xs gap-1.5"
                style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
              >
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
            </>
          )}

          <Button onClick={onOpenAddTransaction} size="sm"
            className="font-bold text-white gap-1.5"
            style={{ backgroundColor: "var(--castle-red)", border: "none", boxShadow: "0 2px 0 0 var(--castle-red-dark)" }}
          >
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

{selectedIds.length > 0 && !showRecurringPanel && (
  <div className="sticky top-4 z-30 flex items-center justify-between px-4 py-3 rounded-lg border shadow-xl bg-white mb-4" style={{ borderColor: "var(--engine-navy)" }}>
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={() => setSelectedIds([])}><X className="h-4 w-4" /></Button>
      <span className="text-sm font-bold uppercase tracking-widest">{selectedIds.length} Selected</span>
    </div>
    <div className="flex items-center gap-3">
      <Select onValueChange={handleBulkCategoryChange}>
        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Move to Category" /></SelectTrigger>
        <SelectContent style={{ backgroundColor: "var(--surface)" }}>
          {budgets.map(b => <SelectItem key={b.id} value={b.category}>{b.category}</SelectItem>)}
          <SelectItem value="Income">Income</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleBulkDelete} className="bg-red-600 text-white font-bold h-9">
        <Trash2 className="w-4 h-4 mr-2" /> Delete
      </Button>
    </div>
  </div>
)}
      {/* ── CONDITIONAL RENDERING ──────────────────────────────────────── */}
      {showRecurringPanel ? (

        /* ── RECURRING RULES PANEL ── */
        <Card className="border animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}
        >
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div>
              <CardTitle className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Subscription Engine</CardTitle>
              <p className="text-xs mt-1" style={{ color: "var(--fortress-steel)" }}>Automated rules that prompt you for approval on their due date.</p>
            </div>
            <Button onClick={() => setShowRecurringForm(!showRecurringForm)} size="sm" variant="outline"
              className="font-bold uppercase tracking-wide text-xs"
              style={{ borderColor: "var(--border-subtle)", color: "var(--engine-navy)" }}
            >
              {showRecurringForm ? "Cancel" : "+ New Rule"}
            </Button>
          </CardHeader>

          {showRecurringForm && (
            <div className="p-4 border-b space-y-4" style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Description</Label>
                  <Input placeholder="e.g. Netflix, Rent" value={recurringForm.description}
                    onChange={e => setRecurringForm(f => ({ ...f, description: e.target.value }))}
                    style={{ backgroundColor: "var(--surface)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Amount</Label>
                  <MoneyInput value={recurringForm.amount} onChange={val => setRecurringForm(f => ({ ...f, amount: val }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Category</Label>
                  <select
                    className="flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    value={recurringForm.category}
                    onChange={e => setRecurringForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="" disabled>Select category...</option>
                    {budgets.map(b => <option key={b.id} value={b.category}>{b.category}</option>)}
                    <option value="Income">Income (Not Budgeted)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                      value={recurringForm.type}
                      onChange={e => setRecurringForm(f => ({ ...f, type: e.target.value as any }))}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Frequency</Label>
                    <select
                      className="flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                      value={recurringForm.frequency}
                      onChange={e => setRecurringForm(f => ({ ...f, frequency: e.target.value as any }))}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Next Due Date</Label>
                  <Input type="date" value={recurringForm.nextDueDate}
                    onChange={e => setRecurringForm(f => ({ ...f, nextDueDate: e.target.value }))}
                    style={{ backgroundColor: "var(--surface)" }}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleAddRecurring} className="font-bold text-white px-8" style={{ backgroundColor: "var(--engine-navy)" }}>
                  Save Rule
                </Button>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            {recurringRules.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <CalendarClock className="w-10 h-10 mb-3 opacity-20" style={{ color: "var(--fortress-steel)" }} />
                <p className="text-sm font-bold text-muted-foreground">No recurring rules configured.</p>
              </div>
            ) : (
              <Table>
                <TableBody>
                  {recurringRules.map(rule => (
                    <TableRow key={rule.id} style={{ borderColor: "var(--border-subtle)" }}>
                      <TableCell className="w-12 text-center">
                        <Repeat className="w-4 h-4 mx-auto opacity-50" style={{ color: "var(--engine-navy)" }} />
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{rule.description}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "var(--surface-raised)", color: "var(--fortress-steel)" }}
                          >{rule.frequency}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>• {rule.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-bold font-mono text-sm"
                          style={{ color: rule.type === "expense" ? "var(--castle-red)" : "var(--field-green)" }}
                        >
                          {rule.type === "expense" ? "−" : "+"}${rule.amount.toFixed(2)}
                        </p>
                        <p className="text-[10px] uppercase font-bold mt-1" style={{ color: "var(--engine-navy)" }}>
                          Due: {new Date(rule.nextDueDate).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell className="w-16 text-right pr-4">
                        <Button variant="ghost" size="icon"
                          onClick={() => onDeleteRecurringRule && rule.id && onDeleteRecurringRule(rule.id)}
                          style={{ color: "var(--castle-red)" }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      ) : (

        /* ── LOG HISTORY PANEL ── */
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* ── Controls Row ─────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">

            {/* Search */}
            <div className="max-w-xs w-full">
              <div className="flex items-center w-full rounded-md overflow-hidden border"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center justify-center w-10 h-10 border-r flex-shrink-0"
                  style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
                >
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search transactions…"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                  className="flex-1 h-10 px-3 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>

            {/* Date range + page size toggles */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Date Range Selector */}
              <div className="flex items-center gap-1 p-1 rounded-md border"
                style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
              >
                {DATE_RANGE_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleDateRangeChange(key)}
                    className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={segmentBtn(dateRange === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1 p-1 rounded-md border"
                style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
              >
                {([10, 50, 100] as PageSize[]).map(size => (
                  <button
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={segmentBtn(pageSize === size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────────────────── */}
<div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}>
  <Table>
    <TableHeader>
      <TableRow style={{ backgroundColor: "var(--surface-raised)" }}>
        {/* 1. ADD SELECT ALL CHECKBOX */}
        <TableHead className="w-10">
          <input 
            type="checkbox" 
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
            checked={selectedIds.length === visibleTransactions.length && visibleTransactions.length > 0}
            onChange={toggleSelectAll}
          />
        </TableHead>

        {["Date", "Description", "Category", "Amount", "Actions"].map((col, i) => (
          <TableHead key={col}
            className={`text-[10px] font-bold uppercase tracking-widest ${i >= 3 ? "text-right" : ""}`}
            style={{ color: "var(--fortress-steel)" }}
          >{col}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {visibleTransactions.length > 0 ? (
        visibleTransactions.map(t => (
          <TableRow 
            key={t.id} 
            className="transition-colors" 
            style={{ 
              borderColor: "var(--border-subtle)",
              backgroundColor: selectedIds.includes(t.id) ? "var(--surface-raised)" : "transparent" 
            }}
            onMouseEnter={e => {
              if (!selectedIds.includes(t.id)) e.currentTarget.style.backgroundColor = "var(--surface-raised)";
            }}
            onMouseLeave={e => {
              if (!selectedIds.includes(t.id)) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {/* 2. ADD INDIVIDUAL ROW CHECKBOX */}
            <TableCell>
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                checked={selectedIds.includes(t.id)}
                onChange={() => toggleSelectOne(t.id)}
              />
            </TableCell>

            <TableCell className="text-xs font-mono whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
            </TableCell>
            <TableCell className="max-w-[200px] truncate font-semibold text-sm"
              style={{ color: "var(--text-primary)" }} title={t.description}
            >
              {t.description}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(t.category) }} />
                <span className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--fortress-steel)", border: "1px solid var(--border-subtle)" }}
                >
                  {t.category}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right font-bold font-mono text-sm"
              style={{ color: t.type === "income" ? "var(--field-green)" : "var(--castle-red)" }}
            >
              {t.type === "income" ? "+" : "−"}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 transition-colors"
                  style={{ color: "var(--fortress-steel)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--engine-navy)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--fortress-steel)")}
                  onClick={() => onEdit(t)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 transition-colors"
                  style={{ color: "var(--fortress-steel)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--castle-red)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--fortress-steel)")}
                  onClick={() => onDelete(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))
      ) : (
        <TableRow>
          {/* 3. ADJUST COLSPAN TO 6 TO ACCOUNT FOR NEW COLUMN */}
          <TableCell colSpan={6} className="h-48 text-center">
            <div className="flex flex-col items-center justify-center gap-2">
              <Search className="h-10 w-10 opacity-20" style={{ color: "var(--fortress-steel)" }} />
              <p className="font-semibold text-sm" style={{ color: "var(--fortress-steel)" }}>No transactions found</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Try adjusting your date range or search term.</p>
            </div>
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
</div>

          {/* ── Pagination Footer ─────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Showing {pageStart + 1}–{Math.min(pageStart + pageSize, filteredTransactions.length)} of {filteredTransactions.length} transactions
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
                  disabled={safePage === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-bold px-2" style={{ color: "var(--fortress-steel)" }}>
                  {safePage} / {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
                  disabled={safePage === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}