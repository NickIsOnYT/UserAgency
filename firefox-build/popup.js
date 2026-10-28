const extensionApi = globalThis.browser ?? globalThis.chrome;
const presets = globalThis.DEFAULT_USER_AGENT_PRESETS;

const enabledInput = document.querySelector("#enabled");
const spoofNavigatorInput = document.querySelector("#spoof-navigator");
const statusText = document.querySelector("#status");
const spoofStatusText = document.querySelector("#spoof-status");
const scopeStatus = document.querySelector("#scope-status");
const presetInput = document.querySelector("#preset");
const customSection = document.querySelector("#custom-section");
const customUserAgentInput = document.querySelector("#custom-user-agent");
const applyCustomButton = document.querySelector("#apply-custom");
const darkModeInput = document.querySelector("#dark-mode");
const openSettingsButton = document.querySelector("#open-settings");
const message = document.querySelector("#message");

let customPresets = [];
let currentTabDomain = "";
let siteSettings = {};
let popupState = {};

function showPresetFields() {
  customSection.hidden = presetInput.value !== "custom";
}

function addOption(parent, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  parent.append(option);
}

function populatePresets(state) {
  presetInput.replaceChildren();
  const hasSelection = (value) => value === "custom"
    || Object.hasOwn(presets, value)
    || customPresets.some((preset) => `saved:${preset.id}` === value);

  if (state.hideDefaultPresets !== true) {
    const builtInGroup = document.createElement("optgroup");
    builtInGroup.label = "Built-in presets";
    for (const [id, preset] of Object.entries(presets)) {
      addOption(builtInGroup, id, preset.label);
    }
    presetInput.append(builtInGroup);
  }

  if (customPresets.length) {
    const savedGroup = document.createElement("optgroup");
    savedGroup.label = "Saved presets";
    for (const preset of customPresets) {
      addOption(savedGroup, `saved:${preset.id}`, preset.name);
    }
    presetInput.append(savedGroup);
  }

  addOption(presetInput, "custom", "Custom User-Agent");
  const requestedSelection = state.selectedPreset ?? "chrome-windows";
  presetInput.value = hasSelection(requestedSelection)
    ? requestedSelection
    : (state.hideDefaultPresets === true ? "custom" : "chrome-windows");
}

function showError(error) {
  message.textContent = error instanceof Error ? error.message : String(error);
}

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function listDefault(hostname, state) {
  const domains = Array.isArray(state.allowList) ? state.allowList : [];
  if (!domains.length) {
    return false;
  }
  const listed = domains.some((domain) => domainMatches(hostname, domain));
  return state.invertAllowList === true ? !listed : listed;
}

function effectiveSiteSetting(field) {
  const matchingDomains = Object.keys(siteSettings)
    .filter((domain) => domainMatches(currentTabDomain, domain))
    .sort((left, right) => right.length - left.length);

  for (const domain of matchingDomains) {
    const value = siteSettings[domain]?.[field];
    if (typeof value === "boolean") {
      return { enabled: value, manual: true };
    }
  }
  return { enabled: listDefault(currentTabDomain, popupState), manual: false };
}

function renderSiteSettings() {
  const validSite = currentTabDomain.length > 0;
  const header = effectiveSiteSetting("enabled");
  const page = effectiveSiteSetting("spoofNavigator");
  enabledInput.checked = validSite && header.enabled;
  spoofNavigatorInput.checked = validSite && page.enabled;
  enabledInput.disabled = !validSite;
  spoofNavigatorInput.disabled = !validSite;
  statusText.textContent = header.manual
    ? (header.enabled ? "On for this site" : "Off for this site")
    : (header.enabled ? "On by site list" : "Off for this site");
  spoofStatusText.textContent = page.manual
    ? (page.enabled ? "On for this site" : "Off for this site")
    : (page.enabled ? "On by site list" : "Off for this site");
  scopeStatus.textContent = validSite
    ? `These switches apply to ${currentTabDomain} and are saved per site. The allow list sets the default; a switch changes only this site's setting.`
    : "Per-site switches are available on regular HTTP or HTTPS websites.";
}

async function saveState(overrides = {}) {
  const selection = overrides.selectedPreset ?? presetInput.value;
  const customValue = (overrides.customUserAgent ?? customUserAgentInput.value).trim();
  const savedPreset = selection.startsWith("saved:")
    ? customPresets.find((preset) => `saved:${preset.id}` === selection)
    : undefined;
  const userAgent = savedPreset?.userAgent
    ?? (selection === "custom" ? customValue : presets[selection]?.userAgent);
  if (!userAgent || /[\u0000-\u001f\u007f]/.test(userAgent)) {
    throw new Error("Choose a preset or enter a valid User-Agent string without control characters.");
  }

  const state = {
    selectedPreset: selection,
    customUserAgent: customValue,
    userAgent,
    ...overrides
  };
  await extensionApi.storage.local.set(state);
}

async function setSiteSetting(field, value) {
  if (!currentTabDomain) {
    throw new Error("Open a regular website to change its User-Agent setting.");
  }
  const storedState = await extensionApi.storage.local.get("siteSettings");
  const updatedSettings = storedState.siteSettings && typeof storedState.siteSettings === "object"
    ? { ...storedState.siteSettings }
    : {};
  updatedSettings[currentTabDomain] = {
    ...updatedSettings[currentTabDomain],
    [field]: value
  };
  await extensionApi.storage.local.set({ siteSettings: updatedSettings });
}

