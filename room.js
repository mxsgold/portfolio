(() => {
  "use strict";

  const cfg = window.RAVE_CONFIG;
  const supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  const q = new URLSearchParams(location.search);
  const id = q.get("room");
  const src = q.get("video");
  const v = document.querySelector("#video");
  const conn = document.querySelector("#connection");
  const msgs = document.querySelector("#messages");
  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#chatInput");
  const copy = document.querySelector("#copyBtn");
  const fresh = document.querySelector("#newRoomBtn");
  const name = document.querySelector("#roomName");
  const empty = document.querySelector("#emptyVideo");
  const videoStatus = document.querySelector("#videoStatus");
  const me = crypto.randomUUID();

  let ch;
  let applying = false;

  if (!id) {
    location.href = "./";
    return;
  }

  name.textContent = "#" + id;

  // Primary source is the URL parameter. localStorage is a fallback for
  // rooms created in this browser if a very long URL gets mangled.
  const saved = localStorage.getItem("rave:lastVideoUrl") || "";
  const videoSrc = src || saved;

  const showVideo = (url) => {
    if (!url) {
      empty.style.display = "grid";
      videoStatus.textContent = "No video URL was attached to this room.";
      return;
    }

    v.src = url;
    empty.style.display = "grid";
    videoStatus.textContent = "Loading video…";

    v.onloadedmetadata = () => {
      empty.style.display = "none";
      videoStatus.textContent = "Video ready";
    };

    v.onerror = () => {
      empty.style.display = "grid";
      videoStatus.textContent =
        "Video could not be loaded. Check the video URL/storage permissions.";
      console.error("[RAVE] video error", v.error, url);
    };

    v.load();
  };

  showVideo(videoSrc);

  const state = () => ({
    type: "state",
    from: me,
    time: v.currentTime || 0,
    playing: !v.paused,
    sentAt: Date.now()
  });

  const send = (x) => ch && ch.send({
    type: "broadcast",
    event: "rave",
    payload: x
  });

  function apply(x) {
    applying = true;
    const t = x.time + (x.playing ? (Date.now() - x.sentAt) / 1000 : 0);
    if (Math.abs(v.currentTime - t) > .35) v.currentTime = Math.max(0, t);

    const done = () => setTimeout(() => applying = false, 80);

    if (x.playing) v.play().then(done).catch(done);
    else {
      v.pause();
      done();
    }
  }

  function add(w, t) {
    const r = document.createElement("div");
    const n = document.createElement("span");
    const p = document.createElement("p");
    r.className = "message";
    n.className = "message-name";
    n.textContent = w;
    p.textContent = t;
    r.append(n, p);
    msgs.append(r);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function connect() {
    ch = supabase.channel("rave:" + id, {
      config: { broadcast: { self: false } }
    });

    ch.on("broadcast", { event: "rave" }, ({ payload: x }) => {
      if (!x || x.from === me) return;
      if (x.type === "hello") send(state());
      if (x.type === "state") apply(x);
      if (x.type === "chat") add(x.name || "friend", x.text);
    });

    await ch.subscribe((status) => {
      conn.textContent =
        status === "SUBSCRIBED" ? "● connected" : status.toLowerCase();
      conn.className = "connection" + (status === "SUBSCRIBED" ? " online" : "");
      if (status === "SUBSCRIBED") send({ type: "hello", from: me });
    });
  }

  ["play", "pause", "seeked"].forEach((event) => {
    v.addEventListener(event, () => {
      if (!applying) send(state());
    });
  });

  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    add("you", text);
    send({ type: "chat", from: me, name: "friend", text });
    input.value = "";
  };

  copy.onclick = async () => {
    await navigator.clipboard.writeText(location.href);
    copy.textContent = "Copied ✓";
    setTimeout(() => copy.textContent = "Copy invite", 1200);
  };

  fresh.onclick = () => location.href = "./";

  connect();
})();