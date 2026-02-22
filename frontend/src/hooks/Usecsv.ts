import { useCallback, useRef, useState } from "react";
import type { Transaction, Budget } from "../App";
import type { CSVMapping } from "../components/CSVMappingDialog";

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
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
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
      .map(t =>
        [
          escapeCell(formatExportDate(t.date)),
          escapeCell(t.description),
          escapeCell(t.category),
          escapeCell(t.type),
          escapeCell(t.amount.toFixed(2)),
        ].join(",")
      ),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const today = new Date().toISOString().split("T")[0];
  link.href     = url;
  link.download = `fortis-transactions-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Import Parsing Logic ──────────────────────────────────────────────────────

function parseDate(raw: string): number | null {
  const cleaned = raw.trim();
  const parsed  = new Date(cleaned);
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
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

// ── Smart Category Engine ───────────────────────────────────────────────────
function autoCategorize(description: string, defaultCategory: string, budgets: Budget[]): string {
  const descLower = description.toLowerCase();
  
  // Keyword mapping for common categories
  const rules = [
    { cat: "Groceries", keywords: ["walmart", "kroger", "target", "meijer", "aldi", "publix", "safeway", "whole foods", "trader joe", "grocery"] },
    { cat: "Dining", keywords: ["mcdonalds", "starbucks", "wendys", "taco bell", "chick-fil-a", "subway", "doordash", "uber eats", "grubhub", "restaurant", "cafe", "pizza", "burger", "panera", "chipotle"] },
    { cat: "Gas", keywords: ["shell", "exxon", "chevron", "speedway", "bp", "pilot", "marathon", "sunoco", "gas", "fuel"] },
    { cat: "Utilities", keywords: ["duke", "aes", "spectrum", "at&t", "verizon", "t-mobile", "electric", "water", "sewer", "internet", "comcast", "xfinity"] },
    { cat: "Housing", keywords: ["rent", "mortgage", "apartment", "housing"] },
    { cat: "Insurance", keywords: ["geico", "state farm", "progressive", "allstate", "insurance"] },
    { cat: "Entertainment", keywords: ["netflix", "spotify", "hulu", "amazon prime", "hbo", "disney", "amc", "steam", "playstation", "xbox"] },
    { cat: "Shopping", keywords: ["amazon", "amzn", "best buy", "ebay", "etsy", "home depot", "lowes"] },
    { cat: "Health", keywords: ["pharmacy", "cvs", "walgreens", "rite aid", "hospital", "clinic", "dental"] }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => descLower.includes(kw))) {
      // Prioritize assigning to a user's exact existing budget category if it matches the theme
      const matchedBudget = budgets.find(b => 
        b.category.toLowerCase() === rule.cat.toLowerCase() || 
        rule.cat.toLowerCase().includes(b.category.toLowerCase())
      );
      if (matchedBudget) return matchedBudget.category;
      
      // If no exact match in budgets, assign the generalized category name
      return rule.cat; 
    }
  }

  return defaultCategory;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseCSVProps {
  transactions: Transaction[];
  budgets: Budget[]; // <-- Added to allow smart categorization
  onImportTransactions: (rows: Omit<Transaction, "id">[]) => Promise<void>;
}

export function useCSV({ transactions, budgets, onImportTransactions }: UseCSVProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);

  const handleExport = useCallback(() => {
    exportTransactionsToCSV(transactions);
  }, [transactions]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ""; // Reset to allow re-importing the same file

    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    
    if (lines.length < 2) {
      alert("File is empty or has no data rows.");
      return;
    }

    const headers = parseCSVLine(lines[0]);
    setCsvHeaders(headers);
    setRawLines(lines.slice(1));
    setIsMappingModalOpen(true);
  }, []);

  const executeImport = async (mapping: CSVMapping) => {
    setIsMappingModalOpen(false);
    
    const errors: string[] = [];
    const rows: Omit<Transaction, "id">[] = [];
    let skipped = 0;

    const dateIdx   = csvHeaders.indexOf(mapping.dateCol);
    const descIdx   = csvHeaders.indexOf(mapping.descCol);
    const amountIdx = csvHeaders.indexOf(mapping.amountCol);
    const incomeIdx = mapping.incomeCol !== "none" ? csvHeaders.indexOf(mapping.incomeCol) : -1;
    const typeIdx   = mapping.typeCol !== "none" ? csvHeaders.indexOf(mapping.typeCol) : -1;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      const cells = parseCSVLine(line);
      const lineNum = i + 2; 

      const rawDate      = cells[dateIdx] ?? "";
      const rawDesc      = cells[descIdx] ?? "";
      let   rawAmount    = cells[amountIdx] ?? "";
      const rawIncome    = incomeIdx >= 0 ? (cells[incomeIdx] ?? "") : "";
      const rawTypeLabel = typeIdx >= 0 ? (cells[typeIdx] ?? "").toLowerCase() : "";

      let isSplitIncome = false;

      // Handle split Income column
      if (incomeIdx >= 0 && rawIncome.trim() !== "") {
        const incParsed = parseFloat(rawIncome.replace(/[$,\s]/g, ""));
        if (!isNaN(incParsed) && incParsed !== 0) {
          rawAmount = rawIncome;
          isSplitIncome = true;
        }
      }

      // Clean and parse amount
      const cleanAmountStr = rawAmount.replace(/[$,\s]/g, "");
      let parsedAmount = parseFloat(cleanAmountStr);

      if (isNaN(parsedAmount)) {
        errors.push(`Row ${lineNum}: invalid amount "${rawAmount}".`);
        skipped++;
        continue;
      }

      // Invert if necessary
      if (mapping.invertAmounts && !isSplitIncome && incomeIdx === -1) {
        parsedAmount = parsedAmount * -1;
      }

      // Determine Type
      let type: "income" | "expense" = "expense";
      if (isSplitIncome) {
        type = "income";
      } else if (typeIdx >= 0 && rawTypeLabel) {
        if (rawTypeLabel.includes("credit") || rawTypeLabel.includes("deposit") || rawTypeLabel.includes("income")) {
          type = "income";
        } else {
          type = "expense";
        }
      } else if (incomeIdx >= 0) {
        type = "expense";
      } else {
        type = parsedAmount < 0 ? "expense" : "income";
      }

      const finalAmount = Math.abs(parsedAmount);

      if (finalAmount === 0) {
        skipped++;
        continue;
      }

      const date = parseDate(rawDate);
      if (date === null) {
        errors.push(`Row ${lineNum}: could not parse date "${rawDate}".`);
        skipped++;
        continue;
      }

      if (!rawDesc) {
        errors.push(`Row ${lineNum}: description is empty.`);
        skipped++;
        continue;
      }

      // Smart Category Assignment
      let finalCategory = type === "income" ? "Income" : mapping.defaultCategory;
      if (type === "expense") {
        finalCategory = autoCategorize(rawDesc, mapping.defaultCategory, budgets);
      }

      rows.push({
        date,
        description: rawDesc,
        category: finalCategory,
        amount: finalAmount,
        type,
      });
    }

    if (errors.length > 0 && rows.length === 0) {
      alert(`Import failed:\n\n${errors.join("\n")}`);
      return;
    }

    const summary = [
      `Ready to import ${rows.length} transaction${rows.length === 1 ? "" : "s"}.`,
      skipped > 0 ? `${skipped} row${skipped === 1 ? "" : "s"} skipped (errors or $0 amounts).` : "",
      errors.length > 0 ? `\nIssues:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n…and ${errors.length - 5} more` : ""}` : "",
      "\nProceed?",
    ].filter(Boolean).join("\n");

    if (!window.confirm(summary)) return;

    try {
      await onImportTransactions(rows);
      alert(`Successfully imported ${rows.length} transaction${rows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      alert("Import failed. Please try again.");
      console.error("CSV import error:", err);
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
    executeImport
  };
}