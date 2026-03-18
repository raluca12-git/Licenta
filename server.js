const express = require("express");
const { Pool } = require("pg");
const app = express();

app.use(express.json());

// Conectare la baza de date
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Creare tabel automat la pornire
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        temperature FLOAT,
        humidity FLOAT,
        mq INT,
        sound INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Tabel pregatit!");
  } catch (err) {
    console.error(err);
  }
};
initDb();

// Pagina principala
app.get("/", (req, res) => {
  res.send("Serverul este activ si tabelul este gata!");
});

// RUTA PENTRU ESP32 (sa salveze date)
app.post("/update-data", async (req, res) => {
  const { temperature, humidity, mq, sound } = req.body;
  try {
    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, mq, sound) VALUES ($1, $2, $3, $4)",
      [temperature, humidity, mq, sound]
    );
    res.status(200).send("Date salvate!");
  } catch (err) {
    res.status(500).send("Eroare la salvare");
  }
});

// RUTA PENTRU BROWSER (sa vezi datele) - ASTA LIPSREA!
app.get("/get-latest", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1");
    res.json(result.rows[0] || { message: "Inca nu sunt date in baza de date." });
  } catch (err) {
    res.status(500).json({ error: "Eroare la citire" });
  }
});

app.listen(3000, () => console.log("Server pornit pe portul 3000"));
