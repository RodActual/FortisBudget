import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { auth } from "../firebase";
import type { Budget } from "../App";

interface BudgetManagerProps {
  budgets: Budget[];
  onUpdateBudgets: (budgets: Budget[]) => void;
  transactions: any[];
}
export const getSuggestedCategory = (description: string): string => {
  const desc = description.toLowerCase();
  
  // High-frequency merchant matching
  if (/housing|rent|mortgage|apartment|hoa/.test(desc)) return "Housing";
  if (/kroger|meijer|walmart|aldi|costco|publix|wholefoods|food|grocery/.test(desc)) return "Food";
  if (/shell|exxon|sheets|bp|speedway|uber|lyft|tesla|transport/.test(desc)) return "Transportation";
  if (/electric|water|gas|waste|comcast|spectrum|verizon|att/.test(desc)) return "Utilities";
  if (/netflix|spotify|hulu|apple|disney|hbo|gaming|minecraft|steam/.test(desc)) return "Entertainment";
  if (/cvs|walgreens|doctor|hospital|pharmacy|insurance|health/.test(desc)) return "Health";
  if (/amazon|target|best buy|nike|tj maxx|shopping/.test(desc)) return "Shopping";
  
  return "Other";
};

const INITIAL_BUDGETS = [
  { category: "Housing",        budgeted: 0, color: "#1E293B" },
  { category: "Groceries",      budgeted: 0, color: "#059669" },
  { category: "Dining Out",     budgeted: 0, color: "#DC2626" },
  { category: "Utilities",      budgeted: 0, color: "#D97706" },
  { category: "Transportation", budgeted: 0, color: "#2563EB" },
  { category: "Subscriptions",  budgeted: 0, color: "#7C3AED" },
  { category: "Shopping",       budgeted: 0, color: "#DB2777" },
  { category: "Health",         budgeted: 0, color: "#0891B2" },
  { category: "Other",          budgeted: 0, color: "#94A3B8" },
];

const COMMON_CATEGORIES = INITIAL_BUDGETS.map(b => b.category);

function getBudgetTier(spent: number, budgeted: number) {
  if (budgeted === 0) return { barColor: "#475569", labelColor: "#475569", label: "—" };
  const pct = (spent / budgeted) * 100;
  if (pct > 100)  return { barColor: "#000000", labelColor: "#8B1219", label: "OVER BUDGET" };
  if (pct >= 80)  return { barColor: "#8B1219", labelColor: "#8B1219", label: "CRITICAL" };
  if (pct >= 60)  return { barColor: "#D97706", labelColor: "#D97706", label: "CAUTION" };
  return               { barColor: "#166534", labelColor: "#166534", label: "SECURE" };
}

