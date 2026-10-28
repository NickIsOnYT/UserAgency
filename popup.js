const extensionApi = globalThis.browser ?? globalThis.chrome;
const presets = globalThis.DEFAULT_USER_AGENT_PRESETS;

const enabledInput = document.querySelector("#enabled");
const statusText = document.querySelector("#status");
const presetInput = document.querySelector("#preset");
const customSection = document.querySelector("#custom-section");
const customUserAgentInput = document.querySelector("#custom-user-agent");
const applyCustomButton = document.querySelector("#apply-custom");
const darkModeInput = document.querySelector("#dark-mode");
const openSettingsButton = document.querySelector("#open-settings");
const message = document.querySelector("#message");
let customPresets = [];

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
    enabled: enabledInput.checked,
    selectedPreset: selection,
    customUserAgent: customValue,
    userAgent,
    ...overrides
  };
  await extensionApi.storage.local.set(state);
}

async function loadState() {
  try {
    const state = await extensionApi.storage.local.get([
      "enabled",
      "selectedPreset",
      "customUserAgent",
      "customPresets",
      "darkMode",
      "hideDefaultPresets"
    ]);

    customPresets = Array.isArray(state.customPresets) ? state.customPresets : [];
    let selectedPreset = state.selectedPreset ?? "chrome-windows";
    let customUserAgent = state.customUserAgent ?? "";
    const savedPresetExists = !selectedPreset.startsWith("saved:")
      || customPresets.some((preset) => `saved:${preset.id}` === selectedPreset);
    const selectedBuiltInIsHidden = state.hideDefaultPresets === true
      && Object.hasOwn(presets, selectedPreset);
    if (!savedPresetExists || selectedBuiltInIsHidden) {
      customUserAgent = state.userAgent ?? presets[selectedPreset]?.userAgent ?? customUserAgent;
      selectedPreset = "custom";
      const migratedState = { selectedPreset, customUserAgent };
      if (customUserAgent) {
        migratedState.userAgent = customUserAgent;
      }
      await extensionApi.storage.local.set(migratedState);
    }

    populatePresets({ ...state, selectedPreset });
    enabledInput.checked = state.enabled === true;
    customUserAgentInput.value = customUserAgent;
    darkModeInput.checked = state.darkMode === true;
    document.body.classList.toggle("dark-mode", darkModeInput.checked);
    statusText.textContent = enabledInput.checked ? "On" : "Off";
    showPresetFields();
  } catch (error) {
    showError(error);
  }
}

enabledInput.addEventListener("change", async () => {
  message.textContent = "";
  if (enabledInput.checked && presetInput.value === "custom" && !customUserAgentInput.value.trim()) {
    enabledInput.checked = false;
    message.textContent = "Enter a custom User-Agent string before turning the override on.";
    return;
  }

  statusText.textContent = enabledInput.checked ? "On" : "Off";
  try {
    await saveState();
  } catch (error) {
    enabledInput.checked = !enabledInput.checked;
    statusText.textContent = enabledInput.checked ? "On" : "Off";
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

loadState();
