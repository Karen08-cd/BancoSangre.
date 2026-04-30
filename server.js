console.log("🔥 BACK LISTO");

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
const upload = multer({ dest: "uploads/" });

async function getGraphToken() {
  const params = new URLSearchParams();
  params.append("client_id", process.env.MS_CLIENT_ID);
  params.append("client_secret", process.env.MS_CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const r = await axios.post(
    "https://login.microsoftonline.com/5097e559-4258-4366-b031-df8fdc05d5c8/oauth2/v2.0/token",
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return r.data.access_token;
}

/* ================================
   SMS PREVIEW
================================ */
app.post("/api/sms/excel/preview", upload.single("file"), (req, res) => {
  const wb = xlsx.readFile(req.file.path);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const preview = rows.map((r, i) => {
    const n = String(r.numero || "").replace(/\D/g, "").slice(-10);
    return { fila: i + 2, numero: n, smsValido: /^3\d{9}$/.test(n) };
  });
  res.json({ success: true, preview });
});

/* ================================
   SMS ENVÍO (MULTIPLE → SINGLE)
================================ */
app.post("/api/sms/excel", upload.single("file"), async (req, res) => {
  try {
    const wb = xlsx.readFile(req.file.path);
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const numeros = rows
      .map(r => String(r.numero || "").replace(/\D/g, "").slice(-10))
      .filter(n => /^3\d{9}$/.test(n))
      .map(n => "57" + n);

    if (!numeros.length) {
      return res.json({ success: true, enviados: 0 });
    }

    const login = await axios.post("https://api.liwa.co/v2/auth/login", {
      account: process.env.userlogin,
      password: process.env.passlogin
    });
    const token = login.data.token;

    /* 🔹 INTENTO MULTIPLE */
    try {
      const messages = numeros.map(n => ({
        number: n,
        message: req.body.message,
        type: 1
      }));

      await axios.post(
        "https://api.liwa.co/v2/sms/multiple",
        { name: "Campaña Banco Sangre", messages },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.LIWA_API_KEY,
            Authorization: `Bearer ${token}`
          }
        }
      );

      return res.json({ success: true, enviados: numeros.length });

    } catch (multiErr) {
      console.warn("⚠️ MULTIPLE FALLÓ, USANDO SINGLE");
    }

    /* 🔹 FALLBACK A SINGLE */
    let enviados = 0;
    for (const numero of numeros) {
      await axios.post(
        "https://api.liwa.co/v2/sms/single",
        { number: numero, message: req.body.message, type: 1 },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.LIWA_API_KEY,
            Authorization: `Bearer ${token}`
          }
        }
      );
      enviados++;
    }

    res.json({ success: true, enviados });

  } catch (err) {
    console.error("❌ ERROR SMS FINAL:", err.message);
    res.status(500).json({ success: false });
  }
});

/* ================================
   EMAIL PREVIEW
================================ */
app.post("/api/email/excel/preview", upload.single("file"), (req, res) => {
  const wb = xlsx.readFile(req.file.path);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  res.json({
    success: true,
    preview: rows.map((r, i) => ({
      fila: i + 2,
      correo: r.correo,
      emailValido: /^\S+@\S+\.\S+$/.test(r.correo)
    }))
  });
});

/* ================================
   EMAIL ENVÍO
================================ */
app.post("/api/email/excel", upload.single("file"), async (req, res) => {
  const token = await getGraphToken();
  const wb = xlsx.readFile(req.file.path);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

 const MENSAJE_HTML = `
  <p>Hola,</p>

  <p>
    Cada donación que recibimos llega con una historia detrás,
    y la tuya ya es parte de la nuestra. 🩸
  </p>

  <p>
    Gracias por confiar en el <strong>Banco de Sangre LaCardio</strong>.
    Tu donación significó esperanza, tiempo y vida para un paciente
    que lo necesitaba. Lo que hiciste hoy importa más de lo que imaginas.
  </p>

  <p>
    Queremos escucharte, porque tu experiencia nos ayuda a seguir
    mejorando y a acompañar mejor a personas como tú en este proceso
    tan valioso.
  </p>

  <p>
    <strong>Cuéntanos cómo te fue:</strong><br>
    👉 
    <a href="https://lacardio.qualtrics.com/jfe/form/SV_a4PAOkMrH9RdCbY" 
       target="_blank"
       style="color:#0B5ED7; font-weight:600;">
      https://lacardio.qualtrics.com/jfe/form/SV_a4PAOkMrH9RdCbY
    </a>
  </p>

  <p>
    Son solo unos minutos y cada respuesta nos ayuda a ser el banco
    de sangre que tú y todos nuestros donantes merecen.
  </p>

  <p>
    Gracias por ser parte de esta historia. 💛
  </p>

  <p>
    Con todo el agradecimiento,<br><br>
    <strong>Equipo del Banco de Sangre LaCardio 🩸</strong>
  </p>
`;

  for (const r of rows) {
    if (!/^\S+@\S+\.\S+$/.test(r.correo)) continue;
    await axios.post(
      "https://graph.microsoft.com/v1.0/users/donantesbsangre@lacardio.org/sendMail",
      {
        message: {
          subject: "Gracias por tu donación",
          body: { contentType: "HTML", content: MENSAJE_HTML },
          toRecipients: [{ emailAddress: { address: r.correo } }]
        }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`✅ Backend en http://192.168.36.163:${PORT}`);
});
