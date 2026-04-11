const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// ─── TRANSPORTER CONFIG ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD,
  },
});

const carrierGateways = {
  "att": "txt.att.net",
  "tmobile": "tmomail.net",
  "verizon": "vtext.com",
  "sprint": "messaging.sprintpcs.com",
};

// ─── THE TRIGGER (v2 Syntax) ────────────────────────────────────────────────
exports.checkBudgetThresholds = onDocumentCreated("transactions/{transactionId}", async (event) => {
  const transaction = event.data.data(); 
  console.log(`[1] Trigger fired! New transaction detected: $${transaction.amount} in ${transaction.category}`);
  
  if (transaction.type !== "expense" || !transaction.category) {
    console.log("[EXIT] Ignored: Not an expense or missing category.");
    return;
  }

  try {
    const userId = transaction.userId;
    if (!userId) {
      console.log("[EXIT] CRITICAL: Transaction is missing a userId field!");
      return;
    }

    // 1. Fetch User Settings
    console.log(`[2] Looking up settings for User: ${userId}`);
    const userDoc = await db.collection("userSettings").doc(userId).get();
    
    if (!userDoc.exists) {
      console.log("[EXIT] No userSettings document found for this ID.");
      return;
    }
    
    const userData = userDoc.data();
    if (!userData.notificationsEnabled) {
      console.log("[EXIT] User has notifications disabled.");
      return;
    }

    const settings = userData.alertSettings || {};

    // 2. Fetch the specific Budget Category
    console.log(`[3] Searching for budget. Category: "${transaction.category}", User: "${userId}"`);
    const budgetsSnapshot = await db.collection("budgets")
      .where("userId", "==", userId)
      .where("category", "==", transaction.category)
      .get();

    if (budgetsSnapshot.empty) {
      console.log("[EXIT] No matching budget found. (Check case sensitivity!)");
      return;
    }
    
    const budget = budgetsSnapshot.docs[0].data();

    // 3. Calculate Thresholds
    const totalSpent = budget.spent; 
    const limit = budget.budgeted;
    const usageRatio = totalSpent / limit;

    console.log(`[4] Budget Data Loaded -> Limit: $${limit}, Spent: $${totalSpent}, Ratio: ${usageRatio}`);

    let alertMessage = "";
    let alertSubject = "";

    if (usageRatio >= 1.0 && settings.budgetExceededEnabled) {
      alertSubject = "🚨 Fortis Budget Alert -- Cloud";
      alertMessage = `You exceeded your ${budget.category} budget! Limit: $${limit}. Spent: $${totalSpent}.`;
      console.log("[5] Preparing RED Alert");
    } else if (usageRatio >= 0.8 && settings.budgetWarningEnabled) {
      alertSubject = "⚠️ Fortis Budget Alert-- Cloud";
      alertMessage = `Warning: You reached ${Math.round(usageRatio * 100)}% of your ${budget.category} budget. Only $${limit - totalSpent} remaining.`;
      console.log("[5] Preparing AMBER Alert");
    } else {
      console.log("[EXIT] Usage ratio is below 80%. No alert needed.");
      return;
    }

    // 4. Dispatch the Alerts
    if (alertMessage) {
      const mailOptions = {
        from: `"FortisBudget Alerts" <alerts@fortisbudget.com>`,
        subject: alertSubject,
        text: alertMessage,
      };

      const emailPromises = [];

      if (userData.email) {
        console.log(`[6] Sending email to: ${userData.email}`);
        emailPromises.push(transporter.sendMail({ ...mailOptions, to: userData.email }));
      } else {
        console.log("[WARNING] User document is missing the 'email' field!");
      }

      await Promise.all(emailPromises);
      console.log(`[7] SUCCESS! Alert fully dispatched for user ${userId}`);
    }
  } catch (error) {
    console.error("Alert Engine Error:", error);
  }
});