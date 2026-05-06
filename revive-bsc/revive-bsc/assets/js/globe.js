/* ============================================
   Globo 3D · Three.js
   Wireframe minimalista + marcadores pulsantes
   ============================================ */

const Globe = {
  instances: {},  // canvasId -> { scene, camera, renderer, ... }

  init(canvasId, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Cena
    const scene = new THREE.Scene();

    // Câmera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Grupo principal (rotaciona)
    const earth = new THREE.Group();
    scene.add(earth);

    // ===== Esfera base (gradiente sutil) =====
    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x0a0e14,
      transparent: true,
      opacity: 0.85,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    earth.add(sphere);

    // ===== Wireframe (linhas de meridianos/paralelos) =====
    const wireGeo = new THREE.SphereGeometry(1.001, 36, 24);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x1a3d2e,
      transparent: true,
      opacity: 0.4,
    });
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(wireGeo),
      wireMat
    );
    earth.add(wireframe);

    // ===== Pontos da superfície (estilo pontilhado de continente) =====
    // Geramos pontos densos para simular a superfície terrestre
    const dotsGroup = new THREE.Group();
    const dotsGeo = new THREE.BufferGeometry();
    const dotsPositions = [];

    // Pontos densos no globo todo (efeito mapa pontilhado)
    const dotCount = 3500;
    for (let i = 0; i < dotCount; i++) {
      // Distribuição esférica uniforme
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.005;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      dotsPositions.push(x, y, z);
    }
    dotsGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotsPositions, 3));
    const dotsMat = new THREE.PointsMaterial({
      color: 0x0d4d36,
      size: 0.008,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true
    });
    const dots = new THREE.Points(dotsGeo, dotsMat);
    earth.add(dots);

    // ===== Atmosfera (glow) =====
    const atmGeo = new THREE.SphereGeometry(1.08, 64, 64);
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
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.0, 1.0, 0.6, 1.0) * intensity * 0.4;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // Inner glow (mais sutil)
    const innerGlowGeo = new THREE.SphereGeometry(1.02, 64, 64);
    const innerGlowMat = new THREE.ShaderMaterial({
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
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
          gl_FragColor = vec4(0.0, 0.8, 0.5, 1.0) * intensity * 0.3;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false
    });
    const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    earth.add(innerGlow);

    // ===== Marcadores (criados dinamicamente em updateMarkers) =====
    const markersGroup = new THREE.Group();
    earth.add(markersGroup);

    // ===== Rotação inicial — Brasil em destaque =====
    // Brasil ~ -15°lat, -55°lng. Vamos rotacionar p/ trazer essa região pra frente
    earth.rotation.y = degToRad(-15);  // gira em y para trazer américa do sul para frente
    earth.rotation.x = degToRad(8);    // inclina pra mostrar melhor

    // ===== Interação: drag para rotacionar =====
    const interaction = {
      isDragging: false,
      previousMouseX: 0,
      previousMouseY: 0,
      autoRotate: true,
      momentumX: 0,
      momentumY: 0
    };

    canvas.addEventListener('mousedown', (e) => {
      interaction.isDragging = true;
      interaction.autoRotate = false;
      interaction.previousMouseX = e.clientX;
      interaction.previousMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      interaction.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!interaction.isDragging) return;
      const deltaX = e.clientX - interaction.previousMouseX;
      const deltaY = e.clientY - interaction.previousMouseY;
      earth.rotation.y += deltaX * 0.005;
      earth.rotation.x += deltaY * 0.005;
      // Limitar rotação X para não virar de cabeça pra baixo
      earth.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, earth.rotation.x));
      interaction.momentumX = deltaX * 0.005;
      interaction.momentumY = deltaY * 0.005;
      interaction.previousMouseX = e.clientX;
      interaction.previousMouseY = e.clientY;
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        interaction.isDragging = true;
        interaction.autoRotate = false;
        interaction.previousMouseX = e.touches[0].clientX;
        interaction.previousMouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      interaction.isDragging = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (!interaction.isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - interaction.previousMouseX;
      const deltaY = e.touches[0].clientY - interaction.previousMouseY;
      earth.rotation.y += deltaX * 0.005;
      earth.rotation.x += deltaY * 0.005;
      earth.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, earth.rotation.x));
      interaction.previousMouseX = e.touches[0].clientX;
      interaction.previousMouseY = e.touches[0].clientY;
    }, { passive: true });

    // Zoom (wheel)
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camera.position.z = Math.max(2.2, Math.min(6, camera.position.z + e.deltaY * 0.002));
    }, { passive: false });

    // ===== Resize handler =====
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ===== Animation loop =====
    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      frame++;

      // Auto-rotation
      if (interaction.autoRotate && !interaction.isDragging) {
        earth.rotation.y += 0.0008;
      }

      // Pulsar marcadores
      markersGroup.children.forEach(marker => {
        if (marker.userData.isPulse) {
          const phase = (elapsed * 1.5 + (marker.userData.phaseOffset || 0)) % 2;
          const scale = 1 + phase * 1.5;
          const opacity = Math.max(0, 0.6 - phase * 0.3);
          marker.scale.setScalar(scale);
          marker.material.opacity = opacity;
        }
      });

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    this.instances[canvasId] = {
      scene, camera, renderer, earth, markersGroup, interaction
    };

    return this.instances[canvasId];
  },

  // ===== Atualizar marcadores =====
  updateMarkers(canvasId, points) {
    const inst = this.instances[canvasId];
    if (!inst) return;
    const { markersGroup } = inst;

    // Remover marcadores antigos
    while (markersGroup.children.length) {
      const m = markersGroup.children[0];
      markersGroup.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }

    // Agrupar por cidade (lat/lng)
    const grouped = {};
    points.forEach(p => {
      if (!p.lat || !p.lng) return;
      const key = `${p.lat.toFixed(2)}_${p.lng.toFixed(2)}`;
      if (!grouped[key]) {
        grouped[key] = { lat: p.lat, lng: p.lng, count: 0, value: 0, types: { digital: 0, referral: 0 }, items: [] };
      }
      grouped[key].count++;
      grouped[key].value += Number(p.value || 0);
      grouped[key].types[p.type] = (grouped[key].types[p.type] || 0) + 1;
      grouped[key].items.push(p);
    });

    Object.values(grouped).forEach((g, idx) => {
      const pos = latLngToVec3(g.lat, g.lng, 1.01);
      // Cor predominante
      const isDigitalDominant = g.types.digital >= g.types.referral;
      const color = isDigitalDominant ? 0x00ff9d : 0xffb547;

      // Tamanho proporcional ao count
      const baseSize = 0.012 + Math.min(0.025, g.count * 0.003);

      // Ponto sólido
      const pointGeo = new THREE.SphereGeometry(baseSize, 12, 12);
      const pointMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1
      });
      const point = new THREE.Mesh(pointGeo, pointMat);
      point.position.copy(pos);
      markersGroup.add(point);

      // Pulse ring (ondulação)
      const ringGeo = new THREE.SphereGeometry(baseSize, 16, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.userData.isPulse = true;
      ring.userData.phaseOffset = (idx * 0.31) % 2;
      markersGroup.add(ring);

      // Linha vertical (beam) opcional para destaques
      if (g.count >= 1) {
        const beamHeight = 0.05 + Math.min(0.15, g.count * 0.015);
        const beamGeo = new THREE.CylinderGeometry(0.001, baseSize * 0.5, beamHeight, 6);
        const beamMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.6
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.copy(pos);
        beam.position.multiplyScalar(1 + beamHeight / 2);
        // Orientar o beam radialmente
        beam.lookAt(pos.clone().multiplyScalar(2));
        beam.rotateX(Math.PI / 2);
        markersGroup.add(beam);
      }
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
