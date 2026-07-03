// api/forgot-password/otp-lib.js
// Shared helpers for the SMS-OTP password reset endpoints.

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores env vars as single-line strings, so the real
      // newlines in the private key get escaped as literal "\n" — undo that.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

function db()   { return getFirestore(getAdminApp()); }
function auth() { return getAuth(getAdminApp()); }

// Normalize any of 09XXXXXXXXX / 9XXXXXXXXX / 639XXXXXXXXX / +639XXXXXXXXX
// down to the same +639XXXXXXXXX format register.html stores in Firestore.
function normalizePhone(raw) {
  let n = String(raw || "").trim().replace(/\s+/g, "");
  if (n.startsWith("09"))          n = "+63" + n.slice(1);
  else if (n.startsWith("639"))    n = "+"  + n;
  else if (/^9\d{9}$/.test(n))     n = "+63" + n;
  return n;
}

const UNISMS_URL       = "https://unismsapi.com/api/sms";
const UNISMS_SENDER_ID = "UnisoftDEV"; // keep in sync with api/sms.js

async function sendSMS(recipient, message) {
  const secretKey = process.env.UNISMS_SECRET_KEY;
  if (!secretKey) throw new Error("UNISMS_SECRET_KEY is not configured");

  const response = await fetch(UNISMS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + Buffer.from(secretKey + ":").toString("base64"),
    },
    body: JSON.stringify({ recipient, content: message, sender_id: UNISMS_SENDER_ID }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("UniSMS error:", data);
    throw new Error("UniSMS rejected the message");
  }
  return data;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = { db, auth, normalizePhone, sendSMS, setCors };
