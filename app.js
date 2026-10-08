(() => {
  "use strict";

  const cfg = window.RAVE_CONFIG;
  const $ = (q) => document.querySelector(q);
  const fileInput = $("#videoFile");
  const dropZone = $("#dropZone");
  const fileName = $("#fileName");
  const fileHint = $("#fileHint");
  const videoUrl = $("#videoUrl");
  const uploadBtn = $("#uploadBtn");
  const createBtn = $("#createBtn");
  const status = $("#status");
  const progressWrap = $("#progressWrap");
  const progressBar = $("#progressBar");
  const progressText = $("#progressText");
  const progressBytes = $("#progressBytes");
  const debugLog = $("#debugLog");

  let selectedFile = null;
  let uploadedUrl = "";
  let busy = false;

  const log = (...parts) => {
    const line = parts.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ");
    debugLog.textContent = (debugLog.textContent === "Waiting…" ? "" : debugLog.textContent + "\n") + line;
    console.log("[RAVE]", ...parts);
  };

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = type;
  };

  const bytes = (n) => {
    if (!Number.isFinite(n)) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0, v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return v.toFixed(i ? 1 : 0) + " " + units[i];
  };

  const choose = (file) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setStatus("That file is not a video.", "error");
      return;
    }
    selectedFile = file;
    uploadedUrl = "";
    fileName.textContent = file.name;
    fileHint.textContent = bytes(file.size) + " · " + (file.type || "video");
    videoUrl.value = "";
    progressWrap.hidden = true;
    setStatus("Ready to upload.");
    log("Selected:", file.name, bytes(file.size), file.type);
  };

  fileInput.addEventListener("change", () => choose(fileInput.files?.[0]));

  ["dragenter", "dragover"].forEach(type => {
    dropZone.addEventListener(type, e => {
      e.preventDefault();
      dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach(type => {
    dropZone.addEventListener(type, e => {
      e.preventDefault();
      dropZone.classList.remove("dragging");
    });
  });
  dropZone.addEventListener("drop", e => choose(e.dataTransfer.files?.[0]));

  const setBusy = (value) => {
    busy = value;
    uploadBtn.disabled = value;
    createBtn.disabled = value;
    fileInput.disabled = value;
  };

  const uploadDirect = (file) => new Promise((resolve, reject) => {
    const ext = (file.name.split(".").pop() || "mp4")
      .toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const path = crypto.randomUUID() + "-" + Date.now() + "." + ext;
    const endpoint = cfg.SUPABASE_URL + "/storage/v1/object/" +
      encodeURIComponent(cfg.STORAGE_BUCKET) + "/" +
      path.split("/").map(encodeURIComponent).join("/");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("apikey", cfg.SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + cfg.SUPABASE_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("content-type", file.type || "video/mp4");

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) {
        progressText.textContent = "Uploading…";
        return;
      }
      const pct = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = pct + "%";
      progressText.textContent = pct + "%";
      progressBytes.textContent = bytes(e.loaded) + " / " + bytes(e.total);
    };

    xhr.onerror = () => reject(new Error("Network/CORS error while contacting Supabase Storage."));
    xhr.onabort = () => reject(new Error("Upload was aborted."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.onload = () => {
      const raw = xhr.responseText || "";
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch {}
      log("Storage response:", xhr.status, raw || "(empty)");

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path, body });
        return;
      }

      const message = body?.message || body?.error || raw || ("HTTP " + xhr.status);
      reject(new Error("Supabase Storage HTTP " + xhr.status + ": " + message));
    };

    xhr.timeout = 20 * 60 * 1000;
    log("POST", endpoint);
    xhr.send(file);
  });

  uploadBtn.addEventListener("click", async () => {
    if (busy) return;
    if (!selectedFile) {
      setStatus("Choose a video first.", "error");
      return;
    }

    setBusy(true);
    progressWrap.hidden = false;
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    progressBytes.textContent = "";
    setStatus("Uploading… 0%");
    log("Upload started.");

    try {
      const result = await uploadDirect(selectedFile);
      uploadedUrl = cfg.SUPABASE_URL + "/storage/v1/object/public/" +
        encodeURIComponent(cfg.STORAGE_BUCKET) + "/" +
        result.path.split("/").map(encodeURIComponent).join("/");

      videoUrl.value = uploadedUrl;
      setStatus("Upload complete. Now create the room.", "success");
      progressBar.style.width = "100%";
      progressText.textContent = "100%";
      progressBytes.textContent = bytes(selectedFile.size);
      log("Public URL:", uploadedUrl);
    } catch (error) {
      uploadedUrl = "";
      setStatus("UPLOAD FAILED: " + (error?.message || String(error)), "error");
      log("ERROR:", error?.stack || error?.message || String(error));
    } finally {
      setBusy(false);
    }
  });

  videoUrl.addEventListener("input", () => {
    if (videoUrl.value.trim()) {
      selectedFile = null;
      uploadedUrl = videoUrl.value.trim();
      fileInput.value = "";
      fileName.textContent = "Direct URL selected";
      fileHint.textContent = "The room will use this URL directly";
    }
  });

  createBtn.addEventListener("click", () => {
    if (busy) return;
    const url = (uploadedUrl || videoUrl.value).trim();
    if (!url) {
      setStatus("Upload a video or paste a direct video URL first.", "error");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setStatus("The video URL must start with http:// or https://.", "error");
      return;
    }

    const roomId = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    log("Creating room:", roomId);
    location.href = "room.html?room=" + encodeURIComponent(roomId) +
      "&video=" + encodeURIComponent(url);
  });

  log("Frontend initialized.");
  log("Supabase:", cfg.SUPABASE_URL);
  log("Bucket:", cfg.STORAGE_BUCKET);
})();