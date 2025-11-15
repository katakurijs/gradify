const express = require('express');
const session = require("express-session");
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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

app.get('/', (req, res) => {
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

const axios = require("axios");

app.get("/api/display/:id", async (req, res) => {
  const apogeeId = req.params.id;

  try {
    // Call your Flask API instead of running Python
    const response = await axios.get(`https://gradify-utilities.onrender.com/`, {
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