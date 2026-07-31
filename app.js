// ===== State =====
let mode = "compress"; // 'compress' | 'convert'
let currentFile = null;
let fileCategory = null; // 'image' | 'video' | 'audio' | 'unsupported'
let selectedFormat = null;
let ffmpegInstance = null;
let resultUrl = null;

// ===== Elements =====
const segPill = document.getElementById("segPill");
const segButtons = document.querySelectorAll(".seg-btn");
const dropCard = document.getElementById("dropCard");
const dropInner = document.getElementById("dropInner");
const dropTitle = document.getElementById("dropTitle");
const fileInput = document.getElementById("fileInput");
const optionsCard = document.getElementById("optionsCard");
const fileName = document.getElementById("fileName");
const fileMeta = document.getElementById("fileMeta");
const clearFileBtn = document.getElementById("clearFile");
const compressOptions = document.getElementById("compressOptions");
const convertOptions = document.getElementById("convertOptions");
const qualityRange = document.getElementById("qualityRange");
const qualityValue = document.getElementById("qualityValue");
const formatGrid = document.getElementById("formatGrid");
const processBtn = document.getElementById("processBtn");
const progressCard = document.getElementById("progressCard");
const ringFg = document.getElementById("ringFg");
const ringPercent = document.getElementById("ringPercent");
const progressLabel = document.getElementById("progressLabel");
const resultCard = document.getElementById("resultCard");
const sizeBefore = document.getElementById("sizeBefore");
const sizeAfter = document.getElementById("sizeAfter");
const resultSavings = document.getElementById("resultSavings");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusLine = document.getElementById("statusLine");

const RING_CIRCUMFERENCE = 238.8;

// ===== Format catalogs =====
const FORMATS = {
  image: [
    { label: "JPG", ext: "jpg", mime: "image/jpeg" },
    { label: "PNG", ext: "png", mime: "image/png" },
    { label: "WEBP", ext: "webp", mime: "image/webp" },
  ],
  video: [
    { label: "MP4", ext: "mp4" },
    { label: "WEBM", ext: "webm" },
    { label: "GIF", ext: "gif" },
  ],
  audio: [
    { label: "MP3", ext: "mp3" },
    { label: "WAV", ext: "wav" },
    { label: "M4A", ext: "m4a" },
    { label: "OGG", ext: "ogg" },
  ],
};

// ===== Helpers =====
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectCategory(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "unsupported";
}

function setStatus(text, isError) {
  statusLine.textContent = text || "";
  statusLine.className = "status-line" + (isError ? " error" : "");
}

function setRing(percent, label) {
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
  ringFg.style.strokeDashoffset = offset;
  ringPercent.textContent = `${Math.round(percent)}%`;
  if (label) progressLabel.textContent = label;
}

function showOnly(el) {
  [dropCard, optionsCard, progressCard, resultCard].forEach((c) => {
    c.hidden = c !== el;
  });
}

// ===== Segmented control =====
segButtons.forEach((btn, i) => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    segButtons.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    segPill.style.transform = `translateX(${i * 100}%)`;
    if (currentFile) renderOptionsForFile();
  });
});

// ===== File input / drag & drop =====
dropCard.addEventListener("click", () => fileInput.click());
dropCard.addEventListener("dragover", (e) => { e.preventDefault(); dropCard.classList.add("drag-over"); });
dropCard.addEventListener("dragleave", () => dropCard.classList.remove("drag-over"));
dropCard.addEventListener("drop", (e) => {
  e.preventDefault();
  dropCard.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
  currentFile = file;
  fileCategory = detectCategory(file);
  resultUrl = null;
  setStatus("");

  if (fileCategory === "unsupported") {
    setStatus("Tipe file ini belum didukung — baru bisa gambar, video, atau audio.", true);
    currentFile = null;
    return;
  }

  const SOFT_WARN_BYTES = 400 * 1024 * 1024; // 400MB
  if ((fileCategory === "video" || fileCategory === "audio") && file.size > SOFT_WARN_BYTES) {
    setStatus(
      `⚠️ File ini ${formatBytes(file.size)} — cukup besar buat diproses di browser. Bisa lambat atau bikin tab nge-lag/crash tergantung HP/laptop kamu. Tetap lanjut? Kalau mau lebih aman, coba file yang lebih kecil/pendek dulu.`
    );
  }

  fileName.textContent = file.name;
  fileMeta.textContent = formatBytes(file.size);
  renderOptionsForFile();
  showOnly(optionsCard);
}

// ===== Options rendering =====
function renderOptionsForFile() {
  compressOptions.hidden = mode !== "compress";
  convertOptions.hidden = mode !== "convert";

  if (mode === "convert") {
    formatGrid.innerHTML = "";
    const opts = FORMATS[fileCategory] || [];
    selectedFormat = opts[0] || null;
    opts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "format-btn" + (i === 0 ? " active" : "");
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        formatGrid.querySelectorAll(".format-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedFormat = opt;
      });
      formatGrid.appendChild(btn);
    });
  }
}

qualityRange.addEventListener("input", () => {
  qualityValue.textContent = qualityRange.value;
  qualityRange.style.setProperty("--fill", `${qualityRange.value}%`);
});
qualityRange.style.setProperty("--fill", `${qualityRange.value}%`);

clearFileBtn.addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  showOnly(dropCard);
});

resetBtn.addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  showOnly(dropCard);
});

