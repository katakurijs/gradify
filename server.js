require("dotenv").config();
const express = require('express');
const session = require("express-session");
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const nodemailer = require("nodemailer");
const UAParser = require("ua-parser-js");
const axios = require("axios");


const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "gradify67",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function getIPInfo(ip) {
  try {
    const clean = ip.split(",")[0].trim();
    const res = await axios.get(`https://ipapi.co/${clean}/json/`);
    return res.data;
  } catch {
    return null;
  }
}

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

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "x7beats1@gmail.com",
      subject: "New Visitor",
      text: message
    });
  } catch (e) {
    console.log("Email error:", e);
  }

  next();
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rowsToHtmlTable(rows) {
  if (!rows || rows.length === 0) return '<p>No data</p>';
  let html = '<table class="table table-bordered">';
  rows.forEach((row, idx) => {
    html += '<tr>';
    row.forEach(cell => {
      const tag = idx === 0 ? 'th' : 'td';
      html += `<${tag}>${escapeHtml(cell)}</${tag}>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  return html;
}

app.get('/', async (req, res) => {
  const visitorIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const time = new Date().toISOString();

  // send email
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "New website visit",
      text: `New visitor\nIP: ${visitorIP}\nUser-Agent: ${userAgent}\nTime: ${time}`
    });
  } catch (err) {
    console.error("Email error:", err);
  }
    res.sendFile(path.join(__dirname, 'public', 'views', 'index.html'));
});

app.get("/search", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "views", "search.html"));
});

app.get("/api/search", (req, res) => {
  const q = req.query.q?.toLowerCase() || "";
  const data = JSON.parse(fs.readFileSync("./data/list.json"));
  const results = data.filter(item => item.name.toLowerCase().includes(q));
  res.json(results);
});

app.get("/display/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "views", "display.html"));
});

app.get("/api/display/:id", async (req, res) => {
  const apogeeId = req.params.id;

  try {
    // Call your Flask API instead of running Python
    const response = await axios.get(`https://gradify-utilities.onrender.com/grades`, {
      params: { apogee: apogeeId }
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(response.data);

  } catch (error) {
    console.error("Error fetching grades:", error.message);
    res.status(500).send('<p class="text-danger">No grades found.</p>');
  }
});


app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'login.html'));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect("/login?error=missing");
  }

  if ((username === "bilalab" && password === "saymynamehhh") || (username === "abdou" && password === "bouker6666")) {
    req.session.username = username;
    return res.redirect("/");
  }

  res.redirect("/login?error=invalid");
});

app.get("/api/username", (req, res) => {
  if (req.session.username) {
    res.json({ username: req.session.username });
  } else {
    res.json({ username: null });
  }
});

app.listen('3000', () => {
    console.log("Started on port 3000!");
});