import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Plus, Edit2, Trash2, Search, Download, Upload } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "../ui/table";
import type { Transaction, Budget } from "../App";
import { getTodayStart, getStartOfDay, getDaysAgo, isDateBefore } from "../utils/dateUtils";
import { useCSV } from "../hooks/Usecsv";
import { CSVMappingDialog } from "./CSVMappingDialog";

interface ExpenseTrackingProps {
  transactions: Transaction[];
  budgets: Budget[];
  onOpenAddTransaction: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onImportTransactions: (rows: Omit<Transaction, "id">[]) => Promise<void>;
}

export function ExpenseTracking({
  transactions,
  budgets,
  onOpenAddTransaction,
  onEdit,
  onDelete,
  onUpdateTransaction,
  onImportTransactions,
}: ExpenseTrackingProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { 
    handleExport, 
    handleImportClick, 
    handleFileChange, 
    fileInputRef,
    isMappingModalOpen,
    setIsMappingModalOpen,
    csvHeaders,
    executeImport
  } = useCSV({
    transactions,
    budgets, // <-- Passed budgets into the hook for smart categorization
    onImportTransactions,
  });

  const { visibleTransactions, oldTransactions, dateRange } = useMemo(() => {
    const todayStart    = getTodayStart();
    const ninetyDaysAgo = getDaysAgo(90);

    const old = transactions.filter(t => {
      if (t.archived) return false;
      return isDateBefore(getStartOfDay(t.date), ninetyDaysAgo);
    });

    const visible = transactions.filter(t => {
      if (t.archived) return false;
      if (isDateBefore(getStartOfDay(t.date), ninetyDaysAgo)) return false;
      const q = searchTerm.toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    });

    visible.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    return {
      visibleTransactions: visible,
      oldTransactions:     old,
      dateRange:           `${fmt(ninetyDaysAgo)} — ${fmt(todayStart)}`,
    };
  }, [transactions, searchTerm]);

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

  const getCategoryColor = (cat: string) =>
    budgets.find(b => b.category === cat)?.color ?? "#9CA3AF";

  return (
    <div className="space-y-6">

      <CSVMappingDialog 
        open={isMappingModalOpen}
        onOpenChange={setIsMappingModalOpen}
        headers={csvHeaders}
        budgets={budgets}
        onConfirm={executeImport}
      />

      {/* Hidden file input — triggered by the Import button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Expense Tracking
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fortress-steel)" }}>
            Active view:{" "}
            <span className="font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
              {dateRange}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">

          {/* Archive old */}
          {oldTransactions.length > 0 && (
            <Button
              variant="outline"
              onClick={handleArchiveClick}
              size="sm"
              className="whitespace-nowrap font-bold uppercase tracking-wide text-xs"
              style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
            >
              Archive {oldTransactions.length} Old
            </Button>
          )}

          {/* Export CSV */}
          <Button
            variant="outline"
            onClick={handleExport}
            size="sm"
            className="font-bold uppercase tracking-wide text-xs gap-1.5"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>

          {/* Import CSV */}
          <Button
            variant="outline"
            onClick={handleImportClick}
            size="sm"
            className="font-bold uppercase tracking-wide text-xs gap-1.5"
            style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>

          {/* Add transaction */}
          <Button
            onClick={onOpenAddTransaction}
            size="sm"
            className="font-bold text-white gap-1.5"
            style={{
              backgroundColor: "var(--castle-red)",
              border:          "none",
              boxShadow:       "0 2px 0 0 var(--castle-red-dark)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="max-w-md">
        <div
          className="flex items-center w-full rounded-md overflow-hidden border"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 border-r flex-shrink-0"
            style={{
              backgroundColor: "var(--surface-raised)",
              borderColor:     "var(--border-subtle)",
              color:           "var(--text-muted)",
            }}
          >
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search transactions…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 h-10 px-3 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div
        className="rounded-md border overflow-hidden"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "var(--surface-raised)" }}>
              {["Date", "Description", "Category", "Amount", "Actions"].map((col, i) => (
                <TableHead
                  key={col}
                  className={`text-[10px] font-bold uppercase tracking-widest ${i >= 3 ? "text-right" : ""}`}
                  style={{ color: "var(--fortress-steel)" }}
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleTransactions.length > 0 ? (
              visibleTransactions.map(t => (
                <TableRow
                  key={t.id}
                  className="transition-colors"
                  style={{ borderColor: "var(--border-subtle)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-raised)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <TableCell className="text-xs font-mono whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                  </TableCell>

                  <TableCell
                    className="max-w-[200px] truncate font-semibold text-sm"
                    style={{ color: "var(--text-primary)" }}
                    title={t.description}
                  >
                    {t.description}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getCategoryColor(t.category) }}
                      />
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: "var(--surface-raised)",
                          color:           "var(--fortress-steel)",
                          border:          "1px solid var(--border-subtle)",
                        }}
                      >
                        {t.category}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell
                    className="text-right font-bold font-mono text-sm"
                    style={{ color: t.type === "income" ? "var(--field-green)" : "var(--castle-red)" }}
                  >
                    {t.type === "income" ? "+" : "−"}
                    ${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 transition-colors"
                        style={{ color: "var(--fortress-steel)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--engine-navy)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--fortress-steel)")}
                        onClick={() => onEdit(t)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 transition-colors"
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
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="h-10 w-10 opacity-20" style={{ color: "var(--fortress-steel)" }} />
                    <p className="font-semibold text-sm" style={{ color: "var(--fortress-steel)" }}>
                      No transactions found
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Adjust your search or check your archived data.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}