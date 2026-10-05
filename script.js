// 1. Подсветка активной ссылки в меню
const page = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll("nav a").forEach(a => {
  if (a.getAttribute("href") === page) a.classList.add("active");
});

// 2. Мягкое свечение, следующее за курсором
addEventListener("pointermove", e => {
  document.body.style.setProperty("--mx", e.clientX + "px");
  document.body.style.setProperty("--my", e.clientY + "px");
});

// 3. Фильтр проектов
const chips = document.querySelectorAll(".chip");
chips.forEach(chip => chip.addEventListener("click", () => {
  chips.forEach(c => c.classList.remove("on"));
  chip.classList.add("on");
  const cat = chip.dataset.cat;
  document.querySelectorAll(".project").forEach(p => {
    p.hidden = cat !== "all" && p.dataset.cat !== cat;
  });
}));

// 4. Форма контактов: проверка полей
const form = document.querySelector("form");
if (form) form.addEventListener("submit", e => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("input,textarea").forEach(f => {
    const err = f.parentElement.querySelector(".err");
    let msg = "";
    if (!f.value.trim()) msg = "Заполните это поле";
    else if (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value)) msg = "Введите email в формате name@site.com";
    err.textContent = msg;
    if (msg) valid = false;
  });
  const status = form.querySelector(".status");
  if (valid) { status.textContent = "Сообщение отправлено. Отвечу в течение двух дней."; form.reset(); }
  else status.textContent = "";
});
