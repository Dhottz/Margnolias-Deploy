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


// Formulário – salva o lead no servidor + WhatsApp (hero e modal usam a mesma lógica)

(function () {
  const whatsappNumber = '5522992634219';
  const msgTemplate    = (nome, tel) => `Olá! Meu nome é ${nome} (tel: ${tel}). Tenho interesse nos terrenos Magnólias II.`;

  const digits = s => (s || '').replace(/\D/g, '');
  const onlyLetters = s => (s || '').normalize('NFC').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'´`^~\s-]/g, '');
  const collapseSpaces = s => s.replace(/\s+/g, ' ').trim();

  const formatBRPhone = d => {
    // d = só dígitos (limitado a 11)
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;      // fixo (8 dígitos total: 2+4+4)
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;                        // celular (9 dígitos: 2+5+4)
  };

  const getUTM = () => {
    const usp = new URLSearchParams(location.search);
    return ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']
      .map(k => usp.get(k) ? `${k}=${usp.get(k)}` : '')
      .filter(Boolean)
      .join('&');
  };

  function setupLeadForm(form) {
    const nomeEl  = form.elements.nome;
    const emailEl = form.elements.email;
    const telEl   = form.elements.telefone;
    const btn     = form.querySelector('button[type="submit"]');

    // === Nome: bloqueia números/símbolos, normaliza espaços ===
    nomeEl.addEventListener('input', () => {
      const cleaned = collapseSpaces(onlyLetters(nomeEl.value));
      if (cleaned !== nomeEl.value) {
        const pos = nomeEl.selectionStart;
        nomeEl.value = cleaned;
        nomeEl.setSelectionRange(pos, pos);
      }
      nomeEl.setCustomValidity('');
    });

    // === Email: reforça validação (sem espaços, formato básico) ===
    const validateEmail = () => {
      const v = emailEl.value.trim();
      emailEl.value = v;
      if (!v) { emailEl.setCustomValidity('Informe seu e-mail.'); return; }
      if (/\s/.test(v)) { emailEl.setCustomValidity('O e-mail não pode ter espaços.'); return; }
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      emailEl.setCustomValidity(ok ? '' : 'Digite um e-mail válido, ex.: nome@dominio.com');
    };
    emailEl.addEventListener('input', () => { emailEl.setCustomValidity(''); });
    emailEl.addEventListener('blur', validateEmail);

    // === Telefone BR: aceita só dígitos, aplica máscara e valida 10 ou 11 dígitos ===
    telEl.addEventListener('input', () => {
      telEl.value = formatBRPhone(digits(telEl.value).slice(0, 11));
      telEl.setCustomValidity('');
    });
    const validatePhone = () => {
      const d = digits(telEl.value);
      if (!d) { telEl.setCustomValidity('Informe seu telefone com DDD.'); return; }
      if (d.length !== 10 && d.length !== 11) {
        telEl.setCustomValidity('Use DDD + número. Ex.: (21) 99999-9999');
        return;
      }
      telEl.setCustomValidity('');
    };
    telEl.addEventListener('blur', validatePhone);

    // Bloqueio extra de colagem inválida no telefone
    telEl.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      telEl.value = formatBRPhone(digits(text).slice(0, 11));
    });

    // Submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      validateEmail();
      validatePhone();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const nomeVal   = collapseSpaces(nomeEl.value);
      const emailVal  = emailEl.value.trim();
      const telDigits = digits(telEl.value);

      const payload = {
        nome:     nomeVal,
        email:    emailVal,
        telefone: telDigits,
        page:     location.href,
        utm:      getUTM(),
        website:  form.elements.website ? form.elements.website.value : ''
      };

      const btnTxt = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

      // Se o servidor falhar ou demorar, a pessoa vai para o WhatsApp do mesmo jeito.
      const ctrl = new AbortController();
      const abortTO = setTimeout(() => ctrl.abort(), 5000);

      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        signal: ctrl.signal
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(abortTO);
        if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
        const waMsg = msgTemplate(nomeVal, telDigits);
        const waURL = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMsg)}`;
        trackAndGo(waURL);
      });
    });
  }

  document.querySelectorAll('form[data-lead]').forEach(setupLeadForm);

  // ---- Modal do formulário: CTAs e botão flutuante ----
  const leadModal = document.getElementById('lead-modal');
  let lastFocus = null;

  function openLeadModal() {
    if (!leadModal) return;
    lastFocus = document.activeElement;
    leadModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const first = leadModal.querySelector('input[name="nome"]');
    if (first) setTimeout(() => first.focus(), 50);
  }

  function closeLeadModal() {
    if (!leadModal) return;
    leadModal.classList.remove('open');
    document.body.style.overflow = 'auto';
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll('[data-open-lead]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openLeadModal(); });
  });

  if (leadModal) {
    leadModal.addEventListener('click', e => {
      if (e.target === leadModal || e.target.closest('[data-close-lead]')) closeLeadModal();
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && leadModal.classList.contains('open')) closeLeadModal();
    });
  }
})();
