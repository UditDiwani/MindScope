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

// Treat file:// and common local hostnames as local frontend (use local API)
const isLocalFrontend = location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);
const API_ROOT_URL = isLocalFrontend ? "http://127.0.0.1:3000/api" : "https://mindscope-nx7y.onrender.com/api";
const API_BASE_URL = `${API_ROOT_URL}/auth`;
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
  const requiresAccount = currentPage === "profile.html" || currentPage === "form.html" || currentPage === "ml-insight.html";

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
const ML_FEATURE_KEYS = [
  "degree_level",
  "study_mode",
  "funding_status",
  "program_year",
  "weekly_hours",
  "supervisor_freq",
  "caregiving",
  "productivity_index",
  "coping_index",
  "stressor_index",
];

const getMlFeaturePayload = (responses) => {
  return ML_FEATURE_KEYS.reduce((payload, key) => {
    payload[key] = Number(responses[key]);
    return payload;
  }, {});
};

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
        const responseKey = field.name || label.textContent.trim();
        const shouldUseNumber = field.type === "range" || field.type === "number" || field.dataset.numeric === "true";
        responses[responseKey] = shouldUseNumber ? Number(field.value) : field.value.trim();
      }
    });

    return responses;
  };

  const getCheckInName = () => {
    const nameField = referenceForm.querySelector("[data-user-name]");
    return nameField ? nameField.value.trim() : "";
  };

  const updateSubmitState = () => {
    const requiredFields = formFields.filter((field) => field.required);
    const isComplete = requiredFields.every((field) => {
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

      const responses = collectCheckInResponses();
      const response = await fetch(`${API_BASE_URL}/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: getCheckInName(),
          responses,
        }),
      });

      const user = await response.json();

      if (!response.ok) {
        throw new Error(user.error || "Unable to save check-in");
      }

      saveStoredUser(user);
      await generateAndStoreLatestInsight(responses);
      navigateWithTransition("./ml-insight.html");
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

const formatCompactDate = (value) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

const getRecentTrendPoints = (user) => {
  const scores = Array.isArray(user.trend)
    ? user.trend.map(Number).filter(Number.isFinite).slice(-5)
    : [];
  const checkpoints = Array.isArray(user.checkpoints) ? user.checkpoints.slice(-5) : [];
  const offset = Math.max(0, checkpoints.length - scores.length);

  return scores.map((score, index) => ({
    score: Math.round(clampScore(score)),
    label: checkpoints[index + offset] ? formatCompactDate(checkpoints[index + offset]) : `Check-in ${index + 1}`,
  }));
};

const getTrendState = (points) => {
  if (points.length < 2) {
    return {
      key: "baseline",
      title: "Baseline established",
      note: points.length ? "One score recorded. More check-ins will show direction." : "Submit a check-in to start tracking your pattern.",
      status: "Need more data",
    };
  }

  const firstScore = points[0].score;
  const lastScore = points[points.length - 1].score;
  const delta = lastScore - firstScore;

  if (delta <= -5) {
    return {
      key: "declining",
      title: "Declining health alert",
      note: `${Math.abs(delta)} point drop across recent check-ins.`,
      status: "Declining",
    };
  }

  if (delta >= 5) {
    return {
      key: "improving",
      title: "Improving well-being",
      note: `${delta} point gain across recent check-ins.`,
      status: "Improving",
    };
  }

  return {
    key: "steady",
    title: "Steady well-being arc",
    note: "Recent scores are staying within a stable range.",
    status: "Steady",
  };
};

const renderTrendCard = (points) => {
  const trendTitle = document.querySelector("[data-profile-trend-title]");
  const trendNote = document.querySelector("[data-profile-trend-note]");
  const trendImage = document.querySelector("[data-profile-trend-image]");
  const accentCard = trendTitle ? trendTitle.closest(".accent-card") : null;
  const state = getTrendState(points);

  if (trendTitle) {
    trendTitle.textContent = state.title;
  }

  if (trendNote) {
    trendNote.textContent = state.note;
  }

  if (accentCard) {
    accentCard.dataset.trendState = state.key;
  }

  if (trendImage) {
    trendImage.style.display = state.key === "declining" ? "none" : "";
  }

  if (accentCard) {
    const existingAlert = accentCard.querySelector("[data-trend-alert-mark]");

    if (state.key === "declining") {
      if (!existingAlert) {
        const alertMark = document.createElement("div");
        alertMark.className = "trend-alert-mark";
        alertMark.dataset.trendAlertMark = "true";
        alertMark.setAttribute("aria-label", "Declining trend warning");
        alertMark.textContent = "!";
        accentCard.appendChild(alertMark);
      }
    } else if (existingAlert) {
      existingAlert.remove();
    }
  }
};

const renderTrendChart = (points) => {
  const chart = document.querySelector("[data-profile-trend-chart]");
  const svg = document.querySelector("[data-profile-trend-svg]");
  const labels = document.querySelector("[data-profile-trend-labels]");
  const emptyState = document.querySelector("[data-profile-trend-empty]");
  const status = document.querySelector("[data-profile-trend-status]");
  const state = getTrendState(points);

  if (!chart || !svg || !labels || !emptyState) {
    return;
  }

  chart.dataset.trendState = state.key;

  if (status) {
    status.textContent = state.status;
  }

  if (!points.length) {
    svg.innerHTML = "";
    labels.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  const width = 480;
  const height = 220;
  const paddingX = 24;
  const paddingY = 24;
  const drawableWidth = width - paddingX * 2;
  const drawableHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1
      ? width / 2
      : paddingX + (drawableWidth * index) / (points.length - 1);
    const y = paddingY + drawableHeight * (1 - point.score / 100);

    return { ...point, x, y };
  });

  const pathData = coordinates.length === 1
    ? ""
    : coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const line = pathData ? `<path d="${pathData}"></path>` : "";
  const circles = coordinates
    .map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5"><title>${point.label}: ${point.score} / 100</title></circle>`)
    .join("");

  svg.innerHTML = `${line}${circles}`;
  labels.style.gridTemplateColumns = `repeat(${points.length}, minmax(0, 1fr))`;
  labels.innerHTML = points
    .map((point) => `<span><strong>${point.score}</strong>${point.label}</span>`)
    .join("");
};

const renderProfileTrend = (user) => {
  const points = getRecentTrendPoints(user);
  renderTrendCard(points);
  renderTrendChart(points);
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
    if (Number(user.last_score) <50){
      score.style.color = "red";
    }
    else if(Number(user.last_score) ==50){
      score.style.color = "yellow";
    } 
    else{
      score.style.color = "green";
    } 
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

  renderProfileTrend(user);

  if (timeline) {
    const checkpoints = Array.isArray(user.checkpoints) ? user.checkpoints.slice(-5).reverse() : [];

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

const getLastCheckInResponses = () => {
  try {
    return JSON.parse(localStorage.getItem("lastCheckInResponses") || "{}");
  } catch (error) {
    return {};
  }
};

const getLatestInsight = () => {
  try {
    return JSON.parse(localStorage.getItem("latestMlInsight") || "null");
  } catch (error) {
    return null;
  }
};

const saveLatestInsight = (insight) => {
  localStorage.setItem("latestMlInsight", JSON.stringify(insight));
};

const getResponseSignature = (responses) => JSON.stringify(responses || {});

const clampScore = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const getLocalSentiment = (responses) => {
  const text = getSentimentText(responses).toLowerCase();
  const positiveWords = ["support", "supported", "cope", "coping", "focused", "calm", "progress", "help", "manageable", "confident", "better"];
  const negativeWords = ["stress", "deadline", "overwhelmed", "anxious", "tired", "hopeless", "pressure", "conflict", "stuck", "difficult"];
  const positive = positiveWords.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0);
  const negative = negativeWords.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0);

  if (!text.trim()) {
    return 0;
  }

  return Number(((positive - negative) / Math.max(positive + negative, 1)).toFixed(3));
};

const getLocalWellbeingScore = (responses) => {
  const copingIndex = Number(responses.coping_index || 3);
  const productivityIndex = Number(responses.productivity_index || 3);
  const stressorIndex = Number(responses.stressor_index || 3);
  const supportAdjustment = (copingIndex - 3) * 10 + (productivityIndex - 3) * 8 - (stressorIndex - 3) * 12;

  return Math.round(clampScore(65 + supportAdjustment));
};

const getFactorContributions = (responses) => {
  const factors = [
    {
      label: "Distress total",
      value: Number(responses.distress_total || 0),
      impact: Number(responses.distress_total || 0) / 88,
      direction: "lower",
    },
    {
      label: "Coping capacity",
      value: Number(responses.coping_index || 0),
      impact: Math.abs(Number(responses.coping_index || 3) - 3) / 2,
      direction: "higher",
    },
    {
      label: "Stressor load",
      value: Number(responses.stressor_index || 0),
      impact: Math.abs(Number(responses.stressor_index || 3) - 3) / 2,
      direction: "lower",
    },
    {
      label: "Productivity",
      value: Number(responses.productivity_index || 0),
      impact: Math.abs(Number(responses.productivity_index || 3) - 3) / 2,
      direction: "higher",
    },
    {
      label: "Supervisor guidance",
      value: Number(responses.supervisor_freq || 0),
      impact: Math.abs(Number(responses.supervisor_freq || 2.5) - 2.5) / 1.5,
      direction: "higher",
    },
  ];

  return factors
    .map((factor) => ({ ...factor, impact: clampScore(factor.impact, 0, 1) }))
    .sort((first, second) => second.impact - first.impact)
    .slice(0, 4);
};

const fetchMlPrediction = async (responses) => {
  try {
    const response = await fetch(`${API_ROOT_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: getMlFeaturePayload(responses) }),
    });

    if (!response.ok) {
      throw new Error("Prediction unavailable");
    }

    return await response.json();
  } catch (error) {
    return null;
  }
};

const getSentimentText = (responses) => {
  const noteText = `${responses.primary_stressor_note || ""} ${responses.coping_support_note || ""}`.trim();

  if (noteText) {
    return noteText;
  }

  return [
    `weekly hours ${responses.weekly_hours || 0}`,
    `stressor ${responses.stressor_index || 0}`,
    `productivity ${responses.productivity_index || 0}`,
    `coping ${responses.coping_index || 0}`,
  ].join(" ");
};

const getStateOfMindLabel = (score) => {
  if (score >= 0.35) {
    return "Positive";
  }

  if (score <= -0.35) {
    return "Strained";
  }

  return "Neutral";
};

const getOverallWellbeingFromPrediction = (prediction) => {
  if (Number.isFinite(Number(prediction.overall_wellbeing))) {
    return Math.round(clampScore(Number(prediction.overall_wellbeing)));
  }

  const stressScore = Number(prediction.pss_score || prediction.stress_score || 0);
  const anxietyScore = Number(prediction.gad7_score || prediction.anxiety_score || 0);
  const depressionScore = Number(prediction.phq9_score || prediction.depression_score || 0);
  const normalizedDistress = (stressScore / 40 + anxietyScore / 21 + depressionScore / 27) / 3;

  return Math.round(clampScore(100 - normalizedDistress * 100));
};

const fetchSentimentScore = async (responses) => {
  const text = getSentimentText(responses);

  try {
    const response = await fetch(`${API_ROOT_URL}/sentiment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error("Sentiment unavailable");
    }

    const sentiment = await response.json();
    return Number(sentiment.compound || 0);
  } catch (error) {
    return getLocalSentiment(responses);
  }
};

const generateAndStoreLatestInsight = async (responses) => {
  const prediction = await fetchMlPrediction(responses);
  const sentiment = await fetchSentimentScore(responses);
  const overallWellbeing = prediction ? getOverallWellbeingFromPrediction(prediction) : getLocalWellbeingScore(responses);
  const enrichedResponses = prediction
    ? {
        ...responses,
        pss_score: prediction.pss_score ?? prediction.stress_score,
        gad7_score: prediction.gad7_score ?? prediction.anxiety_score,
        phq9_score: prediction.phq9_score ?? prediction.depression_score,
        distress_total: prediction.distress_total,
        distress_normalized: prediction.distress_normalized,
        overall_wellbeing: overallWellbeing,
      }
    : responses;
  const insight = {
    generatedAt: new Date().toISOString(),
    responseSignature: getResponseSignature(responses),
    overallWellbeing,
    sentimentScore: sentiment,
    stateOfMind: getStateOfMindLabel(sentiment),
    source: prediction ? "AI Prediction" : "Local Estimate",
    prediction,
    factors: getFactorContributions(enrichedResponses),
  };

  localStorage.setItem("lastCheckInResponses", JSON.stringify(enrichedResponses));
  saveLatestInsight(insight);

  return insight;
};

const getOrCreateLatestInsight = async () => {
  const existingInsight = getLatestInsight();
  const responses = getLastCheckInResponses();

  if (existingInsight && (!Object.keys(responses).length || existingInsight.responseSignature === getResponseSignature(responses))) {
    return existingInsight;
  }

  if (!Object.keys(responses).length) {
    return null;
  }

  return generateAndStoreLatestInsight(responses);
};

const renderInsightSummary = (insight) => {
  const profileScore = document.querySelector("[data-profile-score]");
  const profileAiScore = document.querySelector("[data-profile-ai-score]");
  const profileSentiment = document.querySelector("[data-profile-sentiment]");
  const profileStateScore = document.querySelector("[data-profile-state-score]");
  const profileInsightSource = document.querySelector("[data-profile-insight-source]");

  if (!insight) {
    return;
  }

  if (profileScore) {
    profileScore.textContent = `${insight.overallWellbeing} / 100`;
  }

  if (profileAiScore) {
    profileAiScore.textContent = `${insight.overallWellbeing} / 100`;
  }

  if (profileSentiment) {
    profileSentiment.textContent = insight.stateOfMind;
  }

  if (profileStateScore) {
    profileStateScore.textContent = `${insight.stateOfMind} (${Number(insight.sentimentScore).toFixed(2)})`;
  }

  if (profileInsightSource) {
    profileInsightSource.textContent = insight.source || "Latest Insight";
  }
};

const renderMlInsight = async () => {
  if (currentPage !== "ml-insight.html") {
    return;
  }

  const insight = await getOrCreateLatestInsight();
  const scoreRing = document.querySelector("[data-score-ring]");
  const wellbeingScore = document.querySelector("[data-wellbeing-score]");
  const wellbeingLabel = document.querySelector("[data-wellbeing-label]");
  const sentimentScore = document.querySelector("[data-sentiment-score]");
  const factorToggle = document.querySelector("[data-factor-toggle]");
  const factorPanel = document.querySelector("[data-factor-panel]");
  const factorList = document.querySelector("[data-factor-list]");
  const modelSource = document.querySelector("[data-model-source]");

  if (!insight) {
    if (wellbeingLabel) {
      wellbeingLabel.textContent = "No check-in found";
    }
    return;
  }

  window.setTimeout(() => {
    if (scoreRing) {
      scoreRing.style.setProperty("--score", `${insight.overallWellbeing}%`);
    }

    if (wellbeingScore) {
      wellbeingScore.textContent = insight.overallWellbeing;
    }

    if (wellbeingLabel) {
      wellbeingLabel.textContent = `${insight.overallWellbeing} / 100`;
    }

    if (sentimentScore) {
      sentimentScore.textContent = `${insight.stateOfMind} (${Number(insight.sentimentScore).toFixed(2)})`;
    }

    if (modelSource) {
      modelSource.textContent = insight.source || "Latest Insight";
    }
  }, 2600);

  if (factorList) {
    factorList.innerHTML = (insight.factors || [])
      .map((factor) => {
        const width = Math.max(10, Math.round(factor.impact * 100));
        return `
          <div class="factor-row">
            <div>
              <strong>${factor.label}</strong>
              <span>${factor.direction === "higher" ? "Higher supports score" : "Lower supports score"} - ${factor.value}</span>
            </div>
            <div class="factor-meter" aria-hidden="true">
              <i style="width: ${width}%"></i>
            </div>
          </div>
        `;
      })
      .join("");
  }

  if (factorToggle && factorPanel) {
    factorToggle.addEventListener("click", () => {
      const isHidden = factorPanel.hidden;
      factorPanel.hidden = !isHidden;
      factorToggle.textContent = isHidden ? "Hide Details" : "Show Details";
    });
  }
};

renderMlInsight();

if (currentPage === "profile.html") {
  userReady.then(async () => {
    const insight = await getOrCreateLatestInsight();
    renderInsightSummary(insight);
  });
}

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
