// Galeria de fotos e vídeos — itens vêm de /galeria/galeria.json
(function () {
  const grid = document.getElementById("galeria-grid");
  const btnMais = document.getElementById("galeria-mais");
  const lb = document.getElementById("lightbox");
  if (!grid || !lb) return;

  const midia = document.getElementById("lightbox-midia");
  const legenda = document.getElementById("lightbox-legenda");
  const contador = document.getElementById("lightbox-contador");
  const filtros = document.querySelectorAll(".galeria__filtros [data-filtro]");

  const POR_PAGINA = () => 9;
  let itens = [];
  let filtro = "todos";
  let visiveis = 0;
  let lista = [];      // itens do filtro atual (navegação do lightbox)
  let atual = 0;
  let origemFoco = null;

  fetch("/galeria/galeria.json")
    .then((r) => r.json())
    .then((dados) => { itens = dados; aplicarFiltro("todos"); })
    .catch(() => { grid.closest(".galeria").hidden = true; });

  function aplicarFiltro(f) {
    filtro = f;
    lista = itens.filter((it) => f === "todos" || it.cat === f);
    filtros.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.filtro === f)));
    grid.innerHTML = "";
    visiveis = 0;
    mostrarMais();
  }

  function mostrarMais() {
    // mantém as linhas completas: o destaque ocupa 2x2
    let n = POR_PAGINA();
    if (window.innerWidth < 768) n = visiveis === 0 && filtro === "todos" && lista[0]?.destaque ? 7 : 6;
    const fim = Math.min(lista.length, visiveis + n);
    for (let i = visiveis; i < fim; i++) grid.appendChild(criarTile(lista[i], i));
    visiveis = fim;
    btnMais.hidden = visiveis >= lista.length;
  }

  function criarTile(it, i) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "galeria__item" + (it.destaque && filtro === "todos" ? " galeria__item--destaque" : "") +
      (it.tipo === "video" ? " galeria__item--video" : "");
    b.dataset.i = i;
    b.setAttribute("aria-label", (it.tipo === "video" ? "Assistir vídeo: " : "Ampliar foto: ") + it.alt);
    const img = document.createElement("img");
    img.src = it.thumb || it.capa;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 600; img.height = 600;
    b.appendChild(img);
    if (it.tipo === "video") {
      const p = document.createElement("span");
      p.className = "galeria__play";
      p.innerHTML = '<i class="bi bi-play-fill"></i>';
      b.appendChild(p);
    }
    return b;
  }

  // --- Lightbox ---
  function abrir(i) {
    origemFoco = document.activeElement;
    lb.hidden = false;
    document.documentElement.classList.add("lightbox-aberto");
    mostrar(i);
    lb.querySelector("[data-lb=fechar]").focus();
  }

  function fechar() {
    midia.innerHTML = "";
    lb.hidden = true;
    document.documentElement.classList.remove("lightbox-aberto");
    if (origemFoco) origemFoco.focus();
  }

  function mostrar(i) {
    atual = (i + lista.length) % lista.length;
    const it = lista[atual];
    midia.innerHTML = "";
    let el;
    if (it.tipo === "video") {
      el = document.createElement("video");
      el.src = it.src;
      el.poster = it.capa;
      el.controls = true;
      el.autoplay = true;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.preload = "auto";
    } else {
      el = document.createElement("img");
      el.src = it.src;
      el.alt = it.alt;
      el.decoding = "async";
    }
    midia.appendChild(el);
    legenda.textContent = it.alt;
    contador.textContent = `${atual + 1} / ${lista.length}`;
    // pré-carrega as fotos vizinhas
    [atual + 1, atual - 1].forEach((j) => {
      const v = lista[(j + lista.length) % lista.length];
      if (v && v.tipo === "foto") new Image().src = v.src;
    });
  }

  grid.addEventListener("click", (e) => {
    const t = e.target.closest(".galeria__item");
    if (t) abrir(Number(t.dataset.i));
  });
  btnMais.addEventListener("click", mostrarMais);
  filtros.forEach((b) => b.addEventListener("click", () => aplicarFiltro(b.dataset.filtro)));

  lb.addEventListener("click", (e) => {
    const acao = e.target.closest("[data-lb]")?.dataset.lb;
    if (acao === "fechar") fechar();
    else if (acao === "ant") mostrar(atual - 1);
    else if (acao === "prox") mostrar(atual + 1);
    else if (e.target === lb || e.target === midia) fechar(); // clique no fundo
  });

  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") fechar();
    else if (e.key === "ArrowLeft") mostrar(atual - 1);
    else if (e.key === "ArrowRight") mostrar(atual + 1);
  });

  // swipe no celular
  let x0 = null;
  midia.addEventListener("touchstart", (e) => {
    x0 = e.target.tagName === "VIDEO" ? null : e.touches[0].clientX; // não atrapalha a barra do vídeo
  }, { passive: true });
  midia.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) mostrar(atual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
