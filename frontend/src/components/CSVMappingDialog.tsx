import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "../ui/table";
import { 
  Check, ArrowRight, ArrowLeft, 
  Trash2, Repeat, CalendarDays, X, Plus
} from "lucide-react";
import type { Budget, Transaction, RecurringRule } from "../App";
import type { StagedTransaction } from "../hooks/Usecsv";

export interface CSVMapping {
  dateCol: string;
  descCol: string;
  amountCol: string;
  incomeCol: string;
  typeCol: string;
  defaultCategory: string;
  invertAmounts: boolean;
}

interface CSVMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  budgets: Budget[];
  onGeneratePreview: (mapping: CSVMapping) => StagedTransaction[];
  onFinalImport: (data: Omit<Transaction, "id">[]) => Promise<void>;
  onAddRecurringRule?: (rule: Omit<RecurringRule, "id" | "userId">) => Promise<void>;
  onAddBudget?: (category: string, limit: number, color: string) => Promise<void>;
}

export function CSVMappingDialog({
  open,
  onOpenChange,
  headers,
  budgets,
  onGeneratePreview,
  onFinalImport,
  onAddRecurringRule,
  onAddBudget
}: CSVMappingDialogProps) {
  // ─── 1. STATE ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<"mapping" | "review">("mapping");
  const [stagedData, setStagedData] = useState<StagedTransaction[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  
  // Creation States
  const [recurringToCreate, setRecurringToCreate] = useState<StagedTransaction | null>(null);
  const [newCatData, setNewCatData] = useState<{ name: string; color: string; targetIdx: number } | null>(null);
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");

  // Mapping Configuration
  const [dateCol, setDateCol] = useState<string>("");
  const [descCol, setDescCol] = useState<string>("");
  const [amountCol, setAmountCol] = useState<string>("");
  const [incomeCol, setIncomeCol] = useState<string>("none");
  const [typeCol, setTypeCol] = useState<string>("none");
  const [defaultCategory, setDefaultCategory] = useState<string>("Other");
  const [invertAmounts, setInvertAmounts] = useState<boolean>(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");

  // ─── 2. LOGIC ─────────────────────────────────────────────────────────────
  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set([...budgets.map(b => b.category), "Income", "Other"]));
    return cats;
  }, [budgets]);

  useEffect(() => {
    if (open) {
      setStep("mapping");
      setStagedData([]);
      setSelectedIndices([]);
      setRecurringToCreate(null);
      setNewCatData(null);
      
      if (headers.length > 0) {
        const lowerHeaders = headers.map(h => h.toLowerCase());
        setDateCol(headers[lowerHeaders.findIndex(h => h.includes("date"))] || "");
        setDescCol(headers[lowerHeaders.findIndex(h => h.includes("desc") || h.includes("payee") || h.includes("memo") || h.includes("name"))] || "");
        setAmountCol(headers[lowerHeaders.findIndex(h => h === "amount" || h === "debit" || h.includes("outflow") || h.includes("withdrawal"))] || "");
        setIncomeCol(headers[lowerHeaders.findIndex(h => h === "credit" || h.includes("inflow") || h.includes("deposit"))] || "none");
        setTypeCol(headers[lowerHeaders.findIndex(h => h === "type") || lowerHeaders.findIndex(h => h.includes("transaction type"))] || "none");
      }
    }
  }, [open, headers]);

  // ─── 3. HANDLERS ──────────────────────────────────────────────────────────
  const handleNextStep = () => {
    if (!dateCol || !descCol || !amountCol) {
      alert("Please map the required Date, Description, and Amount columns.");
      return;
    }
    const preview = onGeneratePreview({ 
      dateCol, descCol, amountCol, incomeCol, typeCol, defaultCategory, invertAmounts 
    });
    setStagedData(preview);
    setStep("review");
  };

  const updateStagedRow = (index: number, updates: Partial<StagedTransaction>) => {
    const newData = [...stagedData];
    newData[index] = { ...newData[index], ...updates };
    setStagedData(newData);
  };

  const handleCategorySelect = (idx: number, val: string) => {
    if (val === "NEW_CATEGORY") {
      setNewCatData({ name: "", color: "#3B82F6", targetIdx: idx });
    } else {
      updateStagedRow(idx, { category: val });
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatData || !newCatData.name || !onAddBudget) return;
    try {
      await onAddBudget(newCatData.name, 0, newCatData.color);
      updateStagedRow(newCatData.targetIdx, { category: newCatData.name });
      setNewCatData(null);
    } catch (e) {
      alert("Failed to create category.");
    }
  };

  const handleSaveRecurringRule = async () => {
    if (!recurringToCreate || !onAddRecurringRule) return;
    try {
      await onAddRecurringRule({
        description: recurringToCreate.description,
        amount: recurringToCreate.amount,
        category: recurringToCreate.category,
        type: recurringToCreate.type,
        frequency,
        nextDueDate: Date.now(),
      });
      setStagedData(prev => prev.map(row => 
        row.description === recurringToCreate.description ? { ...row, suggestRecurring: false } : row
      ));
      setRecurringToCreate(null);
    } catch (e) {
      alert("Failed to save recurring rule.");
    }
  };

  const removeStagedRow = (index: number) => {
    const newData = stagedData.filter((_, i) => i !== index);
    setStagedData(newData);
    setSelectedIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={step === "mapping" ? "sm:max-w-[460px] flex flex-col p-0" : "sm:max-w-[1000px] flex flex-col p-0"} 
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", height: "85vh" }}
      >
        {/* HEADER SECTION */}
        <div className="px-6 pt-6 pb-4 shrink-0 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {step === "mapping" ? "Step 1: Map Columns" : "Step 2: Review & Bulk Edit"}
            </DialogTitle>
            <DialogDescription>
              {step === "mapping" 
                ? "Match your CSV headers to Fortis fields." 
                : `Reviewing ${stagedData.length} entries. Edit or bulk-assign categories.`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === "mapping" ? (
            <div className="grid gap-5 pr-1">
              <div className="grid gap-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Date Column *</Label>
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger style={{ backgroundColor: "var(--surface-raised)" }}>
  <SelectValue />
</SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>{headers.map((h, i) => <SelectItem key={i} value={h}>{h || "Empty"}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Description / Payee *</Label>
                <Select value={descCol} onValueChange={setDescCol}>
                  <SelectTrigger style={{ backgroundColor: "var(--surface-raised)" }}>
  <SelectValue />
</SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>{headers.map((h, i) => <SelectItem key={i} value={h}>{h || "Empty"}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Primary Amount Column *</Label>
                <Select value={amountCol} onValueChange={setAmountCol}>
                  <SelectTrigger style={{ backgroundColor: "var(--surface-raised)" }}>
  <SelectValue />
</SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>{headers.map((h, i) => <SelectItem key={i} value={h}>{h || "Empty"}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Income Column (Optional)</Label>
                <Select value={incomeCol} onValueChange={setIncomeCol}>
                  <SelectTrigger style={{ backgroundColor: "var(--surface-raised)" }}>
  <SelectValue placeholder="Optional" />
</SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                    <SelectItem value="none">-- None --</SelectItem>
                    {headers.map((h, i) => <SelectItem key={i} value={h}>{h || "Empty"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Type Column (Optional)</Label>
                <Select value={typeCol} onValueChange={setTypeCol}>
                  <SelectTrigger style={{ backgroundColor: "var(--surface-raised)" }}>
  <SelectValue placeholder="Optional" />
</SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                    <SelectItem value="none">-- None --</SelectItem>
                    {headers.map((h, i) => <SelectItem key={i} value={h}>{h || "Empty"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <Checkbox id="invert-amounts" checked={invertAmounts} onCheckedChange={(val) => setInvertAmounts(!!val)} />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="invert-amounts" className="text-xs font-bold cursor-pointer">Invert Amounts</Label>
                  <p className="text-[10px]" style={{ color: "var(--fortress-steel)" }}>Check if bank lists expenses as positive numbers.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* BULK ACTIONS */}
              <div className="flex items-center justify-between p-3 rounded-md border sticky top-0 bg-white z-20 shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-4">
                   <Checkbox checked={selectedIndices.length === stagedData.length && stagedData.length > 0} onCheckedChange={(val) => setSelectedIndices(val ? stagedData.map((_, i) => i) : [])} />
                   <span className="text-xs font-bold text-muted-foreground">{selectedIndices.length} Selected</span>
                   <Select value={bulkCategory} onValueChange={setBulkCategory}>
                     <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Bulk Category" /></SelectTrigger>
                     <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>{uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                   </Select>
                   <Button size="sm" variant="outline" className="h-8 text-xs font-bold" disabled={!bulkCategory || selectedIndices.length === 0} onClick={() => {
                     selectedIndices.forEach(idx => updateStagedRow(idx, { category: bulkCategory }));
                     setBulkCategory("");
                     setSelectedIndices([]);
                   }}>Apply</Button>
                </div>
              </div>

              {/* REVIEW TABLE */}
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Date</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Description</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Category</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-right">Amount</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-center">Rule</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagedData.map((row, idx) => (
                      <TableRow key={idx} className={selectedIndices.includes(idx) ? "bg-slate-50" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedIndices.includes(idx)} onCheckedChange={() => setSelectedIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} />
                        </TableCell>
                        <TableCell className="text-xs font-mono">{new Date(row.date).toLocaleDateString()}</TableCell>
                        <TableCell><Input className="h-8 text-xs bg-transparent border-none" value={row.description} onChange={(e) => updateStagedRow(idx, { description: e.target.value })} /></TableCell>
                        <TableCell>
                          <Select value={row.category} onValueChange={(val) => handleCategorySelect(idx, val)}>
                            <SelectTrigger 
  className="h-8 text-xs border-none hover:bg-slate-100" 
  style={{ backgroundColor: "var(--surface-raised)" }}
></SelectTrigger>
                            <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
                              <SelectItem value="NEW_CATEGORY" className="font-bold text-blue-600 border-b"><Plus className="w-3 h-3 mr-2 inline" /> New Category</SelectItem>
                              {uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold" style={{ color: row.type === 'income' ? 'var(--field-green)' : 'var(--castle-red)' }}>
                          {row.type === 'income' ? '+' : '-'}${row.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.suggestRecurring && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-blue-600 bg-blue-50" onClick={() => setRecurringToCreate(row)}>
                              <Repeat className="w-3 h-3 mr-1" /> Save Rule?
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500" onClick={() => removeStagedRow(idx)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL: NEW CATEGORY */}
        {newCatData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <Card className="w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">New Category</h3>
                <Button variant="ghost" size="icon" onClick={() => setNewCatData(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold text-slate-400">Name</Label><Input value={newCatData.name} onChange={e => setNewCatData({...newCatData, name: e.target.value})} placeholder="e.g. Hobbies" /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] uppercase font-bold text-slate-400">Color</Label><input type="color" className="w-full h-8 rounded cursor-pointer" value={newCatData.color} onChange={e => setNewCatData({...newCatData, color: e.target.value})} /></div>
              </div>
              <Button className="w-full font-bold bg-slate-900 text-white" onClick={handleCreateCategory}>Create & Assign</Button>
            </Card>
          </div>
        )}

        {/* MODAL: RECURRING RULE */}
        {recurringToCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <Card className="w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Setup Rule</h3>
                <Button variant="ghost" size="icon" onClick={() => setRecurringToCreate(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Enable automated prompts for <span className="font-bold text-slate-900">{recurringToCreate.description}</span>?</p>
                <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                </Select>
              </div>
              <Button className="w-full font-bold bg-slate-900 text-white" onClick={handleSaveRecurringRule}>Confirm Rule</Button>
            </Card>
          </div>
        )}

        {/* FOOTER */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-between items-center" style={{ backgroundColor: "var(--surface)" }}>
          {step === "mapping" ? (
             <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          ) : (
             <Button variant="ghost" onClick={() => setStep("mapping")} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>
          )}
          <div className="flex gap-2">
            {step === "mapping" ? (
              <Button onClick={handleNextStep} className="font-bold text-white px-8 h-10 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--engine-navy)" }}>
                Review Data <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={() => onFinalImport(stagedData)} className="font-bold text-white px-8 h-10 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--field-green)" }}>
                Import {stagedData.length} <Check className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}