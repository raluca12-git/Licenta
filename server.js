const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/sensors.html", (req, res) => {
  res.sendFile(path.join(__dirname, "sensors.html"));
});

app.get("/control.html", (req, res) => {
  res.sendFile(path.join(__dirname, "control.html"));
});

// stocare simpla pentru control manual
let controls = {
  mode: "auto",
  manualVolume: 10,
  manualFan: 0
};

app.get("/get-controls", (req, res) => {
  res.json(controls);
});

app.post("/set-controls", (req, res) => {
  try {
    const { mode, manualVolume, manualFan } = req.body;

    if (!["auto", "manual"].includes(mode)) {
      return res.status(400).json({ error: "Mod invalid" });
    }

    const volume = Number(manualVolume);
    const fan = Number(manualFan);

    if (isNaN(volume) || volume < 0 || volume > 30) {
      return res.status(400).json({ error: "Volum invalid" });
    }

    if (![0, 1].includes(fan)) {
      return res.status(400).json({ error: "Stare ventilator invalidă" });
    }

    controls = {
      mode,
      manualVolume: volume,
      manualFan: fan
    };

    res.json({ success: true, controls });
  } catch (error) {
    console.error("Eroare la /set-controls:", error);
    res.status(500).json({ error: "Eroare la salvarea comenzilor" });
  }
});

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