console.log("🔥 BACK LISTO");

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const xlsx = require("xlsx");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/* ================================
   UPLOAD
================================ */
const upload = multer({ dest: "uploads/" });

/* ================================
   EMAIL (UNA SOLA VEZ ✅)
================================ */
const mailer = nodemailer.createTransport({
  host: "smtp.gmail.com", // cambia si es institucional
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ================================
   SMS INDIVIDUAL
================================ */
app.post("/api/sms/enviar", async (req, res) => {
  try {
    let { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({ success: false, error: "Datos faltantes" });
    }

    if (!/^3\d{9}$/.test(number)) {
      return res.status(400).json({ success: false, error: "Número inválido" });
    }

    number = "57" + number;

    const token = await axios.post(
      "https://api.liwa.co/v2/auth/login",
      {
        account: process.env.userlogin,
        password: process.env.passlogin
      }
    );

    await axios.post(
      "https://api.liwa.co/v2/sms/single",
      { number, message, type: 1 },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.LIWA_API_KEY,
          Authorization: "Bearer " + token.data.token
        }
      }
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: "Error enviando SMS" });
  }
});

/* ================================
   PREVIEW EXCEL
================================ */
app.post("/api/sms/excel/preview", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Archivo no recibido" });
    }

    const wb = xlsx.readFile(req.file.path);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const preview = rows.map((r, i) => {
      const numeroLimpio = String(r.numero || "")
        .replace(/\D/g, "")
        .slice(-10);

      return {
        fila: i + 2,
        fecha: r.fecha || "",
        numero: numeroLimpio,
        correo: r.correo || "",
        smsValido: /^3\d{9}$/.test(numeroLimpio),
        correoValido: /^\S+@\S+\.\S+$/.test(String(r.correo))
      };
    });

    res.json({
      success: true,
      total: rows.length,
      smsValidos: preview.filter(p => p.smsValido).length,
      correosValidos: preview.filter(p => p.correoValido).length,
      preview
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Error leyendo Excel" });
  }
});

/* ================================
   ENVÍO MASIVO (SMS + EMAIL)
================================ */
app.post("/api/sms/excel", upload.single("file"), async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !req.file) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }

    const wb = xlsx.readFile(req.file.path);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const token = await axios.post(
      "https://api.liwa.co/v2/auth/login",
      {
        account: process.env.userlogin,
        password: process.env.passlogin
      }
    );

    const bearer = "Bearer " + token.data.token;

    let smsEnviados = 0;
    let emailsEnviados = 0;

    for (const r of rows) {

      /* ================= SMS ================= */
      const numeroLimpio = String(r.numero || "")
        .replace(/\D/g, "")
        .slice(-10);

      if (/^3\d{9}$/.test(numeroLimpio)) {
        try {
          await axios.post(
            "https://api.liwa.co/v2/sms/single",
            {
              number: "57" + numeroLimpio,
              message,
              type: 1
            },
            {
              headers: {
                "Content-Type": "application/json",
                "api-key": process.env.LIWA_API_KEY,
                Authorization: bearer
              }
            }
          );
          smsEnviados++;
        } catch (err) {
          console.error("❌ Error SMS:", numeroLimpio, err.response?.data);
        }
      }

      /* ================= EMAIL ================= */
      if (/^\S+@\S+\.\S+$/.test(String(r.correo))) {
        try {
          console.log("✉️ Enviando correo a:", r.correo);

          const info = await mailer.sendMail({
            from: `"Banco de Sangre LaCardio" <${process.env.EMAIL_USER}>`,
            to: r.correo,
            subject: "Banco de Sangre LaCardio",
            text: message
          });

          console.log("✅ Email enviado:", info.response);
          emailsEnviados++;

        } catch (err) {
          console.error("❌ Error email:", r.correo, err.message);
        }
      }
    }

    res.json({
      success: true,
      smsEnviados,
      emailsEnviados,
      total: rows.length
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: "Error en envío masivo" });
  }
});

/* ================================
   FRONTEND
================================ */
app.use(express.static(path.join(__dirname, "public")));

/* ================================
   START SERVER
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend corriendo en http://192.168.36.163:${PORT}`);
});
