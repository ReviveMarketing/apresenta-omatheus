/* ============================================
   Globo 3D · Three.js
   Estilo Google Earth — textura realista + atmosfera
   ============================================ */

const Globe = {
  instances: {},

  // Texturas (NASA Blue Marble, hospedadas em CDN público)
  TEXTURE_EARTH: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
  TEXTURE_EARTH_FALLBACK: 'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
  TEXTURE_BUMP: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
  TEXTURE_CLOUDS: 'https://unpkg.com/three-globe@2.31.1/example/img/clouds.png',

  init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (this.instances[canvasId]) {
      this.handleResize(canvasId);
      return this.instances[canvasId];
    }

    const container = canvas.parentElement;
    const width = Math.max(container.clientWidth, 100);
    const height = Math.max(container.clientHeight, 100);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Iluminação
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x00ff9d, 0.25);
    rim.position.set(-5, -2, -3);
    scene.add(rim);

    const earth = new THREE.Group();
    scene.add(earth);

    // ===== Esfera principal ===== //
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const sphereGeo = new THREE.SphereGeometry(1, 96, 96);

    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x0d2333,
      shininess: 25,
      specular: 0x114455
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    earth.add(sphere);

    // Carrega textura com fallback automático
    const tryLoad = (urls, onSuccess) => {
      const url = urls.shift();
      if (!url) return;
      loader.load(
        url,
        (tex) => {
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          onSuccess(tex);
        },
        undefined,
        () => { if (urls.length) tryLoad(urls, onSuccess); }
      );
    };

    tryLoad(
      [this.TEXTURE_EARTH, this.TEXTURE_EARTH_FALLBACK],
      (tex) => {
        sphereMat.map = tex;
        sphereMat.color.setHex(0xffffff);
        sphereMat.needsUpdate = true;
      }
    );

    loader.load(
      this.TEXTURE_BUMP,
      (tex) => {
        sphereMat.bumpMap = tex;
        sphereMat.bumpScale = 0.015;
        sphereMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    // ===== Atmosfera (glow tipo Google Earth) ===== //
    const atmGeo = new THREE.SphereGeometry(1.12, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
          vec3 col = mix(vec3(0.25, 0.55, 1.0), vec3(0.0, 1.0, 0.6), 0.15);
          gl_FragColor = vec4(col, 1.0) * intensity * 0.8;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // ===== Camada de nuvens ===== //
    const cloudGeo = new THREE.SphereGeometry(1.012, 64, 64);
    const cloudMat = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    earth.add(clouds);
    loader.load(
      this.TEXTURE_CLOUDS,
      (tex) => {
        cloudMat.map = tex;
        cloudMat.alphaMap = tex;
        cloudMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    // ===== Marcadores ===== //
    const markersGroup = new THREE.Group();
    earth.add(markersGroup);

    // Rotação inicial: Brasil em destaque
    earth.rotation.y = degToRad(-15);
    earth.rotation.x = degToRad(8);

    // ===== Interação ===== //
    const interaction = {
      isDragging: false,
      previousMouseX: 0,
      previousMouseY: 0,
      autoRotate: true
    };

    const onDown = (x, y) => {
      interaction.isDragging = true;
      interaction.autoRotate = false;
      interaction.previousMouseX = x;
      interaction.previousMouseY = y;
    };
    const onMove = (x, y) => {
      if (!interaction.isDragging) return;
      const dx = x - interaction.previousMouseX;
      const dy = y - interaction.previousMouseY;
      earth.rotation.y += dx * 0.005;
      earth.rotation.x += dy * 0.005;
      earth.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, earth.rotation.x));
      interaction.previousMouseX = x;
      interaction.previousMouseY = y;
    };
    const onUp = () => { interaction.isDragging = false; };

    canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onUp);

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', onUp);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camera.position.z = Math.max(1.6, Math.min(6, camera.position.z + e.deltaY * 0.002));
    }, { passive: false });

    window.addEventListener('resize', () => this.handleResize(canvasId));

    // ===== Loop ===== //
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      if (interaction.autoRotate && !interaction.isDragging) {
        earth.rotation.y += 0.0008;
      }
      clouds.rotation.y += 0.0003;

      markersGroup.children.forEach(marker => {
        if (marker.userData.isPulse) {
          const phase = (elapsed * 1.5 + (marker.userData.phaseOffset || 0)) % 2;
          const scale = 1 + phase * 1.6;
          const opacity = Math.max(0, 0.65 - phase * 0.32);
          marker.scale.setScalar(scale);
          marker.material.opacity = opacity;
        }
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    this.instances[canvasId] = {
      scene, camera, renderer, earth, markersGroup, interaction, container, canvas
    };
    return this.instances[canvasId];
  },

  handleResize(canvasId) {
    const inst = this.instances[canvasId];
    if (!inst) return;
    const w = Math.max(inst.container.clientWidth, 100);
    const h = Math.max(inst.container.clientHeight, 100);
    inst.camera.aspect = w / h;
    inst.camera.updateProjectionMatrix();
    inst.renderer.setSize(w, h);
  },

  updateMarkers(canvasId, points) {
    const inst = this.instances[canvasId];
    if (!inst) return;
    const { markersGroup } = inst;

    while (markersGroup.children.length) {
      const m = markersGroup.children[0];
      markersGroup.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }

    const grouped = {};
    points.forEach(p => {
      if (!p.lat || !p.lng) return;
      const key = `${p.lat.toFixed(2)}_${p.lng.toFixed(2)}`;
      if (!grouped[key]) {
        grouped[key] = { lat: p.lat, lng: p.lng, count: 0, value: 0, types: { digital: 0, referral: 0 } };
      }
      grouped[key].count++;
      grouped[key].value += Number(p.value || 0);
      grouped[key].types[p.type] = (grouped[key].types[p.type] || 0) + 1;
    });

    Object.values(grouped).forEach((g, idx) => {
      const pos = latLngToVec3(g.lat, g.lng, 1.005);
      const isDigitalDominant = g.types.digital >= g.types.referral;
      const color = isDigitalDominant ? 0x00ff9d : 0xffb547;
      const baseSize = 0.014 + Math.min(0.025, g.count * 0.003);

      const pointGeo = new THREE.SphereGeometry(baseSize, 16, 16);
      const pointMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const point = new THREE.Mesh(pointGeo, pointMat);
      point.position.copy(pos);
      markersGroup.add(point);

      const ringGeo = new THREE.SphereGeometry(baseSize, 16, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.userData.isPulse = true;
      ring.userData.phaseOffset = (idx * 0.31) % 2;
      markersGroup.add(ring);

      const beamHeight = 0.06 + Math.min(0.18, g.count * 0.018);
      const beamGeo = new THREE.CylinderGeometry(0.0015, baseSize * 0.55, beamHeight, 8);
      const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(pos);
      beam.position.multiplyScalar(1 + beamHeight / 2);
      beam.lookAt(pos.clone().multiplyScalar(2));
      beam.rotateX(Math.PI / 2);
      markersGroup.add(beam);
    });
  }
};

// ===== Helpers ===== //
function degToRad(d) { return d * Math.PI / 180; }

function latLngToVec3(lat, lng, radius = 1) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}
