# User-Agent Switcher

A basic Manifest V3 extension for Chrome and Firefox. Choose a desktop or mobile preset, enter a custom User-Agent, and use the toolbar popup to enable either override for the current site. The request-header override changes HTTP and HTTPS requests. The separate webpage override changes `navigator.userAgent` on matching pages.

The extension requests access to all sites so it can apply the chosen header and optionally set `navigator.userAgent` on matching pages. With an empty settings list, each site's overrides default to off and can be enabled from the popup; a non-empty list sets the default per site.

| Tested on | Status | Extension version |
|-|-|-|
| [Google Chrome 156.0.8078.74](https://www.google.com/chrome/) | Works | v2.0 |
| [Mozilla Firefox 159.0](https://www.firefox.com/) | Works | v2.0 |
| [Waterfox 6.7.7](https://www.waterfox.com/) | Works | v2.0 |
|[Waterfox for Android 1.2.10](https://play.google.com/store/apps/details?id=net.waterfox.android.release)|Works|v2.0|


## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…**.
3. Run `.\build-firefox.ps1` from this folder.
4. Select `firefox-build\manifest.json`.

Firefox's temporary add-on is removed when the browser closes. To install it indefinitely please scroll below the `Use in Waterfox for Android` section

## Load in Waterfox (does not require signing)

1. Open `about:addons`.
2. Click the small cog, then `install addon from file`.
3. Run `.\build-firefox.ps1` from this folder.
4. Zip the contents of the `firefox-build` folder.
5. Select the zip file in Waterfox.

## Use in Firefox for Android (untested)

1. Run `.\build-firefox.ps1`,
2. Connect the device with USB debugging enabled. 
3. Run `web-ext run -t firefox-android` from the generated `firefox-build` folder,

Open the extension from Firefox's Extensions menu to change the preset or toggles. Open **Settings** from the popup to configure domains, presets, or display preferences. Reload open pages after changing presets.

## Use in Waterfox for Android (doesn't require signing)

1. Run `.\build-firefox.ps1`.
2. Zip the contents of the `firefox-build` folder  
.
3. Transfer the zip file to your phone.
4. Open the `about:config` page
2. Search for: `xpinstall.signatures.required` & `extensions.langpacks.signatures.required` and toggle the settings to False. 
3. Open settings and click `install extension from file`, find the zip file you transfered to your phone and import it
pen the extension from Firefox's Extensions menu to change the preset or toggles. Open **Settings** from the popup to configure domains, presets, or display preferences. Reload open pages after changing presets.

## Advanced section for Firefox users
***Note: this only works on [Firefox ESR](https://www.firefox.com/en-CA/enterprise/), [Firefox Developer](https://www.firefox.com/en-CA/channel/desktop/developer/) & [Firefox Nightly](https://nightly.mozilla.org/)**

1. Open the `about:config` page
2. Search for: `xpinstall.signatures.required` & `extensions.langpacks.signatures.required` and toggle the settings to False. 
3. Open `about:addons`.
2. Click the small cog, then `install addon from file`.
3. Run `.\build-firefox.ps1` from this folder.
4. Zip the contents of the `firefox-build` folder.
5. Select the zip file in Firefox.