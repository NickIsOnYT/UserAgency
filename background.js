const extensionApi = globalThis.browser ?? globalThis.chrome;
const STATE_KEYS = ["userAgent", "allowList", "invertAllowList", "siteSettings"];

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isAutoActive(hostname, domains, inverted) {
  if (!domains.length) {
    return false;
  }
  const listed = domains.some((domain) => domainMatches(hostname, domain));
  return inverted ? !listed : listed;
}

function addDomainRules(rules, nextRuleId, domains, action, priority) {
  if (!domains.length) {
    return nextRuleId;
  }

  rules.push({
    id: nextRuleId++,
    priority,
    action,
    condition: {
      urlFilter: "|http",
      requestDomains: domains,
      resourceTypes: ["main_frame"]
    }
  });
  rules.push({
    id: nextRuleId++,
    priority,
    action,
    condition: {
      urlFilter: "|http",
      initiatorDomains: domains
    }
  });
  return nextRuleId;
}

async function syncUserAgentRule() {
  const state = await extensionApi.storage.local.get(STATE_KEYS);
  const userAgent = typeof state.userAgent === "string" ? state.userAgent.trim() : "";
  const domains = Array.isArray(state.allowList)
    ? [...new Set(state.allowList.filter((domain) => typeof domain === "string" && domain))]
    : [];
  const inverted = state.invertAllowList === true;
  const siteSettings = state.siteSettings && typeof state.siteSettings === "object"
    ? state.siteSettings
    : {};
  const rules = [];
  let nextRuleId = 1;
  const headerAction = {
    type: "modifyHeaders",
    requestHeaders: [{
      header: "user-agent",
      operation: "set",
      value: userAgent
    }]
  };

  if (userAgent && !/[\u0000-\u001f\u007f]/.test(userAgent)) {
    if (domains.length && inverted) {
      rules.push({
        id: nextRuleId++,
        priority: 1,
        action: headerAction,
        condition: { urlFilter: "|http" }
      });
      nextRuleId = addDomainRules(rules, nextRuleId, domains, { type: "allow" }, 2);
    } else if (domains.length) {
      nextRuleId = addDomainRules(rules, nextRuleId, domains, headerAction, 1);
    }

    const overridesByPriority = new Map();
    for (const [hostname, settings] of Object.entries(siteSettings)) {
      if (!settings || typeof settings.enabled !== "boolean") {
        continue;
      }
      const autoActive = isAutoActive(hostname, domains, inverted);
      if (settings.enabled === autoActive) {
        continue;
      }
      const priority = 100 + hostname.split(".").length;
      const group = overridesByPriority.get(priority) ?? { active: [], inactive: [] };
      group[settings.enabled ? "active" : "inactive"].push(hostname);
      overridesByPriority.set(priority, group);
    }

    for (const [priority, group] of overridesByPriority) {
      nextRuleId = addDomainRules(rules, nextRuleId, group.active, headerAction, priority);
      nextRuleId = addDomainRules(rules, nextRuleId, group.inactive, { type: "allow" }, priority);
    }
  }

  const existingRules = await extensionApi.declarativeNetRequest.getDynamicRules();
  await extensionApi.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRules.map((rule) => rule.id),
    addRules: rules
  });
}

let syncQueue = Promise.resolve();

function scheduleSync() {
  syncQueue = syncQueue
    .then(syncUserAgentRule)
    .catch((error) => console.error("Could not update User-Agent rules:", error));
}

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && STATE_KEYS.some((key) => key in changes)) {
    scheduleSync();
  }
});

extensionApi.runtime.onStartup.addListener(() => {
  scheduleSync();
});

extensionApi.runtime.onInstalled.addListener(() => {
  scheduleSync();
});

scheduleSync();
