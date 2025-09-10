const track = document.getElementById("carousel-track");
const container = document.getElementById("carousel-container");

let speed = 1.75;
let currentX = 0;

// Lê as imagens originais (só dos primeiros 6)
const imageElements = Array.from(track.children).slice(0, track.children.length / 2);
const images = imageElements.map(imgDiv => imgDiv.querySelector('img').src);

const totalSlides = images.length;

// ----- Dots -----
const dotsContainer = document.getElementById("carousel-dots");
dotsContainer.innerHTML = '';
for (let i = 0; i < totalSlides; i++) {
  const dot = document.createElement("span");
  dot.classList.add("carousel-dot");
  if (i === 0) dot.classList.add("active");
  dot.addEventListener("click", () => {
    scrollToSlide(i);
    updateDots(i);
    // Se o modal estiver aberto, muda a imagem do modal também
    if (modal.style.display === "flex") {
      showModal(i);
    }
  });
  dotsContainer.appendChild(dot);
}
const dots = document.querySelectorAll(".carousel-dot");

// Atualiza os dots ativos
function updateDots(idx) {
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === idx);
  });
}

// Centraliza no slide correto (slide original, nunca nos duplicados)
function scrollToSlide(idx) {
  const slideWidth = track.children[0].offsetWidth;
  currentX = -slideWidth * idx;
  track.style.transform = `translateX(${currentX}px)`;
}

// ---- Carrossel infinito + Dots automáticos ----
function animate() {
  const slideWidth = track.children[0].offsetWidth;
  const slideCount = track.children.length / 2; // só os originais
  const resetPoint = -(slideWidth * slideCount);

  currentX -= speed;

  if (currentX <= resetPoint) {
    currentX = 0;
  }

  track.style.transform = `translateX(${currentX}px)`;

  // Dot amarelo sempre sincronizado com o centro
  let centerIndex = Math.round(Math.abs(currentX) / slideWidth) % totalSlides;
  if (centerIndex < 0) centerIndex += totalSlides;
  updateDots(centerIndex);

  requestAnimationFrame(animate);
}

track.addEventListener("mouseenter", () => speed = 0.5);
track.addEventListener("mouseleave", () => speed = 1.75);

animate();

// ---- MODAL ----
const modal = document.getElementById("modal");
const modalImage = document.getElementById("modal-image");
let currentIndex = 0;

// Clique nas imagens abre o modal correto
imageElements.forEach((imgDiv, idx) => {
  imgDiv.querySelector('img').addEventListener("click", () => {
    currentIndex = idx;
    showModal(currentIndex);
  });
});

// Também funciona se clicar em uma imagem duplicada:
Array.from(track.children).forEach(imgDiv => {
  imgDiv.querySelector('img').addEventListener("click", (e) => {
    // Sempre abre o índice do slide original (pelo data-index ou pelo src)
    const src = e.target.src;
    const idx = images.indexOf(src);
    currentIndex = idx !== -1 ? idx : 0;
    showModal(currentIndex);
  });
});

function showModal(index) {
  modalImage.src = images[index];
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  updateDots(index);
}

function closeModal() {
  modal.style.display = "none";
  document.body.style.overflow = "auto";
}

function prevImage() {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  modalImage.src = images[currentIndex];
  updateDots(currentIndex);
}

function nextImage() {
  currentIndex = (currentIndex + 1) % images.length;
  modalImage.src = images[currentIndex];
  updateDots(currentIndex);
}

// Fecha modal com ESC
window.addEventListener('keydown', (e) => {
  if (e.key === "Escape") closeModal();
});
