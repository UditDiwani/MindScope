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
  demoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const emailField = demoForm.querySelector('input[type="email"]');
    const submitButton = demoForm.querySelector('button[type="submit"]');
    const email = emailField ? emailField.value.trim() : "";
    const password = passwordField ? passwordField.value : "";

    if (!email || !password) {
      return;
    }

    const originalButtonText = submitButton ? submitButton.textContent : "";

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Signing in...";
      }

      const response = await fetch("http://localhost:3000/api/auth/authenticate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in");
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem(
        "authUser",
        JSON.stringify({ id: data._id, email: data.email, isNewUser: data.isNewUser })
      );
      navigateWithTransition(data.isNewUser ? "./form.html" : "./profile.html");
    } catch (error) {
      window.alert(error.message);

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}

const bgFrame = document.querySelector("[data-bg-frame-animation]");

if (bgFrame) {
  const frameCount = Number(bgFrame.dataset.frameCount) || 36;
  const framePath = "./assets/images/BG-animation-frames";
  const frameRate = 12;
  const frameDuration = 1000 / frameRate;
  const frameImages = Array.from({ length: frameCount }, (_, index) => {
    const image = new Image();
    image.src = `${framePath}/frame_${String(index).padStart(3, "0")}.png`;
    return image;
  });
  let activeFrame = 0;
  let lastFrameTime = 0;

  const animateBgFrame = (timestamp) => {
    if (timestamp - lastFrameTime >= frameDuration) {
      activeFrame = (activeFrame + 1) % frameCount;
      bgFrame.src = frameImages[activeFrame].src;
      lastFrameTime = timestamp;
    }

    window.requestAnimationFrame(animateBgFrame);
  };

  window.requestAnimationFrame(animateBgFrame);
}

const formWindow = document.querySelector("[data-form-window]");
const formWindowShell = document.querySelector("[data-form-window-shell]");
const referenceForm = document.querySelector(".reference-form");
const minimizeWindowButton = document.querySelector("[data-window-minimize]");
const restoreWindowButton = document.querySelector("[data-window-restore]");
const closeWindowButton = document.querySelector("[data-window-close]");
const questionSheets = Array.from(document.querySelectorAll("[data-question-sheet]"));
const sheetTabs = Array.from(document.querySelectorAll("[data-sheet-tab]"));
const sheetBackButton = document.querySelector("[data-sheet-back]");
const sheetNextButton = document.querySelector("[data-sheet-next]");
const sheetSubmitButton = document.querySelector("[data-sheet-submit]");

if (formWindow && minimizeWindowButton && restoreWindowButton && closeWindowButton) {
  const setMinimizedState = (isMinimized) => {
    formWindow.classList.toggle("is-minimized", isMinimized);
    if (formWindowShell) {
      formWindowShell.classList.toggle("is-minimized-shell", isMinimized);
    }
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

if (questionSheets.length && sheetTabs.length && sheetBackButton && sheetNextButton && sheetSubmitButton) {
  let activeSheet = 0;

  const formFields = referenceForm
    ? Array.from(referenceForm.querySelectorAll("select, textarea, input"))
    : [];

  const updateSubmitState = () => {
    const isComplete = formFields.every((field) => {
      if (field.type === "range") {
        return field.value !== "";
      }

      return field.value.trim() !== "";
    });

    sheetSubmitButton.disabled = !isComplete;
    sheetSubmitButton.classList.toggle("is-locked", !isComplete);
    sheetSubmitButton.setAttribute("aria-disabled", isComplete ? "false" : "true");
  };

  const setActiveSheet = (index) => {
    activeSheet = Math.max(0, Math.min(index, questionSheets.length - 1));

    questionSheets.forEach((sheet, sheetIndex) => {
      const isActive = sheetIndex === activeSheet;
      sheet.classList.toggle("is-active", isActive);
      sheet.hidden = !isActive;
    });

    sheetTabs.forEach((tab, tabIndex) => {
      const isActive = tabIndex === activeSheet;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    sheetBackButton.disabled = activeSheet === 0;
    sheetNextButton.hidden = activeSheet === questionSheets.length - 1;
    sheetSubmitButton.hidden = activeSheet !== questionSheets.length - 1;

    if (referenceForm) {
      referenceForm.scrollTop = 0;
    }
  };

  formFields.forEach((field) => {
    field.addEventListener("input", updateSubmitState);
    field.addEventListener("change", updateSubmitState);
  });

  sheetTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      setActiveSheet(index);
    });
  });

  sheetBackButton.addEventListener("click", () => {
    setActiveSheet(activeSheet - 1);
  });

  sheetNextButton.addEventListener("click", () => {
    setActiveSheet(activeSheet + 1);
  });

  setActiveSheet(0);
  updateSubmitState();
}
