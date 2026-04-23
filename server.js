require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

/* ================================
   ENVIAR SMS (LIWA)
================================ */

app.post("/api/sms/enviar", async (req, res) => {
  console.log("🔥 PETICIÓN RECIBIDA:", req.body);

  let { message, number, type = 1 } = req.body;

  // 🔴 Validación básica
  if (!number || !message) {
    return res.status(400).json({
      success: false,
      error: "Datos incompletos"
    });
  }

  // 🔧 Limpiar número (quitar espacios)
  number = number.replace(/\s+/g, "");

  // 🔧 Asegurar formato Colombia
  if (!number.startsWith("57")) {
    if (!/^3\d{9}$/.test(number)) {
      return res.status(400).json({
        success: false,
        error: "Número inválido. Debe ser un celular colombiano"
      });
    }
    number = `57${number}`;
  }

  // 🔴 Validar API KEY
  if (!process.env.LIWA_API_KEY) {
    console.error("❌ API KEY NO DEFINIDA");
    return res.status(500).json({
      success: false,
      error: "API KEY no configurada"
    });
  }

  try {
    console.log("📡 Enviando a LIWA...");
    console.log("📱 Número:", number);
    console.log("💬 Mensaje:", message);

    const response = await axios.post(
      "https://api.liwa.co/v2/sms/single",
      {
        number,
        message,
        type
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.LIWA_API_KEY
        },
        timeout: 10000
      }
    );

    console.log("✅ RESPUESTA LIWA:", response.data);

    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    console.error("❌ ERROR LIWA STATUS:", err.response?.status);
    console.error("❌ ERROR LIWA DATA:", err.response?.data);
    console.error("❌ ERROR GENERAL:", err.message);

    res.status(500).json({
      success: false,
      error: "Error enviando SMS",
      detalle: err.response?.data || err.message
    });
  }
});

/* ================================
   START SERVER
================================ */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
});  