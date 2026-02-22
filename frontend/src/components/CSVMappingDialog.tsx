import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../ui/select";
import type { Budget } from "../App";

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
  onConfirm: (mapping: CSVMapping) => void;
}

export function CSVMappingDialog({
  open,
  onOpenChange,
  headers,
  budgets,
  onConfirm,
}: CSVMappingDialogProps) {
  const [dateCol, setDateCol] = useState<string>("");
  const [descCol, setDescCol] = useState<string>("");
  const [amountCol, setAmountCol] = useState<string>("");
  const [incomeCol, setIncomeCol] = useState<string>("none");
  const [typeCol, setTypeCol] = useState<string>("none");
  const [defaultCategory, setDefaultCategory] = useState<string>("Other");
  const [invertAmounts, setInvertAmounts] = useState<boolean>(false);

  // Auto-guess columns based on common bank headers when the dialog opens
  useEffect(() => {
    if (open && headers.length > 0) {
      const lowerHeaders = headers.map(h => h.toLowerCase());
      
      const guessDate = headers[lowerHeaders.findIndex(h => h.includes("date"))] || "";
      const guessDesc = headers[lowerHeaders.findIndex(h => h.includes("desc") || h.includes("payee") || h.includes("memo") || h.includes("name"))] || "";
      const guessAmount = headers[lowerHeaders.findIndex(h => h === "amount" || h === "debit" || h.includes("outflow") || h.includes("withdrawal"))] || "";
      const guessIncome = headers[lowerHeaders.findIndex(h => h === "credit" || h.includes("inflow") || h.includes("deposit"))] || "none";
      const guessType = headers[lowerHeaders.findIndex(h => h === "type" || h.includes("transaction type"))] || "none";

      setDateCol(guessDate);
      setDescCol(guessDesc);
      setAmountCol(guessAmount);
      setIncomeCol(guessIncome);
      setTypeCol(guessType);
      setDefaultCategory("Other");
      setInvertAmounts(false);
    }
  }, [open, headers]);

  const handleConfirm = () => {
    if (!dateCol || !descCol || !amountCol) {
      alert("Please map the Date, Description, and Primary Amount columns to continue.");
      return;
    }
    onConfirm({ dateCol, descCol, amountCol, incomeCol, typeCol, defaultCategory, invertAmounts });
  };

  const uniqueCategories = Array.from(new Set([...budgets.map(b => b.category), "Income", "Other"]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[460px] flex flex-col p-0 gap-0" 
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)", maxHeight: "85vh" }}
      >
        
        {/* PINNED HEADER */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Map CSV Columns
            </DialogTitle>
            <DialogDescription style={{ color: "var(--fortress-steel)" }}>
              Match your bank's CSV headers to Fortis fields. We will auto-categorize recognized payees.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 pr-1">
            
            <div className="grid gap-1.5">
              <Label style={{ color: "var(--text-primary)", fontWeight: 600 }}>Date Column *</Label>
              <Select value={dateCol} onValueChange={setDateCol}>
                <SelectTrigger style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                  <SelectValue placeholder="Select Date Column" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  {headers.map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h || "(Empty Header)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label style={{ color: "var(--text-primary)", fontWeight: 600 }}>Description (Payee/Memo) *</Label>
              <Select value={descCol} onValueChange={setDescCol}>
                <SelectTrigger style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                  <SelectValue placeholder="Select Description Column" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  {headers.map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h || "(Empty Header)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <Label style={{ color: "var(--text-primary)", fontWeight: 600 }}>Primary Amount / Expense Column *</Label>
              <Select value={amountCol} onValueChange={setAmountCol}>
                <SelectTrigger style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                  <SelectValue placeholder="Select Amount Column" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  {headers.map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h || "(Empty Header)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label style={{ color: "var(--text-primary)", fontWeight: 600 }}>Income / Credit Column (Optional)</Label>
              <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>If your bank separates debits and credits, select the credit column here.</p>
              <Select value={incomeCol} onValueChange={setIncomeCol}>
                <SelectTrigger style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                  <SelectValue placeholder="Select Income Column" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  <SelectItem value="none">-- Single Amount Column --</SelectItem>
                  {headers.map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h || "(Empty Header)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label style={{ color: "var(--text-primary)", fontWeight: 600 }}>Transaction Type Label (Optional)</Label>
              <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>If your bank uses a column that says "Credit" or "Debit".</p>
              <Select value={typeCol} onValueChange={setTypeCol}>
                <SelectTrigger style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                  <SelectValue placeholder="Select Type Column" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  <SelectItem value="none">-- No Type Column --</SelectItem>
                  {headers.map((h, i) => <SelectItem key={`${h}-${i}`} value={h}>{h || "(Empty Header)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <Label style={{ color: "var(--text-primary)", fontWeight: 600 }}>Default Fallback Category</Label>
              <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>Used only if the smart-assign engine doesn't recognize the payee.</p>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}>
                  <SelectValue placeholder="Select Default Category" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-subtle)" }}>
                  {uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 mt-1">
              <input 
                type="checkbox" 
                id="invert" 
                checked={invertAmounts} 
                onChange={e => setInvertAmounts(e.target.checked)} 
                className="mt-0.5 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
              />
              <Label htmlFor="invert" className="text-xs leading-tight font-medium" style={{ color: "var(--fortress-steel)" }}>
                Invert single-column amounts (Check this if your bank lists expenses as positive numbers)
              </Label>
            </div>

          </div>
        </div>

        {/* PINNED FOOTER */}
        <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface)" }}>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: "var(--border-subtle)", color: "var(--fortress-steel)", backgroundColor: "transparent" }}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="font-bold tracking-wide text-white" style={{ backgroundColor: "var(--engine-navy)", border: "none" }}>
              Import Data
            </Button>
          </DialogFooter>
        </div>

      </DialogContent>
    </Dialog>
  );
}