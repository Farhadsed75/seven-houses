# Seven Houses — free iPhone app (PWA)

This is a **progressive web app** designed for iPhone. It installs to your Home Screen using Safari, with no App Store or Apple Developer account. Once opened online, it works offline. Your flashcards stay in local storage on your device; they are not uploaded to GitHub.

## Get it on your iPhone (free)

1. Make a free GitHub account at https://github.com/ (if you do not already have one).
2. Create a **public** repository called `seven-houses`. In the repository's **Add file → Upload files** menu, upload the **contents of this folder**, not the ZIP and not a nested folder. Commit the upload.
3. Open the repository's **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**. Choose `main` and `/(root)`, then **Save**.
4. Open the resulting HTTPS site in **Safari on your iPhone**. Typically the address is `https://YOUR-USERNAME.github.io/seven-houses/`. It may take a moment for GitHub Pages to publish.
5. In Safari, tap the **Share** menu (on some iOS versions: Page Menu then Share), then **Add to Home Screen**, make sure **Open as Web App** is enabled, and tap **Add**.
6. Open **Seven Houses** from your Home Screen and add your words. After the initial online load, the app works without internet.

**Important:** GitHub Pages on a free plan publishes from a **public repository**. Only upload the app source code and icons, **not your vocabulary backup JSON** if you want your word list to remain private. Words you type into the running app stay on that particular device/browser installation.

## Rules

- Everyday: House **3 → 2 → 1**.
- Friday: additionally House **5 → 4**.
- 25th of each month: additionally House **6**.
- 25th, every two calendar months after a card enters House 7 (or its last review): House **7**.
- **Correct:** 1→2, 2→3, 3→4, 4→5, 5→6, 6→7, 7→7.
- **Incorrect:** 1→1, 2→1, 3→1, 4→1, 5→1, 6→4, 7→4.
- The prompt is **Persian only**. Enter an English answer; the comparison is exact after trimming, converting case, and collapsing extra whitespace.
- **First Enter:** automatically grade. **Second Enter:** advance. You can instead tap **Check answer** and **Next word**.
- Skipping sends a card to the end of the current queue without grading.
- Cards already graded today are not asked again today, even if you close and reopen the app. Progress persists.
- Uses **the local calendar of your iPhone**; no server clock or timezone dependency.

## Managing and backing up words

- Search by Persian or English, edit translations/house assignments, and delete word pairs.
- Dashboard shows remaining due / total in each house.
- **Export JSON backup** provides a file accepted by the original Python dataclass (`leitner_words.json` format).
- **Import JSON backup** accepts that Python format or a data object with a `cards` array. Duplicates are skipped, and existing cards are preserved.
- After exporting, use the browser's Files / Save to Files menu to keep the file somewhere safe (ideally iCloud Drive). **Regular backups are important:** uninstalling a web app or clearing web data can remove its saved words.
- Avoid entering cards in the Safari tab before installing the Home Screen app. Depending on iOS storage isolation, the standalone app can use separate website storage. Instead, install first and enter your words in the Home Screen app.

## Files

- `index.html` — mobile UI.
- `styles.css` — responsive iPhone styling.
- `logic.js` — all seven-house scheduling and grading rules.
- `app.js` — session handling, management, storage, backup.
- `sw.js` — offline service worker.
- `manifest.webmanifest` and PNG icons — Home Screen installation.

## Optional local testing on a computer

From this folder:

```bash
python -m http.server 8000
```

Open http://localhost:8000 in a browser. Opening `index.html` directly is not enough to test service-worker caching.

## Updating the app

Upload changed files to the same GitHub repository. If you change static assets, update `CACHE_NAME` in `sw.js` to a new version (such as `seven-houses-static-v2`) so installed copies update. Keep a JSON backup before making changes.

## Limitations

This is a **Home Screen web app**, not a native App Store `.ipa`. It does not sync words across devices automatically or send scheduled push alerts. Its offline availability relies on the browser's cached web assets. Export backups regularly.
