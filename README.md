# User-Agent Switcher

A basic Manifest V3 extension for Chrome and Firefox. Choose a desktop or mobile preset, enter a custom User-Agent, and turn the override on or off from the toolbar popup. It changes the `User-Agent` request header for HTTP and HTTPS requests; it does not change browser-identification APIs exposed to webpages.

***This extension has not been tested for Firefox or Firefox Mobile**

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…**.
3. Select `manifest.firefox.json` in this folder.

Firefox's temporary add-on is removed when the browser closes. For a permanent install, package and sign the extension through Mozilla Add-ons.

## Use in Firefox for Android

The Firefox manifest declares Android support starting at Firefox 128. To install on a regular Firefox for Android release, the add-on needs to be signed and distributed through Mozilla Add-ons. For development, connect the device with USB debugging enabled and run `web-ext run -t firefox-android` from this folder, or use Firefox Nightly/Beta's custom add-on collection workflow.

Open the extension from Firefox's Extensions menu to change the preset or toggle the override. Open **Settings** from the popup to configure domains, presets, or display preferences. Reload open pages after changing settings.
