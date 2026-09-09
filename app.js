(() => {
  "use strict";

  const els = {
    img: document.getElementById("page-img"),
    stage: document.getElementById("page-stage"),
    viewer: document.querySelector(".viewer"),
    input: document.getElementById("page-input"),
    total: document.getElementById("page-total"),
    prev: document.getElementById("prev-btn"),
    next: document.getElementById("next-btn"),
    zoom: document.getElementById("zoom-btn"),
    menu: document.getElementById("menu-btn"),
    sidebar: document.getElementById("sidebar"),
    scrim: document.getElementById("sidebar-scrim"),
    toc: document.getElementById("toc"),
    thumbs: document.getElementById("thumbs"),
    zonePrev: document.getElementById("zone-prev"),
    zoneNext: document.getElementById("zone-next"),
    installToast: document.getElementById("install-toast"),
    installYes: document.getElementById("install-yes"),
    installNo: document.getElementById("install-no"),
  };

  let DATA = { totalPages: 54, sections: [] };
  let current = 1;

  function pad(n) { return String(n).padStart(2, "0"); }
  function pageSrc(n) { return `assets/pages/page-${pad(n)}.jpg`; }
  function thumbSrc(n) { return `assets/thumbs/page-${pad(n)}.jpg`; }

  function groupOf(page) {
    // Determine which colored section a page belongs to, for the legend dot.
    const sections = DATA.sections;
    let g = "Sommaire";
    for (const s of sections) {
      if (page >= s.page) g = s.group; else break;
    }
    return g;
  }
  function dotClassFor(group) {
    if (group === "Enfants (0–14 ans)") return "enfants";
    if (group === "Adultes") return "adultes";
    if (group === "Autres produits de santé") return "autres";
    return "sommaire";
  }

  function render(page, { push = true, scrollThumb = true } = {}) {
    current = Math.min(Math.max(1, page), DATA.totalPages);
    els.img.src = pageSrc(current);
    els.img.alt = `Page ${current} sur ${DATA.totalPages}`;
    els.input.value = current;
    els.viewer.classList.remove("zoomed");
    els.viewer.scrollTop = 0;

    document.querySelectorAll(".toc-item").forEach(b =>
      b.classList.toggle("active", Number(b.dataset.page) === current));
    document.querySelectorAll(".thumb").forEach(t => {
      const active = Number(t.dataset.page) === current;
      t.classList.toggle("active", active);
      if (active && scrollThumb) t.scrollIntoView({ block: "nearest" });
    });

    if (push) {
      const url = new URL(location.href);
      url.searchParams.set("p", current);
      history.replaceState(null, "", url);
    }
  }

  function buildTOC() {
    const groups = {};
    DATA.sections.forEach(s => {
      groups[s.group] = groups[s.group] || [];
      groups[s.group].push(s);
    });
    els.toc.innerHTML = "";
    Object.entries(groups).forEach(([group, items]) => {
      const h = document.createElement("div");
      h.className = "toc-group";
      h.textContent = group;
      els.toc.appendChild(h);
      items.forEach(s => {
        const b = document.createElement("button");
        b.className = "toc-item";
        b.dataset.page = s.page;
        b.innerHTML = `<span class="toc-dot ${dotClassFor(s.group)}"></span><span>${s.label}</span>`;
        b.addEventListener("click", () => {
          render(s.page);
          closeSidebarOnMobile();
        });
        els.toc.appendChild(b);
      });
    });
  }

  function buildThumbs() {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= DATA.totalPages; i++) {
      const b = document.createElement("button");
      b.className = "thumb";
      b.dataset.page = i;
      b.setAttribute("aria-label", `Page ${i}`);
      b.innerHTML = `<img src="${thumbSrc(i)}" loading="lazy" alt=""><span>${i}</span>`;
      b.addEventListener("click", () => {
        render(i);
        closeSidebarOnMobile();
      });
      frag.appendChild(b);
    }
    els.thumbs.appendChild(frag);
  }

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 860) {
      els.sidebar.classList.remove("open");
      els.scrim.hidden = true;
      els.menu.setAttribute("aria-expanded", "false");
    }
  }

  // Navigation controls
  els.prev.addEventListener("click", () => render(current - 1));
  els.next.addEventListener("click", () => render(current + 1));
  els.input.addEventListener("change", () => render(Number(els.input.value) || 1));
  els.zonePrev.addEventListener("click", () => render(current - 1));
  els.zoneNext.addEventListener("click", () => render(current + 1));

  els.img.addEventListener("click", () => els.viewer.classList.toggle("zoomed"));

  els.menu.addEventListener("click", () => {
    const open = els.sidebar.classList.toggle("open");
    els.scrim.hidden = !open;
    els.menu.setAttribute("aria-expanded", String(open));
  });
  els.scrim.addEventListener("click", closeSidebarOnMobile);

  document.addEventListener("keydown", (e) => {
    if (document.activeElement === els.input) return;
    if (e.key === "ArrowRight") render(current + 1);
    if (e.key === "ArrowLeft") render(current - 1);
    if (e.key === "Escape") closeSidebarOnMobile();
  });

  // Basic swipe support on the page image
  let touchX = null;
  els.stage.addEventListener("touchstart", (e) => {
    if (els.viewer.classList.contains("zoomed")) return;
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  els.stage.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) render(current + (dx < 0 ? 1 : -1));
    touchX = null;
  }, { passive: true });

  // Load data, then boot
  fetch("assets/pages.json")
    .then(r => r.json())
    .then(data => {
      DATA = data;
      els.total.textContent = `/ ${DATA.totalPages}`;
      els.input.max = DATA.totalPages;
      buildTOC();
      buildThumbs();
      const params = new URLSearchParams(location.search);
      const startPage = Number(params.get("p")) || 1;
      render(startPage, { push: false });
    })
    .catch(() => {
      // Fallback if pages.json fails to load
      els.total.textContent = "/ 54";
      render(1, { push: false });
    });

  // Service worker registration (enables offline + "install as app")
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  // Custom install prompt
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem("lnme-install-dismissed")) {
      els.installToast.hidden = false;
    }
  });
  els.installYes.addEventListener("click", async () => {
    els.installToast.hidden = true;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });
  els.installNo.addEventListener("click", () => {
    els.installToast.hidden = true;
    localStorage.setItem("lnme-install-dismissed", "1");
  });
})();
