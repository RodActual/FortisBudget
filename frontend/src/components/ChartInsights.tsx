import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { BudgetManager } from "../components/BudgetManager";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  ReferenceLine,
  Label,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, GitCompare, Calendar } from "lucide-react";
import type { Budget, Transaction } from "../App";

interface ChartsInsightsProps {
  budgets: Budget[];
  transactions: Transaction[];
  onUpdateBudgets: (budgets: Budget[]) => void;
}

const resolveColor = (color: string) => color || "#CBD5E1";

type TimeRange = "3m" | "6m" | "1y" | "all";

export function ChartsInsights({ budgets, transactions, onUpdateBudgets }: ChartsInsightsProps) {
  const [chartMode, setChartMode] = useState<"growth" | "spending" | "comparison">("comparison");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  // ── 1. Category spending data ────────────────────────────────────────────
  const categoryData = useMemo(() =>
    budgets
      .map((b) => ({
        name: b.category,
        value: Number(b.spent || 0),
        color: resolveColor(b.color),
        budget: Number(b.budgeted || 0),
      }))
      .filter((item) => item.budget > 0 || item.value > 0),
    [budgets]
  );

  const pieChartData = categoryData.filter((item) => item.value > 0);

  // ── 2. Trend data with time-range filter ─────────────────────────────────
  const filteredTrendData = useMemo(() => {
    // Group transactions by Year-Month
    const grouped: Record<string, { date: string; sortKey: number; income: number; expense: number }> = {};

    transactions.forEach((t) => {
      if (t.archived) return; 

      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      
      const year = d.getFullYear();
      const month = d.getMonth(); 
      
      // Ensure key sorts properly chronologically
      const paddedMonth = month.toString().padStart(2, "0");
      const key = `${year}-${paddedMonth}`;
      
      const displayDate = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      if (!grouped[key]) {
        grouped[key] = { 
          date: displayDate, 
          sortKey: year * 100 + month, 
          income: 0, 
          expense: 0 
        };
      }
      
      if (t.type === "income") {
        grouped[key].income += Number(t.amount || 0);
      } else {
        grouped[key].expense += Number(t.amount || 0);
      }
    });

    const sorted = Object.values(grouped).sort((a, b) => a.sortKey - b.sortKey);
    
    if (timeRange === "all") return sorted;
    
    const rangeMap: Record<TimeRange, number> = { "3m": 3, "6m": 6, "1y": 12, all: 999 };
    return sorted.slice(-rangeMap[timeRange]);
  }, [transactions, timeRange]);

  const visibleAverages = useMemo(() => {
    if (!filteredTrendData.length) return { income: 0, expense: 0 };
    const n = filteredTrendData.length;
    return {
      income:  filteredTrendData.reduce((s, d) => s + d.income,  0) / n,
      expense: filteredTrendData.reduce((s, d) => s + d.expense, 0) / n,
    };
  }, [filteredTrendData]);

  // ── Custom Pie label ─────────────────────────────────────────────────────
  const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const r = outerRadius * 1.28;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x} y={y}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        style={{ fontSize: 10, fontWeight: 600, fill: "var(--fortress-steel)", fontFamily: "Inter, sans-serif" }}
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  // ── Custom Tooltips ──────────────────────────────────────────────────────
  const CategoryTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        className="rounded-md border p-3 text-sm"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</span>
        </div>
        <p style={{ color: "var(--fortress-steel)" }}>
          Spent: <span className="font-mono font-bold">${d.value.toFixed(2)}</span>
        </p>
        {d.budget > 0 && (
          <p style={{ color: "var(--text-muted)" }}>
            Budget: <span className="font-mono">${d.budget.toFixed(2)}</span>
          </p>
        )}
      </div>
    );
  };

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-md border p-3 text-sm"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
        }}
      >
        <p className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.fill }} />
            <span style={{ color: "var(--fortress-steel)" }} className="capitalize">{entry.name}:</span>
            <span className="font-bold font-mono" style={{ color: entry.stroke || entry.fill }}>
              ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ── Chart mode button styles ─────────────────────────────────────────────
  const modeButtons: { key: "growth" | "spending" | "comparison"; icon: typeof TrendingUp; label: string; activeColor: string }[] = [
    { key: "growth",     icon: TrendingUp,  label: "Growth",  activeColor: "var(--field-green)"  },
    { key: "spending",   icon: TrendingDown, label: "Spending", activeColor: "var(--castle-red)"  },
    { key: "comparison", icon: GitCompare,  label: "Compare", activeColor: "var(--engine-navy)"  },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Charts & Insights
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--fortress-steel)" }}>
          Analyze your spending patterns and financial trends.
        </p>
      </div>

      {/* ── Budget Manager ──────────────────────────────────────────────────── */}
      <BudgetManager
        budgets={budgets}
        onUpdateBudgets={onUpdateBudgets}
        transactions={transactions}
      />

      {/* ── Pie + Bar Row ───────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Spending by Category — Pie */}
        <Card className="min-w-0 border" style={{ borderColor: "var(--border-subtle)" }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
              Spending by Category
            </CardTitle>
            <CardDescription style={{ color: "var(--fortress-steel)" }}>
              Distribution of expenses this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%" cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      paddingAngle={3}
                      labelLine={{ stroke: "var(--border)", strokeWidth: 1 }}
                      label={renderPieLabel}
                    >
                      {pieChartData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} strokeWidth={1} stroke="var(--surface)" />
                      ))}
                    </Pie>
                    <Tooltip content={<CategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="h-64 flex items-center justify-center rounded-md border-2 border-dashed text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                No spending data for the current month.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Adherence — Horizontal Bar */}
        <Card className="min-w-0 border" style={{ borderColor: "var(--border-subtle)" }}>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
              Budget Adherence
            </CardTitle>
            <CardDescription style={{ color: "var(--fortress-steel)" }}>
              Planned vs. actual — current month
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div style={{ width: "100%", height: 340 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{ left: 10, right: 40, top: 4, bottom: 4 }}
                    barGap={4}
                  >
                    <defs>
                      <pattern
                        id="fortis-stripe"
                        x="0" y="0" width="8" height="8"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(45)"
                      >
                        <rect x="0" y="0" width="8" height="8" fill="#F1F5F9" />
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#CBD5E1" strokeWidth="2" />
                      </pattern>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                    <XAxis
                      type="number"
                      hide
                      tick={{ fontSize: 11, fill: "var(--fortress-steel)" }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={82}
                      tick={{ fontSize: 11, fill: "var(--fortress-steel)", fontFamily: "Inter, sans-serif" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CategoryTooltip />} cursor={{ fill: "var(--surface-raised)" }} />
                    <Legend
                      iconType="rect"
                      wrapperStyle={{ fontSize: 11, color: "var(--fortress-steel)" }}
                    />
                    <Bar
                      dataKey="budget"
                      name="Budget"
                      fill="url(#fortis-stripe)"
                      radius={[0, 4, 4, 0]}
                      barSize={10}
                    />
                    <Bar
                      dataKey="value"
                      name="Spent"
                      radius={[0, 4, 4, 0]}
                      barSize={10}
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="h-64 flex items-center justify-center rounded-md border-2 border-dashed text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                No data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Financial Trends ────────────────────────────────────────────────── */}
      <Card className="border" style={{ borderColor: "var(--border-subtle)" }}>
        <CardHeader>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                Financial Trends
              </CardTitle>
              <CardDescription style={{ color: "var(--fortress-steel)" }}>
                Performance tracking vs. range averages
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Time Range Selector */}
              <div
                className="flex items-center gap-1 p-1 rounded-md border"
                style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
              >
                <Calendar className="w-3 h-3 ml-1.5 mr-0.5" style={{ color: "var(--text-muted)" }} />
                {(["3m", "6m", "1y", "all"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: timeRange === range ? "var(--surface)" : "transparent",
                      color: timeRange === range ? "var(--engine-navy)" : "var(--fortress-steel)",
                      boxShadow: timeRange === range ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      border: timeRange === range ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>

              {/* Chart Mode Selector */}
              <div
                className="flex p-1 rounded-md border"
                style={{ backgroundColor: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}
              >
                {modeButtons.map(({ key, icon: Icon, label, activeColor }) => (
                  <button
                    key={key}
                    onClick={() => setChartMode(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all"
                    style={{
                      backgroundColor: chartMode === key ? activeColor : "transparent",
                      color: chartMode === key ? "#FFFFFF" : "var(--fortress-steel)",
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredTrendData.length > 0 ? (
            <div style={{ width: "100%", height: 380, marginTop: "0.5rem" }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={filteredTrendData}
                  margin={{ top: 20, right: 64, left: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#166534" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8B1219" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#8B1219" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--fortress-steel)", fontFamily: "Inter, sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--fortress-steel)", fontFamily: "Inter, sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: "var(--fortress-steel)" }}
                  />

                  {/* Average reference lines */}
                  {(chartMode === "growth" || chartMode === "comparison") && (
                    <ReferenceLine y={visibleAverages.income} stroke="#166534" strokeDasharray="4 4" strokeOpacity={0.7}>
                      <Label
                        value={`Avg $${visibleAverages.income.toFixed(0)}`}
                        position="right"
                        fill="#166534"
                        fontSize={10}
                        fontWeight={700}
                      />
                    </ReferenceLine>
                  )}
                  {(chartMode === "spending" || chartMode === "comparison") && (
                    <ReferenceLine y={visibleAverages.expense} stroke="#8B1219" strokeDasharray="4 4" strokeOpacity={0.7}>
                      <Label
                        value={`Avg $${visibleAverages.expense.toFixed(0)}`}
                        position="right"
                        fill="#8B1219"
                        fontSize={10}
                        fontWeight={700}
                      />
                    </ReferenceLine>
                  )}

                  {(chartMode === "growth" || chartMode === "comparison") && (
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke="#166534"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#grad-income)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#166534", stroke: "var(--surface)", strokeWidth: 2 }}
                    />
                  )}
                  {(chartMode === "spending" || chartMode === "comparison") && (
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Expenses"
                      stroke="#8B1219"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#grad-expense)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#8B1219", stroke: "var(--surface)", strokeWidth: 2 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className="h-72 flex items-center justify-center rounded-md border-2 border-dashed text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--surface-raised)" }}
            >
              Insufficient data history for this range.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}