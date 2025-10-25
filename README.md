# Infoblock Filter for SillyTavern

## Project Overview
Infoblock Filter is a SillyTavern client extension that trims older `<infoblock>` sections from your chat history before it is sent to a model connector. By stripping everything except the most recent infoblock, it helps reduce token usage while keeping the freshest metadata intact. The extension installs lightweight fetch/XMLHttpRequest interceptors and hooks into SillyTavern's generation entry points to make sure filtering happens both when chats are submitted and when they are prepared for formatting.

## Installation & Enabling
1. Download or clone this repository into your SillyTavern `extensions` directory (e.g. `SillyTavern/extensions/ST-Infoblock`).
2. Launch SillyTavern and open **Settings → Extensions**.
3. Locate **Infoblock Filter** in the list and press **Enable**. SillyTavern will load the bundled `index.js` and `style.css` files.
4. The extension automatically adds its controls under the Extensions tab once it finishes initializing.

> **Tip:** If you update the files manually, use the **Reload Extensions** button inside SillyTavern to pick up the latest changes.

## What the Infoblock Filter Does
- Scans outbound request payloads (REST `fetch`/`XMLHttpRequest`) for messages containing `<infoblock>` tags.
- Removes every infoblock except the newest one detected in the history before a request is sent to the API.
- Temporarily strips older infoblocks from `window.chat` right before generation and restores the untouched conversation afterward.

### UI Controls
- **Enable Infoblock Filter** – master toggle that turns filtering on/off without unloading the extension.
- **Test Filter** button – runs a built-in scenario that confirms old infoblocks are removed while the latest is preserved. Results appear in the status line and in the browser console.
- **Status Indicator** – displays `Active` (green) when filtering is running or `Disabled` (amber) when it is turned off.

## Configuration Options
| Option | Description |
| --- | --- |
| Enable toggle | Checkbox that instantly activates/deactivates all fetch/XHR and pre-format hooks. State resets to enabled each time SillyTavern loads the extension. |
| Test button | Executes a sample conversation to verify filtering and surfaces a pass/fail message along with console diagnostics. |

## Compatibility & Caveats
- Designed for the modern SillyTavern extension framework (client builds from mid-2023 onward). Earlier versions that lack the Extensions settings panel may not load the UI.
- Works with API connectors that accept standard SillyTavern message arrays containing `mes` or `content` fields. Custom connectors that transform payloads before the extension runs may bypass the filter.
- Only trims well-formed `<infoblock>` HTML tags. If models or scripts emit custom metadata outside that pattern, it will be left untouched.
- The extension does not persist configuration across sessions; re-enable it if the toggle is turned off and SillyTavern reloads.

## Attribution & Support
Created by [sulaljuhani](https://github.com/sulaljuhani). For updates, changelogs, and issue tracking visit the project repository: <https://github.com/sulaljuhani/ST-Infoblock>.

## License
This project is distributed under the MIT License. Refer to the repository for the complete license text and any future updates.
