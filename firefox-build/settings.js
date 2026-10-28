const extensionApi = globalThis.browser ?? globalThis.chrome;
const MAX_DOMAINS = 100;

const darkModeInput = document.querySelector("#dark-mode");
const domainForm = document.querySelector("#domain-form");
const domainInput = document.querySelector("#domain-input");
const invertAllowListInput = document.querySelector("#invert-allow-list");
const domainList = document.querySelector("#domain-list");
const domainEmpty = document.querySelector("#domain-empty");
const hideDefaultPresetsInput = document.querySelector("#hide-default-presets");
const presetForm = document.querySelector("#preset-form");
const presetNameInput = document.querySelector("#preset-name");
const presetUserAgentInput = document.querySelector("#preset-user-agent");
const presetList = document.querySelector("#preset-list");
const presetEmpty = document.querySelector("#preset-empty");
const message = document.querySelector("#message");

let domains = [];
let customPresets = [];

function showError(error) {
  message.textContent = error instanceof Error ? error.message : String(error);
}

function makeItem(text, buttonText, onClick, detail) {
  const item = document.createElement("li");
  item.className = "item-row";
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = text;
  content.append(title);
  if (detail) {
    const userAgent = document.createElement("details");
    const summary = document.createElement("summary");
    const value = document.createElement("pre");
    summary.textContent = "View User-Agent";
    value.className = "user-agent-value";
    value.textContent = detail;
    userAgent.append(summary, value);
    content.append(userAgent);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = buttonText;
  button.addEventListener("click", onClick);
  item.append(content, button);
  return item;
}

function renderDomains() {
  domainList.replaceChildren();
  for (const domain of domains) {
    domainList.append(makeItem(domain, "Remove", () => {
      domains = domains.filter((item) => item !== domain);
      save({ allowList: domains });
    }));
  }
  domainEmpty.hidden = domains.length > 0;
}

function renderPresets() {
  presetList.replaceChildren();
  for (const preset of customPresets) {
    presetList.append(makeItem(preset.name, "Remove", () => {
      customPresets = customPresets.filter((item) => item.id !== preset.id);
      save({ customPresets });
    }, preset.userAgent));
  }
  presetEmpty.hidden = customPresets.length > 0;
}

async function save(values) {
  message.textContent = "";
  try {
    await extensionApi.storage.local.set(values);
    renderDomains();
    renderPresets();
  } catch (error) {
    showError(error);
  }
}

function normalizeDomain(input) {
  const value = input.trim();
  if (!value || value.includes("*")) {
    throw new Error("Enter a domain such as example.com, without wildcards or paths.");
  }
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  let url;
  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    throw new Error("That does not look like a valid domain.");
  }
  if (
    !["http:", "https:"].includes(url.protocol)
    || url.username
    || url.password
    || url.port
    || url.pathname !== "/"
    || url.search
    || url.hash
    || !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(url.hostname)
  ) {
    throw new Error("Enter a hostname only, such as example.com, without a path or port.");
  }
  return url.hostname.toLowerCase();
}

domainForm.addEventListener("submit", (event) => {
  event.preventDefault();
  message.textContent = "";
  try {
    const domain = normalizeDomain(domainInput.value);
    if (domains.includes(domain)) {
      throw new Error("That domain is already in the list.");
    }
    if (domains.length >= MAX_DOMAINS) {
      throw new Error(`The list can contain up to ${MAX_DOMAINS} domains.`);
    }
    domains.push(domain);
    domainInput.value = "";
    save({ allowList: domains });
  } catch (error) {
    showError(error);
  }
});

invertAllowListInput.addEventListener("change", () => {
  save({ invertAllowList: invertAllowListInput.checked });
});

hideDefaultPresetsInput.addEventListener("change", () => {
  save({ hideDefaultPresets: hideDefaultPresetsInput.checked });
});

presetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  message.textContent = "";
  const name = presetNameInput.value.trim();
  const userAgent = presetUserAgentInput.value.trim();
  if (!name || !userAgent || /[\u0000-\u001f\u007f]/.test(userAgent)) {
    showError(new Error("Enter a preset name and a valid User-Agent string without control characters."));
    return;
  }
  customPresets.push({
    id: crypto.randomUUID(),
    name,
    userAgent
  });
  presetNameInput.value = "";
  presetUserAgentInput.value = "";
  save({ customPresets });
});

darkModeInput.addEventListener("change", () => {
  document.body.classList.toggle("dark-mode", darkModeInput.checked);
  save({ darkMode: darkModeInput.checked });
});

async function initialize() {
  try {
    const state = await extensionApi.storage.local.get([
      "allowList",
      "invertAllowList",
      "customPresets",
      "hideDefaultPresets",
      "darkMode"
    ]);
    domains = Array.isArray(state.allowList) ? state.allowList : [];
    customPresets = Array.isArray(state.customPresets) ? state.customPresets : [];
    invertAllowListInput.checked = state.invertAllowList === true;
    hideDefaultPresetsInput.checked = state.hideDefaultPresets === true;
    darkModeInput.checked = state.darkMode === true;
    document.body.classList.toggle("dark-mode", darkModeInput.checked);
    document.querySelector("#default-user-agent").textContent = navigator.userAgent;
    renderDomains();
    renderPresets();
  } catch (error) {
    showError(error);
  }
}

initialize();
