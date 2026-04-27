const initTheme = () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeButton(savedTheme);
  updateThemeImages(savedTheme);
};

const updateThemeButton = (theme) => {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = theme === "dark" ? "\u2600" : "\u263e";
    button.dataset.themeState = theme;
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    button.setAttribute(
      "title",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  });
};

const updateThemeImages = (theme) => {
  document.querySelectorAll("[data-theme-image]").forEach((image) => {
    const imageSource = theme === "dark" ? image.dataset.darkSrc : image.dataset.lightSrc;

    if (imageSource && image.getAttribute("src") !== imageSource) {
      image.setAttribute("src", imageSource);
    }
  });
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeButton(newTheme);
  updateThemeImages(newTheme);
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const transitionDuration = 280;

const isInternalPageLink = (link) => {
  if (!link.href || link.target || link.hasAttribute("download")) {
    return false;
  }

  const destination = new URL(link.href, window.location.href);

  return (
    destination.origin === window.location.origin &&
    destination.pathname !== window.location.pathname
      ? true
      : destination.pathname === window.location.pathname && destination.search !== window.location.search
  );
};

const navigateWithTransition = (href) => {
  if (prefersReducedMotion) {
    window.location.href = href;
    return;
  }

  document.body.classList.add("is-page-exiting");
  window.setTimeout(() => {
    window.location.href = href;
  }, transitionDuration);
};

window.addEventListener("pageshow", () => {
  document.body.classList.remove("is-page-exiting");

  if (!prefersReducedMotion) {
    document.body.classList.add("is-transition-ready");
  }
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a");

  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  if (!isInternalPageLink(link)) {
    return;
  }

  event.preventDefault();
  navigateWithTransition(link.href);
});

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", toggleTheme);
});

initTheme();

const toggleButton = document.querySelector("[data-toggle-password]");
const passwordField = document.querySelector("#password-field");

if (toggleButton && passwordField) {
  toggleButton.addEventListener("click", () => {
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";
    toggleButton.textContent = isPassword ? "Hide" : "Show";
  });
}

const demoForm = document.querySelector("[data-demo-form]");

if (demoForm) {
  demoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    navigateWithTransition("./profile.html");
  });
}

const formWindow = document.querySelector("[data-form-window]");
const minimizeWindowButton = document.querySelector("[data-window-minimize]");
const restoreWindowButton = document.querySelector("[data-window-restore]");
const closeWindowButton = document.querySelector("[data-window-close]");

if (formWindow && minimizeWindowButton && restoreWindowButton && closeWindowButton) {
  const setMinimizedState = (isMinimized) => {
    formWindow.classList.toggle("is-minimized", isMinimized);
    minimizeWindowButton.disabled = isMinimized;
    restoreWindowButton.disabled = !isMinimized;
  };

  setMinimizedState(false);

  minimizeWindowButton.addEventListener("click", () => {
    setMinimizedState(true);
  });

  restoreWindowButton.addEventListener("click", () => {
    setMinimizedState(false);
  });

  closeWindowButton.addEventListener("click", () => {
    navigateWithTransition("./profile.html");
  });
}
