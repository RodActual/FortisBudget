import "./globals.css";
import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, updateDoc, deleteDoc } from "firebase/firestore"; 
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

// Components
import { 
  DashboardOverview, 
  ExpenseTracking, 
  ChartsInsights, 
  SettingsPage, 
  AddTransactionDialog, 
  LoginForm, 
  AlertsNotificationBell, 
  LiteraturePage, 
  LandingPage, 
  PrivacyPolicy, 
  TermsOfService, 
  WelcomeSetup, 
  EmailVerification,
  ErrorBoundary,
  GlobalErrorBoundary
} from "./components";

import { FortisLogo } from "./components/FortisLogo";

// UI
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { LayoutDashboard, Receipt, BarChart3, Settings, LogOut, BookOpen, ArrowLeft } from "lucide-react"; 
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";

// Hooks
import { useFinancialData } from "./hooks/useFinancialData";
import { useInactivity } from "./hooks/useInactivity";

// Types
export interface Transaction {
  id: string;
  date: number;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  userId?: string;
  archived?: boolean; 
}

export interface Budget {
  lastReset: number;
  id?: string;
  category: string;
  budgeted: number;
  spent: number;
  color: string;
  userId?: string;
}

export interface AlertSettings {
  budgetWarningEnabled: boolean;
  budgetWarningThreshold: number;
  budgetExceededEnabled: boolean;
  largeTransactionEnabled: boolean;
  largeTransactionAmount: number;
  weeklyReportEnabled: boolean;
  dismissedAlertIds: string[]; 
}

