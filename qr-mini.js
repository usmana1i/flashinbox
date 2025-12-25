// Minimal QR: uses a free public image service as a fallback (no external libs).
// For a fully offline QR library later, swap this file.
window.renderQR = async function renderQR(canvas, text){
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const url = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(text);
  await new Promise((res, rej) => { img.onload=res; img.onerror=rej; img.src=url; });
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
}
