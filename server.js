const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

// conectare DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// servește fișiere statice din folderul curent
app.use(express.static(__dirname));

// pagina principală
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server pornit");
});