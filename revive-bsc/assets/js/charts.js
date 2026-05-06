/* ============================================
   Charts: sparklines + trend chart (SVG vanilla)
   ============================================ */

const Charts = {

  // Sparkline simples
  sparkline(svgEl, values, options = {}) {
    if (!svgEl) return;
    const { color = '#00ff9d', fill = true, padding = 2 } = options;

    const w = 200;
    const h = 40;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = padding + (i / Math.max(values.length - 1, 1)) * (w - padding * 2);
      const y = h - padding - ((v - min) / range) * (h - padding * 2);
      return [x, y];
    });

    const pathD = points.reduce((acc, [x, y], i) => {
      return acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`);
    }, '');

    const fillD = pathD + ` L${points[points.length - 1][0]},${h} L${points[0][0]},${h} Z`;

    svgEl.innerHTML = `
      <defs>
        <linearGradient id="sparkGrad-${Math.random().toString(36).slice(2)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${fill ? `<path d="${fillD}" fill="${color}" opacity="0.1"/>` : ''}
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${points[points.length-1][0]}" cy="${points[points.length-1][1]}" r="2.5" fill="${color}"/>
    `;
  },

  // Funnel
  renderFunnel(container, steps) {
    if (!container) return;
    const max = Math.max(...steps.map(s => s.value), 1);
    container.innerHTML = steps.map((s, i) => {
      const pct = max > 0 ? (s.value / max) * 100 : 0;
      const conv = i > 0 && steps[i-1].value > 0 ? Math.round((s.value / steps[i-1].value) * 100) : null;
      return `
        <div class="funnel-step" style="--w:${pct}%">
          <span class="funnel-step__label">
            ${s.label}
            ${conv !== null ? `<span class="funnel-step__pct">${conv}%</span>` : ''}
          </span>
          <span class="funnel-step__value">${fmtNum(s.value)}</span>
        </div>
      `;
    }).join('');
  },

  // Ranking (top cidades)
  renderRanking(container, items) {
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = '<li style="color:var(--c-text-3); padding:14px 0; font-size:12px; text-align:center; border:none;">Sem dados no período</li>';
      return;
    }
    const max = items[0].count;
    container.innerHTML = items.slice(0, 6).map((item, i) => {
      const pct = (item.count / max) * 100;
      return `
        <li>
          <span class="rank-pos">${String(i + 1).padStart(2, '0')}</span>
          <span class="rank-name">
            <span class="rank-name__city">${item.city}</span>
            <span class="rank-name__uf">${item.uf}</span>
          </span>
          <span class="rank-bar-wrap">
            <span class="rank-bar"><i style="--w:${pct}%"></i></span>
            <span class="rank-count">${item.count}</span>
          </span>
        </li>
      `;
    }).join('');
  },

  // Trend (12 meses)
  renderTrend(svgEl, datasets, options = {}) {
    if (!svgEl) return;
    const { width = 800, height = 280, padding = { top: 20, right: 20, bottom: 36, left: 50 } } = options;
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    // Achar max de todos datasets
    const allVals = datasets.flatMap(d => d.values);
    const max = Math.max(...allVals, 1);
    const min = 0;
    const range = max - min || 1;

    const xStep = innerW / 11;  // 12 meses
    const monthAbbr = MONTH_ABBR;

    // Ticks Y
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(min + range * t));

    let svg = `
      <!-- Y Grid -->
      ${ticks.map(t => {
        const y = padding.top + innerH - ((t - min) / range) * innerH;
        return `
          <line x1="${padding.left}" y1="${y}" x2="${padding.left + innerW}" y2="${y}"
                stroke="rgba(255,255,255,0.04)" stroke-width="1" stroke-dasharray="2 4"/>
          <text x="${padding.left - 10}" y="${y + 3}" fill="#5d6470" font-size="10" font-family="JetBrains Mono" text-anchor="end">${fmtNum(t)}</text>
        `;
      }).join('')}

      <!-- X Labels -->
      ${monthAbbr.map((m, i) => {
        const x = padding.left + i * xStep;
        return `<text x="${x}" y="${padding.top + innerH + 22}" fill="#5d6470" font-size="9" font-family="JetBrains Mono" text-anchor="middle" letter-spacing="0.1em">${m}</text>`;
      }).join('')}
    `;

    datasets.forEach(ds => {
      const points = ds.values.map((v, i) => {
        const x = padding.left + i * xStep;
        const y = padding.top + innerH - ((v - min) / range) * innerH;
        return [x, y, v];
      });

      const pathD = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), '');
      const fillD = pathD + ` L${points[points.length - 1][0]},${padding.top + innerH} L${points[0][0]},${padding.top + innerH} Z`;

      const gradId = 'g_' + ds.name.replace(/\W/g, '_');

      svg += `
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${ds.color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${ds.color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${fillD}" fill="url(#${gradId})"/>
        <path d="${pathD}" fill="none" stroke="${ds.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map(([x, y, v]) => `
          <circle cx="${x}" cy="${y}" r="3" fill="${ds.color}" stroke="#0a0c10" stroke-width="2"/>
        `).join('')}
      `;
    });

    // Legenda no topo
    svg += `
      <g transform="translate(${padding.left}, ${padding.top - 4})">
        ${datasets.map((ds, i) => `
          <g transform="translate(${i * 110}, 0)">
            <circle cx="6" cy="6" r="4" fill="${ds.color}"/>
            <text x="16" y="10" fill="#9ba1ac" font-size="11" font-family="Inter Tight">${ds.name}</text>
          </g>
        `).join('')}
      </g>
    `;

    svgEl.innerHTML = svg;
  },

  // Sources (origens)
  renderSources(container, items) {
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = '<div style="color:var(--c-text-3); padding:20px 0; font-size:12px; text-align:center;">Sem fechamentos no período</div>';
      return;
    }
    const max = Math.max(...items.map(i => i.count));
    const colorClass = {
      'META': 'bar-meta',
      'GOOGLE': 'bar-google',
      'ORGÂNICO': 'bar-organico',
      'INDICAÇÃO': 'bar-indicacao',
      'OUTRO': 'bar-outro'
    };
    container.innerHTML = items.map(item => {
      const pct = (item.count / max) * 100;
      const cls = colorClass[item.name] || 'bar-outro';
      return `
        <div class="source-item">
          <span class="source-item__name">${item.name}</span>
          <span class="source-item__bar"><i class="${cls}" style="--w:${pct}%"></i></span>
          <span class="source-item__count">${item.count}</span>
        </div>
      `;
    }).join('');
  }
};
