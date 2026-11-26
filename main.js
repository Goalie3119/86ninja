(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Mobile menu ----------
  const menuBtn = document.querySelector(".menu-btn");
  const nav = document.getElementById("main-nav");
  function setMenu(open) {
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.querySelector(".menu-text").textContent = open ? "Close" : "Menu";
    nav.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
  }
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // Solid top bar once the page scrolls past the hero top
  const topbar = document.querySelector(".topbar");
  const toTop = document.getElementById("to-top");
  const onScroll = () => {
    topbar.classList.toggle("scrolled", scrollY > 40);
    toTop.classList.toggle("show", scrollY > innerHeight * 0.8);
  };
  toTop.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    document.querySelector(".brand").focus({ preventScroll: true });
  });
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Color remote ----------
  const swatches = document.querySelectorAll(".swatch");
  let glow = "#00e5ff";

  function setGlow(color) {
    glow = color;
    root.style.setProperty("--glow", color);
    swatches.forEach((s) => s.setAttribute("aria-pressed", String(s.dataset.glow === color)));
    try { localStorage.setItem("dojoglow-color", color); } catch {}
  }

  swatches.forEach((s) => {
    s.style.background = s.dataset.glow;
    s.addEventListener("click", () => setGlow(s.dataset.glow));
  });

  try {
    const saved = localStorage.getItem("dojoglow-color");
    if (saved && [...swatches].some((s) => s.dataset.glow === saved)) setGlow(saved);
  } catch {}

  // ---------- Light-cycle race ----------
  // Top-down arena: riders move on a grid, leave trails that fade out, steer away from walls and
  // trails, sometimes try to cut each other off, crash when boxed in, then respawn.
  const canvas = document.querySelector(".arena");
  const ctx = canvas.getContext("2d");
  const motionBox = document.getElementById("motion");
  const NEON = ["#00e5ff", "#ff8a00", "#ff2bd6", "#39ff14", "#fff200", "#ff3b5c", "#9d7bff", "#f4fbff"];
  const TRAIL_LIFE = 5200;   // ms a trail stays on the floor
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let w = 0, h = 0, dpr = 1, cell = 14, cols = 0, rows = 0;
  let laid;                  // per cell: time a trail was laid there (0 = empty)
  let riders = [], sparks = [];
  let gridLayer = document.createElement("canvas");
  let gridColor = "";
  let simTime = 0;

  const idx = (x, y) => y * cols + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const blocked = (x, y) => !inside(x, y) || (laid[idx(x, y)] && simTime - laid[idx(x, y)] < TRAIL_LIFE);

  // How much open floor is reachable from a cell (capped), so riders avoid dead ends
  function room(x, y, limit) {
    if (blocked(x, y)) return 0;
    const seen = new Set([idx(x, y)]);
    const queue = [[x, y]];
    while (queue.length && seen.size < limit) {
      const [cx, cy] = queue.shift();
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy, k = idx(nx, ny);
        if (inside(nx, ny) && !seen.has(k) && !blocked(nx, ny)) { seen.add(k); queue.push([nx, ny]); }
      }
    }
    return seen.size;
  }

  function spawn(r) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 2 + Math.floor(Math.random() * (cols - 4));
      const y = 2 + Math.floor(Math.random() * (rows - 4));
      const dir = Math.floor(Math.random() * 4);
      if (room(x, y, 120) < 120) continue;
      Object.assign(r, { x, y, dir, progress: 0, run: 0, alive: true, trail: [{ x, y, t: simTime }] });
      laid[idx(x, y)] = simTime;
      return true;
    }
    return false;
  }

  function crash(r) {
    r.alive = false;
    r.respawnAt = simTime + 1400 + Math.random() * 1600;
    // Burst of light, then the wreck's trail fades out fast
    const px = (r.x + 0.5) * cell, py = (r.y + 0.5) * cell;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.12;
      sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: simTime, color: r.color });
    }
    const fadeFrom = simTime - TRAIL_LIFE + 700;
    for (const p of r.trail) {
      p.t = Math.min(p.t, fadeFrom);
      const k = idx(p.x, p.y);
      if (laid[k]) laid[k] = Math.min(laid[k], fadeFrom);
    }
  }

  // Pick straight, left or right on arriving at a cell
  function steer(r) {
    const heads = new Set(riders.filter((o) => o !== r && o.alive).map((o) => idx(o.x + DIRS[o.dir][0], o.y + DIRS[o.dir][1])));
    const target = r.aggression > Math.random() ? nearestCutoff(r) : null;
    let best = null, bestScore = -Infinity;
    for (const turn of [0, -1, 1]) {
      const dir = (r.dir + turn + 4) % 4;
      const nx = r.x + DIRS[dir][0], ny = r.y + DIRS[dir][1];
      if (blocked(nx, ny) || heads.has(idx(nx, ny))) continue;
      let score = room(nx, ny, 90);
      if (turn === 0) score += 30;                      // strongly prefer long straights
      score += Math.random() * 4;
      if (target) score -= Math.hypot(target[0] - nx, target[1] - ny) * 2;
      // Stay off the walls (and out from under the top menu) when there's a choice
      const edge = Math.min(nx, ny - 4, cols - 1 - nx, rows - 1 - ny);
      if (edge < 3) score -= (3 - edge) * 12;
      if (score > bestScore) { bestScore = score; best = dir; }
    }
    // Occasional unprovoked turn, but only after a decent straight run
    if (best === r.dir && r.run >= 6 && Math.random() < 0.05) {
      const turn = Math.random() < 0.5 ? -1 : 1, dir = (r.dir + turn + 4) % 4;
      if (room(r.x + DIRS[dir][0], r.y + DIRS[dir][1], 90) > 60) best = dir;
    }
    return best;
  }

  // A point just ahead of the closest rival: steering there cuts them off
  function nearestCutoff(r) {
    let pick = null, bestD = 18;
    for (const o of riders) {
      if (o === r || !o.alive) continue;
      const d = Math.abs(o.x - r.x) + Math.abs(o.y - r.y);
      if (d < bestD) { bestD = d; pick = o; }
    }
    if (!pick) return null;
    const lead = 5;
    return [pick.x + DIRS[pick.dir][0] * lead, pick.y + DIRS[pick.dir][1] * lead];
  }

  function step(dt) {
    simTime += dt;
    for (const r of riders) {
      if (!r.alive) { if (simTime >= r.respawnAt) spawn(r); continue; }
      r.progress += (r.speed * dt) / 1000;
      while (r.alive && r.progress >= 1) {
        r.progress -= 1;
        const nx = r.x + DIRS[r.dir][0], ny = r.y + DIRS[r.dir][1];
        if (blocked(nx, ny)) { crash(r); break; }
        r.x = nx; r.y = ny;
        laid[idx(nx, ny)] = simTime;
        r.trail.push({ x: nx, y: ny, t: simTime });
        const dir = steer(r);
        if (dir === null) { crash(r); break; }
        r.run = dir === r.dir ? r.run + 1 : 0;
        r.dir = dir;
      }
      while (r.trail.length && simTime - r.trail[0].t > TRAIL_LIFE) r.trail.shift();
    }
    // Dead riders' trails still need trimming while they wait
    for (const r of riders) if (!r.alive) while (r.trail.length && simTime - r.trail[0].t > TRAIL_LIFE) r.trail.shift();
    sparks = sparks.filter((p) => simTime - p.born < 700);
  }

  function drawGrid() {
    const key = `${glow}|${w}|${h}|${cell}`;
    if (key === gridColor) return;
    gridColor = key;
    gridLayer.width = w * dpr; gridLayer.height = h * dpr;
    const g = gridLayer.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = glow; g.lineWidth = 1;
    g.globalAlpha = 0.07;
    g.beginPath();
    for (let x = 0; x <= cols; x++) { g.moveTo(x * cell + 0.5, 0); g.lineTo(x * cell + 0.5, rows * cell); }
    for (let y = 0; y <= rows; y++) { g.moveTo(0, y * cell + 0.5); g.lineTo(cols * cell, y * cell + 0.5); }
    g.stroke();
    // Brighter major lines every 6 cells
    g.globalAlpha = 0.14;
    g.beginPath();
    for (let x = 0; x <= cols; x += 6) { g.moveTo(x * cell + 0.5, 0); g.lineTo(x * cell + 0.5, rows * cell); }
    for (let y = 0; y <= rows; y += 6) { g.moveTo(0, y * cell + 0.5); g.lineTo(cols * cell, y * cell + 0.5); }
    g.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawGrid();
    ctx.drawImage(gridLayer, 0, 0, w, h);
    riders[0].color = glow; // the lead rider wears the visitor's color
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt"; ctx.lineJoin = "miter";
    for (const r of riders) {
      const pts = r.trail;
      if (!pts.length) continue;
      const head = r.alive
        ? [(r.x + DIRS[r.dir][0] * r.progress + 0.5) * cell, (r.y + DIRS[r.dir][1] * r.progress + 0.5) * cell]
        : null;
      // Screen points along the trail, ending at the moving head
      const P = pts.map((p) => [(p.x + 0.5) * cell, (p.y + 0.5) * cell, p.t]);
      if (head) P.push([head[0], head[1], simTime]);
      ctx.strokeStyle = r.color;
      // Two passes: wide soft glow, then the bright wall itself. Short polyline chunks
      // share one fade level each, so segments never overlap and bead up.
      const CHUNK = 4;
      for (const [width, alpha] of [[8, 0.2], [2.4, 1]]) {
        ctx.lineWidth = width;
        for (let i = 0; i < P.length - 1; i += CHUNK) {
          const j = Math.min(i + CHUNK, P.length - 1);
          const life = 1 - (simTime - P[j][2]) / TRAIL_LIFE;
          ctx.globalAlpha = alpha * Math.max(0, life) ** 1.5;
          ctx.beginPath();
          ctx.moveTo(P[i][0], P[i][1]);
          for (let k = i + 1; k <= j; k++) ctx.lineTo(P[k][0], P[k][1]);
          ctx.stroke();
        }
      }
      if (head) {
        ctx.globalAlpha = 0.35; ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(head[0], head[1], cell * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
        ctx.fillRect(head[0] - 2.5, head[1] - 2.5, 5, 5);
      }
    }
    for (const p of sparks) {
      const age = simTime - p.born;
      ctx.globalAlpha = 1 - age / 700;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x + p.vx * age - 1.5, p.y + p.vy * age - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const small = w < 640;
    cell = small ? 12 : 14;
    cols = Math.floor(w / cell); rows = Math.floor(h / cell);
    laid = new Float64Array(cols * rows);
    simTime = 1;
    sparks = [];
    const others = NEON.filter((c) => c.toLowerCase() !== glow.toLowerCase());
    riders = Array.from({ length: small ? 6 : 8 }, (_, i) => ({
      color: i === 0 ? glow : others[(i - 1) % others.length],
      speed: (small ? 13 : 16) * (0.9 + Math.random() * 0.2),  // cells per second
      aggression: 0.15 + Math.random() * 0.35,
      trail: [], alive: false, respawnAt: 0,
    }));
    riders.forEach(spawn);
    gridColor = "";
  }

  let running = false, last = 0, heroVisible = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(50, now - (last || now));
    last = now;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || !motionBox.checked || reduceMotion || !heroVisible) return;
    running = true; last = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  // A still frame for reduced motion, or when the race is switched off before it starts
  function settle() {
    for (let i = 0; i < 300; i++) step(16);
    draw();
  }

  layout();
  if (reduceMotion) { motionBox.checked = false; settle(); } else start();
  motionBox.addEventListener("change", () => (motionBox.checked ? start() : stop()));
  swatches.forEach((s) => s.addEventListener("click", () => { if (!running) draw(); }));
  // Only race while the hero is on screen, to save battery
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    heroVisible ? start() : stop();
  }).observe(canvas);
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); if (!running) settle(); }, 150);
  });

  // ---------- Gallery ----------
  // Every photo in images/gallery/ shows up here. The file name becomes the caption:
  // "01-gr86-starlight-headliner.jpg" shows as "Gr86 Starlight Headliner" (a leading number only sets the order).
  // On GitHub Pages the photo list (gallery.json) is written automatically on each upload;
  // locally it falls back to reading the folder listing.
  const GALLERY_DIR = "images/gallery/";
  const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

  async function listGallery() {
    try {
      const res = await fetch(GALLERY_DIR + "gallery.json", { cache: "no-cache" });
      if (res.ok) return (await res.json()).filter((f) => IMAGE_RE.test(f));
    } catch {}
    // On a github.io address, ask GitHub for the folder contents directly
    const gh = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (gh) {
      try {
        const repo = location.pathname.split("/")[1] || `${gh[1]}.github.io`;
        const res = await fetch(`https://api.github.com/repos/${gh[1]}/${repo}/contents/${GALLERY_DIR}`);
        if (res.ok) return (await res.json()).map((f) => f.name).filter((f) => IMAGE_RE.test(f));
      } catch {}
    }
    try {
      const res = await fetch(GALLERY_DIR, { cache: "no-cache" });
      if (res.ok) {
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        return [...doc.querySelectorAll("a[href]")]
          .map((a) => decodeURIComponent(a.getAttribute("href").split("/").pop()))
          .filter((f) => IMAGE_RE.test(f));
      }
    } catch {}
    return [];
  }

  function captionFor(file) {
    return file
      .replace(IMAGE_RE, "")
      .replace(/^\d+[-_ ]+/, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  const carousel = document.getElementById("carousel");
  const track = document.getElementById("carousel-track");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  const count = document.getElementById("carousel-count");

  // Index of the slide nearest the middle of the track
  function currentIndex() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    [...track.children].forEach((slide, i) => {
      const d = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - mid);
      if (d < bestDist) { best = i; bestDist = d; }
    });
    return best;
  }
  function updateCarousel() {
    const total = track.children.length;
    prevBtn.disabled = track.scrollLeft <= 2;
    nextBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    count.textContent = `${currentIndex() + 1} of ${total}`;
  }
  // Animate the scroll ourselves: built-in smooth scrolling is ignored by some browsers
  function animateTo(left) {
    left = Math.max(0, Math.min(left, track.scrollWidth - track.clientWidth));
    if (reduceMotion) { track.scrollLeft = left; return; }
    const from = track.scrollLeft, dist = left - from, t0 = performance.now(), dur = 420;
    track.style.scrollSnapType = "none";
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      track.scrollLeft = from + dist * (1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step);
      else { track.style.scrollSnapType = ""; updateCarousel(); }
    };
    requestAnimationFrame(step);
  }
  function go(dir) {
    const slides = track.children;
    const i = Math.max(0, Math.min(slides.length - 1, currentIndex() + dir));
    const slide = slides[i];
    animateTo(slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2);
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });
  track.addEventListener("scroll", updateCarousel, { passive: true });
  addEventListener("resize", updateCarousel);

  listGallery().then((files) => {
    if (!files.length) return; // keep the placeholder tiles
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    track.innerHTML = files.map((f, i) => {
      const caption = esc(captionFor(f));
      return `<figure class="slide" aria-roledescription="slide" aria-label="${i + 1} of ${files.length}">
        <img src="${GALLERY_DIR}${encodeURIComponent(f)}" alt="${caption}" loading="${i < 2 ? "eager" : "lazy"}">
        ${caption ? `<figcaption>${caption}</figcaption>` : ""}
      </figure>`;
    }).join("");
    document.getElementById("gallery-placeholder").remove();
    document.getElementById("gallery-hint").remove();
    carousel.hidden = false;
    const single = files.length === 1;
    prevBtn.hidden = nextBtn.hidden = count.hidden = single;
    updateCarousel();
  });

  // ---------- Meets ----------
  const list = document.getElementById("meet-list");
  const tabs = { upcoming: document.getElementById("tab-upcoming"), past: document.getElementById("tab-past") };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parse = (d) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); };
  const meets = (window.MEETS || []).map((m) => ({ ...m, when: parse(m.date) }));
  const upcoming = meets.filter((m) => m.when >= today).sort((a, b) => a.when - b.when);
  const past = meets.filter((m) => m.when < today).sort((a, b) => b.when - a.when);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function render(which) {
    const items = which === "upcoming" ? upcoming : past;
    if (!items.length) {
      list.innerHTML = `<li class="meet-empty">${which === "upcoming"
        ? "No meets on the calendar yet. Check back soon, or follow on Instagram for pop-ups."
        : "No recaps yet."}</li>`;
      return;
    }
    list.innerHTML = items.map((m) => {
      const month = m.when.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const weekday = m.when.toLocaleDateString(undefined, { weekday: "long" });
      const recap = m.recap
        ? `<details class="details"><summary>Read the recap</summary><p>${esc(m.recap)}</p></details>`
        : "";
      return `<li class="meet">
        <time datetime="${m.date}"><div class="day">${m.when.getDate()}</div><div class="month">${month}</div></time>
        <div>
          <h3>${esc(m.title)}</h3>
          <p class="where">${esc(weekday)}${m.time ? ", " + esc(m.time) : ""} at ${esc(m.location)}</p>
          <p>${esc(m.summary)}</p>
          ${recap}
        </div>
      </li>`;
    }).join("");
  }

  function select(which) {
    for (const [key, tab] of Object.entries(tabs)) tab.setAttribute("aria-selected", String(key === which));
    list.setAttribute("aria-labelledby", tabs[which].id);
    render(which);
  }
  tabs.upcoming.addEventListener("click", () => select("upcoming"));
  tabs.past.addEventListener("click", () => select("past"));
  select(upcoming.length || !past.length ? "upcoming" : "past");

  // ---------- Year / make / model pickers ----------
  // Models come from the free NHTSA vehicle database (vpic.nhtsa.dot.gov), filtered by year and make.
  const MAKES = [
    "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick", "Cadillac", "Chevrolet",
    "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford", "Genesis", "GMC", "Honda", "Hummer", "Hyundai",
    "Infiniti", "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus",
    "Lucid", "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "Mercury", "Mini", "Mitsubishi", "Nissan",
    "Oldsmobile", "Plymouth", "Polestar", "Pontiac", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Saab",
    "Saturn", "Scion", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
  ];
  const VEHICLE_TYPES = ["passenger car", "multipurpose passenger vehicle (mpv)", "truck"];
  const OTHER = "__other";

  const yearSel = document.getElementById("car-year");
  const makeSel = document.getElementById("car-make");
  const modelSel = document.getElementById("car-model");
  const makeOther = document.getElementById("car-make-other");
  const modelOther = document.getElementById("car-model-other");
  const modelCache = new Map();
  let modelRequest = 0;

  function fillSelect(sel, placeholder, values, withOther) {
    sel.innerHTML = "";
    sel.add(new Option(placeholder, ""));
    values.forEach((v) => sel.add(new Option(v, v)));
    if (withOther) sel.add(new Option("Other / Not Listed", OTHER));
  }

  function showOther(input, show) {
    input.parentElement.hidden = !show;
    input.required = show;
    if (!show) { input.value = ""; input.removeAttribute("aria-invalid"); }
  }

  async function fetchModels(year, make) {
    const key = `${year}|${make}`;
    if (!modelCache.has(key)) {
      const base = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}/vehicletype/`;
      const lists = await Promise.all(VEHICLE_TYPES.map((t) =>
        fetch(base + encodeURIComponent(t) + "?format=json").then((r) => {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })));
      const names = new Set(lists.flatMap((d) => d.Results.map((r) => r.Model_Name.trim())));
      modelCache.set(key, [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    }
    return modelCache.get(key);
  }

  function resetVehicle() {
    fillSelect(makeSel, "Select Year First", []);
    fillSelect(modelSel, "Select Make First", []);
    makeSel.disabled = modelSel.disabled = true;
    showOther(makeOther, false);
    showOther(modelOther, false);
  }

  const thisYear = new Date().getFullYear();
  fillSelect(yearSel, "Select Year", Array.from({ length: thisYear + 2 - 1980 }, (_, i) => String(thisYear + 1 - i)));
  resetVehicle();

  yearSel.addEventListener("change", () => {
    const keepMake = makeSel.value;
    resetVehicle();
    if (!yearSel.value) return;
    fillSelect(makeSel, "Select Make", MAKES, true);
    makeSel.disabled = false;
    // Changing only the year keeps the chosen make and reloads its models
    if (keepMake && keepMake !== OTHER) { makeSel.value = keepMake; makeSel.dispatchEvent(new Event("change")); }
  });

  makeSel.addEventListener("change", async () => {
    showOther(modelOther, false);
    const make = makeSel.value;
    showOther(makeOther, make === OTHER);
    if (!make) { fillSelect(modelSel, "Select Make First", []); modelSel.disabled = true; return; }
    if (make === OTHER) {
      // Unknown make: there's no list to load, so ask for the model as text
      fillSelect(modelSel, "Type It Below", []);
      modelSel.disabled = true;
      showOther(modelOther, true);
      return;
    }
    const request = ++modelRequest;
    fillSelect(modelSel, "Loading Models…", []);
    modelSel.disabled = true;
    try {
      const models = await fetchModels(yearSel.value, make);
      if (request !== modelRequest) return;
      fillSelect(modelSel, models.length ? "Select Model" : `No ${yearSel.value} ${make} Models Listed`, models, true);
      modelSel.disabled = false;
      if (!models.length) { modelSel.value = OTHER; showOther(modelOther, true); }
    } catch {
      if (request !== modelRequest) return;
      fillSelect(modelSel, "Couldn't Load Models — Type It Below", []);
      showOther(modelOther, true);
    }
  });

  modelSel.addEventListener("change", () => showOther(modelOther, modelSel.value === OTHER));

  // ---------- Booking form ----------
  // Requests are emailed through FormSubmit (formsubmit.co). The very first request
  // sends an activation email to this address; click the link in it once to turn delivery on.
  const FORM_ENDPOINT = "https://formsubmit.co/ajax/detrimentalow@gmail.com";

  const form = document.getElementById("book-form");
  const status = document.getElementById("form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const nameInput = document.getElementById("f-name");
  const contactInput = document.getElementById("f-contact");
  const serviceBoxes = [...form.querySelectorAll('input[name="service"]')];

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function isPhone(v) {
    if (!/^[\d\s().+-]+$/.test(v)) return false;
    const digits = v.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits[0] === "1");
  }

  function setError(id, el, message) {
    document.getElementById(id).textContent = message;
    if (el) el.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  }

  function carValue() {
    const make = makeSel.value === OTHER ? makeOther.value.trim() : makeSel.value;
    const model = modelSel.value === OTHER || modelSel.disabled ? modelOther.value.trim() : modelSel.value;
    return { year: yearSel.value, make, model };
  }

  // Each check returns the field to focus when it fails
  const checks = [
    () => {
      const v = nameInput.value.trim();
      return setError("err-name", nameInput, v.length >= 2 ? "" : "Enter your name.") ? null : nameInput;
    },
    () => {
      const v = contactInput.value.trim();
      const msg = !v ? "Enter an email or phone number so I can reply."
        : EMAIL_RE.test(v) || isPhone(v) ? ""
        : "Enter a valid email (name@example.com) or a 10-digit phone number.";
      return setError("err-contact", contactInput, msg) ? null : contactInput;
    },
    () => {
      const car = carValue();
      const missing = !car.year ? yearSel
        : !car.make ? (makeSel.value === OTHER ? makeOther : makeSel)
        : !car.model ? (modelSel.disabled || modelSel.value === OTHER ? modelOther : modelSel)
        : null;
      [yearSel, makeSel, modelSel, makeOther, modelOther].forEach((el) => el.removeAttribute("aria-invalid"));
      if (missing) missing.setAttribute("aria-invalid", "true");
      document.getElementById("err-car").textContent = missing ? "Choose the year, make and model of your car." : "";
      return missing;
    },
    () => {
      const ok = serviceBoxes.some((b) => b.checked);
      setError("err-services", null, ok ? "" : "Choose at least one thing you're interested in.");
      return ok ? null : serviceBoxes[0];
    },
  ];

  // Clear a field's error as soon as it's fixed
  nameInput.addEventListener("input", () => nameInput.getAttribute("aria-invalid") === "true" && checks[0]());
  contactInput.addEventListener("input", () => contactInput.getAttribute("aria-invalid") === "true" && checks[1]());
  contactInput.addEventListener("blur", () => contactInput.value.trim() && checks[1]());
  [yearSel, makeSel, modelSel, makeOther, modelOther].forEach((el) =>
    el.addEventListener("change", () => document.getElementById("err-car").textContent && checks[2]()));
  serviceBoxes.forEach((b) => b.addEventListener("change", () => document.getElementById("err-services").textContent && checks[3]()));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstBad = checks.map((check) => check()).find(Boolean);
    if (firstBad) {
      status.textContent = "Fix the highlighted fields and send again.";
      status.className = "form-status error";
      firstBad.focus();
      return;
    }

    const car = carValue();
    const services = serviceBoxes.filter((b) => b.checked).map((b) => b.value);
    const payload = {
      _subject: `New build request: ${car.year} ${car.make} ${car.model}`,
      _template: "table",
      _honey: form.elements._honey.value,
      Name: nameInput.value.trim(),
      Contact: contactInput.value.trim(),
      Car: `${car.year} ${car.make} ${car.model}`,
      "Interested in": services.join(", "),
      Notes: form.elements.notes.value.trim() || "(none)",
    };
    if (EMAIL_RE.test(payload.Contact)) payload._replyto = payload.Contact;

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    status.textContent = "";
    status.className = "form-status";
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      // FormSubmit answers the very first request with an activation notice instead of sending it
      if (/activat/i.test(data.message || "")) {
        status.textContent = "This form isn't switched on yet. Check the booking inbox for an email from FormSubmit, click Activate Form, then send your request again.";
        status.className = "form-status error";
        return;
      }
      if (!res.ok || String(data.success) !== "true") throw new Error(data.message || res.status);
      status.textContent = "Request sent. I'll get back to you within a day.";
      status.className = "form-status sent";
      form.reset();
      resetVehicle();
    } catch (err) {
      console.error("Booking request failed:", err);
      status.textContent = "Your request didn't go through. Check your connection and try again, or message me on TikTok @86ninja_.";
      status.className = "form-status error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Request";
    }
  });
})();
