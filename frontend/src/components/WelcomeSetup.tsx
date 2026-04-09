import { useState, useEffect } from "react";
import { doc, writeBatch, collection } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { ArrowRight, CheckCircle2, DollarSign, Info, User, ShieldCheck, Plus, X, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { FortisLogo } from "./FortisLogo";
import { MoneyInput } from "./MoneyInput";

const INITIAL_RECOMMENDATIONS = [
  { id: "housing",    name: "Housing",        ratio: 0.30, color: "#1B263B" },
  { id: "groceries",  name: "Groceries",      ratio: 0.15, color: "#10B981" },
  { id: "utilities",  name: "Utilities",      ratio: 0.10, color: "#F59E0B" },
  { id: "transport",  name: "Transportation", ratio: 0.10, color: "#3B82F6" },
];

const VAULT_PRESETS = [
  { name: "Emergency Fund", monthlyTarget: 200, ceilingAmount: 10000 },
  { name: "Vacation",       monthlyTarget: 100, ceilingAmount: null  },
  { name: "Car Repair",     monthlyTarget: 75,  ceilingAmount: 2000  },
  { name: "New Device",     monthlyTarget: 50,  ceilingAmount: 1500  },
];

interface VaultDraft {
  name: string;
  monthlyTarget: number;
  ceilingAmount: number | null;
}

interface WelcomeSetupProps {
  userId: string;
  onComplete: () => void;
}

export function WelcomeSetup({ userId, onComplete }: WelcomeSetupProps) {
  const [step, setStep]                   = useState(1);
  const [name, setName]                   = useState("");
  const [income, setIncome]               = useState("");
  const [shieldPercent, setShieldPercent] = useState(20);
  const [loading, setLoading]             = useState(false);
  const [budgets, setBudgets]             = useState<{ name: string; limit: number; color: string }[]>([]);
  const [error, setError]                 = useState("");

  // ── Vault state ──────────────────────────────────────────────────────────
  const [vaults, setVaults]               = useState<VaultDraft[]>([]);
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [vaultForm, setVaultForm]         = useState<VaultDraft>({ name: "", monthlyTarget: 0, ceilingAmount: null });

  // ── Budget form state ──────────────────────────────────────────────────────────
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm]         = useState({ name: "", limit: 0, color: "#6366F1" });

  const BUDGET_COLORS = [
    "#6366F1", "#8B1219", "#1B263B", "#166534",
    "#D97706", "#3B82F6", "#EC4899", "#475569",
  ];

  const numericIncome   = parseFloat(income) || 0;
  const shieldedAmount  = Math.floor(numericIncome * (shieldPercent / 100));
  const spendableAmount = numericIncome - shieldedAmount;

  // How much of the shield goal is covered by vault monthly targets
  const totalVaultTarget = vaults.reduce((sum, v) => sum + v.monthlyTarget, 0);
  const vaultVsShield    = shieldedAmount > 0 ? Math.min((totalVaultTarget / shieldedAmount) * 100, 100) : 0;
  const isOverCommitted  = totalVaultTarget > shieldedAmount && shieldedAmount > 0;

  useEffect(() => {
    if (step === 1) {
      setBudgets(INITIAL_RECOMMENDATIONS.map(cat => ({
        name:  cat.name,
        limit: Math.floor(spendableAmount * cat.ratio),
        color: cat.color,
      })));
    }
  }, [spendableAmount, step]);

  const handleNext = () => {
    if (step === 1 && numericIncome > 0 && name.trim().length > 0) setStep(2);
    if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  // ── Vault CRUD ───────────────────────────────────────────────────────────
  const addPreset = (preset: typeof VAULT_PRESETS[number]) => {
    if (vaults.some(v => v.name === preset.name)) return;
    setVaults(prev => [...prev, { ...preset }]);
  };

  const addCustomVault = () => {
    if (!vaultForm.name || vaultForm.monthlyTarget <= 0) return;
    setVaults(prev => [...prev, { ...vaultForm }]);
    setVaultForm({ name: "", monthlyTarget: 0, ceilingAmount: null });
    setShowVaultForm(false);
  };

  const removeVault = (i: number) => setVaults(prev => prev.filter((_, idx) => idx !== i));

  const addCustomBudget = () => {
    if (!budgetForm.name || budgetForm.limit <= 0) return;
    setBudgets(prev => [...prev, { name: budgetForm.name, limit: budgetForm.limit, color: budgetForm.color }]);
    setBudgetForm({ name: "", limit: 0, color: "#6366F1" });
    setShowBudgetForm(false);
  };

  const removeBudget = (i: number) => setBudgets(prev => prev.filter((_, idx) => idx !== i));

  // ── Final submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (numericIncome <= 0) return;
    setLoading(true);
    setError("");
    try {
      const batch = writeBatch(db);
      const userEmail = auth.currentUser?.email || "";

      batch.set(doc(db, "userSettings", userId), {
        userId:               userId,
        email:                userEmail, // Required for Nodemailer to find the destination
        userName:             name.trim(),
        monthlyIncome:        numericIncome,
        shieldAllocationPct:  shieldPercent,
        savingsGoal:          shieldedAmount,
        isSetupComplete:      true,
        updatedAt:            new Date().toISOString(),
        notificationsEnabled: true,
        alertSettings: {
          budgetWarningEnabled:    true,
          budgetWarningThreshold:  80,
          budgetExceededEnabled:   true,
          largeTransactionEnabled: true,
          largeTransactionAmount:  500,
          weeklyReportEnabled:     false,
          dismissedAlertIds:       [],
        },
      }, { merge: true });

      budgets.forEach(cat => {
        const ref = doc(collection(db, "budgets"));
        batch.set(ref, {
          userId,
          category:  cat.name,
          budgeted:  cat.limit,
          spent:     0,
          color:     cat.color,
          lastReset: Date.now(),
        });
      });

      vaults.forEach(vault => {
        const ref = doc(collection(db, "savingsBuckets"));
        batch.set(ref, {
          userId,
          name:           vault.name,
          monthlyTarget:  vault.monthlyTarget,
          currentBalance: 0,
          ceilingAmount:  vault.ceilingAmount ?? null,
          createdAt:      Date.now(),
        });
      });

      await batch.commit();
      onComplete();
    } catch (err: any) {
      setError("Failed to save setup. Please try again. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const STEP_LABELS = ["Identity & Income", "Vault Setup", "Review & Commit"];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <style>{`
        .fortis-range { -webkit-appearance: none; width: 100%; background: transparent; }
        .fortis-range::-webkit-slider-runnable-track { height: 6px; border-radius: 4px; background: var(--border-subtle); cursor: pointer; }
        .fortis-range::-webkit-slider-thumb { -webkit-appearance: none; height: 22px; width: 22px; border-radius: 50%; background: var(--castle-red); cursor: pointer; margin-top: -8px; box-shadow: 0 2px 6px rgba(139,18,25,0.4); }
        .fortis-range:focus { outline: none; }
      `}</style>

      <Card
        className="w-full max-w-2xl shadow-2xl border-t-4"
        style={{
          backgroundColor: "var(--surface)",
          borderColor:     "var(--border-subtle)",
          borderTopColor:  "var(--castle-red)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <CardHeader className="text-center pb-6" style={{ backgroundColor: "var(--surface-raised)" }}>
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg"
            style={{ backgroundColor: "var(--engine-navy)" }}
          >
            <FortisLogo className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Initialize Your Vault
          </CardTitle>
          <CardDescription className="text-base mt-1" style={{ color: "var(--fortress-steel)" }}>
            Step {step} of 3: {STEP_LABELS[step - 1]}
          </CardDescription>

          {/* Step progress bar */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width:           s === step ? "2rem" : "0.75rem",
                  backgroundColor: s <= step ? "var(--castle-red)" : "var(--border-subtle)",
                }}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-8 px-8">
          {error && (
            <Alert className="mb-6 border rounded-md" style={{ backgroundColor: "#FEF2F2", borderColor: "var(--castle-red)" }}>
              <AlertTitle className="font-bold text-xs uppercase" style={{ color: "var(--castle-red)" }}>Error</AlertTitle>
              <AlertDescription className="text-xs" style={{ color: "#7F1D1D" }}>{error}</AlertDescription>
            </Alert>
          )}

          {/* ── STEP 1: Identity & Income ───────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-8 animate-in slide-in-from-right duration-300">

              <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <Label htmlFor="name" className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  What should we call you?
                </Label>
                <div className="relative w-full max-w-xs">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                  <Input
                    id="name"
                    placeholder="e.g. Alex"
                    className="pl-12 h-12 text-xl text-center font-medium"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                    style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <Label htmlFor="income" className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  Monthly Net Income
                </Label>
                <div className="relative w-full max-w-xs">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6" style={{ color: "var(--text-muted)" }} />
                  <Input
                    id="income"
                    type="number"
                    placeholder="4000"
                    className="pl-12 h-14 text-2xl text-center font-bold font-mono"
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                    style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Enter your total take-home pay.</p>
              </div>

              <div className="p-6 rounded-xl border space-y-6" style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}>
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--surface)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <Info className="w-6 h-6" style={{ color: "var(--engine-navy)" }} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg" style={{ color: "var(--engine-navy)" }}>The Savings Shield</h4>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--fortress-steel)" }}>
                      We logically reserve a percentage of every deposit. This becomes your <strong>Monthly Savings Goal</strong>.
                    </p>
                    <p className="text-xs mt-2 italic" style={{ color: "var(--text-muted)" }}>
                      *Note: This is a strategic budgeting partition. Fortis does not move real bank funds.
                    </p>
                  </div>
                </div>

                <div className="space-y-5 pt-1">
                  <div className="flex justify-between items-center px-1">
                    <Label className="font-semibold" style={{ color: "var(--fortress-steel)" }}>Shield Strength</Label>
                    <span className="text-3xl font-bold font-mono" style={{ color: "var(--castle-red)" }}>{shieldPercent}%</span>
                  </div>
                  <input
                    type="range" min="0" max="50" step="5"
                    value={shieldPercent}
                    onChange={e => setShieldPercent(parseInt(e.target.value))}
                    className="fortis-range w-full"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                      <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--fortress-steel)" }}>Savings Goal</div>
                      <div className="text-xl font-extrabold font-mono" style={{ color: "var(--engine-navy)" }}>${shieldedAmount.toLocaleString()}</div>
                    </div>
                    <div className="p-4 rounded-lg border-2 text-center" style={{ backgroundColor: "#F0FDF4", borderColor: "var(--field-green)" }}>
                      <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--field-green)" }}>True Spendable</div>
                      <div className="text-xl font-extrabold font-mono" style={{ color: "var(--field-green)" }}>${spendableAmount.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Vault Setup ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right duration-300">

              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Set Up Your Savings Vaults</h3>
                <p className="text-sm max-w-md mx-auto" style={{ color: "var(--fortress-steel)" }}>
                  Vaults let you track distinct goals within your{" "}
                  <strong className="font-mono">${shieldedAmount.toLocaleString()}/mo</strong> shield.
                  Skip this and add them later in Settings.
                </p>
              </div>

              {/* Shield allocation meter */}
              {shieldedAmount > 0 && (
                <div
                  className="p-3 rounded-lg border space-y-2"
                  style={{
                    backgroundColor: isOverCommitted ? "#FEF2F2"          : "var(--surface-raised)",
                    borderColor:     isOverCommitted ? "var(--castle-red)" : "var(--border-subtle)",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                      style={{ color: isOverCommitted ? "var(--castle-red)" : "var(--engine-navy)" }}>
                      <ShieldCheck className="w-3.5 h-3.5" /> Shield Allocation
                    </span>
                    <span className="text-xs font-bold font-mono"
                      style={{ color: isOverCommitted ? "var(--castle-red)" : "var(--fortress-steel)" }}>
                      ${totalVaultTarget}/mo of ${shieldedAmount}/mo
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width:           `${Math.min(vaultVsShield, 100)}%`,
                        backgroundColor: isOverCommitted ? "var(--castle-red)" : "var(--field-green)",
                      }}
                    />
                  </div>
                  {isOverCommitted && (
                    <p className="text-[10px] font-bold" style={{ color: "var(--castle-red)" }}>
                      Monthly vault targets exceed your shield goal. Consider reducing targets or raising your shield %.
                    </p>
                  )}
                </div>
              )}

              {/* Quick-add preset pills */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--fortress-steel)" }}>Quick Add</p>
                <div className="flex flex-wrap gap-2">
                  {VAULT_PRESETS.map(preset => {
                    const already = vaults.some(v => v.name === preset.name);
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => !already && addPreset(preset)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full border transition-all"
                        style={{
                          backgroundColor: already ? "var(--engine-navy)" : "var(--surface-raised)",
                          borderColor:     already ? "var(--engine-navy)" : "var(--border-subtle)",
                          color:           already ? "#ffffff"             : "var(--fortress-steel)",
                          cursor:          already ? "default"             : "pointer",
                          opacity:         already ? 0.7                   : 1,
                        }}
                      >
                        {already ? "✓ " : "+ "}{preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active vault list */}
              {vaults.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {vaults.map((vault, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{vault.name}</p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--fortress-steel)" }}>
                          ${vault.monthlyTarget}/mo
                          {vault.ceilingAmount ? ` · cap $${vault.ceilingAmount.toLocaleString()}` : " · uncapped"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVault(i)}
                        className="ml-3 p-1.5 rounded-md transition-colors"
                        style={{ color: "var(--castle-red)" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom vault form */}
              {showVaultForm ? (
                <div className="p-4 rounded-lg border space-y-3" style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>Custom Vault</h4>
                    <button type="button" onClick={() => setShowVaultForm(false)} style={{ color: "var(--fortress-steel)" }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    placeholder="Vault name (e.g. Wedding Fund)"
                    value={vaultForm.name}
                    onChange={e => setVaultForm(f => ({ ...f, name: e.target.value }))}
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                        Monthly Target
                      </Label>
                      <MoneyInput
                        value={vaultForm.monthlyTarget}
                        onChange={val => setVaultForm(f => ({ ...f, monthlyTarget: val }))}
                        placeholder="100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                        Ceiling (Optional)
                      </Label>
                      <MoneyInput
                        value={vaultForm.ceilingAmount ?? 0}
                        onChange={val => setVaultForm(f => ({ ...f, ceilingAmount: val > 0 ? val : null }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={addCustomVault}
                    disabled={!vaultForm.name || vaultForm.monthlyTarget <= 0}
                    className="w-full font-bold text-white"
                    style={{ backgroundColor: "var(--engine-navy)", border: "none" }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Vault
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowVaultForm(true)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed text-sm font-bold"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Custom Vault
                </button>
              )}

              {vaults.length === 0 && !showVaultForm && (
                <p className="text-center text-xs italic" style={{ color: "var(--text-muted)" }}>
                  No vaults yet — you can skip and add them later in Settings.
                </p>
              )}
            </div>
          )}

          {/* ── STEP 3: Budget Review ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="text-center space-y-2 mb-4">
                <h3 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Customize Your Budgets</h3>
                <p className="text-sm max-w-md mx-auto" style={{ color: "var(--fortress-steel)" }}>
                  Calculated from your <strong className="font-mono">${spendableAmount.toLocaleString()}</strong> spendable pool.
                  Adjust to match your reality.
                </p>
              </div>

              {/* Vault summary strip */}
              {vaults.length > 0 && (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: "var(--engine-navy)" }} />
                  <p className="text-xs" style={{ color: "var(--fortress-steel)" }}>
                    <strong style={{ color: "var(--engine-navy)" }}>
                      {vaults.length} vault{vaults.length > 1 ? "s" : ""}
                    </strong>{" "}
                    configured — ${totalVaultTarget}/mo committed to savings.{" "}
                    <span style={{ color: "var(--text-muted)" }}>{vaults.map(v => v.name).join(", ")}</span>
                  </p>
                </div>
              )}

              <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2">
                {budgets.map((cat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}
                  >
                    <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: cat.color }} />
                    <Label className="flex-1 font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                      {cat.name}
                    </Label>
                    <div className="w-36">
                      <MoneyInput
                        value={cat.limit}
                        onChange={val => {
                          const updated = [...budgets];
                          updated[i].limit = val;
                          setBudgets(updated);
                        }}
                      />
                    </div>
                    {/* Only allow removing user-added budgets (index >= 4) */}
                    {i >= 4 && (
                      <button
                        type="button"
                        onClick={() => removeBudget(i)}
                        className="p-1.5 rounded-md"
                        style={{ color: "var(--castle-red)" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Custom budget form */}
              {showBudgetForm ? (
                <div
                  className="p-4 rounded-lg border space-y-3"
                  style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                      Custom Budget
                    </h4>
                    <button type="button" onClick={() => setShowBudgetForm(false)} style={{ color: "var(--fortress-steel)" }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    placeholder="Category name (e.g. Dining Out)"
                    value={budgetForm.name}
                    onChange={e => setBudgetForm(f => ({ ...f, name: e.target.value }))}
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                      Monthly Budget
                    </Label>
                    <MoneyInput
                      value={budgetForm.limit}
                      onChange={val => setBudgetForm(f => ({ ...f, limit: val }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fortress-steel)" }}>
                      Color
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {BUDGET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBudgetForm(f => ({ ...f, color }))}
                          className="w-7 h-7 rounded-full transition-transform"
                          style={{
                            backgroundColor: color,
                            boxShadow: budgetForm.color === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : "none",
                            transform: budgetForm.color === color ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={addCustomBudget}
                    disabled={!budgetForm.name || budgetForm.limit <= 0}
                    className="w-full font-bold text-white"
                    style={{ backgroundColor: "var(--castle-red)", border: "none", boxShadow: "0 2px 0 0 var(--castle-red-dark)" }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Budget
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBudgetForm(true)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed text-sm font-bold"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Add Budget Category
                </button>
              )}
            </div>
          )}
        </CardContent>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <CardFooter
          className="flex justify-between pt-6 px-8 pb-8"
          style={{ backgroundColor: "var(--surface-raised)" }}
        >
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={loading}
              className="h-12 px-6 font-bold"
              style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}
            >
              Back
            </Button>
          )}

          <div className={step === 1 ? "w-full flex justify-center" : "ml-auto"}>
            {step < 3 ? (
              <Button
                className="w-full max-w-sm h-12 text-lg font-bold text-white"
                onClick={handleNext}
                disabled={step === 1 && (numericIncome <= 0 || !name.trim())}
                style={{ backgroundColor: "var(--castle-red)", border: "none", boxShadow: "0 4px 0 0 var(--castle-red-dark)" }}
              >
                {step === 2 && vaults.length === 0 ? "Skip Vaults" : "Next Step"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button
                className="h-12 px-8 text-lg font-bold text-white flex items-center gap-2"
                onClick={handleSubmit}
                disabled={loading}
                style={{ backgroundColor: "var(--castle-red)", border: "none", boxShadow: "0 4px 0 0 var(--castle-red-dark)" }}
              >
                {loading ? "Initializing Vault…" : "Confirm & Launch"}
                {!loading && <CheckCircle2 className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}