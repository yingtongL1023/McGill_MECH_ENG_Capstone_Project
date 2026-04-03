/**
 * Interactive STL preview (Three.js via dynamic import).
 * If Network shows no .stl request, the module usually failed before loader.load
 * (CDN blocked, adblock, or static import error). Dynamic import surfaces that in UI.
 */
const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
const STL_LOADER_CDN =
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/STLLoader.js";
const ORBIT_CDN =
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";

function setStatus(statusEl, msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.classList.toggle("is-error", isError);
  if (!isError && msg === "") {
    statusEl.classList.add("is-hidden");
  }
}

async function initStlViewer() {
  const container = document.getElementById("stl-viewport");
  const statusEl = document.getElementById("stl-status");

  if (!container) {
    console.warn("stl-viewer: #stl-viewport not found");
    return;
  }

  if (window.location.protocol === "file:") {
    setStatus(
      statusEl,
      "This preview cannot load the STL when you open the HTML file directly (file://). Start a local server instead — e.g. VS Code “Live Server”, or npx serve . — then open http://localhost:…",
      true
    );
    return;
  }

  setStatus(statusEl, "Loading 3D engine (Three.js from CDN)…");

  let THREE;
  let STLLoader;
  let OrbitControls;
  try {
    THREE = await import(THREE_CDN);
    const stlMod = await import(STL_LOADER_CDN);
    const orbitMod = await import(ORBIT_CDN);
    STLLoader = stlMod.STLLoader;
    OrbitControls = orbitMod.OrbitControls;
  } catch (e) {
    console.error("stl-viewer: CDN import failed (STL request never starts):", e);
    setStatus(
      statusEl,
      "Could not load Three.js from the CDN (jsdelivr). Check the Console (F12). Common causes: ad blocker, corporate firewall, or offline. Unblocking cdn.jsdelivr.net fixes this — no .stl line will appear in Network until this succeeds.",
      true
    );
    return;
  }

  const stlUrl = container.dataset.stlUrl || "STL_Model/aorta_model.stl";
  const resolvedStlUrl = new URL(stlUrl, document.baseURI).href;
  console.info("[stl-viewer] resolved STL URL:", resolvedStlUrl);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1520);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.insertBefore(renderer.domElement, container.firstChild);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 0.75;
  controls.minDistance = 0.1;
  controls.maxDistance = 800;

  const hemi = new THREE.HemisphereLight(0xc8e8f0, 0x1a2530, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(4, 8, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x2dd4bf, 0.35);
  fill.position.set(-6, 2, -4);
  scene.add(fill);

  function frameObject(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);

    controls.target.copy(center);

    const dist = maxDim * 2.2;
    camera.position.set(center.x + dist * 0.75, center.y + dist * 0.45, center.z + dist * 0.9);
    camera.near = Math.max(maxDim / 200, 0.01);
    camera.far = maxDim * 50;
    camera.updateProjectionMatrix();

    controls.minDistance = maxDim * 0.08;
    controls.maxDistance = maxDim * 12;
    controls.update();
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < 2 || h < 2) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  resize();
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(container);
  }

  setStatus(statusEl, "Loading aorta_model.stl…");
  console.info("[stl-viewer] starting FileLoader for:", resolvedStlUrl);

  const loader = new STLLoader();
  loader.load(
    resolvedStlUrl,
    (geometry) => {
      geometry.computeVertexNormals();
      geometry.center();

      const material = new THREE.MeshStandardMaterial({
        color: 0x3dd4c4,
        metalness: 0.12,
        roughness: 0.48,
        flatShading: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      frameObject(mesh);
      setStatus(statusEl, "");
    },
    undefined,
    (err) => {
      console.error("stl-viewer: STL load error", resolvedStlUrl, err);
      setStatus(
        statusEl,
        "STL request failed. URL: " +
          resolvedStlUrl +
          " — Open this URL in a new tab; if 404, fix path or GitHub Pages source. If CDN errors appeared first, fix those (see Console).",
        true
      );
    }
  );

  function tick() {
    requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  }
  tick();
}

initStlViewer().catch((e) => {
  console.error("stl-viewer: unexpected error", e);
  const el = document.getElementById("stl-status");
  if (el) {
    el.textContent =
      "3D viewer stopped: " + (e && e.message ? e.message : String(e)) + " — see Console (F12).";
    el.classList.add("is-error");
  }
});
