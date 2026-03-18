const express = require("express");
const { Pool } = require("pg");
const app = express();

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- ACEASTA SECTIUNE CREEAZA TABELUL AUTOMAT ---
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
    console.log("Tabelul sensor_data este gata!");
  } catch (err) {
    console.error("Eroare la initializarea bazei de date:", err);
  }
};
initDb();
// -----------------------------------------------

app.get("/", (req, res) => {
  res.send("Serverul este activ si tabelul a fost verificat/creat!");
});

app.post("/update-data", async (req, res) => {
  const { temperature, humidity, mq, sound } = req.body;
  try {
    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, mq, sound) VALUES ($1, $2, $3, $4)",
      [temperature, humidity, mq, sound]
    );
    res.status(200).send("Date salvate!");
  } catch (err) {
    res.status(500).send("Eroare la salvare.");
  }
});

app.get("/get-latest", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1");
    res.json(result.rows[0] || { message: "Nu exista date inca." });
  } catch (err) {
    res.status(500).json({ error: "Eroare la citire." });
  }
});

app.listen(3000, () => {
  console.log("Server pornit pe portul 3000");
});
