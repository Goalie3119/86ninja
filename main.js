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
  const onScroll = () => topbar.classList.toggle("scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Color remote ----------
  const swatches = document.querySelectorAll(".swatch");
  let glow = "#8f7bff";

  function setGlow(color) {
    glow = color;
    root.style.setProperty("--glow", color);
    swatches.forEach((s) => s.setAttribute("aria-pressed", String(s.dataset.glow === color)));
    try { localStorage.setItem("afterglow-color", color); } catch {}
  }

  swatches.forEach((s) => {
    s.style.background = s.dataset.glow;
    s.addEventListener("click", () => setGlow(s.dataset.glow));
  });

  try {
    const saved = localStorage.getItem("afterglow-color");
    if (saved && [...swatches].some((s) => s.dataset.glow === saved)) setGlow(saved);
  } catch {}

  // ---------- Starlight headliner ----------
  const canvas = document.querySelector(".sky");
  const ctx = canvas.getContext("2d");
  const twinkleBox = document.getElementById("twinkle");
  let stars = [];
  let w = 0, h = 0, dpr = 1;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(160, Math.round((w * h) / 2600));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      // Denser toward the top, like a real headliner viewed from the seat
      y: Math.pow(Math.random(), 1.4) * h,
      r: Math.random() < 0.1 ? 1.6 + Math.random() : 0.6 + Math.random() * 0.9,
      tinted: Math.random() < 0.35, // these strands take the remote's color
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 2.2,
    }));
    shooters = [];
  }

  // Shooting stars, like the "meteor" mode on starlight kits
  let shooters = [];
  let nextShot = 1500;

  function spawnShooter(t) {
    const fromLeft = Math.random() < 0.5;
    const speed = 0.9 + Math.random() * 0.6; // px per ms
    const angle = 0.25 + Math.random() * 0.35;
    shooters.push({
      x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
      y: Math.random() * h * 0.45,
      vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
      vy: Math.sin(angle) * speed,
      born: t,
      life: 700 + Math.random() * 500,
    });
    nextShot = t + 2500 + Math.random() * 3500;
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const twinkle = twinkleBox.checked && !reduceMotion;
    for (const s of stars) {
      // Cubing the sine gives long dim stretches and quick bright peaks, so each strand visibly flashes
      const v = twinkle ? Math.pow(0.5 + 0.5 * Math.sin(t / 1000 * s.speed + s.phase), 3) : 0.7;
      const a = 0.12 + 0.88 * v;
      const r = s.r * (0.75 + 0.6 * v);
      ctx.fillStyle = s.tinted ? glow : "#f3eedf";
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (v > 0.55) {
        // Halo at the peak of the flash
        ctx.globalAlpha = (v - 0.55) * 0.6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.5) {
          // Four-point sparkle on the bigger strands
          const len = r * 7 * v;
          ctx.globalAlpha = (v - 0.55) * 1.6;
          ctx.fillRect(s.x - len, s.y - 0.5, len * 2, 1);
          ctx.fillRect(s.x - 0.5, s.y - len, 1, len * 2);
        }
      }
    }

    if (twinkle) {
      if (t > nextShot) spawnShooter(t);
      shooters = shooters.filter((m) => t - m.born < m.life);
      for (const m of shooters) {
        const age = (t - m.born) / m.life;
        const hx = m.x + m.vx * (t - m.born);
        const hy = m.y + m.vy * (t - m.born);
        const tail = 140;
        const grad = ctx.createLinearGradient(hx, hy, hx - m.vx * tail, hy - m.vy * tail);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.25, glow);
        grad.addColorStop(1, "transparent");
        ctx.globalAlpha = Math.sin(age * Math.PI);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - m.vx * tail, hy - m.vy * tail);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    if (twinkleBox.checked && !reduceMotion) requestAnimationFrame(loop);
  }

  layout();
  if (reduceMotion) twinkleBox.checked = false;
  requestAnimationFrame(loop);
  twinkleBox.addEventListener("change", () => requestAnimationFrame(loop));
  swatches.forEach((s) => s.addEventListener("click", () => requestAnimationFrame(draw)));
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); draw(performance.now()); }, 120);
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
