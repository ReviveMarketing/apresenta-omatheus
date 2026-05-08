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

  // Coordenadas diretas das principais cidades em pixels SVG
  // (calibradas pra cair em cima do estado correto no mapa estilizado)
  cityCoords: {
    // SC
    'Blumenau_SC':            { x: 432, y: 720 },
    'Indaial_SC':             { x: 425, y: 720 },
    'Timbó_SC':               { x: 422, y: 717 },
    'Pomerode_SC':            { x: 428, y: 712 },
    'Gaspar_SC':              { x: 438, y: 722 },
    'Brusque_SC':             { x: 432, y: 728 },
    'Itajaí_SC':              { x: 446, y: 720 },
    'Balneário Camboriú_SC':  { x: 448, y: 728 },
    'Joinville_SC':           { x: 442, y: 705 },
    'Florianópolis_SC':       { x: 452, y: 740 },
    'Chapecó_SC':             { x: 380, y: 720 },
    'Criciúma_SC':            { x: 430, y: 758 },
    'Lages_SC':               { x: 412, y: 740 },
    'Tubarão_SC':             { x: 432, y: 752 },
    'Rio do Sul_SC':          { x: 422, y: 728 },
    'Jaraguá do Sul_SC':      { x: 438, y: 712 },
    // CE
    'Fortaleza_CE':           { x: 605, y: 372 },
    'Caucaia_CE':             { x: 600, y: 374 },
    'Maracanaú_CE':           { x: 602, y: 378 },
    'Sobral_CE':              { x: 590, y: 380 },
    'Juazeiro do Norte_CE':   { x: 595, y: 408 },
    // MG
    'Belo Horizonte_MG':      { x: 538, y: 615 },
    'Uberlândia_MG':          { x: 495, y: 612 },
    'Contagem_MG':            { x: 535, y: 615 },
    'Juiz de Fora_MG':        { x: 565, y: 632 },
    'Betim_MG':               { x: 532, y: 615 },
    'Ipatinga_MG':            { x: 558, y: 605 },
    // SP
    'São Paulo_SP':           { x: 478, y: 660 },
    'Campinas_SP':            { x: 470, y: 650 },
    'Ribeirão Preto_SP':      { x: 460, y: 638 },
    'Santos_SP':              { x: 482, y: 668 },
    'Sorocaba_SP':            { x: 465, y: 663 },
    'São José dos Campos_SP': { x: 488, y: 658 },
    // RJ
    'Rio de Janeiro_RJ':      { x: 605, y: 660 },
    'Niterói_RJ':             { x: 612, y: 660 },
    'Nova Iguaçu_RJ':         { x: 600, y: 660 },
    // PR
    'Curitiba_PR':            { x: 432, y: 695 },
    'Londrina_PR':            { x: 410, y: 685 },
    'Maringá_PR':              { x: 405, y: 685 },
    // RS
    'Porto Alegre_RS':        { x: 332, y: 770 },
    'Caxias do Sul_RS':       { x: 348, y: 745 },
    'Pelotas_RS':             { x: 318, y: 778 },
    // BA
    'Salvador_BA':            { x: 615, y: 510 },
    'Feira de Santana_BA':    { x: 605, y: 510 },
    // PE
    'Recife_PE':              { x: 660, y: 432 },
    // DF
    'Brasília_DF':            { x: 470, y: 518 },
    // GO
    'Goiânia_GO':             { x: 445, y: 520 },
    // PA
    'Belém_PA':               { x: 430, y: 320 },
    // AM
    'Manaus_AM':              { x: 250, y: 350 },
    // ES
    'Vitória_ES':             { x: 638, y: 605 },
    // PB
    'João Pessoa_PB':         { x: 668, y: 408 },
    // RN
    'Natal_RN':               { x: 660, y: 378 }
  },

  // Centros aproximados dos estados em coordenadas SVG (pro fallback)
  stateCentersSVG: {
    'AC': [125, 385], 'AM': [250, 350], 'RR': [305, 248], 'AP': [435, 275],
    'PA': [385, 335], 'TO': [450, 465], 'MA': [485, 400], 'PI': [538, 425],
    'CE': [598, 388], 'RN': [640, 372], 'PB': [648, 405], 'PE': [625, 430],
    'AL': [670, 438], 'SE': [678, 458], 'BA': [590, 510], 'RO': [255, 450],
    'MT': [345, 460], 'GO': [445, 525], 'DF': [470, 519], 'MG': [540, 615],
    'ES': [638, 605], 'RJ': [615, 660], 'SP': [475, 645], 'PR': [430, 695],
    'SC': [420, 745], 'RS': [320, 760], 'MS': [365, 590]
  },

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

    // Agrupar por cidade — guardando os itens completos para o tooltip
    const cityGroups = {};
    closings.forEach(c => {
      // chave: prefere cidade+UF, senão lat/lng
      const k = (c.city && c.uf) ? `${c.city}_${c.uf}` : `${(c.lat||0).toFixed(2)}_${(c.lng||0).toFixed(2)}`;
      if (!cityGroups[k]) {
        cityGroups[k] = {
          lat: c.lat, lng: c.lng, city: c.city, uf: c.uf,
          count: 0, types: { digital: 0, referral: 0 }, items: []
        };
      }
      cityGroups[k].count++;
      cityGroups[k].types[c.type] = (cityGroups[k].types[c.type] || 0) + 1;
      cityGroups[k].items.push(c);
    });

    // Guardar para acesso pelo tooltip
    this.cityGroups = cityGroups;

    // Construir o SVG
    let html = '';

    // 1) Estados
    Object.entries(this.paths).forEach(([uf, info]) => {
      const has = ufCounts[uf] > 0;
      html += `<path class="uf-path ${has ? 'has-closings' : ''}" d="${info.d}" data-uf="${uf}" data-count="${ufCounts[uf] || 0}">
        <title>${uf}${has ? ` · ${ufCounts[uf]} fechamento(s)` : ''}</title>
      </path>`;
    });

    // 2) Labels dos UFs
    Object.entries(this.paths).forEach(([uf, info]) => {
      const has = ufCounts[uf] > 0;
      html += `<text class="uf-label ${has ? 'has-closings' : ''}" x="${info.label[0]}" y="${info.label[1]}">${uf}</text>`;
    });

    // 3) Pinos das cidades
    Object.entries(cityGroups).forEach(([key, g], idx) => {
      const pos = this.resolvePos(g);
      const isDigital = g.types.digital >= g.types.referral;
      const color = isDigital ? '#00ff9d' : '#ffb547';
      const baseR = 4 + Math.min(6, g.count * 0.8);
      const delay = idx * 60; // ms — para animação escalonada

      html += `<g class="city-pin" data-city-key="${key}" transform="translate(${pos.x}, ${pos.y})" style="--delay:${delay}ms">
        <circle class="city-pin__halo" r="${baseR + 4}" fill="${color}" opacity="0.4"/>
        <circle class="city-pin__dot" r="${baseR}" fill="${color}" stroke="rgba(0,0,0,0.5)" stroke-width="0.8"/>
        <title>${g.city || ''} · ${g.uf || ''} · ${g.count} fechamento(s)</title>
      </g>`;

      // Label da cidade
      if (g.city) {
        const labelW = (g.city.length * 5) + 14;
        const labelY = pos.y + baseR + 14;
        html += `<g class="city-pin__labelgroup" pointer-events="none" style="--delay:${delay + 200}ms">
          <rect class="city-pin__label-bg" x="${pos.x - labelW/2}" y="${labelY - 9}" width="${labelW}" height="14" rx="3"/>
          <text class="city-pin__label" x="${pos.x}" y="${labelY + 1}">${g.city.toUpperCase()}</text>
        </g>`;
      }
    });

    svg.innerHTML = html;

    // ===== Eventos de interação =====
    this.bindInteraction();
    this.bindZoomPan();
    this.applyTransform();
  },

  // Liga interação (hover/click + tooltip)
  bindInteraction() {
    const svg = this.svg;
    if (!svg) return;
    const tooltip = this.ensureTooltip();

    // Pinos
    svg.querySelectorAll('.city-pin').forEach(pin => {
      pin.addEventListener('mouseenter', (e) => {
        const key = pin.dataset.cityKey;
        const group = this.cityGroups[key];
        if (!group) return;
        this.showTooltip(group);
      });
      pin.addEventListener('mousemove', (e) => this.positionTooltip(e));
      pin.addEventListener('mouseleave', () => this.hideTooltip());
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = pin.dataset.cityKey;
        const group = this.cityGroups[key];
        if (group) this.showTooltipPinned(group, e);
      });
    });

    // Estados (hover destaca + tooltip)
    svg.querySelectorAll('.uf-path').forEach(path => {
      path.addEventListener('mouseenter', () => {
        const uf = path.dataset.uf;
        const count = Number(path.dataset.count || 0);
        if (count > 0) {
          this.showStateTooltip(uf, count);
        }
      });
      path.addEventListener('mousemove', (e) => this.positionTooltip(e));
      path.addEventListener('mouseleave', () => this.hideTooltip());
    });

    // Click fora fecha tooltip pinado
    svg.addEventListener('click', (e) => {
      if (e.target === svg || e.target.classList.contains('uf-path')) {
        this.hideTooltip();
      }
    });
  },

  ensureTooltip() {
    let tip = document.getElementById('brazil-map-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'brazil-map-tooltip';
      tip.className = 'brazil-tooltip';
      document.getElementById('brazil-map').appendChild(tip);
    }
    return tip;
  },

  showTooltip(group) {
    const tip = this.ensureTooltip();
    const total = group.count;
    // Quebrar processos
    const procs = {};
    group.items.forEach(it => {
      const ps = (it.processes && it.processes.length) ? it.processes : ['(sem tipo)'];
      ps.forEach(p => {
        const k = (p === 'Outros' && it.processOther) ? `Outros: ${it.processOther}` : p;
        procs[k] = (procs[k] || 0) + 1;
      });
    });
    const procRows = Object.entries(procs).sort((a,b) => b[1]-a[1]).slice(0, 5)
      .map(([n, c]) => `<div class="brazil-tooltip__row"><span>${n}</span><span class="brazil-tooltip__rowcount">${c}</span></div>`)
      .join('');

    tip.innerHTML = `
      <div class="brazil-tooltip__head">
        <strong>${group.city || '—'}</strong>
        <span class="brazil-tooltip__uf">${group.uf || ''}</span>
      </div>
      <div class="brazil-tooltip__big">${total} <em>${total === 1 ? 'fechamento' : 'fechamentos'}</em></div>
      ${procRows ? `<div class="brazil-tooltip__breakdown">${procRows}</div>` : ''}
      <div class="brazil-tooltip__hint">Clique para ver clientes</div>
    `;
    tip.classList.add('is-visible');
  },

  showStateTooltip(uf, count) {
    const tip = this.ensureTooltip();
    tip.innerHTML = `
      <div class="brazil-tooltip__head">
        <strong>${uf}</strong>
      </div>
      <div class="brazil-tooltip__big">${count} <em>${count === 1 ? 'fechamento' : 'fechamentos'}</em></div>
    `;
    tip.classList.add('is-visible');
  },

  showTooltipPinned(group, evt) {
    this.showTooltip(group);
    // Adicionar lista completa de clientes
    const tip = this.ensureTooltip();
    const list = group.items.slice(0, 8).map(c => {
      const procs = (c.processes && c.processes.length)
        ? c.processes.join(', ') + (c.processOther ? ` (${c.processOther})` : '')
        : '—';
      return `<div class="brazil-tooltip__client">
        <strong>${c.client || '—'}</strong>
        <span>${procs}</span>
      </div>`;
    }).join('');
    if (list) {
      tip.innerHTML += `<div class="brazil-tooltip__clients">${list}</div>`;
    }
    this.positionTooltip(evt);
    tip.classList.add('is-pinned');
  },

  positionTooltip(evt) {
    const tip = document.getElementById('brazil-map-tooltip');
    if (!tip) return;
    const container = document.getElementById('brazil-map');
    const r = container.getBoundingClientRect();
    const x = evt.clientX - r.left;
    const y = evt.clientY - r.top;
    // Ajusta pra não sair da tela
    const tipW = tip.offsetWidth || 240;
    const tipH = tip.offsetHeight || 100;
    const dx = (x + tipW + 20 > r.width) ? -tipW - 16 : 16;
    const dy = (y + tipH + 20 > r.height) ? -tipH - 16 : 16;
    tip.style.left = (x + dx) + 'px';
    tip.style.top = (y + dy) + 'px';
  },

  hideTooltip() {
    const tip = document.getElementById('brazil-map-tooltip');
    if (tip) {
      tip.classList.remove('is-visible');
      tip.classList.remove('is-pinned');
    }
  },

  // Resolve a posição SVG de um fechamento (cidade > estado > projeção)
  resolvePos(point) {
    // 1) cidade conhecida
    const key = `${point.city}_${point.uf}`;
    if (this.cityCoords[key]) return this.cityCoords[key];
    // 2) centro do estado
    if (this.stateCentersSVG[point.uf]) {
      const [x, y] = this.stateCentersSVG[point.uf];
      return { x, y };
    }
    // 3) fallback: projeção lat/lng
    return this.latLngToXY(point.lat, point.lng);
  },

  // Projeção lat/lng -> coordenadas SVG (fallback)
  latLngToXY(lat, lng) {
    const b = this.bounds;
    const x = ((lng - b.minLng) / (b.maxLng - b.minLng)) * (this.vw - 100) + 50;
    const y = ((b.maxLat - lat) / (b.maxLat - b.minLat)) * (this.vh - 200) + 100;
    return { x, y };
  },

  // ============= ZOOM E PAN =============
  zoomState: { scale: 1, tx: 0, ty: 0 },
  ZOOM_MIN: 0.7,
  ZOOM_MAX: 5,
  ZOOM_STEP: 1.25,

  applyTransform() {
    const svg = this.svg || document.getElementById('brazil-svg');
    if (!svg) return;
    const { scale, tx, ty } = this.zoomState;
    svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    const lvl = document.getElementById('brazil-zoomlevel');
    if (lvl) lvl.textContent = Math.round(scale * 100) + '%';
  },

  setZoom(newScale, anchorX, anchorY) {
    const wrap = document.getElementById('brazil-map');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const cx = (anchorX !== undefined) ? anchorX : r.width / 2;
    const cy = (anchorY !== undefined) ? anchorY : r.height / 2;

    const z = this.zoomState;
    const clamped = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, newScale));
    if (clamped === z.scale) return;

    // Mantém o ponto sob o cursor estável durante o zoom
    const ratio = clamped / z.scale;
    z.tx = cx - (cx - z.tx) * ratio;
    z.ty = cy - (cy - z.ty) * ratio;
    z.scale = clamped;
    this.applyTransform();
  },

  resetZoom() {
    this.zoomState = { scale: 1, tx: 0, ty: 0 };
    const svg = document.getElementById('brazil-svg');
    if (svg) svg.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    this.applyTransform();
    setTimeout(() => {
      if (svg) svg.style.transition = '';
    }, 400);
  },

  bindZoomPan() {
    if (this._zoomBound) return;
    this._zoomBound = true;

    const wrap = document.getElementById('brazil-map');
    const svg = document.getElementById('brazil-svg');
    if (!wrap || !svg) return;

    // Botões
    const btnIn = document.getElementById('brazil-zoom-in');
    const btnOut = document.getElementById('brazil-zoom-out');
    const btnReset = document.getElementById('brazil-zoom-reset');
    if (btnIn) btnIn.addEventListener('click', () => this.setZoom(this.zoomState.scale * this.ZOOM_STEP));
    if (btnOut) btnOut.addEventListener('click', () => this.setZoom(this.zoomState.scale / this.ZOOM_STEP));
    if (btnReset) btnReset.addEventListener('click', () => this.resetZoom());

    // Scroll do mouse = zoom
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const factor = e.deltaY < 0 ? this.ZOOM_STEP : (1 / this.ZOOM_STEP);
      this.setZoom(this.zoomState.scale * factor, cx, cy);
    }, { passive: false });

    // Drag pan
    let isDragging = false;
    let startX = 0, startY = 0, startTx = 0, startTy = 0;

    const onPointerDown = (e) => {
      // só drag se clicou em área "vazia" (não num pino interativo)
      if (e.target.closest('.city-pin')) return;
      isDragging = true;
      svg.classList.add('is-dragging');
      startX = e.clientX;
      startY = e.clientY;
      startTx = this.zoomState.tx;
      startTy = this.zoomState.ty;
      wrap.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      this.zoomState.tx = startTx + (e.clientX - startX);
      this.zoomState.ty = startTy + (e.clientY - startY);
      this.applyTransform();
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      svg.classList.remove('is-dragging');
      try { wrap.releasePointerCapture(e.pointerId); } catch (_) {}
    };

    wrap.addEventListener('pointerdown', onPointerDown);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerup', onPointerUp);
    wrap.addEventListener('pointercancel', onPointerUp);

    // Pinch-to-zoom mobile
    let lastDist = 0;
    wrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (lastDist) {
          const factor = dist / lastDist;
          const r = wrap.getBoundingClientRect();
          const cx = (e.touches[0].clientX + e.touches[1].clientX)/2 - r.left;
          const cy = (e.touches[0].clientY + e.touches[1].clientY)/2 - r.top;
          this.setZoom(this.zoomState.scale * factor, cx, cy);
        }
        lastDist = dist;
        e.preventDefault();
      }
    }, { passive: false });
    wrap.addEventListener('touchend', () => { lastDist = 0; });
  }
};
