alert("ESTA ES LA VERSION NUEVA");
console.log("🔥 FRONT LISTO");

const API = "http://192.168.36.163:3000";
console.log("🔥 FRONT LISTO");

/* ======================
   ELEMENTOS DOM
====================== */
const form = document.getElementById("formMensaje");
const messageInput = document.getElementById("message");
const numberInput = document.getElementById("number");
const excelInput = document.getElementById("excel");

const previewContainer = document.getElementById("previewContainer");
const previewTable = document.getElementById("previewTable");
const resumen = document.getElementById("resumen");
const btnEnviarMasivo = document.getElementById("btnEnviarMasivo");

const progresoDiv = document.getElementById("progreso");
const barra = document.getElementById("barra");
const porcentaje = document.getElementById("porcentaje");

const submitBtn = form.querySelector("button");

/* ======================
   UI HELPERS
====================== */
function showToast(msg, type = "ok") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => toast.remove(), 3000);
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.innerText = isLoading ? "⏳ Enviando..." : getSubmitText();
}

function getSubmitText() {
  return excelInput.files.length > 0
    ? "Previsualizar Excel"
    : "Enviar SMS individual";
}

/* ======================
   VALIDAR SMS
====================== */
function validateSMS(number, message) {
  if (!message || !number) {
    showToast("❌ Campos obligatorios", "error");
    return false;
  }
  if (!/^3\d{9}$/.test(number)) {
    showToast("📱 Número inválido", "error");
    return false;
  }
  return true;
}

/* ======================
   CAMBIO DE EXCEL
====================== */
excelInput.addEventListener("change", () => {
  submitBtn.innerText = getSubmitText();
});

/* ======================
   SUBMIT PRINCIPAL
====================== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  const number = numberInput.value.trim();
  const file = excelInput.files[0];

  if (!message) {
    showToast("❌ Escribe un mensaje", "error");
    return;
  }

  /* ✅ CASO 1: SMS INDIVIDUAL */
  if (!file) {
    if (!validateSMS(number, message)) return;

    try {
      setLoading(true);

      const res = await fetch(`${API}/api/sms/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, number })
      });

      if (!res.ok) throw new Error();

      showToast("✅ SMS enviado correctamente");
      form.reset();
      submitBtn.innerText = getSubmitText();

    } catch (err) {
      console.error(err);
      showToast("❌ Error enviando SMS", "error");
    } finally {
      setLoading(false);
    }

    return;
  }

  /* ✅ CASO 2: HAY EXCEL → PREVISUALIZAR */
  try {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${API}/api/sms/excel/preview`, {
      method: "POST",
      body: fd
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw data;

    previewTable.innerHTML = "";

    data.preview.forEach(r => {
      previewTable.innerHTML += `
        <tr>
          <td>${r.fila}</td>
          <td>${r.fecha}</td>
          <td>${r.numero}</td>
          <td>${r.correo}</td>
          <td>${r.smsValido ? "✅" : "❌"}</td>
          <td>${r.correoValido ? "✅" : "❌"}</td>
        </tr>
      `;
    });

    resumen.innerText = `
Total: ${data.total}
SMS válidos: ${data.smsValidos}
Emails válidos: ${data.correosValidos}
    `;

    previewContainer.style.display = "block";
    showToast("✅ Excel validado. Presiona CONFIRMAR ENVÍO");

    btnEnviarMasivo.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error(err);
    showToast("❌ Error leyendo Excel", "error");
  }
});

/* ======================
   ENVÍO MASIVO
====================== */
btnEnviarMasivo.addEventListener("click", async () => {
  const message = messageInput.value.trim();
  const file = excelInput.files[0];

  if (!message || !file) {
    showToast("❌ Mensaje y Excel requeridos", "error");
    return;
  }

  try {
    progresoDiv.style.display = "block";
    barra.value = 0;
    porcentaje.innerText = "0%";

    const fd = new FormData();
    fd.append("message", message);
    fd.append("file", file);

    const res = await fetch(`${API}/api/sms/excel`, {
      method: "POST",
      body: fd
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw data;

    barra.value = 100;
    porcentaje.innerText = "100%";

    showToast("✅ Envío masivo finalizado");
    form.reset();
    previewContainer.style.display = "none";
    submitBtn.innerText = getSubmitText();

  } catch (err) {
    console.error(err);
    showToast("❌ Error en envío masivo", "error");
  }
});
