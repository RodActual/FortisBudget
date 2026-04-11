import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Plus, 
  TrendingDown, 
  TrendingUp, 
  Wallet, 
  ShieldCheck, 
  Infinity, 
  AlertCircle,
  ShieldAlert,
  CalendarClock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type { Budget, Transaction, RecurringRule } from "../App";
import { DailyTipCard } from "./DailyTipCard";
import { useUserSettings } from "../hooks/useUserSettings";
import type { SavingsVault } from "../utils/shieldLogic";

interface DashboardOverviewProps {
  budgets: Budget[];
  transactions: Transaction[];
  savingsBuckets?: SavingsVault[];
  pendingApprovals?: RecurringRule[]; // NEW
  onAcceptRecurring?: (rule: RecurringRule) => void; // NEW
  onSkipRecurring?: (rule: RecurringRule) => void; // NEW
  onOpenAddTransaction: () => void;
}

function getVaultProgressColor(pct: number): string {
  if (pct >= 70) return "var(--field-green)";
  if (pct >= 30) return "var(--safety-amber)";
  return "var(--castle-red)";
}

function getBudgetTier(spent: number, budgeted: number): {
  className: string;
  barColor: string;
  labelColor: string;
  label: string;
} {
  if (budgeted === 0) {
    return {
      className: "",
      barColor: "var(--fortress-steel)",
      labelColor: "var(--fortress-steel)",
      label: "—",
    };
  }

  const pct = (spent / budgeted) * 100;

  if (spent > budgeted) {
    return {
      className: "budget-combat",
      barColor: "var(--castle-red)",
      labelColor: "#FCA5A5",
      label: "OVER BUDGET",
    };
  }
  if (pct >= 100) {
    return {
      className: "budget-breach",
      barColor: "#991B1B",
      labelColor: "#991B1B",
      label: "BREACH",
    };
  }
  if (pct >= 85) {
    return {
      className: "budget-caution",
      barColor: "var(--safety-amber)",
      labelColor: "var(--safety-amber)",
      label: "CAUTION",
    };
  }
  return {
    className: "budget-secure",
    barColor: "var(--field-green)",
    labelColor: "var(--field-green)",
    label: "SECURE",
  };
}

