TEMPLE OF ARTEMIS LEUKOPHRYENE - VR TOUR (WebXR, three.js r187)            v1, 10 Nov 2026

WHAT IT IS
  Four 360 viewpoints (Court W, Pteron SW, Cella, East). Gold rings mark 12 reconstructed elements.
  Select a ring -> dark studio, the element floats under studio light, with its text and sources.
  Plan: bottom-left on a screen; on the floor under your feet in VR (point at a gold dot to move).

CONTROLS
  Quest 3:  point + trigger (or pinch) = select | in the studio: hold trigger and twist = turn the object,
            thumbstick left/right = turn, up/down = zoom, grip = back to the temple | in the panorama: grip = plan on/off
  Screen:   drag = look / turn, wheel or pinch = zoom, Esc = back

PUT IT ONLINE (needed for the headset: WebXR needs https)
  GitHub Pages (free): new public repository -> "Add file > Upload files" -> drag the CONTENTS of this folder
  (index.html at the top level; upload in two or three batches if the browser complains) -> Commit ->
  Settings > Pages > Branch: main, folder / (root) > Save. After 1-2 min: https://<user>.github.io/<repo>/
  Any static host works the same way (Netlify, Cloudflare Pages).

OFFLINE BACKUP FOR THE DEFENCE
  Open the online page once in the Quest browser with internet and press "Save for offline use" (about 40 MB
  on the Quest: 8K panoramas). After that the page opens and runs in that browser without internet.

TEST ON THE PC (screen only)
  serve_local.bat (needs Python) then open http://localhost:8000  - or any local web server in this folder.
  Opening index.html by double-click does NOT work (browsers block modules from file://).

FILES
  data/panoramas.json  viewpoints, marker directions (u,v of the equirect), heading
  data/objects.json    texts, sources, evidence levels (edit here; no code change needed)
  models/*.glb         studio models (meshopt-compressed, metres, front = +Z)
  panos/               8K (headset, desktop) and 4K (phones) equirect renders
  #pano=Cella / #obj=statue at the end of the URL opens a viewpoint / an element directly.
