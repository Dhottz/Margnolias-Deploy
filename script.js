// Carousel – drop-in

(function () {
  // velocidades (px/s)
  const SPEED_NORMAL = 120;
  const SPEED_HOVER  = 40;
  const SPEED_EASE   = 0.12;

  // revelação controlada
  const DECODE_COUNT  = 2;     // quantas imagens originais pré-decodificar
  const REVEAL_MIN_MS = 300;   // atraso mínimo antes de exibir
  const REVEAL_MAX_MS = 1200;  // atraso máximo

  const container     = document.getElementById("carousel-container");
  const track         = document.getElementById("carousel-track");
  const dotsContainer = document.getElementById("carousel-dots");
  const modal         = document.getElementById("modal");
  const modalImage    = document.getElementById("modal-image");

  if (!container || !track || !dotsContainer) return;

  const allItems       = Array.from(track.children);
  const originalsCount = Math.max(1, Math.floor(allItems.length / 2)) || allItems.length;
  const originalItems  = allItems.slice(0, originalsCount);
  const originalImgs   = originalItems.map(el => el.querySelector("img")).filter(Boolean);

  dotsContainer.innerHTML = "";
  for (let i = 0; i < originalsCount; i++) {
    const dot = document.createElement("span");
    dot.className = "carousel-dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => {
      scrollToSlide(i);
      setActiveDot(i);
      if (modal && modal.style.display === "flex") showModal(i);
    });
    dotsContainer.appendChild(dot);
  }
  const dots = Array.from(dotsContainer.querySelectorAll(".carousel-dot"));
  let activeDot = 0;
  function setActiveDot(i) {
    if (i === activeDot) return;
    dots.forEach((d, idx) => d.classList.toggle("active", idx === i));
    activeDot = i;
  }

  let slideWidth = 1;
  let halfWidth  = 1;
  function measure() {
    const first = originalItems[0];
    slideWidth = Math.max(1, first ? first.getBoundingClientRect().width : 1);
    halfWidth  = originalItems.reduce((acc, el) => acc + (el.getBoundingClientRect().width || slideWidth), 0);
  }

  let currentX     = 0;
  let lastT        = performance.now();
  let rafId        = null;
  let speedTarget  = SPEED_NORMAL;
  let speedCurrent = SPEED_NORMAL;

  function animate(t) {
    const dt = Math.min(32, t - lastT);
    lastT = t;

    speedCurrent += (speedTarget - speedCurrent) * SPEED_EASE;
    const dx = (speedCurrent / 1000) * dt;

    currentX -= dx;
    if (currentX <= -halfWidth) currentX += halfWidth;

    track.style.transform = `translate3d(${currentX}px,0,0)`;

    const idx = Math.round(Math.abs(currentX) / slideWidth) % originalsCount;
    if (idx !== activeDot) setActiveDot(idx);

    rafId = requestAnimationFrame(animate);
  }

  function scrollToSlide(idx) {
    currentX = -slideWidth * idx;
    track.style.transform = `translate3d(${currentX}px,0,0)`;
    lastT = performance.now();
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function loadAndDecode(img) {
    img.setAttribute("fetchpriority", "high");
    img.setAttribute("decoding", "async");
    if (img.complete) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", () => {
        img.decode ? img.decode().then(resolve).catch(resolve) : resolve();
      }, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }
  async function predecodeFirstN(n) {
    const imgs = originalImgs.slice(0, Math.min(n, originalImgs.length));
    await Promise.allSettled(imgs.map(loadAndDecode));
  }

  let rzTO;
  window.addEventListener("resize", () => {
    clearTimeout(rzTO);
    rzTO = setTimeout(() => {
      const idx = Math.round(Math.abs(currentX) / slideWidth) % originalsCount;
      measure();
      currentX = -idx * slideWidth;
      track.style.transform = `translate3d(${currentX}px,0,0)`;
    }, 120);
  }, { passive: true });

  let currentIndex = 0;

  function showModal(index) {
    if (!modal || !modalImage) return;
    currentIndex = index;
    modalImage.src = originalImgs[currentIndex]?.src || "";
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    setActiveDot(currentIndex);
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }

  function prevImage() {
    currentIndex = (currentIndex - 1 + originalsCount) % originalsCount;
    if (modalImage) modalImage.src = originalImgs[currentIndex]?.src || "";
    setActiveDot(currentIndex);
  }

  function nextImage() {
    currentIndex = (currentIndex + 1) % originalsCount;
    if (modalImage) modalImage.src = originalImgs[currentIndex]?.src || "";
    setActiveDot(currentIndex);
  }

  track.addEventListener("click", (e) => {
    const img = e.target.closest("img");
    if (!img) return;
    const idx = originalImgs.findIndex(i => i.src === img.src);
    showModal(idx >= 0 ? idx : 0);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  }, { passive: true });

  window.closeModal = closeModal;
  window.prevImage  = prevImage;
  window.nextImage  = nextImage;

  track.addEventListener("pointerenter", () => { speedTarget = SPEED_HOVER; }, { passive: true });
  track.addEventListener("pointerleave", () => { speedTarget = SPEED_NORMAL; }, { passive: true });
  track.addEventListener("touchstart",    () => { speedTarget = SPEED_HOVER; }, { passive: true });
  track.addEventListener("touchend",      () => { speedTarget = SPEED_NORMAL; }, { passive: true });

  document.addEventListener("DOMContentLoaded", async () => {
    container.classList.add("is-loading");
    container.style.visibility = "hidden";

    measure();

    const t0 = performance.now();
    await Promise.race([ predecodeFirstN(DECODE_COUNT), sleep(REVEAL_MAX_MS) ]);
    const elapsed = performance.now() - t0;
    if (elapsed < REVEAL_MIN_MS) await sleep(REVEAL_MIN_MS - elapsed);

    measure();

    container.classList.remove("is-loading");
    container.classList.add("is-ready");
    container.style.visibility = "";

    lastT = performance.now();
    requestAnimationFrame(animate);
  });
})();
