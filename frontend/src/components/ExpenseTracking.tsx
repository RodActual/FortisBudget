import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Plus, Edit2, Trash2, Search, Download, Upload, CalendarClock, Repeat, ListOrdered } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { Transaction, Budget, RecurringRule } from "../App";
import { getTodayStart, getStartOfDay, getDaysAgo, isDateBefore, parseDateInput, formatDateForInput } from "../utils/dateUtils";
import { useCSV } from "../hooks/Usecsv";
import { CSVMappingDialog } from "./CSVMappingDialog";
import { MoneyInput } from "./MoneyInput";

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
  const [searchTerm, setSearchTerm] = useState("");
  
  // Recurring Form State
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    description: "",
    amount: 0,
    category: "",
    type: "expense" as "expense" | "income",
    frequency: "monthly" as "weekly" | "monthly" | "yearly",
    nextDueDate: formatDateForInput(new Date())
  });

  const { 
    handleExport, handleImportClick, handleFileChange, fileInputRef,
    isMappingModalOpen, setIsMappingModalOpen, csvHeaders, executeFinalImport, generatePreview
  } = useCSV({ transactions, budgets, onImportTransactions });

  // ─── TRANSACTIONS LOGIC ────────────────────────────────────────────────
  const { visibleTransactions, oldTransactions, dateRange } = useMemo(() => {
    const todayStart    = getTodayStart();
    const ninetyDaysAgo = getDaysAgo(90);

    const old = transactions.filter(t => !t.archived && isDateBefore(getStartOfDay(t.date), ninetyDaysAgo));
    const visible = transactions.filter(t => {
      if (t.archived) return false;
      if (isDateBefore(getStartOfDay(t.date), ninetyDaysAgo)) return false;
      const q = searchTerm.toLowerCase();
      return t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.amount.toString().includes(q);
    });

    visible.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return {
      visibleTransactions: visible,
      oldTransactions:     old,
      dateRange:           `${fmt(ninetyDaysAgo)} — ${fmt(todayStart)}`,
    };
  }, [transactions, searchTerm]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────
  const handleArchiveClick = async () => {
    if (oldTransactions.length === 0) return;
    const n   = oldTransactions.length;
    const msg = `Archive ${n} transaction${n === 1 ? "" : "s"} older than 90 days?\n\n✓ Hidden from main list\n✓ Still counted in charts\n✓ Accessible in Settings → Archived`;
    if (!window.confirm(msg)) return;
    try {
      await Promise.all(oldTransactions.map(t => onUpdateTransaction(t.id, { archived: true })));
      alert(`Archived ${n} transaction${n === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Archive failed:", err);
      alert("An error occurred while archiving.");
    }
  };

  const handleAddRecurring = async () => {
    if (!onAddRecurringRule) return;
    if (!recurringForm.description || recurringForm.amount <= 0 || !recurringForm.category) {
      alert("Please fill out all fields.");
      return;
    }

    try {
      await onAddRecurringRule({
        description: recurringForm.description,
        amount: recurringForm.amount,
        category: recurringForm.category,
        type: recurringForm.type,
        frequency: recurringForm.frequency,
        nextDueDate: parseDateInput(recurringForm.nextDueDate) 
      });
      
      setShowRecurringForm(false);
      setRecurringForm({
        description: "", amount: 0, category: "", type: "expense", frequency: "monthly", nextDueDate: formatDateForInput(new Date())
      });
    } catch (e) {
      console.error(e);
      alert("Failed to add recurring rule.");
    }
  };

  const getCategoryColor = (cat: string) => budgets.find(b => b.category === cat)?.color ?? "#9CA3AF";

  return (
    <div className="space-y-6">

      <CSVMappingDialog 
  open={isMappingModalOpen}
  onOpenChange={setIsMappingModalOpen}
  headers={csvHeaders}
  budgets={budgets}
  onGeneratePreview={generatePreview}
  onFinalImport={executeFinalImport}
/>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {showRecurringPanel ? "Recurring Rules" : "Expense Tracking"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fortress-steel)" }}>
            {showRecurringPanel ? "Manage automated subscriptions and bills." : `Active view: ${dateRange}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* Main Action Toggles */}
          {!showRecurringPanel && oldTransactions.length > 0 && (
            <Button variant="outline" onClick={handleArchiveClick} size="sm" className="whitespace-nowrap font-bold uppercase tracking-wide text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}>
              Archive {oldTransactions.length} Old
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={() => setShowRecurringPanel(!showRecurringPanel)} 
            size="sm" 
            className="font-bold uppercase tracking-wide text-xs gap-1.5" 
            style={{ borderColor: "var(--border-subtle)", color: "var(--engine-navy)" }}
          >
            {showRecurringPanel ? <ListOrdered className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
            {showRecurringPanel ? "Back to History" : "Recurring Rules"}
          </Button>

          {!showRecurringPanel && (
            <>
              <Button variant="outline" onClick={handleExport} size="sm" className="font-bold uppercase tracking-wide text-xs gap-1.5" style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="outline" onClick={handleImportClick} size="sm" className="font-bold uppercase tracking-wide text-xs gap-1.5" style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}>
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
            </>
          )}

          <Button onClick={onOpenAddTransaction} size="sm" className="font-bold text-white gap-1.5" style={{ backgroundColor: "var(--castle-red)", border: "none", boxShadow: "0 2px 0 0 var(--castle-red-dark)" }}>
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* ── CONDITIONAL RENDERING ──────────────────────────────────────────── */}
      {showRecurringPanel ? (
        
        /* ── RECURRING RULES PANEL ── */
        <Card className="border animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}>
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
            <div>
              <CardTitle className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Subscription Engine</CardTitle>
              <p className="text-xs mt-1" style={{ color: "var(--fortress-steel)" }}>Automated rules that prompt you for approval on their due date.</p>
            </div>
            <Button onClick={() => setShowRecurringForm(!showRecurringForm)} size="sm" variant="outline" className="font-bold uppercase tracking-wide text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--engine-navy)" }}>
              {showRecurringForm ? "Cancel" : "+ New Rule"}
            </Button>
          </CardHeader>

          {/* NEW RULE FORM */}
          {showRecurringForm && (
            <div className="p-4 border-b space-y-4" style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Description</Label>
                  <Input placeholder="e.g. Netflix, Rent" value={recurringForm.description} onChange={e => setRecurringForm(f => ({ ...f, description: e.target.value }))} style={{ backgroundColor: "var(--surface)" }} />
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
                  <Input type="date" value={recurringForm.nextDueDate} onChange={e => setRecurringForm(f => ({ ...f, nextDueDate: e.target.value }))} style={{ backgroundColor: "var(--surface)" }} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleAddRecurring} className="font-bold text-white px-8" style={{ backgroundColor: "var(--engine-navy)" }}>
                  Save Rule
                </Button>
              </div>
            </div>
          )}

          {/* RULE LIST */}
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
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--fortress-steel)" }}>{rule.frequency}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>• {rule.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-bold font-mono text-sm" style={{ color: rule.type === 'expense' ? 'var(--castle-red)' : 'var(--field-green)' }}>
                          {rule.type === 'expense' ? '−' : '+'}${rule.amount.toFixed(2)}
                        </p>
                        <p className="text-[10px] uppercase font-bold mt-1" style={{ color: "var(--engine-navy)" }}>
                          Due: {new Date(rule.nextDueDate).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell className="w-16 text-right pr-4">
                        <Button variant="ghost" size="icon" onClick={() => onDeleteRecurringRule && rule.id && onDeleteRecurringRule(rule.id)} style={{ color: "var(--castle-red)" }}>
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
          <div className="max-w-md">
            <div className="flex items-center w-full rounded-md overflow-hidden border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center justify-center w-10 h-10 border-r flex-shrink-0" style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                <Search className="h-4 w-4" />
              </div>
              <input type="text" placeholder="Search transactions…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 h-10 px-3 bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
            </div>
          </div>

          <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "var(--surface-raised)" }}>
                  {["Date", "Description", "Category", "Amount", "Actions"].map((col, i) => (
                    <TableHead key={col} className={`text-[10px] font-bold uppercase tracking-widest ${i >= 3 ? "text-right" : ""}`} style={{ color: "var(--fortress-steel)" }}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTransactions.length > 0 ? (
                  visibleTransactions.map(t => (
                    <TableRow key={t.id} className="transition-colors" style={{ borderColor: "var(--border-subtle)" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-raised)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <TableCell className="text-xs font-mono whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-semibold text-sm" style={{ color: "var(--text-primary)" }} title={t.description}>
                        {t.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(t.category) }} />
                          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--fortress-steel)", border: "1px solid var(--border-subtle)" }}>
                            {t.category}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono text-sm" style={{ color: t.type === "income" ? "var(--field-green)" : "var(--castle-red)" }}>
                        {t.type === "income" ? "+" : "−"}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 transition-colors" style={{ color: "var(--fortress-steel)" }} onMouseEnter={e => (e.currentTarget.style.color = "var(--engine-navy)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--fortress-steel)")} onClick={() => onEdit(t)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 transition-colors" style={{ color: "var(--fortress-steel)" }} onMouseEnter={e => (e.currentTarget.style.color = "var(--castle-red)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--fortress-steel)")} onClick={() => onDelete(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-10 w-10 opacity-20" style={{ color: "var(--fortress-steel)" }} />
                        <p className="font-semibold text-sm" style={{ color: "var(--fortress-steel)" }}>No transactions found</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Adjust your search or check your archived data.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}