export default function App() {
  // --- 1. AUTH & USER STATE ---
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    budgetWarningEnabled: true,
    budgetWarningThreshold: 80,
    budgetExceededEnabled: true,
    largeTransactionEnabled: true,
    largeTransactionAmount: 500,
    weeklyReportEnabled: false,
    dismissedAlertIds: [],
  });

  // --- 2. UI STATE ---
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'signup' | 'privacy' | 'terms'>('landing');
  const [showVerificationBanner, setShowVerificationBanner] = useState(false);

  // --- 3. CUSTOM HOOKS ---
  // THE FIX: Added savingsBuckets and vault functions back into the pipeline
  const { 
    transactions, budgets, currentBudgets, savingsBuckets, loading: dataLoading, 
    addTransaction, updateTransaction, deleteTransaction, updateBudgets,
    addVault, updateVault, deleteVault 
  } = useFinancialData(user);

  const { showWarning, continueSession, logout } = useInactivity(user);

  // --- 4. AUTH EFFECTS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await currentUser.reload();
          setUser(currentUser); 
          setShowVerificationBanner(!currentUser.emailVerified);

          const settingsRef = doc(db, "userSettings", currentUser.uid);
          const settingsDoc = await getDoc(settingsRef);
          
          if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            setUserName(data.userName || "User");
            setSavingsGoal(data.savingsGoal || 0);
            setNotificationsEnabled(data.notificationsEnabled ?? true);
            setIsSetupComplete(data.isSetupComplete === true);
            if (data.alertSettings) setAlertSettings(data.alertSettings);
          } else {
            setIsSetupComplete(false);
          }
        } catch (error) {
          console.error("Error loading settings:", error);
          setIsSetupComplete(false);
        }
      } else {
        setUser(null);
        setIsSetupComplete(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 5. AUTO-SAVE SETTINGS ---
  const handleSaveSettings = useCallback(async () => {
    if (!user) return;
    try {
      const settingsRef = doc(db, "userSettings", user.uid);
      await setDoc(settingsRef, {
        userName, savingsGoal, notificationsEnabled, alertSettings, isSetupComplete, 
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) { console.error("Error saving settings:", error); }
  }, [user, userName, savingsGoal, notificationsEnabled, alertSettings, isSetupComplete]);

  useEffect(() => {
    if (user && !authLoading && user.emailVerified) {
      const handler = setTimeout(handleSaveSettings, 500);
      return () => clearTimeout(handler);
    }
  }, [user, authLoading, userName, savingsGoal, notificationsEnabled, alertSettings, handleSaveSettings]);

  // --- 6. HANDLERS ---
  const handleLogout = async () => {
    await logout();
    setUserName("User");
    setSavingsGoal(0);
    setActiveTab("dashboard");
    setAuthMode('landing');
    setIsSetupComplete(false);
  };

  const handleLegalBack = () => setAuthMode('landing');

  const handleUpdatePassword = async (current: string, newPass: string) => {
    if (!user) return { success: false, error: "No user" };
    try {
      const cred = EmailAuthProvider.credential(user.email!, current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  };

  const handleDeleteAccount = async (pass: string) => {
    if (!user) return { success: false, error: "No user" };
    try {
      const cred = EmailAuthProvider.credential(user.email!, pass);
      await reauthenticateWithCredential(user, cred);
      const uid = user.uid;
      const tSnaps = await getDocs(query(collection(db, "transactions"), where("userId", "==", uid)));
      const bSnaps = await getDocs(query(collection(db, "budgets"), where("userId", "==", uid)));
      const sSnaps = await getDocs(query(collection(db, "savingsBuckets"), where("userId", "==", uid))); // Added vault deletion
      const batch = writeBatch(db);
      tSnaps.docs.forEach(d => batch.delete(d.ref));
      bSnaps.docs.forEach(d => batch.delete(d.ref));
      sSnaps.docs.forEach(d => batch.delete(d.ref)); // Added vault deletion
      batch.delete(doc(db, "userSettings", uid));
      await batch.commit();
      await deleteUser(user);
      return { success: true };
    } catch (e: any) { 
      console.error("Delete Account Error:", e);
      return { success: false, error: e.message }; 
    }
  };

  // --- 7. ARCHIVE HANDLERS ---
  const handleUpdateTransactionForArchive = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;
    try {
      const transactionRef = doc(db, 'transactions', id);
      await updateDoc(transactionRef, updates);
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
      throw error;
    }
  };

  const handleDeleteTransactionPermanently = async (id: string) => {
    if (!user) return;
    try {
      const transactionRef = doc(db, 'transactions', id);
      await deleteDoc(transactionRef);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
      throw error;
    }
  };

  // --- 8. CSV IMPORT HANDLER ---
  const handleImportTransactions = async (rows: Omit<Transaction, "id">[]) => {
    await Promise.all(rows.map(row => addTransaction(row)));
  };

  // --- 9. RENDERING ---
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--castle-red)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--fortress-steel)' }}>Loading FortisBudget...</p>
      </div>
    </div>
  );

  // Global Legal Overlays
  if (authMode === 'privacy') return <PrivacyPolicy onBack={handleLegalBack} />;
  if (authMode === 'terms') return <TermsOfService onBack={handleLegalBack} />;

  if (!user) {
    if (authMode === 'login' || authMode === 'signup') {
      return (
        <div className="relative min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="absolute top-4 left-4 z-10">
            <Button 
              variant="ghost" 
              onClick={() => setAuthMode('landing')} 
              style={{ color: 'var(--fortress-steel)' }}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
          <LoginForm onLogin={() => {}} initialIsSignUp={authMode === 'signup'} />
        </div>
      );
    }
    
    return (
      <LandingPage 
        onGetStarted={() => setAuthMode('signup')} 
        onSignIn={() => setAuthMode('login')} 
        onOpenPrivacy={() => setAuthMode('privacy')} 
        onOpenTerms={() => setAuthMode('terms')} 
      />
    );
  }

  return (
    <GlobalErrorBoundary>
      <div className="min-h-screen relative" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
          
          {/* ================================================================
              FORTIS HEADER — Engine Navy structural bar
              ================================================================ */}
          <header 
            className="flex items-center justify-between rounded-lg px-4 py-3 overflow-hidden"
            style={{ 
              backgroundColor: 'var(--engine-navy)',
              boxShadow: '0 2px 8px rgba(27, 38, 59, 0.4)',
            }}
          >
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <FortisLogo className="h-8 w-8" />
              <div>
                <h1 className="text-base font-bold tracking-widest uppercase text-white">
                  FortisBudget
                </h1>
                <p className="hidden lg:block text-[9px] font-medium uppercase tracking-[0.25em]" style={{ color: '#64748B' }}>
                  Financial Strength Through Intentionality
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Email display */}
              <span 
                className="text-xs font-medium hidden sm:inline px-2 py-1 rounded"
                style={{ color: '#94A3B8', backgroundColor: 'rgba(255,255,255,0.06)' }}
              >
                {user?.email}
              </span>

              {/* Notification bell */}
              <div className="text-white">
                <AlertsNotificationBell 
                  budgets={currentBudgets} 
                  transactions={transactions} 
                  alertSettings={alertSettings} 
                  onUpdateAlertSettings={setAlertSettings} 
                />
              </div>

              {/* Logout */}
              <Button 
                onClick={handleLogout} 
                size="sm"
                className="text-white border font-semibold tracking-wide"
                style={{ 
                  backgroundColor: 'var(--castle-red)',
                  borderColor: 'var(--castle-red-dark)',
                  boxShadow: '0 2px 0 0 var(--castle-red-dark)',
                }}
              >
                <LogOut className="h-4 w-4" /> 
                <span className="hidden sm:inline ml-1">Logout</span>
              </Button>
            </div>
          </header>

          {/* Verification Banner */}
          {showVerificationBanner && (
            <EmailVerification 
              onVerified={async () => { 
                setShowVerificationBanner(false); 
                window.location.reload(); 
              }} 
            />
          )}

          {/* ================================================================
              MAIN CONTENT GATE
              ================================================================ */}
          {user?.emailVerified ? (
            !isSetupComplete ? (
              <WelcomeSetup 
                userId={user.uid} 
                onComplete={() => setIsSetupComplete(true)} 
              />
            ) : (
              <>
                {/* ============================================================
                    NAVIGATION TABS
                    ============================================================ */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList 
                    className="grid w-full grid-cols-5 h-auto sm:h-10 p-1 rounded-lg border"
                    style={{ 
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {[
                      { value: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                      { value: 'expenses',  icon: Receipt,         label: 'Expenses'  },
                      { value: 'insights',  icon: BarChart3,       label: 'Insights'  },
                      { value: 'learn',     icon: BookOpen,        label: 'Learn'     },
                      { value: 'settings',  icon: Settings,        label: 'Settings'  },
                    ].map(({ value, icon: Icon, label }) => (
                      <TabsTrigger 
                        key={value}
                        value={value} 
                        className="gap-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-all"
                        style={{
                          color: activeTab === value ? 'var(--engine-navy)' : 'var(--fortress-steel)',
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="dashboard" className="mt-6">
                    <ErrorBoundary name="Dashboard">
                      <DashboardOverview 
                        budgets={currentBudgets} 
                        transactions={transactions} 
                        savingsBuckets={savingsBuckets} // THE FIX: PASSED DATA HERE
                        onOpenAddTransaction={() => { setEditingTransaction(null); setDialogOpen(true); }} 
                      />
                    </ErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="expenses" className="mt-6">
                    <ErrorBoundary name="Expense Tracking">
                      <ExpenseTracking 
                        transactions={transactions} 
                        budgets={budgets} 
                        onOpenAddTransaction={() => { setEditingTransaction(null); setDialogOpen(true); }} 
                        onEdit={(t) => { setEditingTransaction(t); setDialogOpen(true); }} 
                        onDelete={deleteTransaction} 
                        onUpdateTransaction={updateTransaction}
                        onImportTransactions={handleImportTransactions}
                      />
                    </ErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="insights" className="mt-6">
                    <ErrorBoundary name="Charts & Insights">
                      <ChartsInsights 
                        budgets={currentBudgets} 
                        transactions={transactions} 
                        onUpdateBudgets={updateBudgets} 
                      />
                    </ErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="learn" className="mt-6">
                    <ErrorBoundary name="Learn">
                      <LiteraturePage />
                    </ErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="settings" className="mt-6">
                    <ErrorBoundary name="Settings">
                      <SettingsPage 
                        budgets={budgets} 
                        transactions={transactions}
                        savingsBuckets={savingsBuckets} // THE FIX: PASSED DATA HERE
                        onAddVault={addVault}           // THE FIX: PASSED DATA HERE
                        onUpdateVault={updateVault}     // THE FIX: PASSED DATA HERE
                        onDeleteVault={deleteVault}     // THE FIX: PASSED DATA HERE
                        onUpdateTransaction={handleUpdateTransactionForArchive}
                        onDeleteTransaction={handleDeleteTransactionPermanently}
                        onNavigate={setAuthMode}
                        onUpdatePassword={handleUpdatePassword} 
                        onDeleteAccount={handleDeleteAccount}
                      />
                    </ErrorBoundary>
                  </TabsContent>
                </Tabs>

                {/* Internal Legal Footer */}
                <footer 
                  className="flex justify-center gap-6 mt-8 pb-8 text-[10px] uppercase tracking-widest font-mono"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <button 
                    onClick={() => setAuthMode('privacy')} 
                    className="hover:underline transition-colors"
                    style={{ color: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--castle-red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    Privacy Policy
                  </button>
                  <button 
                    onClick={() => setAuthMode('terms')} 
                    className="hover:underline transition-colors"
                    style={{ color: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--castle-red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    Terms of Service
                  </button>
                  <span>&copy; 2026 FortisBudget</span>
                </footer>

                <AddTransactionDialog 
                  open={dialogOpen} 
                  onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingTransaction(null); }}
                  onAddTransaction={(t) => { addTransaction(t); setDialogOpen(false); }}
                  onEditTransaction={(t) => { if (editingTransaction) updateTransaction(editingTransaction.id, t); setDialogOpen(false); }}
                  editingTransaction={editingTransaction}
                  budgets={budgets}
                  savingsBuckets={savingsBuckets} // THE FIX: PASSED DATA HERE
                  onUpdateVault={updateVault}     // THE FIX: PASSED DATA HERE
                />
              </>
            )
          ) : (
            /* Email not verified gate */
            <div 
              className="text-center py-20 border-2 border-dashed rounded-lg mt-6"
              style={{ 
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Email Verification Required
              </h2>
              <p className="mt-2 max-w-sm mx-auto text-sm" style={{ color: 'var(--fortress-steel)' }}>
                To protect your financial data, please verify your email address using the banner above.
              </p>
            </div>
          )}

          {/* Inactivity Warning Dialog */}
          <AlertDialog open={showWarning} onOpenChange={() => {}}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you still there?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll be logged out in 2 minutes due to inactivity.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction 
                  onClick={continueSession}
                  style={{ backgroundColor: 'var(--engine-navy)' }}
                >
                  Continue Session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      </div>
    </GlobalErrorBoundary>
  );
}