// api/sms.js
// UniSMS proxy for JunkOut — replaces the old PhilSMS proxy.
// Deploy target: same Vercel project as junkout-sms-proxy.vercel.app
// (overwrite your existing api/sms.js file with this one)

const UNISMS_URL       = "https://unismsapi.com/api/sms";
const UNISMS_SENDER_ID = "UniSMS"; // replace once you register your own Sender ID

module.exports = async function handler(req, res) {
  // ── CORS ──
  // Your dashboard runs on junkout-46931.web.app, a different domain from
  // this Vercel deployment. Browsers send a preflight OPTIONS request before
  // any cross-site POST with a JSON body, and reject the real request if
  // that preflight isn't answered correctly. Every response — including
  // errors below — needs these headers, not just the OPTIONS one.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only allow POST, same as before
  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const { recipient, message } = req.body || {};
  if (!recipient || !message) {
    res.status(400).json({ status: "error", message: "recipient and message are required" });
    return;
  }

  // Normalize to +63 format, same logic your Cloud Function already uses
  let number = String(recipient).trim().replace(/\s+/g, "");
  if (number.startsWith("09"))  number = "+63" + number.slice(1);
  if (number.startsWith("639")) number = "+"  + number;
  if (!number.startsWith("+63")) {
    res.status(400).json({ status: "error", message: "Invalid phone number format" });
    return;
  }

  const secretKey = process.env.UNISMS_SECRET_KEY;
  if (!secretKey) {
    console.error("UNISMS_SECRET_KEY environment variable is not set");
    res.status(500).json({ status: "error", message: "Server misconfiguration: missing SMS key" });
    return;
  }

  try {
    const response = await fetch(UNISMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(secretKey + ":").toString("base64"),
      },
      body: JSON.stringify({
        recipient: number,
        content:   message,
        sender_id: UNISMS_SENDER_ID,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("UniSMS error:", data);
      res.status(response.status).json({ status: "error", message: "UniSMS rejected the message", detail: data });
      return;
    }

    // Keep the same success shape your admin_dashboard.html already checks for
    // (it looks for data.status === 'success' OR resp.ok)
    res.status(200).json({ status: "success", data });
  } catch (err) {
    console.error("UniSMS request failed:", err);
    res.status(500).json({ status: "error", message: "Failed to reach UniSMS" });
  }
};
