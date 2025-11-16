require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const UAParser = require("ua-parser-js");
const axios = require("axios");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "gradify67",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(express.urlencoded({ extended: true }));

// RESEND
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// SEND EMAIL FUNCTION
async function sendVisitorEmail(message) {
  try {
    await resend.emails.send({
      from: "Website Alerts <onboarding@resend.dev>",
      to: process.env.SEND_TO,
      subject: "New Visitor",
      text: message,
    });
  } catch (error) {
    console.error("Resend email error:", error);
  }
}

// IP INFO API
async function getIPInfo(ip) {
  try {
    const clean = ip.split(",")[0].trim();
    const res = await axios.get(`https://ipapi.co/${clean}/json/`);
    return res.data;
  } catch {
    return null;
  }
}

// GLOBAL VISITOR LOGGER
app.use(async (req, res, next) => {
  const ipRaw = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ip = ipRaw.split(",")[0].trim();

  const parser = new UAParser(req.headers["user-agent"]);
  const ua = parser.getResult();

  const ipInfo = await getIPInfo(ip);

  const message = `
New Visitor:

IP: ${ip}
Country: ${ipInfo?.country_name || "Unknown"}
City: ${ipInfo?.city || "Unknown"}

Device: ${ua.device.type || "Desktop"}
Browser: ${ua.browser.name || "Unknown"}
OS: ${ua.os.name || "Unknown"}

Page: ${req.originalUrl}
Referer: ${req.headers.referer || "Direct"}
Time: ${new Date().toISOString()}

User-Agent:
${req.headers["user-agent"]}
`;

  await sendVisitorEmail(message);
  next();
});

// ESCAPE HTML
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// HOME PAGE
app.get("/", async (req, res) => {
  const visitorIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];
  const time = new Date().toISOString();

  await sendVisitorEmail(
    `New visitor on homepage\nIP: ${visitorIP}\nUser-Agent: ${userAgent}\nTime: ${time}`
  );

  res.sendFile(path.join(__dirname, "public", "views", "index.html"));
});

// SEARCH PAGE
app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "views", "search.html"));
});

// API SEARCH
app.get("/api/search", (req, res) => {
  const q = req.query.q?.toLowerCase() || "";
  const data = JSON.parse(fs.readFileSync("./data/list.json"));
  const results = data.filter((item) => item.name.toLowerCase().includes(q));
  res.json(results);
});

// DISPLAY PAGE
app.get("/display/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "views", "display.html"));
});

// DISPLAY API (FLASK SERVICE)
app.get("/api/display/:id", async (req, res) => {
  const apogeeId = req.params.id;

  try {
    const response = await axios.get(
      `https://gradify-utilities.onrender.com/grades`,
      { params: { apogee: apogeeId } }
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(response.data);
  } catch (error) {
    console.error("Error fetching grades:", error.message);
    res.status(500).send('<p class="text-danger">No grades found.</p>');
  }
});

// LOGIN
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect("/login?error=missing");
  }

  if (
    (username === "bilalab" && password === "saymynamehhh") ||
    (username === "abdou" && password === "bouker6666")
  ) {
    req.session.username = username;
    return res.redirect("/");
  }

  res.redirect("/login?error=invalid");
});

// USERNAME API
app.get("/api/username", (req, res) => {
  res.json({ username: req.session.username || null });
});

// START SERVER
app.listen(3000, () => {
  console.log("Started on port 3000!");
});