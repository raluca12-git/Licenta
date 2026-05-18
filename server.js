const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id SERIAL PRIMARY KEY,
      temperature FLOAT,
      humidity FLOAT,
      mq INT,
      sound FLOAT,
      fan INT,
      volume INT DEFAULT 10,
      fan_percent INT DEFAULT 0,
      fuzzy_level VARCHAR(20) DEFAULT 'scazut',
      mode VARCHAR(20) DEFAULT 'auto',
      kalman_sound FLOAT DEFAULT 0,
      pid_error FLOAT DEFAULT 0,
      target_sound FLOAT DEFAULT 500,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS volume INT DEFAULT 10;`);
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS fan_percent INT DEFAULT 0;`);
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS fuzzy_level VARCHAR(20) DEFAULT 'scazut';`);
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'auto';`);
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS kalman_sound FLOAT DEFAULT 0;`);
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS pid_error FLOAT DEFAULT 0;`);
  await pool.query(`ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS target_sound FLOAT DEFAULT 500;`);
  await pool.query(`ALTER TABLE sensor_data ALTER COLUMN sound TYPE FLOAT USING sound::FLOAT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS control_state (
      id INT PRIMARY KEY,
      mode VARCHAR(20) NOT NULL DEFAULT 'auto',
      manual_volume INT NOT NULL DEFAULT 10,
      manual_fan INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    INSERT INTO control_state (id, mode, manual_volume, manual_fan)
    VALUES (1, 'auto', 10, 0)
    ON CONFLICT (id) DO NOTHING;
  `);
}

initDb()
  .then(() => console.log("DB initializat"))
  .catch((err) => console.error("Eroare init DB:", err));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/sensors.html", (req, res) => res.sendFile(path.join(__dirname, "sensors.html")));
app.get("/control.html", (req, res) => res.sendFile(path.join(__dirname, "control.html")));
app.get("/fuzzy.html", (req, res) => res.sendFile(path.join(__dirname, "fuzzy.html")));
app.get("/pid.html", (req, res) => res.sendFile(path.join(__dirname, "pid.html")));
app.get("/history.html", (req, res) => res.sendFile(path.join(__dirname, "history.html")));

function normalizeControls(row) {
  return {
    mode: row.mode,
    manualVolume: Number(row.manual_volume),
    manualFan: Number(row.manual_fan),
    updatedAt: row.updated_at,
  };
}

app.get("/get-controls", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM control_state WHERE id=1");
    res.json(normalizeControls(result.rows[0]));
  } catch (error) {
    console.error("Eroare la /get-controls:", error);
    res.status(500).json({ error: "Eroare la citirea comenzilor" });
  }
});

app.get("/device-control", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM control_state WHERE id=1");
    res.json(normalizeControls(result.rows[0]));
  } catch (error) {
    console.error("Eroare la /device-control:", error);
    res.status(500).json({ error: "Eroare la citirea comenzilor" });
  }
});

app.post("/set-controls", async (req, res) => {
  try {
    const { mode, manualVolume, manualFan } = req.body;

    if (!["auto", "manual"].includes(mode)) {
      return res.status(400).json({ error: "Mod invalid" });
    }

    const volume = Number(manualVolume);
    const fan = Number(manualFan);

    if (Number.isNaN(volume) || volume < 0 || volume > 30) {
      return res.status(400).json({ error: "Volum invalid" });
    }

    if (![0, 20, 40, 60, 80, 100].includes(fan)) {
      return res.status(400).json({ error: "Treaptă ventilator invalidă" });
    }

    const result = await pool.query(
      `UPDATE control_state
       SET mode=$1, manual_volume=$2, manual_fan=$3, updated_at=CURRENT_TIMESTAMP
       WHERE id=1
       RETURNING *`,
      [mode, volume, fan]
    );

    res.json({ success: true, controls: normalizeControls(result.rows[0]) });
  } catch (error) {
    console.error("Eroare la /set-controls:", error);
    res.status(500).json({ error: "Eroare la salvarea comenzilor" });
  }
});

app.post("/update-data", async (req, res) => {
  try {
    const {
      temperature,
      humidity,
      mq,
      sound,
      fan,
      volume = 10,
      fanPercent = 0,
      fuzzyLevel = "scazut",
      mode = "auto",
      kalmanSound = 0,
      pidError = 0,
      targetSound = 500,
    } = req.body;

    if ([temperature, humidity, mq, sound, fan].some((v) => v === undefined)) {
      return res.status(400).json({ error: "Lipsesc date din request" });
    }

    await pool.query(
      `INSERT INTO sensor_data
       (temperature, humidity, mq, sound, fan, volume, fan_percent, fuzzy_level, mode, kalman_sound, pid_error, target_sound)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        temperature,
        humidity,
        mq,
        sound,
        fan,
        volume,
        fanPercent,
        fuzzyLevel,
        mode,
        kalmanSound,
        pidError,
        targetSound,
      ]
    );

    res.status(200).json({ success: true, message: "Date salvate" });
  } catch (error) {
    console.error("Eroare la /update-data:", error);
    res.status(500).json({ error: "Eroare la salvare în baza de date" });
  }
});

app.get("/get-latest", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Nu există date în tabel" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Eroare la /get-latest:", error);
    res.status(500).json({ error: "Eroare la citirea datelor" });
  }
});

app.get("/get-history", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 30), 200);
    const result = await pool.query(
      "SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    res.json(result.rows.reverse());
  } catch (error) {
    console.error("Eroare la /get-history:", error);
    res.status(500).json({ error: "Eroare la citirea istoricului" });
  }
});

app.get("/stats-summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ROUND(AVG(temperature)::numeric, 2) AS avg_temperature,
        ROUND(AVG(humidity)::numeric, 2) AS avg_humidity,
        ROUND(AVG(mq)::numeric, 2) AS avg_mq,
        ROUND(AVG(sound)::numeric, 2) AS avg_sound,
        MAX(temperature) AS max_temperature,
        MAX(mq) AS max_mq,
        MAX(sound) AS max_sound,
        COUNT(*) AS total_records
      FROM sensor_data
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Eroare la /stats-summary:", error);
    res.status(500).json({ error: "Eroare la sumar statistici" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}`));