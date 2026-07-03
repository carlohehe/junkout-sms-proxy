// api/forgot-password/send-otp.js
const { db, normalizePhone, sendSMS, setCors } = require("./otp-lib");
const OTP_TTL_MS   = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds — mirrors the frontend's resend timer
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }
  const phone = normalizePhone((req.body || {}).phone);
  if (!/^\+639\d{9}$/.test(phone)) {
    res.status(400).json({ status: "error", message: "Please enter a valid Philippine mobile number." });
    return;
  }
  try {
    const firestore = db();
    // Find which account owns this phone number
    const snap = await firestore.collection("users").where("phone", "==", phone).limit(1).get();
    if (snap.empty) {
      res.status(404).json({ status: "error", message: "No account found with that phone number." });
      return;
    }
    // Cooldown: prevent spamming new OTPs / SMS credits
    const existing = await firestore.collection("passwordResetOTPs").doc(phone).get();
    if (existing.exists) {
      const data = existing.data();
      const elapsed = Date.now() - (data.createdAt || 0);
      if (elapsed < RESEND_COOLDOWN_MS) {
        res.status(429).json({ status: "error", message: "Please wait before requesting another code." });
        return;
      }
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    await firestore.collection("passwordResetOTPs").doc(phone).set({
      otp,
      createdAt: now,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      verified: false,
      resetToken: null,
    });
    await sendSMS(phone, `JunkOut Waste Management - Brgy. Bancao-Bancao: Your account password reset code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`);
    res.status(200).json({ status: "success", message: "Code sent." });
  } catch (err) {
    console.error("send-otp failed:", err);
    res.status(500).json({ status: "error", message: "Failed to send the code. Please try again." });
  }
};
