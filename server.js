const express = require("express");
const { Pool } = require("pg");
const cors = require("cors"); // Adăugăm asta pentru ca site-ul să poată citi datele
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Creează tabelul dacă nu există
pool.query(`
  CREATE TABLE IF NOT EXISTS sensor_data (
    id SERIAL PRIMARY KEY,
    temperature FLOAT,
    humidity FLOAT,
    mq INT,
    sound INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => console.log("Tabelul este gata!"));

// RUTA 1: Pagina principală (Test)
app.get("/", (req, res) => {
  res.send("Sistemul de monitorizare este ONLINE!");
});

// RUTA 2: ESP32 trimite date aici (Asta merge deja la tine!)
app.post("/update-data", async (req, res) => {
  const { temperature, humidity, mq, sound } = req.body;
  try {
    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, mq, sound) VALUES ($1, $2, $3, $4)",
      [temperature, humidity, mq, sound]
    );
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare la salvare");
  }
});

// RUTA 3: Site-ul cere datele aici (Asta îți lipsește!)
app.get("/get-latest", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1");
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ message: "Nu sunt date încă." });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serverul rulează pe portul ${PORT}`));
