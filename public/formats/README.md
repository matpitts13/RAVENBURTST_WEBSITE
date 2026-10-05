# Academic format specs

The app's **Help → Check for Format Updates…** reads `apa.json` and `mla.json`
from `https://ravenburst.com/formats/`.

To publish a new spec (for example when a style guide changes):

1. Edit `spec` in the file.
2. Change `specVersion` to a new value. The app offers an update whenever the
   published `specVersion` differs from what the user has, so never reuse one.
3. Deploy the site (`npm run deploy`).

The versions built into the current app release are `apa-7-2019.1` and
`mla-9-2021.1` (see `BUILT_IN_VERSION` in the app's `electron/ipc/formats.ipc.ts`);
keep these files on those versions until there is a real change to ship.
Applying an update replaces any edits the user made in Preferences → Academic.
