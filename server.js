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

// primește date de la ESP32 și le salvează în DB
app.post("/update-data", async (req, res) => {
  try {
    const { temperature, humidity, mq, sound, fan } = req.body;

    if (
      temperature === undefined ||
      humidity === undefined ||
      mq === undefined ||
      sound === undefined ||
      fan === undefined
    ) {
      return res.status(400).json({ error: "Lipsesc date din request" });
    }

    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, mq, sound, fan) VALUES ($1, $2, $3, $4, $5)",
      [temperature, humidity, mq, sound, fan]
    );

    res.status(200).json({ success: true, message: "Date salvate" });
  } catch (error) {
    console.error("Eroare la /update-data:", error);
    res.status(500).json({ error: "Eroare la salvare în baza de date" });
  }
});

// trimite ultima înregistrare către site
app.get("/get-latest", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Nu există date în tabel" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Eroare la /get-latest:", error);
    res.status(500).json({ error: "Eroare la citirea datelor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server pornit pe portul ${PORT}`);
});
