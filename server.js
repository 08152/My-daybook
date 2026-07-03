const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const PIN = "error422";

app.use(express.static("public"));

let state = {
  created: Date.now(),
  lines: []
};

const DATA_FILE = "data.json";

function load() {
  if (fs.existsSync(DATA_FILE)) {
    state = JSON.parse(fs.readFileSync(DATA_FILE));
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function exportTxt() {
  const date = new Date().toISOString().split("T")[0];
  const content = state.lines.map(l => l.text).join("\n");
  fs.writeFileSync(`log_${date}.txt`, content);
}

function reset() {
  exportTxt();
  state = {
    created: Date.now(),
    lines: []
  };
  save();
  broadcast({ type: "reset" });
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(msg);
  });
}

setInterval(() => {
  if (Date.now() - state.created > 24 * 60 * 60 * 1000) {
    reset();
  }
}, 60000);

wss.on("connection", (ws) => {
  ws.unlocked = false;

  ws.send(JSON.stringify({
    type: "init",
    lines: state.lines
  }));

  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    if (data.type === "pin") {
      if (data.pin === PIN) {
        ws.unlocked = true;
        ws.send(JSON.stringify({ type: "unlocked" }));
      } else {
        ws.send(JSON.stringify({ type: "error" }));
      }
      return;
    }

    if (data.type === "line" && ws.unlocked) {
      const entry = { t: Date.now(), text: data.text };
      state.lines.push(entry);
      save();
      broadcast({ type: "line", text: data.text });
    }
  });
});

load();

server.listen(PORT, () => {
  console.log("Server läuft auf", PORT);
});
