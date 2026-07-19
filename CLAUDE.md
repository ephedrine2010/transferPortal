# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-first single-page web app for registering store-to-store product transfers. A user scans/searches a product barcode against a large local SQLite catalog, then records a transfer (SKU, qty, destination store) into Firebase Firestore, where it syncs in real time and is grouped by month.

## No build system

This is a **pure static site** — no npm, bundler, transpiler, or test suite. There is nothing to build, lint, or compile.

- **Run locally:** serve the folder over HTTP (e.g. `python -m http.server 8000`) and open `index.html`. A plain `file://` open will fail — `sql.js` WASM, the Cache API, `getUserMedia`, and Firebase all require an HTTP(S) origin, ideally over localhost/HTTPS.
- **Camera scanning** needs a secure context (HTTPS or localhost) and a browser with the native `BarcodeDetector` API (Chrome Android 83+, Safari iOS 17.2+).
- Editing a `js/*.js`, `css/styles.css`, or `index.html` file takes effect on page reload — no watch step.

## Script loading model (important)

`index.html` loads two different kinds of scripts, and the ordering is deliberate:

1. **Classic scripts** (`database.js`, `scanner.js`, `nahdi-api.js`, `transfers.js`, `app.js`) — each is an IIFE that assigns a global (`Database`, `Scanner`, `NahdiApi`, `Transfers`, `App`). They call each other directly through these globals.
2. **ES modules** (`firebase-config.js`, `auth.js`) — deferred by nature, so they run *after* the classic scripts. They import Firebase from `gstatic.com` CDN URLs.

The two worlds communicate **only through `window`**:
- `firebase-config.js` sets `window.firebaseAuth`, `window.firestoreDb`, and `window.firestoreFns` (a hand-picked bag of Firestore functions) so the classic `transfers.js` can use Firestore without being a module.
- `auth.js` sets `window.currentAppUser` after login so `transfers.js` can read the user's email.

When adding Firestore functionality to `transfers.js`, any new Firestore SDK function must first be imported in `firebase-config.js` and added to the `window.firestoreFns` object — `transfers.js` cannot import it directly.

## Boot sequence

The app does **not** auto-start. Flow:
1. `auth.js`'s `onAuthStateChanged` fires. No user → show login screen.
2. Login uses a Store ID + Emp ID, deterministically mapped to Firebase email/password credentials: `email = storeId + empId + "@cashfollowup.com"`, `password = storeId + empId` (see `convertIdsToCredentials`). There is no separate password.
3. On successful auth, `showApp()` calls `App.init()` **once**, which loads the DB, inits the scanner/modal, and starts the Firestore listener.

## Core data flows

**Product lookup (`database.js`):** `localDB.db` (~40 MB SQLite) is fetched once, streamed with a progress bar, then stored in the Cache API (`localdb-cache-v1`) so later visits load instantly. It's queried in-browser via `sql.js` (WASM from CDN). Search hits the `localmaster` table and branches on barcode **length** (9 → try `sku` then `barcode`; 10–13 → `barcode`; >13 → `gtin`); long raw scans are trimmed via `extractBarcode` (`substring(2,16)`). Price is computed with VAT: `item_price * (vat + 100) / 100`. This length-based logic is a port of a Dart reference implementation — preserve its branches when editing.
  - **To force clients to re-download an updated `localDB.db`, bump the cache name** `CACHE_NAME` in `database.js` (currently `'localdb-cache-v1'`); otherwise stale copies persist in the Cache API.

**Transfers (`transfers.js`):** the single source of truth is Firestore, at collection path **`{storeCode}/transfers/{YYYYMM}`**, where `storeCode` is the **first 4 characters of the user's email** and `YYYYMM` is the selected month. `onSnapshot` drives a full re-render on every change (real-time, multi-device). Month/year navigation just re-points the listener at a different `YYYYMM` path. Records carry `transferDone`, `imageUrl`, and a `serverTimestamp()` used only for client-side sort. Export is CSV (hand-rolled, labeled "Excel"); print uses `window.print()` with print CSS.

**Product images (`nahdi-api.js`):** thumbnails come from the Nahdi Online public API, fetched **through public CORS proxies** (`corsproxy.io`, then `allorigins.win` as fallback) because the API sends no CORS headers. Responses vary in shape, so `extractImageUrl` tries known field names then recursively deep-searches. Results are cached in memory per session and de-duplicated per in-flight SKU. The resolved `imageUrl` is stored on the transfer record so it survives without re-fetching.

## Conventions

- Classic-script modules use the **revealing-module (IIFE) pattern** with `var`, ES5-style loops, and a `return { ... }` public API. Match this style in those files. `auth.js`/`firebase-config.js` are ES modules and use `import`/`const`.
- UI is rendered by building **HTML strings** and assigning `innerHTML`, then attaching listeners by querying the freshly-inserted nodes (event delegation via `data-*` attributes). There is no framework or reactive layer.
- All DOM ids/classes live in `index.html`; JS reaches them by `getElementById`. Keep ids in sync across both.

## Notable characteristics to be aware of

- Firebase config and the project (`cashfollowup`) are **shared with a sibling "cashFollowup" project**; auth and Firestore live in the same project. The `@cashfollowup.com` email domain and shared `apiKey` are intentional, not a copy-paste mistake.
- `localDB.db` is committed to the repo (large binary). Treat it as a data asset, not source.
