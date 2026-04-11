import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Save, Lock, Trash2, AlertTriangle, ShieldCheck, Archive, RotateCcw, Plus, Edit2, X, User, Heart } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import type { Budget, Transaction } from "../App";
import { useUserSettings } from "../hooks/useUserSettings";
import { FORTIS_VERSION, GIT_HASH, LAST_DEPLOYED } from "../version";
import type { SavingsVault } from "../utils/shieldLogic";

interface SettingsPageProps {
  budgets: Budget[];
  transactions: Transaction[];
  savingsBuckets: SavingsVault[];
  onAddVault: (vault: Omit<SavingsVault, "id">) => Promise<void>;
  onUpdateVault: (id: string, updates: Partial<SavingsVault>) => Promise<void>;
  onDeleteVault: (id: string) => Promise<void>;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onNavigate: (mode: "privacy" | "terms") => void;
  onUpdatePassword: (current: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteAccount: (pass: string) => Promise<{ success: boolean; error?: string }>;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--surface-raised)",
  borderColor:     "var(--border-subtle)",
  color:           "var(--text-primary)",
};

const labelStyle: React.CSSProperties = {
  color:         "var(--fortress-steel)",
  fontWeight:    600,
  fontSize:      "0.8125rem",
  letterSpacing: "0.01em",
};

