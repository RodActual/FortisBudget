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
  const transaction = event.data.data(); // This is how you get the document data in v2
  
  if (transaction.type !== "expense" || !transaction.category) return;

  try {
    const userId = transaction.userId;

    // 1. Fetch User Settings
    const userDoc = await db.collection("userSettings").doc(userId).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    if (!userData.notificationsEnabled) return;

    const settings = userData.alertSettings || {};

    // 2. Fetch the specific Budget Category
    const budgetsSnapshot = await db.collection("budgets")
      .where("userId", "==", userId)
      .where("category", "==", transaction.category)
      .get();

    if (budgetsSnapshot.empty) return;
    const budget = budgetsSnapshot.docs[0].data();

    // 3. Calculate Thresholds
    const totalSpent = budget.spent; 
    const limit = budget.budgeted;
    const usageRatio = totalSpent / limit;

    let alertMessage = "";
    let alertSubject = "";

    if (usageRatio >= 1.0 && settings.budgetExceededEnabled) {
      alertSubject = "🚨 Fortis Budget Alert -- Cloud";
      alertMessage = `You exceeded your ${budget.category} budget! Limit: $${limit}. Spent: $${totalSpent}.`;
    } else if (usageRatio >= 0.8 && settings.budgetWarningEnabled) {
      alertSubject = "⚠️ Fortis Budget Alert-- Cloud";
      alertMessage = `Warning: You reached ${Math.round(usageRatio * 100)}% of your ${budget.category} budget. Only $${limit - totalSpent} remaining.`;
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
        emailPromises.push(transporter.sendMail({ ...mailOptions, to: userData.email }));
      }

      if (userData.phoneNumber && userData.carrierId) {
        const gatewayDomain = carrierGateways[userData.carrierId];
        if (gatewayDomain) {
          const cleanPhone = userData.phoneNumber.replace(/\D/g, "");
          emailPromises.push(transporter.sendMail({ ...mailOptions, to: `${cleanPhone}@${gatewayDomain}` }));
        }
      }

      await Promise.all(emailPromises);
      console.log(`Alert sent for user ${userId} in category ${transaction.category}`);
    }
  } catch (error) {
    console.error("Alert Engine Error:", error);
  }
});