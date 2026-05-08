/* ============================================
   App principal · ReVive BSC
   ============================================ */

const App = {
  state: {
    currentTab: 'overview',
    period: { year: new Date().getFullYear(), month: new Date().getMonth() },
    overviewScope: 'month', // 'month' ou 'all'
    filters: {
      status: '', origin: '', city: '', consultant: '', type: '', search: ''
    }
  },

  init() {
    Store.load();
    this.initTheme();
    this.bindUI();
    this.bindSearch();
    this.bindThemeToggle();
    this.bindOCR();
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

    // Apagar TODOS os fechamentos (com dupla confirmação)
    const btnDeleteAll = document.getElementById('btn-delete-all-closings');
    if (btnDeleteAll) {
      btnDeleteAll.addEventListener('click', () => {
        const total = Store.getAllClosings().length;
        if (total === 0) {
          this.toast('Não há fechamentos para apagar', 'error');
          return;
        }
        // Confirmação 1
        if (!confirm(`Tem certeza que deseja apagar TODOS os ${total} fechamentos?\n\nEssa ação NÃO pode ser desfeita.`)) return;
        // Confirmação 2 (extra cuidado)
        const typed = prompt(`Pra confirmar, digite APAGAR (em maiúsculas):`);
        if (typed !== 'APAGAR') {
          this.toast('Operação cancelada', 'error');
          return;
        }
        const removed = Store.removeAllClosings();
        this.render();
        this.toast(`${removed} fechamento${removed !== 1 ? 's' : ''} apagado${removed !== 1 ? 's' : ''}`, 'success');
      });
    }

    // Manage consultants
    document.getElementById('btn-manage-consultants').addEventListener('click', () => {
      this.openManageConsultants();
    });
    document.getElementById('btn-add-consultant').addEventListener('click', () => {
      const input = document.getElementById('new-consultant-input');
      const name = input.value.trim();
      if (!name) return;
      const ok = Store.addConsultant(name);
      if (ok) {
        input.value = '';
        this.renderConsultantsList();
        this.populateConsultantSelect('f-consultant');
        this.refreshDynamicFilters();
        this.toast('Consultor adicionado', 'success');
      } else {
        this.toast('Consultor já existe', 'error');
      }
    });
    document.getElementById('new-consultant-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-add-consultant').click(); }
    });

    // Manage partners
    document.getElementById('btn-manage-partners').addEventListener('click', () => {
      this.openManagePartners();
    });
    document.getElementById('btn-manage-partners-from-form').addEventListener('click', () => {
      this.openManagePartners();
    });
    document.getElementById('btn-add-partner').addEventListener('click', () => {
      const input = document.getElementById('new-partner-input');
      const name = input.value.trim();
      if (!name) return;
      const partner = Store.addPartner(name);
      if (partner) {
        input.value = '';
        this.renderPartnersList();
        this.toast('Parceiro adicionado', 'success');
      } else {
        this.toast('Parceiro já existe ou inválido', 'error');
      }
    });
    document.getElementById('new-partner-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-add-partner').click(); }
    });

    // Add partner stat
    document.getElementById('btn-add-partner-stat').addEventListener('click', () => this.openPartnerStatModal());
    document.getElementById('btn-empty-add-partner-stat').addEventListener('click', () => this.openPartnerStatModal());

    // Custo total parceiros (input direto no card)
    const costInput = document.getElementById('partner-cost-input');
    if (costInput) {
      costInput.addEventListener('change', () => {
        const { year, month } = this.state.period;
        Store.setPartnerCost(year, month, costInput.value);
        this.renderPartners();
        this.toast('Custo atualizado', 'success');
      });
    }

    // Form partner stat
    document.getElementById('form-partner-stat').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePartnerStat();
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

    // UF muda → repopular cidades só desse estado
    document.getElementById('f-uf').addEventListener('change', (e) => {
      this.populateCitiesForUF(e.target.value);
    });

    // Cidade: se escolher "Outra cidade" → prompt
    document.getElementById('f-city').addEventListener('change', (e) => {
      if (e.target.value === '__OTHER__') {
        const cityName = prompt('Digite o nome da cidade:');
        const uf = document.getElementById('f-uf').value;
        if (cityName && cityName.trim()) {
          this.populateCitiesForUF(uf, cityName.trim());
        } else {
          e.target.value = '';
        }
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

    // Replay do foguete
    const replayBtn = document.getElementById('rocket-replay');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => this.renderRocket());
    }

    // Comparativo: seletores de mês A e B
    ['compare-month-a', 'compare-year-a', 'compare-month-b', 'compare-year-b'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.renderCompare());
    });

    // Toggle de escopo da Visão Geral (Mês selecionado / Acumulado)
    document.querySelectorAll('[data-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        const scope = btn.dataset.scope;
        if (scope === this.state.overviewScope) return;
        document.querySelectorAll('[data-scope]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.state.overviewScope = scope;
        // Re-renderiza a Visão Geral
        this.renderKPIs();
        this.renderCockpit();
        this.renderRocket();
        this.renderSourcesPanel();
      });
    });
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

    // Comparativo: popular seletores de mês/ano (A = mês atual; B = mês anterior por padrão)
    const now = new Date();
    const cYear = now.getFullYear();
    const cMonth = now.getMonth();
    let prevMonth = cMonth - 1, prevYear = cYear;
    if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }

    const monthsA = document.getElementById('compare-month-a');
    const monthsB = document.getElementById('compare-month-b');
    if (monthsA && monthsB) {
      MONTH_NAMES.forEach((m, i) => {
        const o1 = document.createElement('option'); o1.value = i; o1.textContent = m;
        const o2 = document.createElement('option'); o2.value = i; o2.textContent = m;
        monthsA.appendChild(o1);
        monthsB.appendChild(o2);
      });
      monthsA.value = cMonth;
      monthsB.value = prevMonth;
    }

    const yearsA = document.getElementById('compare-year-a');
    const yearsB = document.getElementById('compare-year-b');
    if (yearsA && yearsB) {
      [cYear - 2, cYear - 1, cYear, cYear + 1].forEach(y => {
        const o1 = document.createElement('option'); o1.value = y; o1.textContent = y;
        const o2 = document.createElement('option'); o2.value = y; o2.textContent = y;
        yearsA.appendChild(o1);
        yearsB.appendChild(o2);
      });
      yearsA.value = cYear;
      yearsB.value = prevYear;
    }
  },

  // Repopula o dropdown de Cidade baseado no UF selecionado
  populateCitiesForUF(uf, selectedCity = '') {
    const sel = document.getElementById('f-city');
    if (!sel) return;
    sel.innerHTML = '';

    if (!uf) {
      sel.innerHTML = '<option value="">— escolha o estado primeiro —</option>';
      return;
    }

    const cities = BRAZIL_CITIES
      .filter(c => c.uf === uf)
      .map(c => c.city)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    sel.innerHTML = '<option value="">Selecione a cidade...</option>';
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });

    // Permitir digitar uma cidade não listada
    const optOther = document.createElement('option');
    optOther.value = '__OTHER__';
    optOther.textContent = '+ Outra cidade (digitar)';
    sel.appendChild(optOther);

    if (selectedCity) {
      // Se a cidade existe na lista, seleciona; senão usa "outra"
      if (cities.includes(selectedCity)) {
        sel.value = selectedCity;
      } else {
        // Adiciona dinamicamente
        const o = document.createElement('option');
        o.value = selectedCity;
        o.textContent = selectedCity;
        sel.insertBefore(o, optOther);
        sel.value = selectedCity;
      }
    }
  },

  refreshDynamicFilters() {
    const closings = Store.getAllClosings();
    const cities = [...new Set(closings.map(c => c.city).filter(Boolean))].sort();
    const consultants = Store.getConsultants();

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
  },

  setActiveTab(tab) {
    this.state.currentTab = tab;
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.tabPanel === tab);
    });
    // Aba 'globe' agora usa o mapa do Brasil 2D; 'overview' continua com o globo 3D
    if (tab === 'globe') {
      requestAnimationFrame(() => {
        BrazilMap.init();
        this.updateBrazilMap();
      });
    } else if (tab === 'overview') {
      requestAnimationFrame(() => {
        Globe.init('globe-canvas');
        Globe.handleResize('globe-canvas');
        this.updateGlobes();
      });
    }
  },

  // ============= TEMA (claro/escuro) =============
  initTheme() {
    const saved = localStorage.getItem('revive-bsc-theme');
    if (saved === 'light') {
      document.body.classList.add('theme-light');
    }
  },

  bindThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('theme-light');
      localStorage.setItem('revive-bsc-theme', isLight ? 'light' : 'dark');
    });
  },

  // ============= OCR (importar prints do ReVive) =============
  bindOCR() {
    const fab = document.getElementById('ocr-fab');
    const panel = document.getElementById('ocr-panel');
    const dropzone = document.getElementById('ocr-dropzone');
    const fileInput = document.getElementById('ocr-file-input');
    if (!fab || !panel) return;

    this.ocrItems = []; // { id, file, blobUrl, status, progress, parsed, error }

    const open = () => {
      panel.classList.add('is-open');
      // Pré-carrega Tesseract assim que abre (otimização)
      OCR.loadTesseract().catch(() => {});
    };
    const close = () => panel.classList.remove('is-open');

    fab.addEventListener('click', open);
    panel.querySelectorAll('[data-ocr-close]').forEach(el => el.addEventListener('click', close));

    // Click no dropzone abre o seletor de arquivos
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      this.handleOCRFiles([...e.target.files]);
      e.target.value = '';
    });

    // Drag & drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-drag-over');
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      this.handleOCRFiles(files);
    });

    // Cole (Ctrl+V) — só funciona quando o painel está aberto
    document.addEventListener('paste', (e) => {
      if (!panel.classList.contains('is-open')) return;
      const items = [...(e.clipboardData?.items || [])];
      const files = items
        .filter(it => it.type.startsWith('image/'))
        .map(it => it.getAsFile())
        .filter(Boolean);
      if (files.length > 0) {
        e.preventDefault();
        this.handleOCRFiles(files);
      }
    });

    // ESC fecha
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    // Tabs de modo (Imagem / Texto / Planilha)
    document.querySelectorAll('[data-ocr-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ocr-mode]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const mode = btn.dataset.ocrMode;
        document.getElementById('ocr-dropzone').style.display = (mode === 'image') ? '' : 'none';
        document.getElementById('ocr-textmode').style.display = (mode === 'text') ? '' : 'none';
        document.getElementById('ocr-xlsxmode').style.display = (mode === 'xlsx') ? '' : 'none';
      });
    });

    // Botão "Processar texto"
    const parseTextBtn = document.getElementById('ocr-parse-text');
    if (parseTextBtn) {
      parseTextBtn.addEventListener('click', () => {
        const ta = document.getElementById('ocr-text-input');
        const txt = ta.value.trim();
        if (!txt) {
          this.toast('Cole o texto antes de processar', 'error');
          return;
        }
        this.handleOCRText(txt);
        ta.value = '';
      });
    }

    // Salvar todos
    const saveAllBtn = document.getElementById('ocr-save-all');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => this.saveAllOCRItems());
    }
    // Limpar todos
    const clearAllBtn = document.getElementById('ocr-clear-all');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (this.ocrItems.length === 0) return;
        if (confirm(`Limpar ${this.ocrItems.length} item(s) da fila?`)) {
          this.ocrItems.forEach(it => { if (it.blobUrl) URL.revokeObjectURL(it.blobUrl); });
          this.ocrItems = [];
          this.renderOCRQueue();
        }
      });
    }

    // Modo XLSX - arquivo planilha
    const xlsxBtn = document.getElementById('ocr-xlsx-btn');
    const xlsxInput = document.getElementById('ocr-xlsx-input');
    if (xlsxBtn && xlsxInput) {
      xlsxBtn.addEventListener('click', () => xlsxInput.click());
      xlsxInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleXLSXFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }
  },

  // Processa texto colado (mais rápido que OCR de imagem)
  handleOCRText(rawText) {
    const results = OCR.parseMultiple(rawText);
    results.forEach(parsed => {
      const id = 'ocr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const item = {
        id, file: null, blobUrl: null,
        status: 'ready', progress: 100, parsed, error: null,
        sourceLabel: 'Texto colado'
      };
      this.ocrItems.push(item);
    });
    this.renderOCRQueue();
    if (results.length > 1) {
      this.toast(`${results.length} fechamentos detectados`, 'success');
    }
  },

  // Importa planilha XLSX
  async handleXLSXFile(file) {
    try {
      const results = await XLSXImport.parse(file);
      if (!results || results.length === 0) {
        this.toast('Nenhum dado encontrado na planilha', 'error');
        return;
      }

      results.forEach(parsed => {
        const id = 'xlsx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const item = {
          id, file: null, blobUrl: null,
          status: 'ready', progress: 100, parsed, error: null,
          sourceLabel: `Planilha — ${parsed.consultant}`
        };
        this.ocrItems.push(item);
      });

      this.renderOCRQueue();
      this.toast(`${results.length} fechamento(s) importado(s)`, 'success');
    } catch (err) {
      console.error(err);
      this.toast(`Erro ao importar planilha: ${err.message}`, 'error');
    }
  },

  async handleOCRFiles(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
      // Cria 1 item "container" pra essa imagem que vai gerar N itens depois
      const containerId = 'ocrct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const blobUrl = URL.createObjectURL(file);
      const containerItem = {
        id: containerId, file, blobUrl,
        status: 'processing', progress: 0,
        parsed: null, error: null, isContainer: true
      };
      this.ocrItems.push(containerItem);
      this.renderOCRQueue();

      try {
        const text = await OCR.recognize(file, (p) => {
          containerItem.progress = p;
          this.renderOCRItem(containerItem);
        });

        // Tenta detectar múltiplos clientes
        const results = OCR.parseMultiple(text);

        // Remove o container e gera itens individuais
        this.ocrItems = this.ocrItems.filter(i => i.id !== containerId);
        results.forEach((parsed, idx) => {
          const id = 'ocr_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 5);
          this.ocrItems.push({
            id, file, blobUrl: idx === 0 ? blobUrl : null, // só o primeiro mantém referência
            status: 'ready', progress: 100, parsed, error: null,
            sharedBlobOwner: idx === 0 ? null : blobUrl
          });
        });

        if (results.length > 1) {
          this.toast(`${results.length} fechamentos detectados nesse print`, 'success');
        }
        this.renderOCRQueue();
      } catch (err) {
        console.error(err);
        containerItem.status = 'error';
        containerItem.error = err.message || 'Erro ao processar';
        this.renderOCRItem(containerItem);
      }
    }
  },

  renderOCRQueue() {
    const queue = document.getElementById('ocr-queue');
    if (!queue) return;
    queue.innerHTML = '';
    this.ocrItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'ocr-item';
      el.dataset.ocrId = item.id;
      queue.appendChild(el);
      this.renderOCRItem(item);
    });
    // Atualiza barra "Salvar todos"
    const bar = document.getElementById('ocr-bulk-bar');
    const countEl = document.getElementById('ocr-bulk-count');
    const readyCount = this.ocrItems.filter(i => i.status === 'ready' && i.parsed && i.parsed.date).length;
    if (bar && countEl) {
      bar.style.display = this.ocrItems.length > 1 ? 'flex' : 'none';
      countEl.textContent = readyCount;
    }
  },

  renderOCRItem(item) {
    const el = document.querySelector(`[data-ocr-id="${item.id}"]`);
    if (!el) {
      this.renderOCRQueue();
      return;
    }
    let html = '';
    if (item.blobUrl) {
      html += `<img class="ocr-item__thumb" src="${item.blobUrl}" alt=""/>`;
    } else {
      html += `<div class="ocr-item__thumb ocr-item__thumb--text" style="display:grid;place-items:center;color:var(--c-text-3);">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>
      </div>`;
    }
    html += `<div class="ocr-item__body">`;

    if (item.status === 'processing' || item.status === 'queued') {
      html += `
        <span class="ocr-item__status ocr-item__status--processing">
          ⏳ Lendo print... ${item.progress}%
        </span>
        <div class="ocr-item__progress-bar"><i style="--w:${item.progress}%"></i></div>
      `;
    } else if (item.status === 'error') {
      html += `
        <span class="ocr-item__status ocr-item__status--error">⚠️ Falhou</span>
        <p style="font-size:11px;color:var(--c-text-3);margin-top:4px;">${item.error}</p>
        <div class="ocr-item__actions">
          <button class="ocr-btn-discard" data-ocr-discard="${item.id}">Remover</button>
        </div>
      `;
    } else if (item.status === 'ready') {
      const p = item.parsed;
      const f = (val, miss = '—') => val
        ? `<span class="ocr-item__field-val">${val}</span>`
        : `<span class="ocr-item__field-val ocr-item__field-val--missing">${miss}</span>`;
      html += `
        <span class="ocr-item__status ocr-item__status--ready">✓ Pronto · revise os campos</span>
        <div class="ocr-item__fields">
          <div class="ocr-item__field">
            <span class="ocr-item__field-label">Cliente</span>
            ${f(p.client)}
          </div>
          <div class="ocr-item__field">
            <span class="ocr-item__field-label">Consultor</span>
            ${f(p.consultant)}
          </div>
          <div class="ocr-item__field">
            <span class="ocr-item__field-label">Cidade / UF</span>
            ${f(p.city ? `${p.city} · ${p.uf || '?'}` : '')}
          </div>
          <div class="ocr-item__field">
            <span class="ocr-item__field-label">Telefone</span>
            ${f(p.phone)}
          </div>
          <div class="ocr-item__field">
            <span class="ocr-item__field-label">Data</span>
            ${f(p.date ? fmtDate(p.date) : '')}
          </div>
          <div class="ocr-item__field">
            <span class="ocr-item__field-label">Tipo · Origem</span>
            <span class="ocr-item__field-val">${p.type === 'digital' ? 'Digital' : 'Indicação'} · ${p.origin}</span>
          </div>
          <div class="ocr-item__field" style="grid-column:1/-1;">
            <span class="ocr-item__field-label">Processos</span>
            ${f(p.processes && p.processes.length ? p.processes.join(', ') : '')}
          </div>
        </div>
        <div class="ocr-item__actions">
          <button class="ocr-btn-discard" data-ocr-discard="${item.id}">Descartar</button>
          <button class="ocr-btn-edit" data-ocr-edit="${item.id}">Editar antes</button>
          <button class="ocr-btn-save" data-ocr-save="${item.id}">Salvar fechamento</button>
        </div>
      `;
    }

    html += '</div>';
    el.innerHTML = html;

    // Bind ações
    el.querySelectorAll('[data-ocr-save]').forEach(b => b.addEventListener('click', () => this.saveOCRItem(b.dataset.ocrSave)));
    el.querySelectorAll('[data-ocr-edit]').forEach(b => b.addEventListener('click', () => this.editOCRItem(b.dataset.ocrEdit)));
    el.querySelectorAll('[data-ocr-discard]').forEach(b => b.addEventListener('click', () => this.discardOCRItem(b.dataset.ocrDiscard)));
  },

  saveOCRItem(id) {
    const item = this.ocrItems.find(i => i.id === id);
    if (!item || !item.parsed) return;
    const p = item.parsed;
    // Validação mínima — só data é obrigatória agora (cliente é opcional)
    if (!p.date) {
      this.toast('Data é obrigatória. Use "Editar antes" para completar.', 'error');
      return;
    }
    const data = {
      type: p.type || 'referral',
      date: p.date,
      processes: p.processes || [],
      processOther: p.processOther || '',
      client: p.client || '',
      phone: p.phone || '',
      consultant: p.consultant || '',
      city: p.city || '',
      uf: p.uf || '',
      status: p.status || 'Fechado',
      origin: p.origin || 'INDICAÇÃO PARCEIRO',
      neighborhood: '',
      notes: p.audited ? 'Auditado (importado)' : 'Importado'
    };
    Store.addClosing(data);
    if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    this.ocrItems = this.ocrItems.filter(i => i.id !== id);
    this.renderOCRQueue();
    this.render();
    const label = p.client || `${p.city || '?'} (${p.consultant || '?'})`;
    this.toast(`Fechamento de ${label} salvo`, 'success');
  },

  // Salva TODOS os items prontos da fila de uma vez
  saveAllOCRItems() {
    const ready = this.ocrItems.filter(i => i.status === 'ready' && i.parsed && i.parsed.date);
    if (ready.length === 0) {
      this.toast('Nenhum item pronto para salvar', 'error');
      return;
    }
    let saved = 0;
    ready.forEach(item => {
      const p = item.parsed;
      Store.addClosing({
        type: p.type || 'referral',
        date: p.date,
        processes: p.processes || [],
        processOther: p.processOther || '',
        client: p.client || '',
        phone: p.phone || '',
        consultant: p.consultant || '',
        city: p.city || '',
        uf: p.uf || '',
        status: p.status || 'Fechado',
        origin: p.origin || 'INDICAÇÃO PARCEIRO',
        neighborhood: '',
        notes: p.audited ? 'Auditado (importado em lote)' : 'Importado em lote'
      });
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
      saved++;
    });
    this.ocrItems = this.ocrItems.filter(i => !(i.status === 'ready' && i.parsed && i.parsed.date));
    this.renderOCRQueue();
    this.render();
    this.toast(`${saved} fechamento${saved !== 1 ? 's' : ''} salvo${saved !== 1 ? 's' : ''} de uma vez! 🚀`, 'success');
  },

  editOCRItem(id) {
    const item = this.ocrItems.find(i => i.id === id);
    if (!item || !item.parsed) return;
    const p = item.parsed;

    // Abre o modal padrão de fechamento, pré-preenchido
    document.getElementById('ocr-panel').classList.remove('is-open');
    this.openClosingModal();

    // Pré-preenche
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    document.querySelector(`[name="type"][value="${p.type || 'digital'}"]`).checked = true;
    setVal('f-date', p.date);
    setVal('f-client', p.client);
    setVal('f-phone', p.phone);
    setVal('f-consultant', p.consultant);
    setVal('f-uf', p.uf);
    if (p.uf) this.populateCitiesForUF(p.uf, p.city);
    setVal('f-origin', p.origin);
    setVal('f-notes', p.audited ? 'Auditado (importado via OCR)' : 'Importado via OCR');
    if (p.processes && p.processes.length) {
      this.renderProcessPicker(p.processes);
    }

    // Remove o item da fila
    if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    this.ocrItems = this.ocrItems.filter(i => i.id !== id);
    this.renderOCRQueue();
  },

  discardOCRItem(id) {
    const item = this.ocrItems.find(i => i.id === id);
    if (item) if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    this.ocrItems = this.ocrItems.filter(i => i.id !== id);
    this.renderOCRQueue();
  },

  // ============= BUSCA FLUTUANTE =============
  bindSearch() {
    const fab = document.getElementById('search-fab');
    const panel = document.getElementById('search-panel');
    const input = document.getElementById('search-input');

    if (!fab || !panel || !input) return;

    const open = () => {
      panel.classList.add('is-open');
      setTimeout(() => input.focus(), 80);
    };
    const close = () => {
      panel.classList.remove('is-open');
      input.value = '';
      this.renderSearchEmpty();
    };

    fab.addEventListener('click', open);
    panel.querySelectorAll('[data-search-close]').forEach(el => {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        close();
      }
      // Atalho global: Ctrl/Cmd + K abre a busca
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (panel.classList.contains('is-open')) close(); else open();
      }
    });

    // Input — busca em tempo real
    input.addEventListener('input', () => {
      this.runSearch(input.value);
    });

    // Chips de sugestão
    document.querySelectorAll('[data-search-query]').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.searchQuery;
        input.focus();
        this.runSearch(input.value);
      });
    });
  },

  renderSearchEmpty() {
    const results = document.getElementById('search-results');
    if (!results) return;
    results.innerHTML = `
      <div class="search-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="11" cy="11" r="7"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>Digite no campo abaixo para buscar</p>
      </div>
    `;
  },

  // Motor de busca
  runSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const results = document.getElementById('search-results');
    if (!results) return;

    if (!q) {
      this.renderSearchEmpty();
      return;
    }

    const all = Store.getAllClosings().filter(c => (c.status || 'Fechado') === 'Fechado');

    // Detectar intenção: canal (meta/google), origem indicação, processo, cidade
    const isMeta = /\bmeta\b/i.test(q);
    const isGoogle = /\bgoogle\b/i.test(q);
    const isOrganico = /org[âa]nico/i.test(q);
    const isIndicacao = /indica[çc][ãa]o/i.test(q);

    let filtered = all;
    let title = '';
    let scopeLabel = '';

    if (isMeta) {
      filtered = all.filter(c => c.origin === 'META');
      scopeLabel = 'no META';
    } else if (isGoogle) {
      filtered = all.filter(c => c.origin === 'GOOGLE');
      scopeLabel = 'no GOOGLE';
    } else if (isOrganico) {
      filtered = all.filter(c => c.origin === 'ORGÂNICO');
      scopeLabel = 'no Orgânico';
    } else if (isIndicacao) {
      filtered = all.filter(c => c.type === 'referral' || c.origin === 'INDICAÇÃO');
      scopeLabel = 'por indicação';
    } else {
      // Tenta processo ou cidade ou cliente
      filtered = all.filter(c => {
        const haystack = [
          c.client, c.city, c.uf, c.consultant, c.origin,
          (c.processes || []).join(' '),
          c.processOther || ''
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
      scopeLabel = `para "${query.trim()}"`;
    }

    if (filtered.length === 0) {
      results.innerHTML = `
        <div class="search-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>Nenhum fechamento encontrado ${scopeLabel}</p>
        </div>
      `;
      return;
    }

    // Quebrar por processo
    const processCounts = {};
    filtered.forEach(c => {
      const procs = (c.processes && c.processes.length) ? c.processes : ['(sem tipo)'];
      procs.forEach(p => {
        const key = p === 'Outros' && c.processOther ? `Outros: ${c.processOther}` : p;
        processCounts[key] = (processCounts[key] || 0) + 1;
      });
    });
    const procRanking = Object.entries(processCounts).sort((a, b) => b[1] - a[1]);

    let html = `
      <div class="search-answer">
        <div class="search-answer__count">${filtered.length}</div>
        <div class="search-answer__title">${filtered.length === 1 ? 'fechamento' : 'fechamentos'} encontrado${filtered.length === 1 ? '' : 's'} ${scopeLabel}</div>

        <div class="search-answer__breakdown">
    `;

    procRanking.slice(0, 8).forEach(([proc, count]) => {
      html += `
        <div class="search-answer__row">
          <span class="search-answer__row-label">${proc}</span>
          <span class="search-answer__row-count">${count}</span>
        </div>
      `;
    });

    html += `</div>`;

    // Lista de clientes (limita a 30)
    html += `<div class="search-answer__list">`;
    filtered.slice(0, 30).forEach(c => {
      const procs = (c.processes && c.processes.length)
        ? c.processes.join(', ') + (c.processOther ? ` (${c.processOther})` : '')
        : '—';
      html += `
        <div class="search-answer__item">
          <div class="search-answer__item-info">
            <span class="search-answer__item-name">${c.client || '—'}</span>
            <span class="search-answer__item-meta">${c.city || ''} · ${c.uf || ''} · ${fmtDate(c.date)}</span>
          </div>
          <span class="search-answer__item-tag">${(c.origin || '—')}</span>
        </div>
      `;
    });
    if (filtered.length > 30) {
      html += `<div style="text-align:center;color:var(--c-text-3);font-size:11px;padding:6px;font-family:var(--f-mono);">+ ${filtered.length - 30} fechamento(s)…</div>`;
    }
    html += `</div></div>`;

    results.innerHTML = html;
  },

  // ============= RENDER PRINCIPAL =============
  render() {
    const { year, month } = this.state.period;
    this.renderPeriodLabels();
    this.renderKPIs();
    this.renderCockpit();
    this.renderRocket();
    this.renderTrend();
    this.renderSourcesPanel();
    this.renderCommercial();
    this.renderMarketing();
    this.renderPartners();
    this.renderConsultants();
    this.renderCompare();
    this.refreshDynamicFilters();
    this.updateGlobes();
    this.updateBrazilMap();
  },

  renderPeriodLabels() {
    const label = periodLabel(this.state.period.year, this.state.period.month);
    document.querySelectorAll('[data-bind="period-label"]').forEach(el => {
      el.textContent = label;
    });
  },

  // ============= KPIs =============
  // Retorna os fechamentos baseado no escopo da Visão Geral (mês ou acumulado)
  getScopeClosings() {
    const { year, month } = this.state.period;
    if (this.state.overviewScope === 'all') {
      return Store.getAllClosings().filter(c => (c.status || 'Fechado') === 'Fechado');
    }
    return Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
  },

  // Atualiza o badge de "Acumulado total" com a contagem
  updateScopeBadge() {
    const allCount = Store.getAllClosings().filter(c => (c.status || 'Fechado') === 'Fechado').length;
    const el = document.getElementById('scope-all-count');
    if (el) el.textContent = allCount;
  },

  renderKPIs() {
    const { year, month } = this.state.period;
    const isAll = this.state.overviewScope === 'all';
    const closings = this.getScopeClosings();
    const mk = Store.getMarketing(year, month);
    const mkLast = Store.getMarketing(year, month - 1);

    // Atualiza badge do toggle
    this.updateScopeBadge();

    // ===== Custo com Indicações Parceiras =====
    const referralCost = mk.referralCost || 0;
    const referralCostLast = mkLast.referralCost || 0;
    const referralClosed = closings.filter(c => c.type === 'referral').length;
    const referralClosedLast = Store.getClosingsForPeriod(year, month - 1).filter(c => (c.status || 'Fechado') === 'Fechado' && c.type === 'referral').length;
    const cacReferral = referralClosed > 0 ? referralCost / referralClosed : 0;

    document.querySelector('[data-bind="referral-cost"]').textContent = fmtBRL(referralCost);
    document.querySelector('[data-bind="referral-closed"]').textContent = referralClosed;
    document.querySelector('[data-bind="cac-referral"]').textContent = 'R$ ' + fmtBRL(cacReferral);
    this.setBadge('referral-cost', isAll ? 0 : this.deltaPct(referralCost, referralCostLast));

    // ===== Fechamentos =====
    const closingsCount = closings.length;
    const digitalCount = closings.filter(c => c.type === 'digital').length;
    const closingsLast = Store.getClosingsForPeriod(year, month - 1).filter(c => (c.status || 'Fechado') === 'Fechado').length;
    document.querySelector('[data-bind="closings"]').textContent = closingsCount;
    document.querySelector('[data-bind="closings-digital"]').textContent = digitalCount;
    document.querySelector('[data-bind="closings-referral"]').textContent = referralClosed;
    const splitPct = closingsCount > 0 ? (digitalCount / closingsCount) * 100 : 0;
    document.querySelector('.kpi__split-digital').style.width = splitPct + '%';
    this.setBadge('closings', isAll ? 0 : this.deltaPct(closingsCount, closingsLast));

    // ===== Investimento total =====
    const investTotal = (mk.meta || 0) + (mk.google || 0) + (mk.vagas || 0);
    const investLast  = (mkLast.meta || 0) + (mkLast.google || 0) + (mkLast.vagas || 0);

    // ===== Total de leads (META + GOOGLE) =====
    const totalLeads = (mk.leads_meta || 0) + (mk.leads_google || 0);
    const totalLeadsLast = (mkLast.leads_meta || 0) + (mkLast.leads_google || 0);

    // ===== CAC clássico = Investimento ÷ Fechamentos digitais =====
    const cac = digitalCount > 0 ? investTotal / digitalCount : 0;
    const digitalCountLast = Store.getClosingsForPeriod(year, month - 1).filter(c => (c.status || 'Fechado') === 'Fechado' && c.type === 'digital').length;
    const cacLast = digitalCountLast > 0 ? investLast / digitalCountLast : 0;
    this.bindKPI('cac', fmtBRL(cac), isAll ? 0 : this.deltaPct(cac, cacLast, true));

    // ===== CPL =====
    const investPaid = (mk.meta || 0) + (mk.google || 0);
    const cpl = totalLeads > 0 ? investPaid / totalLeads : 0;
    const investPaidLast = (mkLast.meta || 0) + (mkLast.google || 0);
    const cplLast = totalLeadsLast > 0 ? investPaidLast / totalLeadsLast : 0;
    this.bindKPI('cpl', fmtBRL(cpl), isAll ? 0 : this.deltaPct(cpl, cplLast, true));

    // ===== Leads no KPI =====
    this.bindAll('leads-total', fmtNum(totalLeads));
    const qualified = mk.qualified || 0;
    this.bindAll('leads-qualified', fmtNum(qualified));
    const conv = totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0;
    this.bindAll('conversion-rate', conv + '%');
    this.setBadge('leads', isAll ? 0 : this.deltaPct(totalLeads, totalLeadsLast));

    // ===== Investimento — KPI no topo =====
    this.bindAll('invest-total', fmtBRL(investTotal));
    this.bindAll('invest-meta', 'R$ ' + fmtBRL(mk.meta || 0));
    this.bindAll('invest-google', 'R$ ' + fmtBRL(mk.google || 0));
    this.setBadge('invest', isAll ? 0 : this.deltaPct(investTotal, investLast));

    // ===== Sparklines =====
    this.renderSparklines();
  },

  bindAll(name, value) {
    document.querySelectorAll(`[data-bind="${name}"]`).forEach(el => el.textContent = value);
  },

  bindKPI(name, value, delta) {
    this.bindAll(name, value);
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
    // Mantida por compat — retorna apenas count para evitar quebrar referências antigas
    return Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado').length;
  },

  renderSparklines() {
    const { year, month } = this.state.period;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m < 0) { m += 12; y--; }
      months.push({ year: y, month: m });
    }

    // CAC sparkline (Investimento ÷ fechamentos digitais)
    const cacs = months.map(p => {
      const mk = Store.getMarketing(p.year, p.month);
      const inv = (mk.meta || 0) + (mk.google || 0) + (mk.vagas || 0);
      const dig = Store.getClosingsForPeriod(p.year, p.month).filter(c => (c.status || 'Fechado') === 'Fechado' && c.type === 'digital').length;
      return dig > 0 ? inv / dig : 0;
    });
    Charts.sparkline(document.querySelector('[data-spark="cac"]'), cacs, { color: '#ffb547' });

    // CPL
    const cpls = months.map(p => {
      const mk = Store.getMarketing(p.year, p.month);
      const investPaid = (mk.meta || 0) + (mk.google || 0);
      const lds = (mk.leads_meta || 0) + (mk.leads_google || 0);
      return lds > 0 ? investPaid / lds : 0;
    });
    Charts.sparkline(document.querySelector('[data-spark="cpl"]'), cpls, { color: '#6aa9ff' });

    const cacLargeEl = document.querySelector('[data-spark="cac-large"]');
    if (cacLargeEl) Charts.sparkline(cacLargeEl, cacs, { color: '#ffb547' });
  },

  // ============= COCKPIT =============
  renderCockpit() {
    const { year, month } = this.state.period;
    const closings = this.getScopeClosings();
    const mk = Store.getMarketing(year, month);

    // Globe stats
    const states = new Set(closings.map(c => c.uf).filter(Boolean));
    const cities = new Set(closings.map(c => c.city).filter(Boolean));

    // Top processo do mês
    const procCount = {};
    closings.forEach(c => {
      const procs = c.processes || [];
      procs.forEach(p => {
        const name = p.startsWith('Outros:') ? 'Outros' : p;
        procCount[name] = (procCount[name] || 0) + 1;
      });
    });
    const topProc = Object.entries(procCount).sort((a, b) => b[1] - a[1])[0];

    document.querySelector('[data-bind="states-count"]').textContent = states.size;
    document.querySelector('[data-bind="cities-count"]').textContent = cities.size;
    document.querySelector('[data-bind="top-process"]').textContent = topProc ? topProc[0] : '—';

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
    const allReferrals = allClosings.filter(c => c.type === 'referral').length;
    const overlayClosings = document.querySelector('[data-bind="closings-all"]');
    if (overlayClosings) {
      overlayClosings.textContent = allClosings.length;
      document.querySelector('[data-bind="states-count-all"]').textContent = allStates.size;
      document.querySelector('[data-bind="cities-count-all"]').textContent = allCities.size;
      document.querySelector('[data-bind="referrals-all"]').textContent = allReferrals;
    }

    // Lista no overlay
    const overlayList = document.getElementById('closings-overlay-list');
    if (overlayList) {
      const sorted = [...allClosings].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date)).slice(0, 30);
      if (sorted.length === 0) {
        overlayList.innerHTML = '<div style="color:var(--c-text-3);font-size:12px;padding:20px;text-align:center;">Sem fechamentos registrados ainda</div>';
      } else {
        overlayList.innerHTML = sorted.map(c => {
          const procs = (c.processes || []).slice(0, 2).join(', ');
          return `
            <div class="overlay-item">
              <div class="overlay-item__info">
                <span class="overlay-item__name">${c.client}</span>
                <span class="overlay-item__loc">${c.city} · ${c.uf} · ${fmtDate(c.date)}</span>
              </div>
              <span class="overlay-item__val" style="font-size:10px;">${procs || '—'}</span>
            </div>
          `;
        }).join('');
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

  // Foguete: fechamentos por dia do mês (ou por mês, se escopo = all)
  renderRocket() {
    const { year, month } = this.state.period;
    const isAll = this.state.overviewScope === 'all';

    let daily, labels, peakLabel, avgLabel;

    if (isAll) {
      // Modo "Acumulado": mostra fechamentos por MÊS dos últimos 12 meses
      const closings = Store.getAllClosings().filter(c => (c.status || 'Fechado') === 'Fechado');
      daily = new Array(12).fill(0);
      labels = new Array(12).fill('');
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        let m = now.getMonth() - i;
        let y = now.getFullYear();
        while (m < 0) { m += 12; y--; }
        months.push({ year: y, month: m });
      }
      closings.forEach(c => {
        const d = parseLocalDate(c.date);
        const idx = months.findIndex(p => p.year === d.getFullYear() && p.month === d.getMonth());
        if (idx >= 0) daily[idx]++;
      });
      labels = months.map(p => MONTH_ABBR[p.month] + '/' + String(p.year).slice(2));
      peakLabel = 'Pico mensal';
      avgLabel = 'Média / mês';
    } else {
      // Modo "Mês": fechamentos por DIA do mês
      const closings = Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      daily = new Array(daysInMonth).fill(0);
      labels = null;
      closings.forEach(c => {
        const d = parseLocalDate(c.date);
        const day = d.getDate();
        if (day >= 1 && day <= daysInMonth) daily[day - 1]++;
      });
      peakLabel = 'Pico do mês';
      avgLabel = 'Média / dia';
    }

    const peak = Math.max(...daily, 0);
    const total = daily.reduce((s, v) => s + v, 0);
    const avg = daily.length > 0 ? (total / daily.length).toFixed(1) : '0';

    const peakEl = document.getElementById('rocket-peak');
    const avgEl = document.getElementById('rocket-avg');
    if (peakEl) peakEl.textContent = peak;
    if (avgEl) avgEl.textContent = avg;

    // Atualiza labels (Pico do mês / Pico mensal)
    document.querySelectorAll('.rocket-stat__label').forEach((el, idx) => {
      if (idx === 0) el.textContent = peakLabel;
      if (idx === 1) el.textContent = avgLabel;
    });

    Charts.renderRocket(document.getElementById('rocket-svg'), daily, { labels });
  },

  renderSourcesPanel() {
    const closings = this.getScopeClosings();
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

    if (closings.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      document.getElementById('closings-table').style.display = 'none';
    } else {
      empty.style.display = 'none';
      document.getElementById('closings-table').style.display = 'table';
      tbody.innerHTML = closings.map(c => {
        const procs = (c.processes || []).map(p => {
          const display = p.startsWith('Outros:') ? p.replace('Outros:', '').trim() || 'Outros' : p;
          return `<span class="proc-chip">${display}</span>`;
        }).join('');
        return `
        <tr>
          <td><span style="font-family:var(--f-mono); font-size:12px; color:var(--c-text-2);">${fmtDate(c.date)}</span></td>
          <td>
            <div class="cell-client">
              <span class="cell-client__name">${c.client || '—'}${c.consultant ? `<span class="cell-client__consultant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></svg>${c.consultant}</span>` : ''}</span>
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
          <td><div class="cell-processes">${procs || '<span style="color:var(--c-text-3);font-size:11px;">—</span>'}</div></td>
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
      `;}).join('');

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
    const digital = closings.filter(c => c.type === 'digital').length;
    const referral = closings.filter(c => c.type === 'referral').length;
    document.getElementById('filtered-count').textContent = closings.length;
    document.getElementById('filtered-digital').textContent = digital;
    document.getElementById('filtered-referral').textContent = referral;
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

    // Popular consultor select com lista atual
    this.populateConsultantSelect('f-consultant');

    // Resetar cidade (depende de UF)
    this.populateCitiesForUF('');

    // Renderizar chips de processos
    this.renderProcessPicker([]);

    const title = document.getElementById('modal-closing-title');
    if (id) {
      const item = Store.getAllClosings().find(c => c.id === id);
      if (item) {
        title.textContent = 'Editar Fechamento';
        document.getElementById('f-id').value = item.id;
        document.querySelector(`[name="type"][value="${item.type}"]`).checked = true;
        document.getElementById('f-date').value = item.date;
        document.getElementById('f-client').value = item.client;
        document.getElementById('f-phone').value = item.phone || '';
        document.getElementById('f-consultant').value = item.consultant || '';
        // UF primeiro, depois popula cidades, depois seleciona a cidade
        document.getElementById('f-uf').value = item.uf || '';
        this.populateCitiesForUF(item.uf || '', item.city || '');
        document.getElementById('f-status').value = item.status || 'Fechado';
        document.getElementById('f-origin').value = item.origin || 'INDICAÇÃO PARCEIRO';
        document.getElementById('f-neighborhood').value = item.neighborhood || '';
        document.getElementById('f-notes').value = item.notes || '';
        this.renderProcessPicker(item.processes || []);
      }
    } else {
      title.textContent = 'Novo Fechamento';
      document.getElementById('f-date').valueAsDate = new Date();
    }
    modal.classList.add('is-open');
  },

  populateConsultantSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— selecione —</option>';
    Store.getConsultants().forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    sel.value = current;
  },

  renderProcessPicker(selectedList) {
    const picker = document.getElementById('f-processes-picker');
    if (!picker) return;
    const selected = new Set();
    let othersText = '';
    (selectedList || []).forEach(p => {
      if (p.startsWith('Outros:')) {
        selected.add('Outros');
        othersText = p.replace('Outros:', '').trim();
      } else {
        selected.add(p);
      }
    });

    picker.innerHTML = PROCESS_TYPES.map(p =>
      `<span class="chip-pick ${selected.has(p) ? 'is-active' : ''}" data-process="${p}">${p}</span>`
    ).join('');

    picker.querySelectorAll('.chip-pick').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('is-active');
        // Mostrar/esconder campo "Outros"
        const othersChip = picker.querySelector('[data-process="Outros"]');
        const othersWrap = document.getElementById('f-processes-other-wrap');
        if (othersChip && othersChip.classList.contains('is-active')) {
          othersWrap.style.display = '';
        } else {
          othersWrap.style.display = 'none';
        }
      });
    });

    // Mostrar "Outros" se já estava selecionado
    const othersWrap = document.getElementById('f-processes-other-wrap');
    if (selected.has('Outros')) {
      othersWrap.style.display = '';
      document.getElementById('f-processes-other').value = othersText;
    } else {
      othersWrap.style.display = 'none';
      document.getElementById('f-processes-other').value = '';
    }
  },

  collectSelectedProcesses() {
    const picker = document.getElementById('f-processes-picker');
    if (!picker) return [];
    const list = [];
    picker.querySelectorAll('.chip-pick.is-active').forEach(chip => {
      const p = chip.dataset.process;
      if (p === 'Outros') {
        const txt = document.getElementById('f-processes-other').value.trim();
        list.push(txt ? `Outros: ${txt}` : 'Outros');
      } else {
        list.push(p);
      }
    });
    return list;
  },

  saveClosing() {
    const id = document.getElementById('f-id').value;
    const type = document.querySelector('[name="type"]:checked').value;
    const city = document.getElementById('f-city').value.trim();
    let uf = document.getElementById('f-uf').value;

    if (!uf) {
      const found = BRAZIL_CITIES.find(c => c.city.toLowerCase() === city.toLowerCase());
      if (found) uf = found.uf;
    }

    const processes = this.collectSelectedProcesses();
    if (processes.length === 0) {
      this.toast('Selecione ao menos um tipo de processo', 'error');
      return;
    }

    const data = {
      type,
      date: document.getElementById('f-date').value,
      processes,
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
    document.getElementById('mk-referral-cost').value = mk.referralCost || '';
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
      referralCost: Number(document.getElementById('mk-referral-cost').value) || 0,
      reviews: Number(document.getElementById('mk-reviews').value) || 0
    };
    Store.setMarketing(year, month, data);
    this.toast('Dados de marketing atualizados', 'success');
    document.getElementById('modal-marketing').classList.remove('is-open');
    this.render();
  },

  // ============= COMPARATIVO =============
  renderCompare() {
    const grid = document.getElementById('compare-grid');
    const empty = document.getElementById('compare-empty');
    if (!grid) return;

    const yA = Number(document.getElementById('compare-year-a').value);
    const mA = Number(document.getElementById('compare-month-a').value);
    const yB = Number(document.getElementById('compare-year-b').value);
    const mB = Number(document.getElementById('compare-month-b').value);

    if (isNaN(yA) || isNaN(mA) || isNaN(yB) || isNaN(mB)) return;

    const dataA = this.snapshotPeriod(yA, mA);
    const dataB = this.snapshotPeriod(yB, mB);

    // Verifica se há dados em pelo menos um dos meses
    const hasAnyA = Object.values(dataA).some(v => v > 0);
    const hasAnyB = Object.values(dataB).some(v => v > 0);

    if (!hasAnyA && !hasAnyB) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const labelA = `${MONTH_ABBR[mA]}/${String(yA).slice(2)}`;
    const labelB = `${MONTH_ABBR[mB]}/${String(yB).slice(2)}`;

    const metrics = [
      { key: 'closings',     label: 'Fechamentos',         fmt: 'num',  invert: false },
      { key: 'leads',        label: 'Total de Leads',      fmt: 'num',  invert: false },
      { key: 'qualified',    label: 'Qualificados',        fmt: 'num',  invert: false },
      { key: 'investTotal',  label: 'Investimento',        fmt: 'brl',  invert: true  },
      { key: 'cac',          label: 'CAC',                 fmt: 'brl',  invert: true  },
      { key: 'cpl',          label: 'CPL',                 fmt: 'brl',  invert: true  },
      { key: 'partnerLeads', label: 'Leads de parceiros',  fmt: 'num',  invert: false },
      { key: 'partnerClosed',label: 'Fech. de parceiros',  fmt: 'num',  invert: false },
      { key: 'followers',    label: 'Total seguidores',    fmt: 'num',  invert: false }
    ];

    grid.innerHTML = metrics.map(m => this.compareCard(m, dataA[m.key] || 0, dataB[m.key] || 0, labelA, labelB)).join('');
  },

  // Calcula um snapshot agregado de um período (pra usar no comparativo)
  snapshotPeriod(year, month) {
    const closings = Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
    const mk = Store.getMarketing(year, month);
    const partnerStats = Store.getPartnerStats(year, month);

    const investTotal = (mk.meta || 0) + (mk.google || 0) + (mk.vagas || 0);
    const totalLeads = (mk.leads_meta || 0) + (mk.leads_google || 0);
    const closingsCount = closings.length;
    const digitalCount = closings.filter(c => c.type === 'digital').length;

    return {
      closings: closingsCount,
      leads: totalLeads,
      qualified: mk.qualified || 0,
      investTotal,
      cac: digitalCount > 0 ? investTotal / digitalCount : 0,
      cpl: totalLeads > 0 ? ((mk.meta || 0) + (mk.google || 0)) / totalLeads : 0,
      partnerLeads: partnerStats.reduce((s, x) => s + (x.leads || 0), 0),
      partnerClosed: partnerStats.reduce((s, x) => s + (x.closed || 0), 0),
      followers: (mk.ig || 0) + (mk.tt || 0) + (mk.fb || 0) + (mk.yt || 0) + (mk.kw || 0)
    };
  },

  compareCard(meta, valA, valB, labelA, labelB) {
    const fmt = (v) => meta.fmt === 'brl' ? `R$ ${fmtBRL(v)}` : fmtNum(v);
    let delta = 0;
    if (valB > 0) delta = ((valA - valB) / valB) * 100;
    else if (valA > 0) delta = 100;

    // Para métricas onde menor é melhor (CAC, CPL, Investimento), invertemos a cor
    const realDirection = meta.invert ? -delta : delta;
    let deltaClass = 'compare-card__delta--neutral';
    let arrow = '→';
    if (Math.abs(delta) < 0.05) {
      deltaClass = 'compare-card__delta--neutral';
      arrow = '→';
    } else if (realDirection > 0) {
      deltaClass = 'compare-card__delta--up';
      arrow = '↑';
    } else {
      deltaClass = 'compare-card__delta--down';
      arrow = '↓';
    }

    const sign = delta >= 0 ? '+' : '';
    const total = Math.max(valA, valB, 1);
    const wA = (valA / total) * 100;
    const wB = (valB / total) * 100;

    return `
      <div class="compare-card">
        <header class="compare-card__head">
          <span class="compare-card__label">${meta.label}</span>
          <span class="compare-card__delta ${deltaClass}">${arrow} ${sign}${delta.toFixed(1)}%</span>
        </header>
        <div class="compare-card__values">
          <div class="compare-card__value-block">
            <span class="compare-card__period">A · ${labelA}</span>
            <span class="compare-card__num compare-card__num--a">${fmt(valA)}</span>
          </div>
          <span class="compare-card__arrow">vs</span>
          <div class="compare-card__value-block compare-card__value-block--b">
            <span class="compare-card__period">B · ${labelB}</span>
            <span class="compare-card__num compare-card__num--b">${fmt(valB)}</span>
          </div>
        </div>
        <div class="compare-card__bar">
          <div class="compare-card__bar-a" style="width:${wA}%"></div>
        </div>
        <div class="compare-card__bar">
          <div class="compare-card__bar-b" style="width:${wB}%"></div>
        </div>
      </div>
    `;
  },

  // ============= CONSULTORES =============
  renderConsultants() {
    const { year, month } = this.state.period;
    const consultants = Store.getConsultants();
    const leadsMap = Store.getConsultantLeads(year, month);

    // Contar fechamentos por consultor (mês atual, status Fechado)
    const closings = Store.getClosingsForPeriod(year, month).filter(c => (c.status || 'Fechado') === 'Fechado');
    const closedMap = {};
    closings.forEach(c => {
      const name = (c.consultant || '').trim();
      if (!name) return;
      closedMap[name] = (closedMap[name] || 0) + 1;
    });

    // União: todos os consultores cadastrados + qualquer consultor que apareça nos fechamentos
    const allNames = new Set(consultants);
    Object.keys(closedMap).forEach(n => allNames.add(n));

    // Montar lista com cálculos
    const items = [...allNames].map(name => {
      const leads = Number(leadsMap[name] || 0);
      const closed = Number(closedMap[name] || 0);
      const conv = leads > 0 ? (closed / leads) * 100 : 0;
      return { name, leads, closed, conv };
    });

    // Totais
    const totalLeads = items.reduce((s, i) => s + i.leads, 0);
    const totalClosed = items.reduce((s, i) => s + i.closed, 0);
    const totalConv = totalLeads > 0 ? Math.round((totalClosed / totalLeads) * 100) : 0;
    document.getElementById('cons-total-leads').textContent = fmtNum(totalLeads);
    document.getElementById('cons-total-closed').textContent = fmtNum(totalClosed);
    document.getElementById('cons-total-conv').textContent = totalConv + '%';

    // Ordenar pelo melhor (maior conversão; em empate, mais fechamentos)
    const ranked = [...items].sort((a, b) => {
      if (b.conv !== a.conv) return b.conv - a.conv;
      return b.closed - a.closed;
    });

    // Renderizar ranking
    const rankEl = document.getElementById('cons-ranking');
    if (rankEl) {
      if (ranked.length === 0) {
        rankEl.innerHTML = '<div class="cons-empty">Nenhum consultor cadastrado ainda.<br/>Adicione consultores ao registrar fechamentos.</div>';
      } else {
        const maxConv = Math.max(...ranked.map(r => r.conv), 1);
        rankEl.innerHTML = ranked.map((r, idx) => {
          const w = (r.conv / maxConv) * 100;
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);
          const topClass = idx === 0 ? 'is-top is-top-1' : idx === 1 ? 'is-top is-top-2' : idx === 2 ? 'is-top is-top-3' : '';
          return `
            <div class="cons-rank-item ${topClass}" style="--w:${w}%">
              <span class="cons-rank-medal">${medal}</span>
              <div class="cons-rank-info">
                <span class="cons-rank-name">${r.name}</span>
                <span class="cons-rank-meta"><strong>${r.closed}</strong> fechados de <strong>${r.leads}</strong> leads</span>
              </div>
              <div class="cons-rank-pct">
                <span class="cons-rank-pct-num">${r.conv.toFixed(1)}%</span>
                <span class="cons-rank-pct-label">conversão</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Renderizar inputs editáveis
    const inputEl = document.getElementById('cons-input-list');
    if (inputEl) {
      if (allNames.size === 0) {
        inputEl.innerHTML = '<div class="cons-empty">Cadastre consultores na aba Comercial (ao registrar um fechamento) para começar.</div>';
      } else {
        inputEl.innerHTML = [...allNames].map(name => {
          const leads = Number(leadsMap[name] || 0);
          const closed = Number(closedMap[name] || 0);
          return `
            <div class="cons-input-row">
              <span class="cons-input-row__name">${name}</span>
              <input type="number" min="0" step="1" value="${leads || ''}" placeholder="0" data-cons-leads="${name}" />
              <span class="cons-input-row__closed">${closed} fech.</span>
            </div>
          `;
        }).join('');

        // Bind dos inputs (debounce simples)
        inputEl.querySelectorAll('input[data-cons-leads]').forEach(inp => {
          inp.addEventListener('change', (e) => {
            const name = e.target.dataset.consLeads;
            const qty = Number(e.target.value) || 0;
            Store.setConsultantLeads(year, month, name, qty);
            this.renderConsultants();
          });
        });
      }
    }

    // Tabela detalhada
    const tbody = document.getElementById('cons-table-body');
    if (tbody) {
      if (ranked.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="cons-empty">Sem dados</td></tr>';
      } else {
        const maxConv = Math.max(...ranked.map(r => r.conv), 1);
        tbody.innerHTML = ranked.map((r, idx) => {
          const w = (r.conv / maxConv) * 100;
          return `
            <tr>
              <td><span style="font-family:var(--f-mono); color:var(--c-text-3); font-size:11px;">${String(idx+1).padStart(2,'0')}</span></td>
              <td><strong>${r.name}</strong></td>
              <td class="ta-right" style="font-family:var(--f-mono);">${fmtNum(r.leads)}</td>
              <td class="ta-right" style="font-family:var(--f-mono); color:var(--c-accent); font-weight:600;">${fmtNum(r.closed)}</td>
              <td class="ta-right" style="font-family:var(--f-mono); font-weight:600;">${r.conv.toFixed(1)}%</td>
              <td><span class="cons-perf-bar"><i style="--w:${w}%"></i></span></td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  // ============= GLOBE / MAPA =============
  // Pontos consolidados de fechamentos (usado tanto pelo globo quanto pelo mapa do Brasil)
  buildClosingPoints() {
    return Store.getAllClosings()
      .filter(c => (c.status || 'Fechado') === 'Fechado')
      .map(c => {
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
  },

  updateGlobes() {
    const points = this.buildClosingPoints();
    Globe.updateMarkers('globe-canvas', points);
  },

  updateBrazilMap() {
    if (typeof BrazilMap === 'undefined') return;
    const points = this.buildClosingPoints();
    BrazilMap.render(points);
  },

  // ============= PARTNERS =============
  renderPartners() {
    const { year, month } = this.state.period;
    const partners = Store.getPartners();
    const stats = Store.getPartnerStats(year, month);
    const cost = Store.getPartnerCost(year, month);

    // Totais primeiro (precisamos pra calcular % do total)
    const totalLeads = stats.reduce((s, x) => s + x.leads, 0);
    const totalClosed = stats.reduce((s, x) => s + x.closed, 0);
    const cac = totalClosed > 0 ? cost / totalClosed : 0;

    const tbody = document.getElementById('partners-tbody');
    const empty = document.getElementById('empty-partners');
    const table = document.getElementById('partners-table');

    if (stats.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      table.style.display = 'none';
    } else {
      empty.style.display = 'none';
      table.style.display = 'table';

      // Ordenar por fechados desc (melhores primeiro)
      const sorted = [...stats].sort((a, b) => b.closed - a.closed);

      tbody.innerHTML = sorted.map(s => {
        const partner = partners.find(p => p.id === s.partnerId);
        const name = partner ? partner.name : '(parceiro removido)';
        const conv = s.leads > 0 ? ((s.closed / s.leads) * 100) : 0;
        const sharePct = totalClosed > 0 ? ((s.closed / totalClosed) * 100) : 0;
        return `
          <tr>
            <td><span class="cell-client__name">${name}</span></td>
            <td class="ta-right" style="font-family:var(--f-mono);">${fmtNum(s.leads)}</td>
            <td class="ta-right" style="font-family:var(--f-mono);color:var(--c-accent);font-weight:600;">${fmtNum(s.closed)}</td>
            <td class="ta-right" style="font-family:var(--f-mono);font-weight:600;">${conv.toFixed(1)}%</td>
            <td class="ta-right" style="font-family:var(--f-mono);color:var(--c-text-2);">${sharePct.toFixed(1)}%</td>
            <td>
              <div class="cell-actions">
                <button class="btn-icon-sm" data-edit-pstat="${s.partnerId}" title="Editar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="btn-icon-sm btn-icon-sm--danger" data-del-pstat="${s.partnerId}" title="Remover">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-edit-pstat]').forEach(btn => {
        btn.addEventListener('click', () => this.openPartnerStatModal(btn.dataset.editPstat));
      });
      tbody.querySelectorAll('[data-del-pstat]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Remover este lançamento?')) {
            Store.removePartnerStats(year, month, btn.dataset.delPstat);
            this.render();
            this.toast('Lançamento removido', 'success');
          }
        });
      });
    }

    // Summary
    document.getElementById('partners-active-count').textContent = stats.length;
    document.getElementById('partners-leads-total').textContent = fmtNum(totalLeads);
    document.getElementById('partners-closed-total').textContent = fmtNum(totalClosed);

    // Input de custo
    const costInput = document.getElementById('partner-cost-input');
    if (costInput && document.activeElement !== costInput) {
      costInput.value = cost > 0 ? cost.toFixed(2) : '';
    }

    // CAC
    document.getElementById('partners-cac').textContent = fmtBRL(cac);
    const formulaEl = document.getElementById('partners-cac-formula');
    if (formulaEl) {
      if (totalClosed === 0 && cost > 0) {
        formulaEl.textContent = 'sem fechamentos';
      } else if (cost === 0) {
        formulaEl.textContent = 'informe o custo →';
      } else {
        formulaEl.textContent = `R$ ${fmtBRL(cost)} ÷ ${totalClosed}`;
      }
    }
  },

  openPartnerStatModal(partnerId = null) {
    const { year, month } = this.state.period;
    const partners = Store.getPartners();
    if (partners.length === 0) {
      this.toast('Cadastre um parceiro antes de lançar resultado', 'error');
      this.openManagePartners();
      return;
    }
    const sel = document.getElementById('ps-partner');
    sel.innerHTML = partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    document.getElementById('partner-stat-period').textContent = periodLabel(year, month);

    if (partnerId) {
      const stat = Store.getPartnerStats(year, month).find(s => s.partnerId === partnerId);
      if (stat) {
        sel.value = partnerId;
        document.getElementById('ps-leads').value = stat.leads;
        document.getElementById('ps-closed').value = stat.closed;
      }
    } else {
      document.getElementById('ps-leads').value = '';
      document.getElementById('ps-closed').value = '';
    }
    document.getElementById('modal-partner-stat').classList.add('is-open');
  },

  savePartnerStat() {
    const { year, month } = this.state.period;
    const partnerId = document.getElementById('ps-partner').value;
    const leads = Number(document.getElementById('ps-leads').value) || 0;
    const closed = Number(document.getElementById('ps-closed').value) || 0;
    if (closed > leads) {
      this.toast('Fechados não pode ser maior que leads', 'error');
      return;
    }
    Store.setPartnerStats(year, month, partnerId, leads, closed);
    document.getElementById('modal-partner-stat').classList.remove('is-open');
    this.toast('Lançamento salvo', 'success');
    this.render();
  },

  // ============= MANAGE: Consultants =====
  openManageConsultants() {
    this.renderConsultantsList();
    document.getElementById('modal-consultants').classList.add('is-open');
  },

  renderConsultantsList() {
    const ul = document.getElementById('consultants-list');
    const list = Store.getConsultants();
    if (list.length === 0) {
      ul.innerHTML = '<li class="manage-list__empty">Nenhum consultor cadastrado</li>';
      return;
    }
    ul.innerHTML = list.map(name => `
      <li>
        <span>${name}</span>
        <button class="btn-icon-sm btn-icon-sm--danger" data-remove-consultant="${name}" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </li>
    `).join('');
    ul.querySelectorAll('[data-remove-consultant]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`Remover consultor "${btn.dataset.removeConsultant}"?`)) {
          Store.removeConsultant(btn.dataset.removeConsultant);
          this.renderConsultantsList();
          this.populateConsultantSelect('f-consultant');
          this.refreshDynamicFilters();
          this.toast('Consultor removido', 'success');
        }
      });
    });
  },

  // ============= MANAGE: Partners =====
  openManagePartners() {
    this.renderPartnersList();
    document.getElementById('modal-partners').classList.add('is-open');
  },

  renderPartnersList() {
    const ul = document.getElementById('partners-list');
    const list = Store.getPartners();
    if (list.length === 0) {
      ul.innerHTML = '<li class="manage-list__empty">Nenhum parceiro cadastrado</li>';
      return;
    }
    ul.innerHTML = list.map(p => `
      <li>
        <span>${p.name}</span>
        <button class="btn-icon-sm btn-icon-sm--danger" data-remove-partner="${p.id}" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </li>
    `).join('');
    ul.querySelectorAll('[data-remove-partner]').forEach(btn => {
      btn.addEventListener('click', () => {
        const partner = Store.getPartners().find(p => p.id === btn.dataset.removePartner);
        if (partner && confirm(`Remover parceiro "${partner.name}"? Os lançamentos antigos também serão removidos.`)) {
          Store.removePartner(btn.dataset.removePartner);
          this.renderPartnersList();
          this.render();
          this.toast('Parceiro removido', 'success');
        }
      });
    });
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