export function DashboardOverview({
  budgets,
  transactions,
  savingsBuckets = [],
  pendingApprovals = [], // NEW
  onAcceptRecurring,     // NEW
  onSkipRecurring,       // NEW
  onOpenAddTransaction,
}: DashboardOverviewProps) {
  const { userName, shieldAllocationPct } = useUserSettings();

  // ─── CORE MATHEMATICAL ENGINE ────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = transactions.filter(t => !t.archived);

    const totalIncome = active
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalExpenses = active
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const netBalance = totalIncome - totalExpenses;

    const shieldTarget = totalIncome * (shieldAllocationPct / 100);

    const totalVaultBalance = savingsBuckets.reduce(
      (sum, v) => sum + Number(v.currentBalance || 0), 0
    );
    const availableToSpend = netBalance - totalVaultBalance;

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      shieldTarget,
      availableToSpend,
      totalVaultBalance,
    };
  }, [transactions, savingsBuckets, shieldAllocationPct]);

  // ─── RECENT ACTIVITY ────────────────────────────────────────────────────
  const recentTransactions = useMemo(() => (
    [...transactions]
      .filter(t => !t.archived)
      .sort((a, b) => Number(b.date) - Number(a.date))
      .slice(0, 5)
  ), [transactions]);

  return (
    <div className="space-y-6">

      {/* ─── ROW 1: WELCOME & PRIMARY ACTION ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 w-full text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Welcome back, <span style={{ color: 'var(--castle-red)' }}>{userName}</span>
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--fortress-steel)' }}>
            Fortress operational. Your vault is secure.
          </p>
        </div>
        <Button
          onClick={onOpenAddTransaction}
          size="lg"
          className="font-bold tracking-wide text-white w-full md:w-auto px-8 transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--castle-red)',
            borderColor: 'var(--castle-red-dark)',
            boxShadow: '0 2px 0 0 var(--castle-red-dark)',
          }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Log Transaction
        </Button>
      </div>

      {/* ─── NEW: PENDING APPROVALS BANNER ─── */}
      {pendingApprovals.length > 0 && (
        <Card className="border-2 animate-in slide-in-from-top-4" style={{ borderColor: 'var(--safety-amber)', backgroundColor: '#FFFBEB' }}>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <CalendarClock className="w-5 h-5" style={{ color: 'var(--safety-amber)' }} />
            <CardTitle className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--engine-navy)' }}>
              Action Required: {pendingApprovals.length} Recurring Item{pendingApprovals.length > 1 ? 's' : ''} Due
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map(rule => (
              <div 
                key={rule.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-white shadow-sm gap-3"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{rule.description}</p>
                  <p className="text-xs font-mono font-medium mt-1" style={{ color: rule.type === 'expense' ? 'var(--castle-red)' : 'var(--field-green)' }}>
                    {rule.type === 'expense' ? '−' : '+'}${Number(rule.amount).toFixed(2)} <span className="text-[10px] uppercase font-sans ml-1" style={{ color: 'var(--fortress-steel)' }}>({rule.category})</span>
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 sm:flex-none text-xs font-bold"
                    onClick={() => onSkipRecurring && onSkipRecurring(rule)}
                    style={{ color: 'var(--fortress-steel)', borderColor: 'var(--border-subtle)' }}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Skip Month
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 sm:flex-none text-xs font-bold text-white"
                    onClick={() => onAcceptRecurring && onAcceptRecurring(rule)}
                    style={{ backgroundColor: 'var(--engine-navy)' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Log & Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DailyTipCard />

      {/* ─── ROW 2: STRATEGIC SUMMARY CARDS ─── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* Card 1: Net Balance */}
        <Card className="border" style={{ borderColor: 'var(--border-subtle)' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Net Balance
            </CardTitle>
            <div className="p-1.5 rounded-md" style={{ backgroundColor: 'var(--surface-raised)' }}>
              <Wallet className="h-4 w-4" style={{ color: 'var(--engine-navy)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" style={{ color: stats.netBalance >= 0 ? 'var(--field-green)' : 'var(--castle-red)' }}>
              ${stats.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] mt-1 text-muted-foreground uppercase font-bold">Income vs Expenses</p>
          </CardContent>
        </Card>

        {/* Card 2: Shield Target (reference metric only) */}
        <Card className="border" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-raised)' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--engine-navy)' }}>
              Shield Target
            </CardTitle>
            <div className="p-1.5 rounded-md" style={{ backgroundColor: '#DBEAFE' }}>
              <ShieldAlert className="h-4 w-4" style={{ color: 'var(--engine-navy)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" style={{ color: 'var(--engine-navy)' }}>
              ${stats.shieldTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] mt-1 text-muted-foreground uppercase font-bold">{shieldAllocationPct}% Reserve Goal</p>
          </CardContent>
        </Card>

        {/* Card 3: Total Expenses */}
        <Card className="border" style={{ borderColor: 'var(--border-subtle)' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Total Expenses
            </CardTitle>
            <div className="p-1.5 rounded-md" style={{ backgroundColor: '#FEE2E2' }}>
              <TrendingDown className="h-4 w-4" style={{ color: 'var(--castle-red)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" style={{ color: 'var(--castle-red)' }}>
              ${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] mt-1 text-muted-foreground uppercase font-bold">Total Spending Logged</p>
          </CardContent>
        </Card>

        {/* Card 4: Available Budget — vault-corrected */}
        <Card className="border" style={{ borderColor: 'var(--border-subtle)' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--field-green)' }}>
              Available Budget
            </CardTitle>
            <div className="p-1.5 rounded-md" style={{ backgroundColor: '#DCFCE7' }}>
              <ShieldCheck className="h-4 w-4" style={{ color: 'var(--field-green)' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" style={{ color: stats.availableToSpend >= 0 ? 'var(--field-green)' : 'var(--castle-red)' }}>
              ${stats.availableToSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] mt-1 text-muted-foreground uppercase font-bold">
              Net − ${stats.totalVaultBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} Vaulted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── ROW 3: VAULT PROGRESS SECTION ─── */}
      <Card className="border shadow-sm" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--surface-raised)' }}>
        <CardHeader className="pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--engine-navy)' }}>
            <ShieldCheck className="w-4 h-4" /> Active Savings Vaults
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {savingsBuckets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed rounded-lg" style={{ borderColor: 'var(--border-subtle)' }}>
              <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">No Manual Vaults Found</p>
              <p className="text-[10px] mt-1 text-muted-foreground">Initialize targets in the Settings tab to track specific savings.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savingsBuckets.map(vault => {
                const hasCeiling = vault.ceilingAmount !== null && Number(vault.ceilingAmount) > 0;
                const isCapped   = hasCeiling && Number(vault.currentBalance) >= Number(vault.ceilingAmount);
                const pct        = hasCeiling
                  ? Math.min((Number(vault.currentBalance) / Number(vault.ceilingAmount)) * 100, 100)
                  : 0;

                return (
                  <div key={vault.id} className="p-4 rounded-md border bg-white dark:bg-slate-900 flex flex-col gap-3 shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{vault.name}</span>
                      {isCapped ? (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#DCFCE7', color: 'var(--field-green)' }}>Maxed</span>
                      ) : !hasCeiling ? (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: '#F1F5F9', color: 'var(--engine-navy)' }}>
                          <Infinity className="w-3 h-3" /> Uncapped
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono" style={{ color: 'var(--engine-navy)' }}>
                        ${Number(vault.currentBalance).toLocaleString()}
                      </span>
                      {hasCeiling && (
                        <span className="text-[10px] font-mono opacity-50">/ ${Number(vault.ceilingAmount).toLocaleString()}</span>
                      )}
                    </div>

                    <div className="space-y-1.5 mt-1">
                      {hasCeiling && (
                        <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
                          <div
                            className="h-full transition-all duration-1000 ease-in-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isCapped ? 'var(--field-green)' : getVaultProgressColor(pct),
                            }}
                          />
                        </div>
                      )}
                      <div className="flex justify-between text-[10px] font-bold font-mono mt-1" style={{ color: 'var(--fortress-steel)' }}>
                        <span>Target: ${Number(vault.monthlyTarget).toLocaleString()}/mo</span>
                        {hasCeiling && <span>{Math.round(pct)}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── ROW 4: BUDGET STATUS & RECENT ACTIVITY ─── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* Budget Status */}
        <Card className="col-span-4 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Budget Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgets.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No budgets configured yet.</div>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const pct      = budget.budgeted > 0 ? (budget.spent / budget.budgeted) * 100 : 0;
                  const tier     = getBudgetTier(budget.spent, budget.budgeted);
                  const isCombat = budget.spent > budget.budgeted;

                  return (
                    <div
                      key={budget.id}
                      className={`rounded-md p-3.5 border transition-all ${tier.className}`}
                      style={{
                        backgroundColor: isCombat ? 'var(--engine-navy)' : 'var(--surface)',
                        borderColor:     isCombat ? 'transparent' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isCombat ? '#FCA5A5' : budget.color }} />
                          <span className="text-sm font-bold" style={{ color: isCombat ? '#FFFFFF' : 'var(--text-primary)' }}>
                            {budget.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold font-mono" style={{ color: isCombat ? '#CBD5E1' : 'var(--fortress-steel)' }}>
                            ${Number(budget.spent).toFixed(0)} / ${budget.budgeted}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{
                              color: tier.labelColor,
                              backgroundColor: isCombat ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
                            }}
                          >
                            {tier.label}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: isCombat ? 'rgba(255,255,255,0.12)' : 'var(--border-subtle)' }}>
                        <div
                          className="h-full transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: tier.barColor }}
                        />
                      </div>
                      {isCombat && (
                        <p className="text-[11px] font-bold mt-2 font-mono" style={{ color: '#FCA5A5' }}>
                          ▲ ${(budget.spent - budget.budgeted).toFixed(2)} Over Budget
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-3 border" style={{ borderColor: 'var(--border-subtle)' }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No recent entries.</div>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between border-b border-dashed pb-4 last:border-0 last:pb-0"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2 rounded-md" style={{ backgroundColor: t.type === "income" ? "#DCFCE7" : "#FEE2E2" }}>
                        {t.type === "income"
                          ? <TrendingUp  className="h-4 w-4" style={{ color: 'var(--field-green)' }} />
                          : <TrendingDown className="h-4 w-4" style={{ color: 'var(--castle-red)' }} />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                          {t.description}
                        </p>
                        <p className="text-[10px] uppercase font-bold tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {t.category} &bull; {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold font-mono" style={{ color: t.type === "income" ? 'var(--field-green)' : 'var(--castle-red)' }}>
                      {t.type === "income" ? "+" : "−"}${Math.abs(Number(t.amount)).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}