// ===== FFmpeg lazy loader (cuma dimuat kalau ada video/audio yang diproses) =====
async function getFFmpeg(onLog) {
  if (ffmpegInstance) return ffmpegInstance;

  progressLabel.textContent = "Mengunduh mesin proses video (sekali aja, ± beberapa detik)...";
  const { FFmpeg } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/+esm");
  const { toBlobURL } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/+esm");

  const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
  const ffmpeg = new FFmpeg();
  if (onLog) ffmpeg.on("log", onLog);

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

// ===== Image processing (Canvas API, instan, gak butuh ffmpeg) =====
function loadImageBitmap(file) {
  return createImageBitmap(file);
}

async function processImage() {
  const bitmap = await loadImageBitmap(currentFile);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  setRing(60, "Merender gambar...");

  let targetMime, targetExt, quality;

  if (mode === "compress") {
    quality = Number(qualityRange.value) / 100;
    // PNG itu lossless (quality diabaikan browser), jadi kalau sumbernya PNG,
    // convert ke WEBP biar kompresi kerasa efeknya tapi transparansi tetap kejaga.
    if (currentFile.type === "image/png") {
      targetMime = "image/webp";
      targetExt = "webp";
    } else {
      targetMime = currentFile.type || "image/jpeg";
      targetExt = targetMime === "image/webp" ? "webp" : "jpg";
    }
  } else {
    targetMime = selectedFormat.mime;
    targetExt = selectedFormat.ext;
    quality = 0.92;
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, targetMime, quality));
  setRing(100, "Selesai!");
  return { blob, ext: targetExt };
}

// ===== Video / audio processing (FFmpeg.wasm) =====
async function processMedia() {
  const ffmpeg = await getFFmpeg((entry) => {
    // log mentah dari ffmpeg, gak perlu ditampilkan ke user, cukup buat debug console
    console.log(entry.message);
  });

  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.min(99, Math.max(5, Math.round(progress * 100)));
    setRing(pct, "Memproses...");
  });

  setRing(5, "Menyiapkan file...");

  const inputExt = (currentFile.name.split(".").pop() || "bin").toLowerCase();
  const inputName = `input.${inputExt}`;
  const fileBuffer = new Uint8Array(await currentFile.arrayBuffer());
  await ffmpeg.writeFile(inputName, fileBuffer);

  let outputExt, args;

  if (mode === "compress") {
    const quality = Number(qualityRange.value);
    if (fileCategory === "video") {
      outputExt = inputExt === "mp4" || inputExt === "mov" ? "mp4" : inputExt;
      const crf = Math.max(18, Math.min(40, Math.round(51 - (quality / 100) * 33)));
      args = ["-i", inputName, "-vcodec", "libx264", "-crf", String(crf), "-preset", "veryfast", "-acodec", "aac", `output.${outputExt}`];
    } else {
      outputExt = inputExt;
      const bitrate = Math.max(32, Math.min(192, Math.round(32 + (quality / 100) * 160)));
      args = ["-i", inputName, "-b:a", `${bitrate}k`, `output.${outputExt}`];
    }
  } else {
    outputExt = selectedFormat.ext;
    if (fileCategory === "video") {
      if (outputExt === "gif") {
        args = ["-i", inputName, "-vf", "fps=12,scale=480:-1:flags=lanczos", `output.gif`];
      } else if (outputExt === "webm") {
        args = ["-i", inputName, "-c:v", "libvpx-vp9", "-b:v", "1M", "-c:a", "libopus", `output.webm`];
      } else {
        args = ["-i", inputName, "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", `output.mp4`];
      }
    } else {
      if (outputExt === "mp3") {
        args = ["-i", inputName, "-codec:a", "libmp3lame", "-qscale:a", "2", `output.mp3`];
      } else if (outputExt === "m4a") {
        args = ["-i", inputName, "-c:a", "aac", "-b:a", "192k", `output.m4a`];
      } else if (outputExt === "ogg") {
        args = ["-i", inputName, "-c:a", "libvorbis", "-qscale:a", "5", `output.ogg`];
      } else {
        args = ["-i", inputName, `output.wav`];
      }
    }
  }

  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(`output.${outputExt}`);
  setRing(100, "Selesai!");

  const mimeGuess = fileCategory === "video"
    ? (outputExt === "gif" ? "image/gif" : `video/${outputExt}`)
    : `audio/${outputExt}`;

  return { blob: new Blob([data.buffer], { type: mimeGuess }), ext: outputExt };
}

// ===== Main process trigger =====
processBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  if (mode === "convert" && !selectedFormat) return;

  showOnly(progressCard);
  setRing(0, "Menyiapkan...");
  setStatus("");

  try {
    const result = fileCategory === "image" ? await processImage() : await processMedia();

    const baseName = currentFile.name.replace(/\.[^/.]+$/, "");
    const outName = `${baseName}-${mode === "compress" ? "compressed" : "converted"}.${result.ext}`;

    resultUrl = URL.createObjectURL(result.blob);
    sizeBefore.textContent = formatBytes(currentFile.size);
    sizeAfter.textContent = formatBytes(result.blob.size);

    const diff = currentFile.size - result.blob.size;
    if (diff > 0) {
      const pct = Math.round((diff / currentFile.size) * 100);
      resultSavings.textContent = `🎉 Hemat ${pct}% dari ukuran asli`;
    } else {
      resultSavings.textContent = mode === "compress"
        ? "Ukuran hasil sudah cukup optimal (gak lebih kecil lagi)."
        : "Konversi selesai.";
    }

    downloadBtn.href = resultUrl;
    downloadBtn.download = outName;
    showOnly(resultCard);
  } catch (err) {
    console.error(err);
    showOnly(optionsCard);
    setStatus(`Gagal memproses file: ${err.message || "kesalahan tak terduga"}`, true);
  }
});
    
