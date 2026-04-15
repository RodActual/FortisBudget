import { useCallback, useRef, useState } from "react";
import type { Transaction, Budget } from "../App";
import type { CSVMapping } from "../components/CSVMappingDialog";

// ── Types ───────────────────────────────────────────────────────────────────

export interface StagedTransaction extends Omit<Transaction, "id"> {
  suggestRecurring?: boolean;
}

// ── Export Logic ─────────────────────────────────────────────────────────────
const EXPORT_HEADERS = ["date", "description", "category", "type", "amount"];

function escapeCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatExportDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function exportTransactionsToCSV(transactions: Transaction[]): void {
  const active = transactions.filter(t => !t.archived);
  if (active.length === 0) {
    alert("No transactions to export.");
    return;
  }

  const rows = [
    EXPORT_HEADERS.join(","),
    ...active
      .sort((a, b) => b.date - a.date)
      .map(t => [
        escapeCell(formatExportDate(t.date)),
        escapeCell(t.description),
        escapeCell(t.category),
        escapeCell(t.type),
        escapeCell(t.amount.toFixed(2)),
      ].join(",")),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `fortis-transactions-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Import Parsing Logic ──────────────────────────────────────────────────────

function parseDate(raw: string): number | null {
  const cleaned = raw.trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed.getTime();

  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const attempt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(attempt.getTime())) return attempt.getTime();
  }
  return null;
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; i++;
      } else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim()); current = "";
    } else { current += ch; }
  }
  cells.push(current.trim());
  return cells;
}

function isLikelyRecurring(description: string): boolean {
  const descLower = description.toLowerCase();
  const recurringKeywords = [
    "netflix", "spotify", "hulu", "disney+", "amazon prime", "hbo", 
    "rent", "mortgage", "insurance", "gym", "membership", "utility",
    "internet", "verizon", "at&t", "spectrum", "duke energy", "icloud"
  ];
  return recurringKeywords.some(kw => descLower.includes(kw));
}

/**
 * NEW: Pattern Matching Logic integrated with existing Budgets.
 * This ensures the importer "speaks the same language" as your BudgetManager.
 */
function autoCategorize(description: string, defaultCategory: string, budgets: Budget[]): string {
  const descLower = description.toLowerCase();
  
  const rules = [
    { cat: "Food", keywords: ["walmart", "kroger", "target", "meijer", "aldi", "publix", "safeway", "whole foods", "trader joe", "grocery", "mcdonalds", "starbucks", "wendys", "taco bell", "chick-fil-a", "subway", "doordash", "uber eats", "grubhub", "restaurant", "cafe", "pizza", "burger", "panera", "chipotle"] },
    { cat: "Transportation", keywords: ["shell", "exxon", "chevron", "speedway", "bp", "pilot", "marathon", "sunoco", "gas", "fuel", "uber", "lyft", "tesla", "transit"] },
    { cat: "Utilities", keywords: ["duke", "aes", "spectrum", "at&t", "verizon", "t-mobile", "electric", "water", "sewer", "internet", "comcast", "xfinity"] },
    { cat: "Housing", keywords: ["rent", "mortgage", "apartment", "housing", "hoa"] },
    { cat: "Health", keywords: ["pharmacy", "cvs", "walgreens", "rite aid", "hospital", "clinic", "dental", "doctor", "insurance"] },
    { cat: "Entertainment", keywords: ["netflix", "spotify", "hulu", "amazon prime", "hbo", "disney", "amc", "steam", "playstation", "xbox", "gaming", "minecraft"] },
    { cat: "Shopping", keywords: ["amazon", "amzn", "best buy", "ebay", "etsy", "home depot", "lowes", "nike", "tj maxx", "shopping", "retail"] }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => descLower.includes(kw))) {
      // Find the budget that matches this category name (case-insensitive)
      const matchedBudget = budgets.find(b => 
        b.category.toLowerCase() === rule.cat.toLowerCase()
      );
      if (matchedBudget) return matchedBudget.category;
      
      // Secondary check: if "Groceries" is the rule but the user has "Food"
      const fuzzyMatch = budgets.find(b => rule.cat.toLowerCase().includes(b.category.toLowerCase()) || b.category.toLowerCase().includes(rule.cat.toLowerCase()));
      if (fuzzyMatch) return fuzzyMatch.category;
    }
  }
  
  return defaultCategory;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseCSVProps {
  transactions: Transaction[];
  budgets: Budget[];
  onImportTransactions: (rows: Omit<Transaction, "id">[]) => Promise<void>;
}

export function useCSV({ transactions, budgets, onImportTransactions }: UseCSVProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);

  const handleExport = useCallback(() => exportTransactionsToCSV(transactions), [transactions]);
  const handleImportClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      alert("File is empty or has no data rows.");
      return;
    }
    setCsvHeaders(parseCSVLine(lines[0]));
    setRawLines(lines.slice(1));
    setIsMappingModalOpen(true);
  }, []);

  const generatePreview = (mapping: CSVMapping): StagedTransaction[] => {
    const rows: StagedTransaction[] = [];
    const dateIdx = csvHeaders.indexOf(mapping.dateCol);
    const descIdx = csvHeaders.indexOf(mapping.descCol);
    const amountIdx = csvHeaders.indexOf(mapping.amountCol);
    const incomeIdx = mapping.incomeCol !== "none" ? csvHeaders.indexOf(mapping.incomeCol) : -1;
    const typeIdx = mapping.typeCol !== "none" ? csvHeaders.indexOf(mapping.typeCol) : -1;

    for (const line of rawLines) {
      const cells = parseCSVLine(line);
      if (cells.length < 2) continue;

      let rawAmount = cells[amountIdx] ?? "";
      const rawIncome = incomeIdx >= 0 ? (cells[incomeIdx] ?? "") : "";
      let isSplitIncome = false;

      if (incomeIdx >= 0 && rawIncome.trim() !== "") {
        const incParsed = parseFloat(rawIncome.replace(/[$,\s]/g, ""));
        if (!isNaN(incParsed) && incParsed !== 0) {
          rawAmount = rawIncome;
          isSplitIncome = true;
        }
      }

      const cleanAmountStr = rawAmount.replace(/[$,\s]/g, "");
      let parsedAmount = parseFloat(cleanAmountStr);
      if (isNaN(parsedAmount)) continue;

      // Apply sign inversion logic
      if (mapping.invertAmounts && !isSplitIncome) {
        parsedAmount = parsedAmount * -1;
      }

      let type: "income" | "expense" = "expense";
      if (isSplitIncome) {
        type = "income";
      } else if (typeIdx >= 0) {
        const rawTypeLabel = (cells[typeIdx] ?? "").toLowerCase();
        type = (rawTypeLabel.includes("credit") || rawTypeLabel.includes("deposit") || rawTypeLabel.includes("income")) ? "income" : "expense";
      } else {
        type = parsedAmount < 0 ? "expense" : "income";
      }

      const finalAmount = Math.abs(parsedAmount);
      if (finalAmount === 0) continue;

      const date = parseDate(cells[dateIdx] ?? "") || Date.now();
      const description = cells[descIdx] ?? "Unknown Payee";

      rows.push({
        date,
        description,
        // Match against user's specific budgets
        category: type === "income" ? "Income" : autoCategorize(description, mapping.defaultCategory, budgets),
        amount: finalAmount,
        type,
        suggestRecurring: isLikelyRecurring(description)
      });
    }
    return rows;
  };

  const executeFinalImport = async (data: Omit<Transaction, "id">[]) => {
    if (data.length === 0) return;
    try {
      await onImportTransactions(data);
      setIsMappingModalOpen(false);
    } catch (err) {
      console.error("Import error:", err);
      alert("Failed to save transactions.");
    }
  };

  return { 
    handleExport, 
    handleImportClick, 
    handleFileChange, 
    fileInputRef,
    isMappingModalOpen,
    setIsMappingModalOpen,
    csvHeaders,
    generatePreview,
    executeFinalImport
  };
}