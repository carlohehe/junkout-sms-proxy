// api/forgot-password/reset-password.js
const { db, auth, normalizePhone, setCors } = require("./otp-lib");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const phone       = normalizePhone((req.body || {}).phone);
  const resetToken  = String((req.body || {}).resetToken || "");
  const newPassword = String((req.body || {}).newPassword || "");

  if (!phone || !resetToken) {
    res.status(400).json({ status: "error", message: "Missing verification info. Please restart the process." });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ status: "error", message: "Password must be at least 6 characters." });
    return;
  }

  try {
    const firestore = db();
    const ref  = firestore.collection("passwordResetOTPs").doc(phone);
    const snap = await ref.get();

    if (!snap.exists) {
      res.status(400).json({ status: "error", message: "Verification session not found. Please restart the process." });
      return;
    }

    const data = snap.data();

    if (!data.verified || data.resetToken !== resetToken) {
      res.status(403).json({ status: "error", message: "Invalid or expired verification. Please restart the process." });
      return;
    }
    if (Date.now() > data.resetTokenExpiresAt) {
      res.status(403).json({ status: "error", message: "Verification expired. Please restart the process." });
      return;
    }

    // Find the account that owns this phone number
    const userSnap = await firestore.collection("users").where("phone", "==", phone).limit(1).get();
    if (userSnap.empty) {
      res.status(404).json({ status: "error", message: "Account not found." });
      return;
    }
    const uid = userSnap.docs[0].id;

    await auth().updateUser(uid, { password: newPassword });

    // One-time use — delete so this token/OTP can never be replayed
    await ref.delete();

    res.status(200).json({ status: "success", message: "Password updated." });
  } catch (err) {
    console.error("reset-password failed:", err);
    res.status(500).json({ status: "error", message: "Could not reset password. Please try again." });
  }
};
