// api/forgot-password/verify-otp.js
const crypto = require("crypto");
const { db, normalizePhone, setCors } = require("./_lib");

const MAX_ATTEMPTS = 5;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const phone = normalizePhone((req.body || {}).phone);
  const otp   = String((req.body || {}).otp || "").trim();

  if (!phone || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ status: "error", message: "Please enter the 6-digit code." });
    return;
  }

  try {
    const firestore = db();
    const ref  = firestore.collection("passwordResetOTPs").doc(phone);
    const snap = await ref.get();

    if (!snap.exists) {
      res.status(400).json({ status: "error", message: "No active code for this number. Please request a new one." });
      return;
    }

    const data = snap.data();

    if (Date.now() > data.expiresAt) {
      res.status(400).json({ status: "error", message: "This code has expired. Please request a new one." });
      return;
    }

    if (data.attempts >= MAX_ATTEMPTS) {
      res.status(429).json({ status: "error", message: "Too many incorrect attempts. Please request a new code." });
      return;
    }

    if (data.otp !== otp) {
      await ref.update({ attempts: (data.attempts || 0) + 1 });
      const remaining = MAX_ATTEMPTS - ((data.attempts || 0) + 1);
      res.status(400).json({
        status: "error",
        message: remaining > 0 ? `Incorrect code. ${remaining} attempt(s) left.` : "Too many incorrect attempts. Please request a new code."
      });
      return;
    }

    // Correct — issue a one-time reset token the next step must present.
    // This stops someone from skipping straight to reset-password without
    // actually knowing the OTP.
    const resetToken = crypto.randomBytes(24).toString("hex");
    await ref.update({ verified: true, resetToken, resetTokenExpiresAt: Date.now() + 10 * 60 * 1000 });

    res.status(200).json({ status: "success", resetToken });
  } catch (err) {
    console.error("verify-otp failed:", err);
    res.status(500).json({ status: "error", message: "Something went wrong. Please try again." });
  }
};