async function loadCurrentTabDomain() {
  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tabs[0]?.url;
  if (currentUrl) {
    try {
      const url = new URL(currentUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        currentTabDomain = url.hostname.toLowerCase();
      }
    } catch {
      currentTabDomain = "";
    }
  }
}

async function loadState() {
  try {
    popupState = await extensionApi.storage.local.get([
      "selectedPreset",
      "customUserAgent",
      "customPresets",
      "darkMode",
      "hideDefaultPresets",
      "allowList",
      "invertAllowList",
      "siteSettings",
      "enabled",
      "spoofNavigator",
      "siteSettingsMigrated",
      "userAgent"
    ]);

    customPresets = Array.isArray(popupState.customPresets) ? popupState.customPresets : [];
    siteSettings = popupState.siteSettings && typeof popupState.siteSettings === "object"
      ? popupState.siteSettings
      : {};

    if (!popupState.siteSettingsMigrated && currentTabDomain) {
      const legacySettings = {};
      const currentSiteSettings = siteSettings[currentTabDomain] ?? {};
      if (popupState.enabled === true && typeof currentSiteSettings.enabled !== "boolean") {
        legacySettings.enabled = true;
      }
      if (popupState.spoofNavigator === true && typeof currentSiteSettings.spoofNavigator !== "boolean") {
        legacySettings.spoofNavigator = true;
      }
      if (Object.keys(legacySettings).length) {
        siteSettings = { ...siteSettings, [currentTabDomain]: legacySettings };
      }
      await extensionApi.storage.local.set({
        siteSettings,
        siteSettingsMigrated: true
      });
      popupState.siteSettingsMigrated = true;
    }

    let selectedPreset = popupState.selectedPreset ?? "chrome-windows";
    let customUserAgent = popupState.customUserAgent ?? "";
    const savedPresetExists = !selectedPreset.startsWith("saved:")
      || customPresets.some((preset) => `saved:${preset.id}` === selectedPreset);
    const selectedBuiltInIsHidden = popupState.hideDefaultPresets === true
      && Object.hasOwn(presets, selectedPreset);
    if (!savedPresetExists || selectedBuiltInIsHidden) {
      customUserAgent = popupState.userAgent ?? presets[selectedPreset]?.userAgent ?? customUserAgent;
      selectedPreset = "custom";
      const migratedState = { selectedPreset, customUserAgent };
      if (customUserAgent) {
        migratedState.userAgent = customUserAgent;
      }
      await extensionApi.storage.local.set(migratedState);
    }

    populatePresets({ ...popupState, selectedPreset });
    customUserAgentInput.value = customUserAgent;
    darkModeInput.checked = popupState.darkMode === true;
    document.body.classList.toggle("dark-mode", darkModeInput.checked);
    renderSiteSettings();
    showPresetFields();
  } catch (error) {
    showError(error);
  }
}

enabledInput.addEventListener("change", async () => {
  const value = enabledInput.checked;
  message.textContent = "";
  try {
    if (value) {
      await saveState();
    }
    await setSiteSetting("enabled", value);
    siteSettings[currentTabDomain] = {
      ...siteSettings[currentTabDomain],
      enabled: value
    };
    renderSiteSettings();
  } catch (error) {
    enabledInput.checked = !value;
    showError(error);
  }
});

spoofNavigatorInput.addEventListener("change", async () => {
  const value = spoofNavigatorInput.checked;
  message.textContent = "";
  try {
    if (value) {
      await saveState();
    }
    await setSiteSetting("spoofNavigator", value);
    siteSettings[currentTabDomain] = {
      ...siteSettings[currentTabDomain],
      spoofNavigator: value
    };
    renderSiteSettings();
  } catch (error) {
    spoofNavigatorInput.checked = !value;
    showError(error);
  }
});

presetInput.addEventListener("change", async () => {
  message.textContent = "";
  showPresetFields();
  try {
    await saveState();
  } catch (error) {
    showError(error);
  }
});

applyCustomButton.addEventListener("click", async () => {
  const userAgent = customUserAgentInput.value.trim();
  if (!userAgent || /[\u0000-\u001f\u007f]/.test(userAgent)) {
    message.textContent = "Enter a valid custom User-Agent string without control characters.";
    return;
  }

  message.textContent = "";
  try {
    await saveState({ selectedPreset: "custom", customUserAgent: userAgent });
    presetInput.value = "custom";
    showPresetFields();
  } catch (error) {
    showError(error);
  }
});

customUserAgentInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    applyCustomButton.click();
  }
});

darkModeInput.addEventListener("change", async () => {
  document.body.classList.toggle("dark-mode", darkModeInput.checked);
  try {
    await extensionApi.storage.local.set({ darkMode: darkModeInput.checked });
  } catch (error) {
    darkModeInput.checked = !darkModeInput.checked;
    document.body.classList.toggle("dark-mode", darkModeInput.checked);
    showError(error);
  }
});

openSettingsButton.addEventListener("click", () => {
  extensionApi.runtime.openOptionsPage().catch(showError);
});

async function initialize() {
  try {
    await loadCurrentTabDomain();
    await loadState();
  } catch (error) {
    showError(error);
  }
}

initialize();
