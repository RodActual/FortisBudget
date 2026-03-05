import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../ui/select";
import { MoneyInput } from "./MoneyInput";
import type { Transaction, Budget } from "../App";
import { parseDateInput, formatDateForInput } from "../utils/dateUtils";
import type { SavingsVault } from "../utils/shieldLogic";
import { ShieldCheck, Zap } from "lucide-react";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  onEditTransaction: (transaction: Omit<Transaction, "id">) => void;
  editingTransaction: Transaction | null;
  budgets: Budget[];
  savingsBuckets?: SavingsVault[];
  onUpdateVault?: (id: string, updates: Partial<SavingsVault>) => Promise<void>;
}

const labelStyle: React.CSSProperties = {
  color:         "var(--text-primary)",
  fontWeight:    600,
  fontSize:      "0.8125rem",
  letterSpacing: "0.01em",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--surface-raised)",
  borderColor:     "var(--border-subtle)",
  color:           "var(--text-primary)",
};

export function AddTransactionDialog({
  open,
  onOpenChange,
  onAddTransaction,
  onEditTransaction,
  editingTransaction,
  budgets,
  savingsBuckets = [],
  onUpdateVault,
}: AddTransactionDialogProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount]           = useState<number>(0);
  const [category, setCategory]       = useState("");
  const [type, setType]               = useState<"income" | "expense">("expense");
  const [date, setDate]               = useState(formatDateForInput(new Date()));
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (editingTransaction) {
      setDescription(editingTransaction.description);
      setAmount(editingTransaction.amount);
      setCategory(editingTransaction.category);
      setType(editingTransaction.type);
      setDate(formatDateForInput(editingTransaction.date));
    } else {
      setDescription("");
      setAmount(0);
      setCategory("");
      setType("expense");
      setDate(formatDateForInput(new Date()));
      setAllocations({});
    }
  }, [editingTransaction, open]);

  const handleAllocationChange = (vaultId: string, val: number) => {
    setAllocations(prev => ({ ...prev, [vaultId]: val }));
  };

  // ─── AUTO-FILL ENGINE ───────────────────────────────────────────────────
  const handleAutoFill = () => {
    // Force amount to a strict number to prevent string math bugs
    let remaining = Number(amount) || 0;
    if (remaining <= 0) return;

    const newAllocs: Record<string, number> = {};

    for (const vault of savingsBuckets) {
      if (remaining <= 0) break;

      // Ensure all Firestore values are parsed strictly as numbers
      const currentBal = Number(vault.currentBalance) || 0;
      const target = Number(vault.monthlyTarget) || 0;
      const rawCeiling = Number(vault.ceilingAmount) || 0;
      
      // If ceiling is 0 or null, treat as uncapped
      const ceiling = rawCeiling > 0 ? rawCeiling : Infinity;

      // How much room before hitting the ceiling
      const spaceLeft = Math.max(0, ceiling - currentBal);

      // We want to fund up to the monthly target, but never exceed the ceiling
      const idealAmount = Math.min(target, spaceLeft);

      if (idealAmount <= 0) continue; // vault already maxed or target is 0, skip

      // Claim as much of the ideal amount as the remaining deposit allows
      const claimed = Math.min(idealAmount, remaining);
      if (claimed > 0) {
        newAllocs[vault.id] = claimed;
        remaining -= claimed;
      }
    }

    setAllocations(newAllocs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Income transactions don't need a manual category — assign automatically
    const finalCategory = type === "income" ? "Income" : category;
    if (!description || amount <= 0 || !finalCategory) return;

    const transactionData = {
      date: parseDateInput(date),
      description,
      category: finalCategory,
      amount,
      type,
    };

    if (editingTransaction) {
      onEditTransaction(transactionData);
    } else {
      onAddTransaction(transactionData);

      // Commit vault allocations after logging the transaction
      if (type === "income" && onUpdateVault) {
        for (const vaultId of Object.keys(allocations)) {
          const addedAmount = allocations[vaultId];
          if (addedAmount > 0) {
            const targetVault = savingsBuckets.find(v => v.id === vaultId);
            if (targetVault) {
              await onUpdateVault(vaultId, {
                currentBalance: Number(targetVault.currentBalance) + addedAmount,
              });
            }
          }
        }
      }

      setDescription("");
      setAmount(0);
      setCategory("");
      setAllocations({});
    }
  };

  const uniqueCategories = Array.from(new Set([
    ...budgets.map(b => b.category),
    "Other",
  ]));

  const totalAllocated  = Object.values(allocations).reduce((sum, v) => sum + Number(v || 0), 0);
  const isOverAllocated = totalAllocated > amount;
  const toSpendable     = Math.max(0, amount - totalAllocated);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] flex flex-col p-0 gap-0"
        style={{
          backgroundColor: "var(--surface)",
          borderColor:     "var(--border-subtle)",
          maxHeight:       "85vh",
          overflow:        "hidden",
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">

          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle
                className="text-lg font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {editingTransaction ? "Edit Transaction" : "Log Transaction"}
              </DialogTitle>
              <DialogDescription style={{ color: "var(--fortress-steel)" }}>
                {editingTransaction
                  ? "Update the transaction details below."
                  : "Record a new income or expense entry."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 pr-1">

              {/* Type */}
              <div className="grid gap-1.5">
                <Label htmlFor="type" style={labelStyle}>Type</Label>
                <Select value={type} onValueChange={(v: "income" | "expense") => setType(v)}>
                  <SelectTrigger
                    id="type"
                    style={{
                      ...inputStyle,
                      color:      type === "income" ? "var(--field-green)" : "var(--castle-red)",
                      fontWeight: 600,
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                    <SelectItem value="expense">
                      <span style={{ color: "var(--castle-red)", fontWeight: 600 }}>Expense</span>
                    </SelectItem>
                    <SelectItem value="income">
                      <span style={{ color: "var(--field-green)", fontWeight: 600 }}>Income</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date + Amount row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="date" style={labelStyle}>Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="amount" style={labelStyle}>Amount</Label>
                  <MoneyInput
                    id="amount"
                    value={amount}
                    onChange={setAmount}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="grid gap-1.5">
                <Label htmlFor="description" style={labelStyle}>Description</Label>
                <Input
                  id="description"
                  placeholder={type === "income" ? "e.g. Paycheck" : "e.g. Groceries"}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Category — expenses only */}
              {type === "expense" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="category" style={labelStyle}>Category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger
                      id="category"
                      style={{
                        ...inputStyle,
                        color: category ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                      {uniqueCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vault allocation panel — income only */}
              {type === "income" && !editingTransaction && savingsBuckets.length > 0 && (
                <div
                  className="mt-1 p-3 rounded-lg border space-y-3"
                  style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--engine-navy)" }}>
                          <ShieldCheck className="w-3.5 h-3.5" /> Shield
                        </h4>
                        {amount > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAutoFill}
                            className="h-5 px-2 text-[9px] font-bold uppercase tracking-wider"
                            style={{ backgroundColor: "rgba(27, 38, 59, 0.1)", color: "var(--engine-navy)" }}
                          >
                            <Zap className="w-3 h-3 mr-1" /> Auto-Fill
                          </Button>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-mono font-bold"
                        style={{ color: isOverAllocated ? "var(--castle-red)" : "var(--fortress-steel)" }}
                      >
                        ${totalAllocated.toFixed(2)} / ${amount.toFixed(2)}
                      </span>
                    </div>

                    {totalAllocated === 0 && amount > 0 && (
                      <p className="text-[10px] italic leading-tight" style={{ color: "var(--fortress-steel)" }}>
                        * Allocating $0 bypasses the shield. 100% of this deposit will flow into your spendable budget.
                      </p>
                    )}
                    {isOverAllocated && (
                      <p className="text-[10px] font-bold leading-tight" style={{ color: "var(--castle-red)" }}>
                        Warning: Allocated more than deposit amount.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {savingsBuckets.map(vault => {
                      const allocatedValue = allocations[vault.id] || 0;
                      return (
                        <div key={vault.id} className="grid grid-cols-3 items-center gap-2">
                          <div className="col-span-2 flex flex-col min-w-0 pr-2">
                            <Label className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                              {vault.name}
                            </Label>
                            <span className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                              Bal: ${Number(vault.currentBalance).toLocaleString()} / ${Number(vault.monthlyTarget).toLocaleString()}
                            </span>
                          </div>
                          
                          {/* THE FIX: Removed the specific text-right, h-8, and text-xs classes so it matches the main amount input */}
                          <div className="col-span-1">
                            <MoneyInput
                              key={`vault-input-${vault.id}-${allocatedValue}`}
                              value={allocatedValue}
                              onChange={val => handleAllocationChange(vault.id, val)}
                            />
                          </div>

                        </div>
                      );
                    })}
                  </div>

                  {amount > 0 && (
                    <div
                      className="flex justify-between items-center pt-2 border-t"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--field-green)" }}>
                        To Spendable
                      </span>
                      <span className="text-xs font-bold font-mono" style={{ color: "var(--field-green)" }}>
                        +${toSpendable.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          <div
            className="px-6 py-4 border-t shrink-0"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}
          >
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                style={{
                  borderColor:     "var(--border-subtle)",
                  color:           "var(--fortress-steel)",
                  backgroundColor: "transparent",
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isOverAllocated}
                className="font-bold tracking-wide text-white"
                style={{
                  backgroundColor: "var(--castle-red)",
                  boxShadow:       "0 2px 0 0 var(--castle-red-dark)",
                  border:          "none",
                  opacity:         isOverAllocated ? 0.5 : 1,
                }}
              >
                {editingTransaction ? "Update" : "Log"} Transaction
              </Button>
            </DialogFooter>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}