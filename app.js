(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const screens = {
    intro: document.querySelector('[data-screen="intro"]'),
    camera: document.querySelector('[data-screen="camera"]'),
    reading: document.querySelector('[data-screen="reading"]'),
    result: document.querySelector('[data-screen="result"]'),
  };

  const video = $("video");
  const workCanvas = $("workCanvas");

  let stream = null;
  let capturedSource = null; // canvas, 已是最終方向（自拍鏡像）
  let gradient = null;       // { angle, stops: [hsl,...] }

  // ---------- 畫面切換 ----------
  function show(name) {
    for (const key in screens) {
      screens[key].classList.toggle("is-active", key === name);
    }
  }

  // ---------- 相機 ----------
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      $("uploadFallback").hidden = true;
      $("shutterBtn").style.display = "";
      $("cameraHint").style.display = "";
    } catch (err) {
      // 無相機或被拒絕 → 改用上傳
      $("uploadFallback").hidden = false;
      $("shutterBtn").style.display = "none";
      $("cameraHint").style.display = "none";
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
    }
  }

  // 將來源畫成正方形置中裁切的 canvas，mirror 表示是否水平鏡像
  function toSquareCanvas(source, sw, sh, mirror) {
    const size = Math.min(sw, sh);
    const sx = (sw - size) / 2;
    const sy = (sh - size) / 2;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (mirror) {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, sx, sy, size, size, 0, 0, size, size);
    return c;
  }

  function captureFromVideo() {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    capturedSource = toSquareCanvas(video, vw, vh, true);
    goToReading();
  }

  function handleUpload(file) {
    const img = new Image();
    img.onload = () => {
      capturedSource = toSquareCanvas(img, img.naturalWidth, img.naturalHeight, false);
      goToReading();
    };
    img.src = URL.createObjectURL(file);
  }

  function goToReading() {
    stopCamera();
    resetReading();
    show("reading");
  }

  // ---------- 按壓讀取 ----------
  // 刻意不顯示進度：讓使用者不知道還要按多久。
  const orb = $("orb");
  const hint = $("readingHint");
  const DURATION = 2600;

  let holdTimer = null;
  let done = false;

  function resetReading() {
    done = false;
    clearTimeout(holdTimer);
    orb.classList.remove("is-holding");
    orb.style.setProperty("--p", "0");
    hint.textContent = "請用食指輕輕按住";
    hint.style.opacity = "1";
  }

  function startHold(e) {
    if (done) return;
    e.preventDefault();
    orb.classList.add("is-holding");
    orb.style.setProperty("--p", "1");
    hint.textContent = "正在讀取靈魂能量";
    hint.style.opacity = "0.7";
    try { orb.setPointerCapture(e.pointerId); } catch (_) {}
    clearTimeout(holdTimer);
    holdTimer = setTimeout(finishReading, DURATION);
  }

  function cancelHold() {
    if (done) return;
    clearTimeout(holdTimer);
    orb.classList.remove("is-holding");
    orb.style.setProperty("--p", "0");
    hint.textContent = "請維持按壓，別鬆開";
    hint.style.opacity = "1";
  }

  function finishReading() {
    done = true;
    orb.classList.remove("is-holding");
    orb.style.setProperty("--p", "0");
    gradient = makeGradient();
    setTimeout(renderResult, 460);
  }

  orb.addEventListener("pointerdown", startHold);
  orb.addEventListener("pointerup", cancelHold);
  orb.addEventListener("pointercancel", cancelHold);
  orb.addEventListener("pointerleave", cancelHold);

  // ---------- 隨機漸層 ----------
  function makeGradient() {
    const rand = (a, b) => a + Math.random() * (b - a);
    const base = rand(0, 360);
    const spread = rand(60, 150);
    const count = Math.random() < 0.5 ? 2 : 3;
    const stops = [];
    for (let i = 0; i < count; i++) {
      const h = (base + spread * (i / (count - 1 || 1)) + rand(-12, 12) + 360) % 360;
      const s = rand(62, 82);
      const l = rand(58, 72);
      stops.push(`hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`);
    }
    return { angle: Math.round(rand(0, 360)), stops };
  }

  function gradientCss(g) {
    return `linear-gradient(${g.angle}deg, ${g.stops.join(", ")})`;
  }

  // ---------- 結果 ----------
  function formatDate() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }

  function renderResult() {
    $("resultImg").src = capturedSource.toDataURL("image/jpeg", 0.92);
    $("resultOverlay").style.background = gradientCss(gradient);
    $("resultCaption").textContent = formatDate();
    show("result");
  }

  // ---------- 下載合成 ----------
  let noiseCache = null;
  function paperNoise(ctx) {
    if (noiseCache) return noiseCache;
    const n = document.createElement("canvas");
    n.width = n.height = 120;
    const nc = n.getContext("2d");
    const img = nc.createImageData(120, 120);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 190 + Math.random() * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 20;
    }
    nc.putImageData(img, 0, 0);
    noiseCache = ctx.createPattern(n, "repeat");
    return noiseCache;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function composePolaroid() {
    const S = 1080;      // 照片邊長
    const pad = 64;      // 白框左右上
    const bottom = 240;  // 拍立得下方白邊
    const M = 96;        // 外圍留白（給投影用）
    const frameW = S + pad * 2;
    const frameH = pad + S + bottom;
    const W = frameW + M * 2;
    const H = frameH + M * 2;

    workCanvas.width = W;
    workCanvas.height = H;
    const ctx = workCanvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const fx = M, fy = M; // 白框左上角

    // 投影
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 34;
    ctx.fillStyle = "#f5f2eb";
    roundRect(ctx, fx, fy, frameW, frameH, 12);
    ctx.fill();
    ctx.restore();

    // 紙張色調
    const pg = ctx.createLinearGradient(fx, fy, fx + frameW, fy + frameH);
    pg.addColorStop(0, "#fdfcf9");
    pg.addColorStop(0.55, "#f4f1ea");
    pg.addColorStop(1, "#efe9df");
    ctx.fillStyle = pg;
    roundRect(ctx, fx, fy, frameW, frameH, 12);
    ctx.fill();

    // 紙質顆粒
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = paperNoise(ctx);
    roundRect(ctx, fx, fy, frameW, frameH, 12);
    ctx.fill();
    ctx.restore();

    const px = fx + pad, py = fy + pad; // 照片左上角

    // 照片
    ctx.drawImage(capturedSource, 0, 0, capturedSource.width, capturedSource.height, px, py, S, S);

    // 靈魂色漸層覆蓋
    const rad = (gradient.angle * Math.PI) / 180;
    const cx = px + S / 2, cy = py + S / 2, half = S / 2;
    const dx = Math.cos(rad) * half, dy = Math.sin(rad) * half;
    const lg = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    const n = gradient.stops.length;
    gradient.stops.forEach((c, i) => lg.addColorStop(n === 1 ? 0 : i / (n - 1), c));
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lg;
    ctx.fillRect(px, py, S, S);
    ctx.restore();

    // 照片內緣暗角
    const vg = ctx.createRadialGradient(cx, cy, S * 0.28, cx, cy, S * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vg;
    ctx.fillRect(px, py, S, S);

    // 照片邊緣細線
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, S - 2, S - 2);

    // 日期
    ctx.fillStyle = "#2a2730";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "300 40px 'Noto Serif TC', serif";
    ctx.fillText(formatDate(), fx + frameW / 2, py + S + bottom / 2);

    return workCanvas;
  }

  function download() {
    const canvas = composePolaroid();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soul-colour.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  // ---------- 綁定 ----------
  $("startBtn").addEventListener("click", () => {
    show("camera");
    startCamera();
  });
  $("shutterBtn").addEventListener("click", captureFromVideo);
  $("fileInput").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleUpload(f);
  });
  $("downloadBtn").addEventListener("click", download);
  $("againBtn").addEventListener("click", () => {
    capturedSource = null;
    gradient = null;
    show("camera");
    startCamera();
  });

  // ---------- 惡搞付費解鎖 ----------
  const paywall = $("paywall");
  const unlockNote = $("unlockNote");

  function openPaywall() {
    unlockNote.textContent = "";
    const unlock = $("unlockBtn");
    unlock.disabled = false;
    unlock.textContent = "立即解鎖";
    paywall.hidden = false;
  }
  function closePaywall() { paywall.hidden = true; }

  $("upsellBtn").addEventListener("click", openPaywall);
  paywall.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", closePaywall)
  );
  $("unlockBtn").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "連線中";
    unlockNote.textContent = "";
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "再試一次";
      unlockNote.textContent = "付款失敗：偵測到您的靈魂能量不足，請稍後再試。";
    }, 1600);
  });

  show("intro");
})();
