/* ============================================
   Mapa do Brasil em SVG
   Contornos simplificados dos estados +
   marcadores nas cidades de fechamento
   ============================================ */

const BrazilMap = {
  // Bounds do Brasil para projeção (simplificado)
  bounds: {
    minLat: -34, maxLat: 6,
    minLng: -74, maxLng: -34
  },

  // ViewBox do SVG
  vw: 800,
  vh: 800,

  // Caminhos simplificados dos estados (Mercator simplificado)
  // Coordenadas calibradas para um mapa estilizado do Brasil
  // Cada estado tem [path SVG, posição do label]
  paths: {
    'AC': { d: 'M 80 360 L 130 350 L 165 365 L 175 395 L 145 410 L 95 405 L 75 385 Z', label: [125, 385] },
    'AM': { d: 'M 130 350 L 250 280 L 320 270 L 340 320 L 320 380 L 280 410 L 220 415 L 175 395 L 165 365 Z', label: [240, 350] },
    'RR': { d: 'M 270 220 L 320 215 L 340 240 L 335 280 L 320 270 L 280 275 L 268 245 Z', label: [305, 248] },
    'AP': { d: 'M 410 250 L 445 245 L 460 275 L 450 305 L 415 295 Z', label: [435, 275] },
    'PA': { d: 'M 320 270 L 410 250 L 415 295 L 450 305 L 445 365 L 425 405 L 370 410 L 330 380 L 320 380 L 340 320 Z', label: [385, 335] },
    'TO': { d: 'M 425 405 L 470 410 L 480 460 L 475 510 L 445 525 L 425 510 L 420 460 Z', label: [450, 465] },
    'MA': { d: 'M 445 365 L 510 350 L 540 385 L 535 430 L 495 445 L 470 410 L 425 405 Z', label: [485, 400] },
    'PI': { d: 'M 510 350 L 560 360 L 575 410 L 565 470 L 535 480 L 495 445 L 535 430 L 540 385 Z', label: [538, 425] },
    'CE': { d: 'M 560 360 L 610 350 L 630 380 L 625 415 L 590 425 L 575 410 Z', label: [598, 388] },
    'RN': { d: 'M 610 350 L 655 350 L 670 375 L 660 395 L 630 380 Z', label: [640, 372] },
    'PB': { d: 'M 630 380 L 660 395 L 670 410 L 645 420 L 625 415 Z', label: [648, 405] },
    'PE': { d: 'M 575 410 L 645 420 L 670 410 L 685 425 L 660 445 L 590 440 Z', label: [625, 430] },
    'AL': { d: 'M 645 420 L 680 425 L 690 445 L 670 455 L 660 445 Z', label: [670, 438] },
    'SE': { d: 'M 660 445 L 690 445 L 695 465 L 675 470 Z', label: [678, 458] },
    'BA': { d: 'M 535 480 L 590 440 L 660 445 L 675 470 L 670 530 L 615 575 L 555 580 L 510 540 Z', label: [590, 510] },
    'RO': { d: 'M 220 415 L 280 410 L 310 445 L 295 480 L 235 485 L 195 460 Z', label: [255, 450] },
    'MT': { d: 'M 280 410 L 330 380 L 370 410 L 425 510 L 420 460 L 380 510 L 320 530 L 295 480 L 310 445 Z', label: [345, 460] },
    'GO': { d: 'M 425 510 L 480 460 L 475 510 L 470 555 L 425 565 L 405 540 Z', label: [445, 525] },
    'DF': { d: 'M 462 510 L 478 510 L 478 525 L 462 525 Z', label: [495, 519] },
    'MG': { d: 'M 470 555 L 555 580 L 615 575 L 620 615 L 590 645 L 530 660 L 475 645 L 455 605 Z', label: [540, 615] },
    'ES': { d: 'M 615 575 L 650 580 L 665 615 L 645 640 L 620 615 Z', label: [638, 605] },
    'RJ': { d: 'M 590 645 L 645 640 L 660 665 L 615 680 L 575 670 Z', label: [615, 660] },
    'SP': { d: 'M 425 565 L 475 645 L 530 660 L 575 670 L 555 690 L 480 695 L 425 670 L 410 625 Z', label: [475, 645] },
    'PR': { d: 'M 410 625 L 480 695 L 470 730 L 410 740 L 380 705 L 380 660 Z', label: [430, 695] },
    'SC': { d: 'M 380 705 L 470 730 L 475 760 L 430 770 L 380 760 L 365 735 Z', label: [420, 745] },
    'RS': { d: 'M 320 530 L 365 735 L 380 760 L 330 790 L 280 775 L 250 720 L 270 650 L 295 580 Z', label: [320, 700] },
    'MS': { d: 'M 320 530 L 380 510 L 405 540 L 425 565 L 410 625 L 380 660 L 295 580 Z', label: [365, 590] }
  },

  init() {
    const svg = document.getElementById('brazil-svg');
    if (!svg) return;
    this.svg = svg;
    this.render([]);
  },

  render(closings) {
    const svg = this.svg;
    if (!svg) return;

    // Agrupar fechamentos por UF
    const ufCounts = {};
    closings.forEach(c => {
      if (!c.uf) return;
      ufCounts[c.uf] = (ufCounts[c.uf] || 0) + 1;
    });

    // Agrupar por cidade (para os pinos)
    const cityGroups = {};
    closings.forEach(c => {
      if (!c.lat || !c.lng) return;
      const k = `${c.lat.toFixed(2)}_${c.lng.toFixed(2)}`;
      if (!cityGroups[k]) {
        cityGroups[k] = { lat: c.lat, lng: c.lng, city: c.city, uf: c.uf, count: 0, types: { digital: 0, referral: 0 } };
      }
      cityGroups[k].count++;
      cityGroups[k].types[c.type] = (cityGroups[k].types[c.type] || 0) + 1;
    });

    // Construir o SVG
    let html = '';

    // 1) Estados
    Object.entries(this.paths).forEach(([uf, info]) => {
      const has = ufCounts[uf] > 0;
      html += `<path class="uf-path ${has ? 'has-closings' : ''}" d="${info.d}" data-uf="${uf}">
        <title>${uf}${has ? ` · ${ufCounts[uf]} fechamento(s)` : ''}</title>
      </path>`;
    });

    // 2) Labels dos UFs
    Object.entries(this.paths).forEach(([uf, info]) => {
      const has = ufCounts[uf] > 0;
      html += `<text class="uf-label ${has ? 'has-closings' : ''}" x="${info.label[0]}" y="${info.label[1]}">${uf}</text>`;
    });

    // 3) Pinos das cidades
    Object.values(cityGroups).forEach((g, idx) => {
      const pos = this.latLngToXY(g.lat, g.lng);
      const isDigital = g.types.digital >= g.types.referral;
      const color = isDigital ? '#00ff9d' : '#ffb547';
      const baseR = 4 + Math.min(6, g.count * 0.8);

      html += `<g class="city-pin" transform="translate(${pos.x}, ${pos.y})">
        <circle class="city-pin__halo" r="${baseR + 4}" fill="${color}" opacity="0.4"/>
        <circle r="${baseR}" fill="${color}" stroke="rgba(0,0,0,0.5)" stroke-width="0.8"/>
        <title>${g.city || ''} · ${g.uf || ''} · ${g.count} fechamento(s)</title>
      </g>`;

      // Label da cidade (só para as com 1+ fechamento)
      if (g.city) {
        const labelW = (g.city.length * 5) + 14;
        const labelY = pos.y + baseR + 14;
        html += `<g pointer-events="none">
          <rect class="city-pin__label-bg" x="${pos.x - labelW/2}" y="${labelY - 9}" width="${labelW}" height="14" rx="3"/>
          <text class="city-pin__label" x="${pos.x}" y="${labelY + 1}">${g.city.toUpperCase()}</text>
        </g>`;
      }
    });

    svg.innerHTML = html;
  },

  // Projeção lat/lng -> coordenadas SVG (Mercator simplificado calibrado)
  latLngToXY(lat, lng) {
    const b = this.bounds;
    // Lng linear (oeste a leste do mapa)
    const x = ((lng - b.minLng) / (b.maxLng - b.minLng)) * (this.vw - 100) + 50;
    // Lat invertida (norte = topo)
    const y = ((b.maxLat - lat) / (b.maxLat - b.minLat)) * (this.vh - 200) + 100;
    return { x, y };
  }
};
