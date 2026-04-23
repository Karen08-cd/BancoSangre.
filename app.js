console.log("🔥 JS CARGADO CORRECTAMENTE");

const form = document.getElementById("formMensaje");
const respuesta = document.getElementById("respuesta");

// DEBUG opcional para confirmar click
document.querySelector("button").addEventListener("click", () => {
  console.log("🖱 CLICK DETECTADO");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // 🔥 ESTO ES CLAVE

  console.log("🔥 SUBMIT FUNCIONA");

  const message = document.getElementById("message").value.trim();
  const number = document.getElementById("number").value.trim();

  if (!message || !number) {
    respuesta.style.color = "red";
    respuesta.innerText = "❌ Todos los campos son obligatorios";
    return;
  }

  try {
    console.log("📡 Enviando al backend...");

    const res = await fetch("http://192.168.36.192:3000/api/sms/enviar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        number
      })
    });

    const data = await res.json();  

    console.log("📩 Respuesta backend:", data);

    if (!res.ok || !data.success) {
      throw data;
    }

    respuesta.style.color = "green";
    respuesta.innerText = "✅ SMS enviado correctamente";
    form.reset();

  } catch (err) {
    console.error("❌ ERROR FRONT:", err);

    respuesta.style.color = "red";
    respuesta.innerText =
      err?.error || "❌ Error al enviar el SMS";
  }
}); 