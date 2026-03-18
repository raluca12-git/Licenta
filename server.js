const express = require("express");
const { Pool } = require("pg");
const app = express();

app.use(express.json());

// Configurăm manual accesul (CORS) fără a avea nevoie de pachetul extern 'cors'
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

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

app.get("/", (req, res) => {
  res.send("Sistemul de monitorizare este ONLINE!");
});

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
