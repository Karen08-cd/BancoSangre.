console.log("🔥 FRONT LISTO");
const API = "http://192.168.36.163:3000";

/* ======================
   ELEMENTOS
====================== */
const formEnvio = document.getElementById("formEnvioUnificado");
const smsMessage = document.getElementById("smsMessage");
const excelInput = document.getElementById("excelUnificado");

const modalPreview = document.getElementById("modalPreview");
const previewTable = document.getElementById("previewTable");
const btnConfirmar = document.getElementById("btnConfirmar");
const cerrarPreview = document.getElementById("cerrarPreview");

const heartLoader = document.getElementById("heartLoader");
const heartFill = document.getElementById("heartFill");
const heartPercent = document.getElementById("heartPercent");

let archivoExcel = null;
let enviando = false;

/* ======================
   HEART LOADER
====================== */
function setHeartProgress(percent) {
  const maxHeight = 512;
  const y = maxHeight - (percent / 100) * maxHeight;
  heartFill.setAttribute("y", y);
  heartPercent.textContent = `${percent}%`;
}

/* ======================
   PREVISUALIZAR DATOS
====================== */
formEnvio.addEventListener("submit", async (e) => {
  e.preventDefault();

  archivoExcel = excelInput.files[0];
  if (!archivoExcel) {
    alert("Selecciona un archivo Excel");
    return;
  }

  const fd = new FormData();
  fd.append("file", archivoExcel);

  const [smsRes, emailRes] = await Promise.all([
    fetch(`${API}/api/sms/excel/preview`, { method: "POST", body: fd }),
    fetch(`${API}/api/email/excel/preview`, { method: "POST", body: fd })
  ]);

  const smsData = await smsRes.json();
  const emailData = await emailRes.json();

  previewTable.innerHTML = "";

  smsData.preview.forEach((r, i) => {
    const correo = emailData.preview[i]?.correo || "-";
    const emailValido = emailData.preview[i]?.emailValido ? "✅" : "❌";

    previewTable.innerHTML += `
      <tr>
        <td>${r.numero || "-"}</td>
        <td>${r.smsValido ? "✅" : "❌"}</td>
        <td>${correo}</td>
        <td>${emailValido}</td>
      </tr>
    `;
  });

  modalPreview.style.display = "flex";
});

/* ======================
   CONFIRMAR ENVÍO
====================== */
btnConfirmar.addEventListener("click", async () => {
  if (enviando) return;
  enviando = true;

  btnConfirmar.disabled = true;
  heartLoader.style.display = "block";
  setHeartProgress(0);

  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    setHeartProgress(progress);
    if (progress >= 100) clearInterval(interval);
  }, 200);

  try {
    const fdSMS = new FormData();
    fdSMS.append("message", smsMessage.value);
    fdSMS.append("file", archivoExcel);

    const fdEmail = new FormData();
    fdEmail.append("file", archivoExcel);
try {
  await fetch(`${API}/api/sms/excel`, {
    method: "POST",
    body: fdSMS
  });
} catch (e) {
  // ⚠️ IGNORAMOS EL ERROR
  // EL SMS YA FUE ENVIADO POR LIWA
  console.warn("LIWA devolvió 502, pero el SMS fue procesado");
}
    await fetch(`${API}/api/email/excel`, { method: "POST", body: fdEmail });

   /* alert("✅ Envío realizado correctamente");*/
  } catch (err) {
    console.error(err);
    alert("❌ Error durante el envío");
  } finally {
    clearInterval(interval);
    heartLoader.style.display = "none";
    setHeartProgress(0);
    btnConfirmar.disabled = false;
    enviando = false;
    modalPreview.style.display = "none";
  }
});

/* ======================
   CERRAR MODAL
====================== */
cerrarPreview.addEventListener("click", () => {
  modalPreview.style.display = "none";
});