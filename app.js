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
  const orb = $("orb");
  const ring = $("ringProgress");
  const RING_C = 339.29;
  const DURATION = 2600;
  const hint = $("readingHint");
  const percentEl = $("readingPercent");

  let holding = false;
  let holdStart = 0;
  let rafId = null;
  let done = false;

  function setProgress(p) {
    orb.style.setProperty("--p", p.toFixed(3));
    ring.style.strokeDashoffset = (RING_C * (1 - p)).toFixed(2);
    percentEl.textContent = p > 0 ? `讀取中　${Math.round(p * 100)}%` : "";
  }

  function resetReading() {
    holding = false;
    done = false;
    holdStart = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    setProgress(0);
    hint.textContent = "請用食指輕輕按住";
    hint.style.opacity = "1";
  }

  function tick(now) {
    if (!holding) return;
    const p = Math.min((now - holdStart) / DURATION, 1);
    setProgress(p);
    if (p >= 1) {
      finishReading();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function startHold(e) {
    if (done) return;
    e.preventDefault();
    holding = true;
    holdStart = performance.now();
    hint.textContent = "正在讀取靈魂能量";
    hint.style.opacity = "0.75";
    try { orb.setPointerCapture(e.pointerId); } catch (_) {}
    rafId = requestAnimationFrame(tick);
  }

  function cancelHold() {
    if (done || !holding) return;
    holding = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    setProgress(0);
    hint.textContent = "再試一次，維持按壓";
    hint.style.opacity = "1";
  }

  function finishReading() {
    done = true;
    holding = false;
    setProgress(1);
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
  function composePolaroid() {
    const S = 1080;
    const pad = 64;
    const bottom = 240;
    const W = S + pad * 2;
    const H = pad + S + bottom;

    workCanvas.width = W;
    workCanvas.height = H;
    const ctx = workCanvas.getContext("2d");

    // 白框
    ctx.fillStyle = "#f7f5f0";
    ctx.fillRect(0, 0, W, H);

    // 照片
    ctx.drawImage(capturedSource, 0, 0, capturedSource.width, capturedSource.height, pad, pad, S, S);

    // 漸層覆蓋
    const rad = (gradient.angle * Math.PI) / 180;
    const cx = pad + S / 2;
    const cy = pad + S / 2;
    const half = S / 2;
    const dx = Math.cos(rad) * half;
    const dy = Math.sin(rad) * half;
    const lg = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    const n = gradient.stops.length;
    gradient.stops.forEach((c, i) => lg.addColorStop(n === 1 ? 0 : i / (n - 1), c));
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lg;
    ctx.fillRect(pad, pad, S, S);
    ctx.restore();

    // 日期
    ctx.fillStyle = "#2a2730";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "300 40px 'Noto Serif TC', serif";
    ctx.fillText(formatDate(), W / 2, pad + S + bottom / 2);

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

  show("intro");
})();
