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

const API_BASE_URL = "https://mindscope-nx7y.onrender.com/api/auth";
const currentPage = window.location.pathname.split("/").pop() || "index.html";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "null");
  } catch (error) {
    return null;
  }
};

const saveStoredUser = (user) => {
  if (!user) {
    localStorage.removeItem("authUser");
    return;
  }

  localStorage.setItem(
    "authUser",
    JSON.stringify({
      id: user._id || user.id,
      email: user.email,
      name: user.name || "",
      isNewUser: Boolean(user.isNewUser),
      hasCompletedCheckIn: Boolean(user.hasCompletedCheckIn),
      checkpoints: user.checkpoints || [],
      streak: user.streak || 0,
      last_score: user.last_score || 0,
      preference: user.preference || "Weekly",
      emailReminder: user.emailReminder !== false,
      trend: user.trend || [],
    })
  );
};

const getAuthToken = () => localStorage.getItem("authToken");

const redirectToLogin = () => {
  if (currentPage !== "login.html") {
    navigateWithTransition("./login.html");
  }
};

const redirectToFirstCheckIn = () => {
  if (currentPage !== "form.html" && currentPage !== "login.html") {
    navigateWithTransition("./form.html");
  }
};

const enforceCheckInAccess = async () => {
  const token = getAuthToken();
  const storedUser = getStoredUser();
  const requiresAccount = currentPage === "profile.html" || currentPage === "form.html";

  if (requiresAccount && !token) {
    redirectToLogin();
    return null;
  }

  if (token && storedUser && storedUser.hasCompletedCheckIn === false) {
    redirectToFirstCheckIn();
    return storedUser;
  }

  if (!token || currentPage === "login.html") {
    return storedUser;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("authToken");
        saveStoredUser(null);
        redirectToLogin();
        return null;
      }

      throw new Error("Unable to refresh user");
    }

    const user = await response.json();
    saveStoredUser(user);

    if (!user.hasCompletedCheckIn) {
      redirectToFirstCheckIn();
    }

    return user;
  } catch (error) {
    return storedUser;
  }
};

const userReady = enforceCheckInAccess();

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

      const response = await fetch(`${API_BASE_URL}/authenticate`, {
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
      saveStoredUser(data);
      navigateWithTransition(data.hasCompletedCheckIn ? "./profile.html" : "./form.html");
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

  const collectCheckInResponses = () => {
    const responses = {};

    Array.from(referenceForm.querySelectorAll(".question-block")).forEach((block) => {
      const label = block.querySelector(".question-label");
      const field = block.querySelector("select, textarea, input");

      if (!label || !field) {
        return;
      }

      if (!field.matches("[data-user-name]")) {
        responses[label.textContent.trim()] = field.type === "range" ? Number(field.value) : field.value.trim();
      }
    });

    return responses;
  };

  const getCheckInName = () => {
    const nameField = referenceForm.querySelector("[data-user-name]");
    return nameField ? nameField.value.trim() : "";
  };

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

  referenceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = getAuthToken();

    if (!token) {
      redirectToLogin();
      return;
    }

    const originalButtonText = sheetSubmitButton.textContent;

    try {
      sheetSubmitButton.disabled = true;
      sheetSubmitButton.textContent = "Saving...";

      const response = await fetch(`${API_BASE_URL}/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: getCheckInName(),
          responses: collectCheckInResponses(),
        }),
      });

      const user = await response.json();

      if (!response.ok) {
        throw new Error(user.error || "Unable to save check-in");
      }

      saveStoredUser(user);
      navigateWithTransition("./profile.html");
    } catch (error) {
      window.alert(error.message);
      sheetSubmitButton.disabled = false;
      sheetSubmitButton.textContent = originalButtonText;
    }
  });

  setActiveSheet(0);
  updateSubmitState();
}

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const renderProfile = (user) => {
  if (!user || currentPage !== "profile.html") {
    return;
  }

  const heading = document.querySelector("[data-profile-heading]");
  const streak = document.querySelector("[data-profile-streak]");
  const score = document.querySelector("[data-profile-score]");
  const preference = document.querySelector("[data-profile-preference]");
  const timeline = document.querySelector("[data-profile-timeline]");
  const preferenceSelect = document.querySelector("[data-preference-select]");
  const emailReminder = document.querySelector("[data-email-reminder]");

  if (heading && (user.name || user.email)) {
    heading.textContent = `Welcome, ${user.name || user.email}`;
  }

  if (streak) {
    const count = Number(user.streak || 0);
    streak.textContent = `${count} ${count === 1 ? "session" : "sessions"}`;
  }

  if (score) {
    score.textContent = `${Number(user.last_score || 0)} / 100`;
  }

  if (preference) {
    preference.textContent = `${user.preference || "Weekly"} prompts`;
  }

  if (preferenceSelect) {
    preferenceSelect.value = user.preference || "Weekly";
  }

  if (emailReminder) {
    emailReminder.checked = user.emailReminder !== false;
  }

  if (timeline) {
    const checkpoints = Array.isArray(user.checkpoints) ? user.checkpoints.slice(-3).reverse() : [];

    timeline.innerHTML = checkpoints.length
      ? checkpoints
          .map(
            (checkpoint) => `
              <div class="timeline-item">
                <span class="timeline-dot"></span>
                <div>
                  <h3>${formatDate(checkpoint)}</h3>
                </div>
              </div>
            `
          )
          .join("")
      : "<p>No check-ins submitted yet.</p>";
  }
};

userReady.then(renderProfile);

const preferencesForm = document.querySelector("[data-preferences-form]");

if (preferencesForm) {
  preferencesForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = getAuthToken();
    const preferenceSelect = preferencesForm.querySelector("[data-preference-select]");
    const emailReminder = preferencesForm.querySelector("[data-email-reminder]");
    const submitButton = preferencesForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : "";

    if (!token) {
      redirectToLogin();
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
      }

      const response = await fetch(`${API_BASE_URL}/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preference: preferenceSelect ? preferenceSelect.value : "Weekly",
          emailReminder: emailReminder ? emailReminder.checked : true,
        }),
      });

      const user = await response.json();

      if (!response.ok) {
        throw new Error(user.error || "Unable to save preferences");
      }

      saveStoredUser(user);
      renderProfile(user);
    } catch (error) {
      window.alert(error.message);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}