export function SettingsPage({
  budgets,
  transactions,
  savingsBuckets,
  onAddVault,
  onUpdateVault,
  onDeleteVault,
  onUpdateTransaction,
  onDeleteTransaction,
  onNavigate,
  onUpdatePassword,
  onDeleteAccount,
}: SettingsPageProps) {
  const { userName, monthlyIncome, shieldAllocationPct, updateUserName, updateIncomeSettings } = useUserSettings();

  const [tempUserName, setTempUserName]     = useState(userName);
  const [tempIncome, setTempIncome]         = useState(monthlyIncome.toString());
  const [tempShieldPct, setTempShieldPct]   = useState(shieldAllocationPct.toString());
  const [isSaving, setIsSaving]             = useState(false);
  const [saveMessage, setSaveMessage]       = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isAddingVault, setIsAddingVault]   = useState(false);
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);
  const [vaultForm, setVaultForm]           = useState({ name: "", monthlyTarget: "", currentBalance: "0", ceilingAmount: "" });

  const [currentPassword, setCurrentPassword]       = useState("");
  const [newPassword, setNewPassword]               = useState("");
  const [confirmPassword, setConfirmPassword]       = useState("");
  const [passwordError, setPasswordError]           = useState("");
  const [passwordSuccess, setPasswordSuccess]       = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [deletePassword, setDeletePassword]         = useState("");
  const [deleteError, setDeleteError]               = useState("");

  const archivedTransactions = useMemo(
    () => transactions.filter(t => t.archived === true),
    [transactions]
  );

  useEffect(() => {
    setTempUserName(userName);
    setTempIncome(monthlyIncome.toString());
    setTempShieldPct(shieldAllocationPct.toString());
  }, [userName, monthlyIncome, shieldAllocationPct]);

  const handleSave = async () => {
    setSaveMessage(null);
    setIsSaving(true);
    try {
      if (tempUserName.trim()) updateUserName(tempUserName.trim());
      updateIncomeSettings(parseFloat(tempIncome) || 0, parseFloat(tempShieldPct) || 0);
      await new Promise(r => setTimeout(r, 500));
      setSaveMessage({ type: "success", text: "Settings saved successfully." });
    } catch {
      setSaveMessage({ type: "error", text: "Failed to save settings." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleSaveVault = async () => {
    if (!vaultForm.name || !vaultForm.monthlyTarget) return;
    const vaultData = {
      name:           vaultForm.name,
      monthlyTarget:  parseFloat(vaultForm.monthlyTarget) || 0,
      currentBalance: parseFloat(vaultForm.currentBalance) || 0,
      ceilingAmount:  vaultForm.ceilingAmount ? parseFloat(vaultForm.ceilingAmount) : null,
    };
    if (editingVaultId) {
      await onUpdateVault(editingVaultId, vaultData);
      setEditingVaultId(null);
    } else {
      await onAddVault(vaultData);
      setIsAddingVault(false);
    }
    setVaultForm({ name: "", monthlyTarget: "", currentBalance: "0", ceilingAmount: "" });
  };

  const startEditVault = (v: SavingsVault) => {
    setVaultForm({
      name:           v.name,
      monthlyTarget:  v.monthlyTarget.toString(),
      currentBalance: v.currentBalance.toString(),
      ceilingAmount:  v.ceilingAmount ? v.ceilingAmount.toString() : "",
    });
    setEditingVaultId(v.id);
  };

  const handlePasswordUpdate = async () => {
    setPasswordError(""); setPasswordSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) { setPasswordError("Please fill in all fields"); return; }
    if (newPassword.length < 6) { setPasswordError("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("New passwords do not match"); return; }
    setIsUpdatingPassword(true);
    const result = await onUpdatePassword(currentPassword, newPassword);
    if (result.success) {
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 3000);
    } else {
      setPasswordError(result.error || "Failed to update password");
    }
    setIsUpdatingPassword(false);
  };

  const handleAccountDeletion = async () => {
    setDeleteError("");
    if (!deletePassword) { setDeleteError("Please enter your password to confirm"); return; }
    const result = await onDeleteAccount(deletePassword);
    if (!result.success) setDeleteError(result.error || "Failed to delete account");
  };

  const handleRestoreTransaction   = async (t: Transaction) => { try { await onUpdateTransaction(t.id, { archived: false }); } catch { alert("Failed to restore."); } };
  const handleDeletePermanently    = async (t: Transaction) => { if (window.confirm(`Permanently delete "${t.description}"? This cannot be undone.`)) { try { await onDeleteTransaction(t.id); } catch { alert("Failed to delete."); } } };
  const handleRestoreAll           = async () => { if (window.confirm(`Restore all ${archivedTransactions.length} archived transactions?`)) { await Promise.all(archivedTransactions.map(t => onUpdateTransaction(t.id, { archived: false }))); } };
  const handleDeleteAllPermanently = async () => { try { await Promise.all(archivedTransactions.map(t => onDeleteTransaction(t.id))); } catch { alert("Failed to delete some transactions."); } };

  return (
    <div className="space-y-6 pb-12">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--fortress-steel)" }}>
          Manage your profile, active vaults, and security.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Income & Identity ─────────────────────────────────────────────── */}
        <Card className="border" style={{ borderColor: "var(--border-subtle)" }}>
          <CardHeader>
            <CardTitle
              className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <User className="h-4 w-4" /> Income & Identity
            </CardTitle>
            <CardDescription style={{ color: "var(--fortress-steel)" }}>
              Update your base income parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="userName" style={labelStyle}>Your Name</Label>
              <Input
                id="userName"
                value={tempUserName}
                onChange={e => setTempUserName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="income" style={labelStyle}>Monthly Net Income</Label>
                <div
                  className="flex items-center rounded-md border overflow-hidden"
                  style={{
                    backgroundColor: "var(--surface-raised)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <span
                    className="flex items-center justify-center h-9 px-2.5 text-sm font-bold font-mono border-r select-none flex-shrink-0"
                    style={{
                      color: "var(--fortress-steel)",
                      borderColor: "var(--border-subtle)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    $
                  </span>
                  <input
                    id="income"
                    type="number"
                    value={tempIncome}
                    onChange={e => setTempIncome(e.target.value)}
                    className="flex-1 h-9 px-2 bg-transparent text-sm font-mono outline-none min-w-0"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shieldPct" style={labelStyle}>Shield Goal</Label>
                <div
                  className="flex items-center rounded-md border overflow-hidden"
                  style={{
                    backgroundColor: "var(--surface-raised)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <input
                    id="shieldPct"
                    type="number"
                    value={tempShieldPct}
                    onChange={e => setTempShieldPct(e.target.value)}
                    className="flex-1 h-9 px-2 bg-transparent text-sm font-mono text-right outline-none min-w-0"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <span
                    className="flex items-center justify-center h-9 px-2.5 text-sm font-bold font-mono border-l select-none flex-shrink-0"
                    style={{
                      color: "var(--fortress-steel)",
                      borderColor: "var(--border-subtle)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>

            {saveMessage && (
              <p
                className="text-sm font-semibold"
                style={{ color: saveMessage.type === "success" ? "var(--field-green)" : "var(--castle-red)" }}
              >
                {saveMessage.text}
              </p>
            )}

            <Button
              onClick={handleSave}
              className="w-full font-bold text-white"
              disabled={isSaving}
              style={{
                backgroundColor: "var(--castle-red)",
                border: "none",
                boxShadow: "0 2px 0 0 var(--castle-red-dark)",
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving…" : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Multi-Vault Config ────────────────────────────────────────────── */}
        <Card className="border" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-raised)" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle
                className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <ShieldCheck className="h-4 w-4" /> Multi-Vault Config
              </CardTitle>
              <CardDescription className="mt-1" style={{ color: "var(--fortress-steel)" }}>
                Manage distinct savings targets
              </CardDescription>
            </div>
            {!isAddingVault && !editingVaultId && (
              <Button
                size="sm"
                onClick={() => setIsAddingVault(true)}
                className="h-8 font-bold text-white"
                style={{ backgroundColor: "var(--castle-red)", border: "none" }}
              >
                <Plus className="h-4 w-4 mr-1" /> New Vault
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(isAddingVault || editingVaultId) ? (
              <div className="space-y-4 p-4 rounded-md border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                    {editingVaultId ? "Edit Vault" : "Create Vault"}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => { setIsAddingVault(false); setEditingVaultId(null); }} className="h-6 w-6 p-0" style={{ color: "var(--fortress-steel)" }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label style={labelStyle}>Vault Name (e.g. Emergency, Vacation)</Label>
                  <Input value={vaultForm.name} onChange={e => setVaultForm({ ...vaultForm, name: e.target.value })} style={inputStyle} placeholder="Emergency Fund" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label style={labelStyle}>Monthly Target</Label>
                    <Input type="number" value={vaultForm.monthlyTarget} onChange={e => setVaultForm({ ...vaultForm, monthlyTarget: e.target.value })} style={inputStyle} placeholder="100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label style={labelStyle}>Max Ceiling (Optional)</Label>
                    <Input type="number" value={vaultForm.ceilingAmount} onChange={e => setVaultForm({ ...vaultForm, ceilingAmount: e.target.value })} style={inputStyle} placeholder="1000" />
                  </div>
                </div>
                <Button onClick={handleSaveVault} className="w-full font-bold text-white mt-2" style={{ backgroundColor: "var(--castle-red)", border: "none" }}>
                  <Save className="h-4 w-4 mr-2" /> Save Vault
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {savingsBuckets.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                    No custom vaults active. Using base shield settings.
                  </p>
                ) : (
                  savingsBuckets.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-md border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{v.name}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: "var(--fortress-steel)" }}>
                          Target: ${v.monthlyTarget}/mo{v.ceilingAmount ? ` | Cap: $${v.ceilingAmount}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEditVault(v)} className="h-8 w-8 p-0" style={{ color: "var(--text-primary)" }}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Delete ${v.name}?`)) onDeleteVault(v.id); }} className="h-8 w-8 p-0" style={{ color: "var(--castle-red)" }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Security ──────────────────────────────────────────────────────── */}
        <Card className="border" style={{ borderColor: "var(--border-subtle)" }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Lock className="h-4 w-4" /> Security
            </CardTitle>
            <CardDescription style={{ color: "var(--fortress-steel)" }}>Update your authentication credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" placeholder="Current Password"     value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />
            <Input type="password" placeholder="New Password"         value={newPassword}     onChange={e => setNewPassword(e.target.value)}     style={inputStyle} />
            <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
            {passwordError   && <p className="text-xs font-semibold" style={{ color: "var(--castle-red)"  }}>{passwordError}</p>}
            {passwordSuccess && <p className="text-xs font-semibold" style={{ color: "var(--field-green)" }}>{passwordSuccess}</p>}
            <Button onClick={handlePasswordUpdate} variant="outline" className="w-full font-bold" disabled={isUpdatingPassword} style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
              {isUpdatingPassword ? "Updating…" : "Update Password"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Support the Project ────────────────────────────────────────────── */}
        <Card className="border" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-raised)" }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Heart className="h-4 w-4" style={{ color: "var(--castle-red)" }} /> Support the Project
            </CardTitle>
            <CardDescription style={{ color: "var(--fortress-steel)" }}>
              FortisBudget is free and open source. If it has helped you, consider sponsoring development.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Your support keeps the servers running, funds new features, and helps maintain the zero-ad, zero-tracking promise.
            </p>
            <Button
              asChild
              className="w-full sm:w-auto font-bold text-white gap-2"
              style={{
                backgroundColor: "var(--castle-red)",
                border: "none",
                boxShadow: "0 2px 0 0 var(--castle-red-dark)",
              }}
            >
              <a
                href="https://github.com/sponsors/RodActual"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Heart className="h-4 w-4" />
                Sponsor on GitHub
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Archived Transactions ────────────────────────────────────────────────── */}
      {archivedTransactions.length > 0 && (
        <Card className="border" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-raised)" }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Archive className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
              Archived Transactions ({archivedTransactions.length})
            </CardTitle>
            <CardDescription style={{ color: "var(--fortress-steel)" }}>Hidden from your main list but still counted in analytics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "var(--surface-raised)" }}>
                    {["Date", "Description", "Category", "Amount", "Actions"].map((col, i) => (
                      <TableHead key={col} className={`text-[10px] font-bold uppercase tracking-widest ${i >= 3 ? "text-right" : ""}`} style={{ color: "var(--fortress-steel)" }}>
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedTransactions.map(t => (
                    <TableRow key={t.id} style={{ borderColor: "var(--border-subtle)" }}>
                      <TableCell className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t.description}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}>
                          {t.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono text-sm" style={{ color: "var(--text-primary)" }}>${t.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-1" style={{ color: "var(--text-primary)" }} onClick={() => handleRestoreTransaction(t)}><RotateCcw className="h-3 w-3" /> Restore</Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-1" style={{ color: "var(--castle-red)" }} onClick={() => handleDeletePermanently(t)}><Trash2 className="h-3 w-3" /> Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button variant="outline" onClick={handleRestoreAll} className="flex-1 font-bold gap-2" style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                <RotateCcw className="h-4 w-4" /> Restore All ({archivedTransactions.length})
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1 font-bold gap-2" style={{ borderColor: "var(--castle-red)", color: "var(--castle-red)" }}>
                    <Trash2 className="h-4 w-4" /> Delete All Permanently
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  <AlertDialogHeader>
                    <AlertDialogTitle style={{ color: "var(--text-primary)" }}>Delete All Archived Transactions?</AlertDialogTitle>
                    <AlertDialogDescription style={{ color: "var(--fortress-steel)" }}>This will permanently delete all {archivedTransactions.length} archived transactions. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAllPermanently} className="font-bold text-white" style={{ backgroundColor: "var(--castle-red)", border: "none" }}>Delete All Permanently</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Legal & Compliance ────────────────────────────────────────────────── */}
      <Card className="border" style={{ borderColor: "var(--border-subtle)" }}>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ShieldCheck className="h-4 w-4" style={{ color: "var(--fortress-steel)" }} /> Legal & Compliance
          </CardTitle>
          <CardDescription style={{ color: "var(--fortress-steel)" }}>Review our terms and data protection policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" size="sm" onClick={() => onNavigate("privacy")} className="flex-1 font-bold uppercase tracking-wide text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>Privacy Policy</Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate("terms")} className="flex-1 font-bold uppercase tracking-wide text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>Terms of Service</Button>
          </div>
          <div className="flex flex-col items-center justify-center w-full pt-4 opacity-40">
            <p className="text-[10px] font-mono uppercase" style={{ color: "var(--text-muted)" }}>
              FORTIS_v{FORTIS_VERSION} // {GIT_HASH} // {LAST_DEPLOYED}
            </p>
          </div>
        </CardContent>
      </Card>


      {/* ── Danger Zone ───────────────────────────────────────────────────────── */}
      <Card className="border" style={{ borderColor: "var(--castle-red)", backgroundColor: "var(--surface-raised)" }}>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--castle-red)" }}>
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="font-bold text-white w-full sm:w-auto" style={{ backgroundColor: "var(--castle-red)", border: "none", boxShadow: "0 2px 0 0 var(--castle-red-dark)" }}>
                Delete Account Permanently
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle style={{ color: "var(--text-primary)" }}>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription style={{ color: "var(--fortress-steel)" }}>
                  This will permanently erase your profile and all financial data. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input type="password" placeholder="Enter password to confirm" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} style={inputStyle} />
              {deleteError && <p className="text-xs font-semibold mt-1" style={{ color: "var(--castle-red)" }}>{deleteError}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletePassword("")} style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)" }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleAccountDeletion} className="font-bold text-white" style={{ backgroundColor: "var(--castle-red)", border: "none" }}>Delete Account</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}