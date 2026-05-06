/* ============================================
   App principal · ReVive BSC
   ============================================ */

const App = {
  state: {
    currentTab: 'overview',
    period: { year: new Date().getFullYear(), month: new Date().getMonth() },
    filters: {
      status: '', origin: '', city: '', consultant: '', type: '', search: ''
    }
  },

  init() {
    Store.load();
    this.bindUI();
    this.populateSelectors();
    this.setActiveTab(this.state.currentTab);
    this.render();

    // Inicializar globo do cockpit (visível por padrão)
    setTimeout(() => {
      Globe.init('globe-canvas');
      this.updateGlobes();
    }, 100);

    // Esconder loader
    setTimeout(() => {
      document.getElementById('loader').classList.add('is-hidden');
    }, 500);
  },

  bindUI() {
    // Tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setActiveTab(btn.dataset.tab);
      });
    });

    // Period
    const monthSel = document.getElementById('month-selector');
    const yearSel = document.getElementById('year-selector');
    monthSel.value = this.state.period.month;
    yearSel.value = this.state.period.year;
    monthSel.addEventListener('change', () => {
      this.state.period.month = Number(monthSel.value);
      this.render();
    });
    yearSel.addEventListener('change', () => {
      this.state.period.year = Number(yearSel.value);
      this.render();
    });

    // Edit marketing
    document.getElementById('btn-edit').addEventListener('click', () => {
      this.openMarketingModal();
    });

    // Export / Import
    document.getElementById('btn-export').addEventListener('click', () => {
      this.exportData();
    });
    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-input').click();
    });
    document.getElementById('import-input').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // Add closing
    document.getElementById('btn-add-closing').addEventListener('click', () => {
      this.openClosingModal();
    });

    // Modal close
    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => {
        el.closest('.modal').classList.remove('is-open');
      });
    });

    // Closing form
    document.getElementById('form-closing').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveClosing();
    });

    // Marketing form
    document.getElementById('form-marketing').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMarketing();
    });

    // City auto-fill UF
    document.getElementById('f-city').addEventListener('change', (e) => {
      const city = e.target.value;
      const found = BRAZIL_CITIES.find(c => c.city.toLowerCase() === city.toLowerCase());
      if (found) {
        document.getElementById('f-uf').value = found.uf;
      }
    });

    // Filters
    ['status', 'origin', 'city', 'consultant', 'type', 'search'].forEach(name => {
      const el = document.getElementById('filter-' + name);
      el.addEventListener('input', () => {
        this.state.filters[name] = el.value;
        this.renderCommercial();
      });
    });

    // Trend toggle
    document.querySelectorAll('[data-trend-metric]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-trend-metric]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.state.trendMetric = btn.dataset.trendMetric;
        this.renderTrend();
      });
    });
    this.state.trendMetric = 'closings';
  },

  populateSelectors() {
    // UF select no form
    const ufSel = document.getElementById('f-uf');
    BRAZIL_STATES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.uf;
      opt.textContent = `${s.uf} · ${s.name}`;
      ufSel.appendChild(opt);
    });

    // Datalists
    const dlCities = document.getElementById('dl-cities');
    BRAZIL_CITIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.city;
      dlCities.appendChild(opt);
    });

    // Status filter
    const statusSel = document.getElementById('filter-status');
    STATUS_OPTIONS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      statusSel.appendChild(opt);
    });

    // Origin filter
    const origSel = document.getElementById('filter-origin');
    ORIGIN_OPTIONS.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      origSel.appendChild(opt);
    });

    // City filter (todas as cidades vistas + sugestões)
    this.refreshDynamicFilters();
  },

  refreshDynamicFilters() {
    // Cidades e consultores dinâmicos baseados nos closings
    const closings = Store.getAllClosings();
    const cities = [...new Set(closings.map(c => c.city).filter(Boolean))].sort();
    const consultants = [...new Set(closings.map(c => c.consultant).filter(Boolean))].sort();

    // City filter
    const cityFilter = document.getElementById('filter-city');
    const cityVal = cityFilter.value;
    cityFilter.innerHTML = '<option value="">Todas as cidades</option>';
    cities.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      cityFilter.appendChild(o);
    });
    cityFilter.value = cityVal;

    // Consultant filter
    const consFilter = document.getElementById('filter-consultant');
    const consVal = consFilter.value;
    consFilter.innerHTML = '<option value="">Todos os consultores</option>';
    consultants.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      consFilter.appendChild(o);
    });
    consFilter.value = consVal;

    // Datalist consultants
    const dlCons = document.getElementById('dl-consultants');
    dlCons.innerHTML = '';
    consultants.forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      dlCons.appendChild(o);
    });
  },

  setActiveTab(tab) {
    this.state.currentTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.tabPanel === tab);
    });
    // Forçar resize do globo na aba ativa (canvas precisa ter dimensão visível)
    if (tab === 'globe') {
      requestAnimationFrame(() => {
        Globe.init('globe-canvas-full');
        Globe.handleResize('globe-canvas-full');
        this.updateGlobes();
      });
    } else if (tab === 'overview') {
      requestAnimationFrame(() => {
        Globe.init('globe-canvas');
        Globe.handleResize('globe-canvas');
        this.updateGlobes();
      });
    }
  },

  // ============= RENDER PRINCIPAL =============
  render() {
    const { year, month } = this.state.period;
    this.renderPeriodLabels();
    this.renderKPIs();
    this.renderCockpit();
    this.renderTrend();
    this.renderSourcesPanel();
    this.renderCommercial();
    this.renderMarketing();
    this.refreshDynamicFilters();
    this.updateGlobes();
  },

  renderPeriodLabels() {
    const label = periodLabel(this.state.period.year, this.state.period.month);
    document.querySelectorAll('[data-bind="period-label"]').forEach(el => {
      el.textContent = label;
    });
  },

  // ============= KPIs =============
  renderKPIs() {
    const { year, month } = this.state.period;
    const closings = Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
    const mk = Store.getMarketing(year, month);
    const mkLast = Store.getMarketing(year, month - 1);

    // Faturamento
    const revenue = closings.reduce((s, c) => s + Number(c.value || 0), 0);
    const revenueLast = this.getRevenueForMonth(year, month - 1);
    this.bindKPI('revenue', fmtBRL(revenue), this.deltaPct(revenue, revenueLast));

    // Fechamentos
    const closingsCount = closings.length;
    const digitalCount = closings.filter(c => c.type === 'digital').length;
    const referralCount = closings.filter(c => c.type === 'referral').length;
    const closingsLast = Store.getClosingsForPeriod(year, month - 1).filter(c => (c.status || 'Fechado') === 'Fechado').length;
    document.querySelector('[data-bind="closings"]').textContent = closingsCount;
    document.querySelector('[data-bind="closings-digital"]').textContent = digitalCount;
    document.querySelector('[data-bind="closings-referral"]').textContent = referralCount;
    const splitPct = closingsCount > 0 ? (digitalCount / closingsCount) * 100 : 0;
    document.querySelector('.kpi__split-digital').style.width = splitPct + '%';
    this.setBadge('closings', this.deltaPct(closingsCount, closingsLast));

    // Investimento total
    const investTotal = (mk.meta || 0) + (mk.google || 0) + (mk.vagas || 0);
    const investLast  = (mkLast.meta || 0) + (mkLast.google || 0) + (mkLast.vagas || 0);

    // Total de leads (META + GOOGLE)
    const totalLeads = (mk.leads_meta || 0) + (mk.leads_google || 0);
    const totalLeadsLast = (mkLast.leads_meta || 0) + (mkLast.leads_google || 0);

    // CAC = Investimento ÷ Total de Leads (nova fórmula pedida)
    const cac = totalLeads > 0 ? investTotal / totalLeads : 0;
    const cacLast = totalLeadsLast > 0 ? investLast / totalLeadsLast : 0;
    this.bindKPI('cac', fmtBRL(cac), this.deltaPct(cac, cacLast, true));

    // CPL (custo por lead) — investimento META/GOOGLE só (sem vagas)
    const investPaid = (mk.meta || 0) + (mk.google || 0);
    const cpl = totalLeads > 0 ? investPaid / totalLeads : 0;
    const investPaidLast = (mkLast.meta || 0) + (mkLast.google || 0);
    const cplLast = totalLeadsLast > 0 ? investPaidLast / totalLeadsLast : 0;
    this.bindKPI('cpl', fmtBRL(cpl), this.deltaPct(cpl, cplLast, true));

    // Leads no KPI
    document.querySelector('[data-bind="leads-total"]').textContent = fmtNum(totalLeads);
    const qualified = mk.qualified || 0;
    document.querySelector('[data-bind="leads-qualified"]').textContent = fmtNum(qualified);
    const conv = totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0;
    document.querySelector('[data-bind="conversion-rate"]').textContent = conv + '%';
    this.setBadge('leads', this.deltaPct(totalLeads, totalLeadsLast));

    // Investimento — KPI no topo (atualiza TODOS os elementos com data-bind, evitando o bug)
    this.bindAll('invest-total', fmtBRL(investTotal));
    this.bindAll('invest-meta', 'R$ ' + fmtBRL(mk.meta || 0));
    this.bindAll('invest-google', 'R$ ' + fmtBRL(mk.google || 0));
    this.setBadge('invest', this.deltaPct(investTotal, investLast));

    // Sparklines
    this.renderSparklines();
  },

  bindAll(name, value) {
    document.querySelectorAll(`[data-bind="${name}"]`).forEach(el => el.textContent = value);
  },

  bindKPI(name, value, delta) {
    const el = document.querySelector(`[data-bind="${name}"]`);
    if (el) el.textContent = value;
    this.setBadge(name, delta);
  },

  setBadge(name, delta) {
    const card = document.querySelector(`[data-kpi="${name}"]`);
    if (!card) return;
    const badge = card.querySelector('.kpi__badge');
    if (!badge) return;
    const sign = delta >= 0 ? '+' : '';
    badge.textContent = `${sign}${delta.toFixed(1)}%`;
    badge.dataset.trend = delta >= 0 ? 'up' : 'down';
  },

  deltaPct(current, previous, inverted = false) {
    if (!previous || previous === 0) return 0;
    const d = ((current - previous) / previous) * 100;
    return inverted ? -d : d;
  },

  getRevenueForMonth(year, month) {
    return Store.getClosingsForPeriod(year, month)
      .filter(c => (c.status || 'Fechado') === 'Fechado')
      .reduce((s, c) => s + Number(c.value || 0), 0);
  },

  renderSparklines() {
    const { year, month } = this.state.period;
    // Últimos 6 meses
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m < 0) { m += 12; y--; }
      months.push({ year: y, month: m });
    }

    const revenues = months.map(p => this.getRevenueForMonth(p.year, p.month));
    Charts.sparkline(document.querySelector('[data-spark="revenue"]'), revenues, { color: '#00ff9d' });

    const cacs = months.map(p => {
      const mk = Store.getMarketing(p.year, p.month);
      const inv = (mk.meta || 0) + (mk.google || 0) + (mk.vagas || 0);
      const lds = (mk.leads_meta || 0) + (mk.leads_google || 0);
      return lds > 0 ? inv / lds : 0;
    });
    Charts.sparkline(document.querySelector('[data-spark="cac"]'), cacs, { color: '#ffb547' });

    const cpls = months.map(p => {
      const mk = Store.getMarketing(p.year, p.month);
      const investPaid = (mk.meta || 0) + (mk.google || 0);
      const lds = (mk.leads_meta || 0) + (mk.leads_google || 0);
      return lds > 0 ? investPaid / lds : 0;
    });
    Charts.sparkline(document.querySelector('[data-spark="cpl"]'), cpls, { color: '#6aa9ff' });

    // CAC large (na aba marketing)
    const cacLargeEl = document.querySelector('[data-spark="cac-large"]');
    if (cacLargeEl) Charts.sparkline(cacLargeEl, cacs, { color: '#ffb547' });
  },

  // ============= COCKPIT =============
  renderCockpit() {
    const { year, month } = this.state.period;
    const closings = Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
    const mk = Store.getMarketing(year, month);

    // Globe stats
    const states = new Set(closings.map(c => c.uf).filter(Boolean));
    const cities = new Set(closings.map(c => c.city).filter(Boolean));
    const revenue = closings.reduce((s, c) => s + Number(c.value || 0), 0);
    const avgTicket = closings.length > 0 ? revenue / closings.length : 0;

    document.querySelector('[data-bind="states-count"]').textContent = states.size;
    document.querySelector('[data-bind="cities-count"]').textContent = cities.size;
    document.querySelector('[data-bind="avg-ticket"]').textContent = 'R$ ' + fmtBRL(avgTicket);

    // Funnel
    const totalLeads = (mk.leads_meta || 0) + (mk.leads_google || 0);
    const qualified = mk.qualified || 0;
    const closedFromMK = (mk.closed_sc || 0) + (mk.closed_ce || 0) + (mk.closed_mg || 0);
    const closed = closings.length || closedFromMK;
    Charts.renderFunnel(document.getElementById('funnel'), [
      { label: 'Leads gerados', value: totalLeads },
      { label: 'Qualificados', value: qualified },
      { label: 'Fechados', value: closed }
    ]);

    // Top cidades
    const cityCount = {};
    closings.forEach(c => {
      const k = `${c.city}_${c.uf}`;
      if (!cityCount[k]) cityCount[k] = { city: c.city, uf: c.uf, count: 0 };
      cityCount[k].count++;
    });
    const ranking = Object.values(cityCount).sort((a, b) => b.count - a.count);
    Charts.renderRanking(document.getElementById('city-ranking'), ranking);

    // Globo overlay (full)
    const allClosings = Store.getAllClosings().filter(c => (c.status || 'Fechado') === 'Fechado');
    const allStates = new Set(allClosings.map(c => c.uf).filter(Boolean));
    const allCities = new Set(allClosings.map(c => c.city).filter(Boolean));
    const allRevenue = allClosings.reduce((s, c) => s + Number(c.value || 0), 0);
    const overlayClosings = document.querySelector('[data-bind="closings-all"]');
    if (overlayClosings) {
      overlayClosings.textContent = allClosings.length;
      document.querySelector('[data-bind="states-count-all"]').textContent = allStates.size;
      document.querySelector('[data-bind="cities-count-all"]').textContent = allCities.size;
      document.querySelector('[data-bind="revenue-all"]').textContent = 'R$ ' + fmtBRL(allRevenue);
    }

    // Lista no overlay
    const overlayList = document.getElementById('closings-overlay-list');
    if (overlayList) {
      const sorted = [...allClosings].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
      if (sorted.length === 0) {
        overlayList.innerHTML = '<div style="color:var(--c-text-3);font-size:12px;padding:20px;text-align:center;">Sem fechamentos registrados ainda</div>';
      } else {
        overlayList.innerHTML = sorted.map(c => `
          <div class="overlay-item">
            <div class="overlay-item__info">
              <span class="overlay-item__name">${c.client}</span>
              <span class="overlay-item__loc">${c.city} · ${c.uf} · ${fmtDate(c.date)}</span>
            </div>
            <span class="overlay-item__val">R$ ${fmtBRL(c.value)}</span>
          </div>
        `).join('');
      }
    }
  },

  renderTrend() {
    const { year } = this.state.period;
    const metric = this.state.trendMetric || 'closings';

    if (metric === 'closings') {
      const digital = [], referral = [];
      for (let m = 0; m < 12; m++) {
        const cls = Store.getClosingsForPeriod(year, m).filter(c => (c.status || 'Fechado') === 'Fechado');
        digital.push(cls.filter(c => c.type === 'digital').length);
        referral.push(cls.filter(c => c.type === 'referral').length);
      }
      Charts.renderTrend(document.getElementById('trend-svg'), [
        { name: 'Digital', color: '#00ff9d', values: digital },
        { name: 'Indicação', color: '#ffb547', values: referral }
      ]);
    } else if (metric === 'leads') {
      const meta = [], google = [];
      for (let m = 0; m < 12; m++) {
        const mk = Store.getMarketing(year, m);
        meta.push(mk.leads_meta || 0);
        google.push(mk.leads_google || 0);
      }
      Charts.renderTrend(document.getElementById('trend-svg'), [
        { name: 'Lead META', color: '#6aa9ff', values: meta },
        { name: 'Lead GOOGLE', color: '#ea4335', values: google }
      ]);
    } else if (metric === 'invest') {
      const meta = [], google = [];
      for (let m = 0; m < 12; m++) {
        const mk = Store.getMarketing(year, m);
        meta.push(mk.meta || 0);
        google.push(mk.google || 0);
      }
      Charts.renderTrend(document.getElementById('trend-svg'), [
        { name: 'META', color: '#6aa9ff', values: meta },
        { name: 'GOOGLE', color: '#ea4335', values: google }
      ]);
    }
  },

  renderSourcesPanel() {
    const { year, month } = this.state.period;
    const closings = Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
    const counts = {};
    closings.forEach(c => {
      const o = c.origin || 'OUTRO';
      counts[o] = (counts[o] || 0) + 1;
    });
    const items = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    Charts.renderSources(document.getElementById('sources'), items);
  },

  // ============= COMMERCIAL =============
  renderCommercial() {
    const closings = this.getFilteredClosings();
    const tbody = document.getElementById('closings-tbody');
    const empty = document.getElementById('empty-closings');
    const tableWrap = document.querySelector('.table-wrap');

    if (closings.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      document.getElementById('closings-table').style.display = 'none';
    } else {
      empty.style.display = 'none';
      document.getElementById('closings-table').style.display = 'table';
      tbody.innerHTML = closings.map(c => `
        <tr>
          <td><span style="font-family:var(--f-mono); font-size:12px; color:var(--c-text-2);">${fmtDate(c.date)}</span></td>
          <td>
            <div class="cell-client">
              <span class="cell-client__name">${c.client || '—'}</span>
              ${c.phone ? `<span class="cell-client__phone">${c.phone}</span>` : ''}
            </div>
          </td>
          <td>
            <span class="cell-type cell-type--${c.type}"><i></i>${c.type === 'digital' ? 'DIGITAL' : 'INDICAÇÃO'}</span>
          </td>
          <td><span style="font-family:var(--f-mono);font-size:11px;color:var(--c-text-2);">${c.origin || '—'}</span></td>
          <td>${c.city || '—'} <span style="color:var(--c-text-3);font-family:var(--f-mono);font-size:10px;">${c.uf || ''}</span></td>
          <td>${c.consultant || '—'}</td>
          <td><span class="cell-status">${c.status || 'Fechado'}</span></td>
          <td class="cell-value">R$ ${fmtBRL(c.value)}</td>
          <td>
            <div class="cell-actions">
              <button class="btn-icon-sm" data-edit="${c.id}" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="btn-icon-sm btn-icon-sm--danger" data-del="${c.id}" title="Remover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      // Bind action buttons
      tbody.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => this.openClosingModal(btn.dataset.edit));
      });
      tbody.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Remover este fechamento?')) {
            Store.removeClosing(btn.dataset.del);
            this.toast('Fechamento removido', 'success');
            this.render();
          }
        });
      });
    }

    // Summary
    document.getElementById('filtered-count').textContent = closings.length;
    const revenue = closings.reduce((s, c) => s + Number(c.value || 0), 0);
    document.getElementById('filtered-revenue').textContent = 'R$ ' + fmtBRL(revenue);
    const avg = closings.length > 0 ? revenue / closings.length : 0;
    document.getElementById('filtered-ticket').textContent = 'R$ ' + fmtBRL(avg);
  },

  getFilteredClosings() {
    const f = this.state.filters;
    return Store.getAllClosings().filter(c => {
      if (f.status && c.status !== f.status) return false;
      if (f.origin && c.origin !== f.origin) return false;
      if (f.city && c.city !== f.city) return false;
      if (f.consultant && c.consultant !== f.consultant) return false;
      if (f.type && c.type !== f.type) return false;
      if (f.search) {
        const s = f.search.toLowerCase();
        const t = `${c.client || ''} ${c.phone || ''} ${c.city || ''} ${c.consultant || ''}`.toLowerCase();
        if (!t.includes(s)) return false;
      }
      return true;
    });
  },

  // ============= MARKETING TAB =============
  renderMarketing() {
    const { year, month } = this.state.period;
    const mk = Store.getMarketing(year, month);

    // Investimento — barras META/GOOGLE/VAGAS proporcionais
    const totalInv = (mk.meta || 0) + (mk.google || 0) + (mk.vagas || 0);
    const setBar = (key, val) => {
      const el = document.querySelector(`[data-bar="${key}"]`);
      if (el) el.style.setProperty('--p', totalInv > 0 ? (val / totalInv) * 100 + '%' : '0%');
    };
    setBar('meta', mk.meta || 0);
    setBar('google', mk.google || 0);
    setBar('vagas', mk.vagas || 0);

    // VAGAS aparece só na aba Marketing
    this.bindAll('invest-vagas', 'R$ ' + fmtBRL(mk.vagas || 0));

    // Leads META + GOOGLE
    const leadsMeta = mk.leads_meta || 0;
    const leadsGoogle = mk.leads_google || 0;
    const totalLeads = leadsMeta + leadsGoogle;
    this.bindAll('leads-meta', fmtNum(leadsMeta));
    this.bindAll('leads-google', fmtNum(leadsGoogle));

    // Split bar leads
    const sa = document.querySelector('[data-bar="leads-meta"]');
    const sb = document.querySelector('[data-bar="leads-google"]');
    if (sa && sb) {
      sa.style.width = totalLeads > 0 ? (leadsMeta / totalLeads * 100) + '%' : '0%';
      sb.style.width = totalLeads > 0 ? (leadsGoogle / totalLeads * 100) + '%' : '0%';
    }

    // CPL por canal (custo do canal ÷ leads do canal)
    const cplMeta = leadsMeta > 0 ? (mk.meta || 0) / leadsMeta : 0;
    const cplGoogle = leadsGoogle > 0 ? (mk.google || 0) / leadsGoogle : 0;
    this.bindAll('cpl-meta', 'R$ ' + fmtBRL(cplMeta));
    this.bindAll('cpl-google', 'R$ ' + fmtBRL(cplGoogle));

    // Qualificados + taxas de conversão por canal
    // Como qualificados é um número total único, calculamos taxa baseada no peso de cada canal
    const qualified = mk.qualified || 0;
    // Taxa META = qualificados (proporcional ao peso do META) ÷ leads META
    // Mas é melhor mostrar taxa de qualificação geral por canal — assumindo proporcional
    const convOverall = totalLeads > 0 ? (qualified / totalLeads) : 0;
    const convMetaPct = leadsMeta > 0 ? Math.round(convOverall * 100) : 0;
    const convGooglePct = leadsGoogle > 0 ? Math.round(convOverall * 100) : 0;
    // Como o usuário pediu "taxa de conversão de cada um", mostro a taxa de fechado/lead por canal
    // Sem dado por canal de fechado, usamos a taxa geral
    this.bindAll('conv-meta', convMetaPct + '%');
    this.bindAll('conv-google', convGooglePct + '%');

    // Fechados por unidade
    const closedSC = mk.closed_sc || 0;
    const closedCE = mk.closed_ce || 0;
    const closedMG = mk.closed_mg || 0;
    const closedTotal = closedSC + closedCE + closedMG;
    this.bindAll('leads-closed', fmtNum(closedTotal));
    this.bindAll('closed-sc', fmtNum(closedSC));
    this.bindAll('closed-ce', fmtNum(closedCE));
    this.bindAll('closed-mg', fmtNum(closedMG));

    // Seguidores
    const totalFollowers = (mk.ig || 0) + (mk.tt || 0) + (mk.fb || 0) + (mk.yt || 0) + (mk.kw || 0);
    this.bindAll('followers-total', fmtNum(totalFollowers) + ' total');
    this.bindAll('followers-instagram', fmtNum(mk.ig || 0));
    this.bindAll('followers-tiktok', fmtNum(mk.tt || 0));
    this.bindAll('followers-facebook', fmtNum(mk.fb || 0));
    this.bindAll('followers-youtube', fmtNum(mk.yt || 0));
    this.bindAll('followers-kawai', fmtNum(mk.kw || 0));

    // Reviews
    this.bindAll('google-reviews', fmtNum(mk.reviews || 0));
  },

  // ============= MODALS =============
  openClosingModal(id = null) {
    const modal = document.getElementById('modal-closing');
    const form = document.getElementById('form-closing');
    form.reset();
    document.getElementById('f-id').value = '';

    const title = document.getElementById('modal-closing-title');
    if (id) {
      const item = Store.getAllClosings().find(c => c.id === id);
      if (item) {
        title.textContent = 'Editar Fechamento';
        document.getElementById('f-id').value = item.id;
        document.querySelector(`[name="type"][value="${item.type}"]`).checked = true;
        document.getElementById('f-date').value = item.date;
        document.getElementById('f-value').value = item.value;
        document.getElementById('f-client').value = item.client;
        document.getElementById('f-phone').value = item.phone || '';
        document.getElementById('f-consultant').value = item.consultant || '';
        document.getElementById('f-city').value = item.city;
        document.getElementById('f-uf').value = item.uf;
        document.getElementById('f-status').value = item.status || 'Fechado';
        document.getElementById('f-origin').value = item.origin || 'META';
        document.getElementById('f-neighborhood').value = item.neighborhood || '';
        document.getElementById('f-notes').value = item.notes || '';
      }
    } else {
      title.textContent = 'Novo Fechamento';
      // Default date = hoje
      document.getElementById('f-date').valueAsDate = new Date();
    }
    modal.classList.add('is-open');
  },

  saveClosing() {
    const id = document.getElementById('f-id').value;
    const type = document.querySelector('[name="type"]:checked').value;
    const city = document.getElementById('f-city').value.trim();
    let uf = document.getElementById('f-uf').value;

    // Auto-fill UF se vazio
    if (!uf) {
      const found = BRAZIL_CITIES.find(c => c.city.toLowerCase() === city.toLowerCase());
      if (found) uf = found.uf;
    }

    const data = {
      type,
      date: document.getElementById('f-date').value,
      value: Number(document.getElementById('f-value').value),
      client: document.getElementById('f-client').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      consultant: document.getElementById('f-consultant').value.trim(),
      city,
      uf,
      status: document.getElementById('f-status').value,
      origin: document.getElementById('f-origin').value,
      neighborhood: document.getElementById('f-neighborhood').value.trim(),
      notes: document.getElementById('f-notes').value.trim()
    };

    if (id) {
      Store.updateClosing(id, data);
      this.toast('Fechamento atualizado', 'success');
    } else {
      Store.addClosing(data);
      this.toast('Fechamento adicionado', 'success');
    }

    document.getElementById('modal-closing').classList.remove('is-open');
    this.render();
  },

  openMarketingModal() {
    const { year, month } = this.state.period;
    const mk = Store.getMarketing(year, month);
    document.getElementById('mk-period-label').textContent = periodLabel(year, month);
    document.getElementById('mk-meta').value = mk.meta || '';
    document.getElementById('mk-google').value = mk.google || '';
    document.getElementById('mk-vagas').value = mk.vagas || '';
    document.getElementById('mk-leads-meta').value = mk.leads_meta || '';
    document.getElementById('mk-leads-google').value = mk.leads_google || '';
    document.getElementById('mk-qualified').value = mk.qualified || '';
    document.getElementById('mk-closed-sc').value = mk.closed_sc || '';
    document.getElementById('mk-closed-ce').value = mk.closed_ce || '';
    document.getElementById('mk-closed-mg').value = mk.closed_mg || '';
    document.getElementById('mk-ig').value = mk.ig || '';
    document.getElementById('mk-tt').value = mk.tt || '';
    document.getElementById('mk-fb').value = mk.fb || '';
    document.getElementById('mk-yt').value = mk.yt || '';
    document.getElementById('mk-kw').value = mk.kw || '';
    document.getElementById('mk-reviews').value = mk.reviews || '';
    document.getElementById('modal-marketing').classList.add('is-open');
  },

  saveMarketing() {
    const { year, month } = this.state.period;
    const data = {
      meta: Number(document.getElementById('mk-meta').value) || 0,
      google: Number(document.getElementById('mk-google').value) || 0,
      vagas: Number(document.getElementById('mk-vagas').value) || 0,
      leads_meta: Number(document.getElementById('mk-leads-meta').value) || 0,
      leads_google: Number(document.getElementById('mk-leads-google').value) || 0,
      qualified: Number(document.getElementById('mk-qualified').value) || 0,
      closed_sc: Number(document.getElementById('mk-closed-sc').value) || 0,
      closed_ce: Number(document.getElementById('mk-closed-ce').value) || 0,
      closed_mg: Number(document.getElementById('mk-closed-mg').value) || 0,
      ig: Number(document.getElementById('mk-ig').value) || 0,
      tt: Number(document.getElementById('mk-tt').value) || 0,
      fb: Number(document.getElementById('mk-fb').value) || 0,
      yt: Number(document.getElementById('mk-yt').value) || 0,
      kw: Number(document.getElementById('mk-kw').value) || 0,
      reviews: Number(document.getElementById('mk-reviews').value) || 0
    };
    Store.setMarketing(year, month, data);
    this.toast('Dados de marketing atualizados', 'success');
    document.getElementById('modal-marketing').classList.remove('is-open');
    this.render();
  },

  // ============= GLOBE =============
  updateGlobes() {
    const allClosings = Store.getAllClosings()
      .filter(c => (c.status || 'Fechado') === 'Fechado')
      .map(c => {
        // Encontrar coords
        const cityData = findCity(c.city, c.uf);
        const stateData = findStateCenter(c.uf);
        const coords = cityData || stateData || null;
        if (!coords) return null;
        return {
          lat: coords.lat,
          lng: coords.lng,
          type: c.type,
          value: c.value,
          client: c.client,
          city: c.city,
          uf: c.uf
        };
      })
      .filter(Boolean);

    Globe.updateMarkers('globe-canvas', allClosings);
    Globe.updateMarkers('globe-canvas-full', allClosings);
  },

  // ============= IMPORT/EXPORT =============
  exportData() {
    const data = Store.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `revive-bsc-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('Dados exportados', 'success');
  },

  importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const ok = Store.importJSON(e.target.result);
      if (ok) {
        this.toast('Dados importados com sucesso', 'success');
        this.render();
      } else {
        this.toast('Erro ao importar arquivo', 'error');
      }
    };
    reader.readAsText(file);
  },

  // ============= TOAST =============
  toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (type ? ' toast--' + type : '');
    requestAnimationFrame(() => {
      t.classList.add('is-visible');
    });
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove('is-visible');
    }, 2600);
  }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