export function BudgetManager({ budgets, onUpdateBudgets, transactions }: BudgetManagerProps) {
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [editingBudget, setEditingBudget]   = useState<Budget | null>(null);
  const [category, setCategory]             = useState("");
  const [budgetAmount, setBudgetAmount]     = useState("");
  const [selectedColor, setSelectedColor]   = useState("#3B82F6");

  // Determine if combat mode is active (adjust this logic based on your global state if needed)
  const isCombat = false; 

  useEffect(() => {
    if (budgets.length === 0 && auth.currentUser) {
      const initialBudgets: Budget[] = INITIAL_BUDGETS.map((b, i) => ({
        id: `budget_initial_${i}_${auth.currentUser?.uid}`,
        userId: auth.currentUser?.uid,
        category: b.category,
        budgeted: b.budgeted,
        spent: 0,
        lastReset: Date.now(),
        color: b.color,
      }));
      const t = setTimeout(() => onUpdateBudgets(initialBudgets), 100);
      return () => clearTimeout(t);
    }
  }, [budgets, auth.currentUser]);

  const openAddDialog = () => {
    setEditingBudget(null);
    setCategory("");
    setBudgetAmount("");
    setSelectedColor("#3B82F6");
    setDialogOpen(true);
  };

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setCategory(budget.category);
    setBudgetAmount(budget.budgeted.toString());
    setSelectedColor(budget.color);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!category.trim() || !budgetAmount || parseFloat(budgetAmount) <= 0) {
      alert("Please enter a valid category and budget amount");
      return;
    }

    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      alert("Session error: Please log in again to save budgets.");
      return;
    }

    const now = Date.now();
    const newBudget: Budget = {
      id:        editingBudget?.id || `budget_${now}`,
      userId:    currentUserId,
      category:  category.trim(),
      budgeted:  parseFloat(budgetAmount),
      spent:     editingBudget ? budgets.find(b => b.id === editingBudget.id)?.spent || 0 : 0,
      color:     selectedColor,
      lastReset: editingBudget?.lastReset || now,
    };

    onUpdateBudgets(
      editingBudget
        ? budgets.map(b => b.id === editingBudget.id ? newBudget : b)
        : [...budgets, newBudget]
    );
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this budget category?")) {
      onUpdateBudgets(budgets.filter(b => b.id !== id));
    }
  };

  const totalBudget = budgets.reduce((s, b) => s + b.budgeted, 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent,    0);
  const isOverAll   = totalSpent > totalBudget;

  return (
    <>
      <Card className="border" style={{ borderColor: "var(--border-subtle)" }}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                Budget Categories
              </CardTitle>
              <CardDescription style={{ color: "var(--fortress-steel)" }}>
                Set and manage budgets for different spending categories
              </CardDescription>
            </div>
            <Button
              onClick={openAddDialog}
              size="sm"
              className="font-bold text-white gap-1.5"
              style={{
                backgroundColor: "var(--castle-red)",
                border: "none",
                boxShadow: "0 2px 0 0 var(--castle-red-dark)",
              }}
            >
              <Plus className="h-4 w-4" />
              Add Budget
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {budgets.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
              Initialize your Fortis budget categories...
            </p>
          ) : (
            <>
              <div
                className="rounded-md p-4 mb-5 grid grid-cols-2 gap-4 border"
                style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--fortress-steel)" }}>
                    Total Budget
                  </p>
                  <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                    ${totalBudget.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--fortress-steel)" }}>
                    Total Spent
                  </p>
                  <p
                    className="text-2xl font-bold font-mono"
                    style={{ color: isOverAll ? "var(--castle-red)" : "var(--field-green)" }}
                  >
                    ${totalSpent.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {budgets.map((budget) => {
                  const rawPct = budget.budgeted > 0 ? (budget.spent / budget.budgeted) * 100 : 0;
                  const pct = isNaN(rawPct) ? 0 : rawPct;
                  const tier = getBudgetTier(budget.spent, budget.budgeted);
                  const isOver = budget.spent > budget.budgeted;

                  return (
                    <div
                      key={budget.id}
                      className="rounded-md p-3.5 border transition-all"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: budget.color }} />
                          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {budget.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold font-mono" style={{ color: "var(--fortress-steel)" }}>
                            ${Number(budget.spent).toFixed(0)} / ${budget.budgeted}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{ color: tier.labelColor, backgroundColor: "var(--surface-raised)" }}
                          >
                            {tier.label}
                          </span>
                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              onClick={() => openEditDialog(budget)}
                              className="p-1 rounded transition-colors hover:bg-slate-100"
                              style={{ color: "var(--fortress-steel)" }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(budget.id!)}
                              className="p-1 rounded transition-colors hover:bg-red-50"
                              style={{ color: "var(--castle-red)" }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Replacement Progress Bar Code */}
                      <div style={{ 
                        width: "100%", 
                        height: "6px", 
                        borderRadius: "9999px", 
                        overflow: "hidden",
                        backgroundColor: isCombat ? "rgba(255,255,255,0.12)" : "var(--border-subtle)"
                      }}>
                        <div style={{ 
                          width: `${Math.min(pct, 100)}%`, 
                          height: "6px",
                          borderRadius: "9999px",
                          backgroundColor: tier.barColor,
                          transition: "width 700ms"
                        }} />
                      </div>

                      {isOver && (
                        <p className="text-[11px] font-bold font-mono mt-2" style={{ color: "var(--castle-red)" }}>
                          ▲ ${(budget.spent - budget.budgeted).toFixed(2)} over budget
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
          <DialogHeader>
            <DialogTitle className="font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {editingBudget ? "Edit Budget" : "Add Budget Category"}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--fortress-steel)" }}>
              {editingBudget
                ? "Update the budget amount or category details."
                : "Create a new category to track your spending."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                Category Name
              </Label>
              <Input
                placeholder="e.g., Food, Transportation"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="category-suggestions"
                style={{
                  backgroundColor: "var(--surface-raised)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                Budget Amount
              </Label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold font-mono pointer-events-none"
                  style={{ color: "var(--fortress-steel)" }}
                >
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="pl-7 font-mono"
                  style={{
                    backgroundColor: "var(--surface-raised)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                Category Color
              </Label>
              <input
                type="color"
                className="w-full h-8 rounded cursor-pointer"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="font-bold text-white"
              style={{
                backgroundColor: "var(--castle-red)",
                border: "none",
                boxShadow: "0 2px 0 0 var(--castle-red-dark)",
              }}
            >
              {editingBudget ? "Update" : "Create"} Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}