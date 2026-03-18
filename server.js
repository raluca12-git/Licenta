const express = require("express");
const { Pool } = require("pg");
const app = express();

app.use(express.json());

// conectare DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// test route
app.get("/", (req, res) => {
  res.send("Serverul merge!");
});

app.listen(3000, () => {
  console.log("Server pornit");
});