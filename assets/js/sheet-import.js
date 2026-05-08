/* ============================================
   Sheet Importer — importa CSV/XLSX/XLS
   ============================================ */

const SheetImport = {
  SHEETJS_URL: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  loaded: false,
  loading: false,

  // Carrega SheetJS sob demanda
  async loadSheetJS() {
    if (window.XLSX) return true;
    if (this.loading) {
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (window.XLSX) { clearInterval(check); resolve(true); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(!!window.XLSX); }, 30000);
      });
    }
    this.loading = true;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = this.SHEETJS_URL;
      s.onload = () => { this.loading = false; this.loaded = true; resolve(true); };
      s.onerror = () => { this.loading = false; reject(new Error('Falha ao carregar SheetJS — verifique a conexão')); };
      document.head.appendChild(s);
    });
  },

  // Lê o arquivo e retorna array de objetos {col1, col2, ...} já com headers detectados
  async readFile(file) {
    await this.loadSheetJS();
    const arrayBuffer = await file.arrayBuffer();
    const wb = window.XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    // Pega a primeira aba ou tenta achar uma com nome relevante
    let sheetName = wb.SheetNames[0];
    const preferredNames = ['auditoria', 'fechamentos', 'fechamento', 'principal'];
    for (const n of preferredNames) {
      const found = wb.SheetNames.find(s => s.toLowerCase().includes(n));
      if (found) { sheetName = found; break; }
    }
    const ws = wb.Sheets[sheetName];
    // Converte pra array de arrays (preserva linhas vazias)
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    return { rows, sheetName, allSheets: wb.SheetNames };
  },

  // Detecta a linha de header automaticamente (procura por colunas conhecidas)
  detectHeaderRow(rows) {
    const keywords = [
      'cliente', 'consultor', 'cidade', 'data', 'fechamento',
      'processo', 'telefone', 'estado', 'uf', 'tipo', 'origem', 'status'
    ];
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i].map(c => String(c).toLowerCase().trim());
      const matches = keywords.filter(k => row.some(c => c.includes(k))).length;
      if (matches >= 3) return i;
    }
    return 0; // fallback
  },

  // Mapeia headers da planilha pra campos do sistema
  mapColumns(headers) {
    const map = {};
    headers.forEach((h, idx) => {
      const norm = String(h).toLowerCase().trim()
        .replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i')
        .replace(/[óôõ]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c');

      if (/cliente|nome/.test(norm)) map.client = idx;
      else if (/consultor|vendedor|atendente/.test(norm)) map.consultant = idx;
      else if (/^cidade|municipio/.test(norm)) map.city = idx;
      else if (/^estado|^uf$/.test(norm)) map.uf = idx;
      else if (/data.*fech|fechamento|^data$/.test(norm)) map.date = idx;
      else if (/processo|tipo.*processo|servico/.test(norm)) map.processes = idx;
      else if (/telefone|fone|celular|whatsapp/.test(norm)) map.phone = idx;
      else if (/origem|canal/.test(norm)) map.origin = idx;
      else if (/status|situacao/.test(norm)) map.status = idx;
      else if (/^tipo$/.test(norm)) map.type = idx;
    });
    return map;
  },

  // Converte uma linha em um objeto fechamento
  rowToClosing(row, columnMap, currentConsultant = '') {
    const get = (key) => {
      if (columnMap[key] === undefined) return '';
      const v = row[columnMap[key]];
      return v === undefined || v === null ? '' : String(v).trim();
    };

    const client = get('client');
    if (!client && !currentConsultant) return null; // linha vazia

    const consultantRaw = get('consultant') || currentConsultant;
    const cityRaw = get('city');
    const ufRaw = get('uf');
    const dateRaw = get('date');
    const processesRaw = get('processes');
    const phoneRaw = get('phone');
    const originRaw = get('origin');
    const statusRaw = get('status');
    const typeRaw = get('type');

    // Cidade pode vir "Joinville / SC" — tenta separar
    let city = cityRaw;
    let uf = ufRaw;
    if (city && !uf) {
      const m = city.match(/^(.+?)\s*[\/-]\s*([A-Z]{2})\s*$/);
      if (m) { city = m[1].trim(); uf = m[2]; }
    }
    // Se ainda não tem UF, infere pela cidade conhecida
    if (city && !uf && typeof BRAZIL_CITIES !== 'undefined') {
      const found = BRAZIL_CITIES.find(c => c.city.toLowerCase() === city.toLowerCase());
      if (found) uf = found.uf;
    }

    // Data: vem em vários formatos possíveis
    let date = '';
    if (dateRaw) {
      // 1) DD/MM/YYYY ou DD/MM/YY
      let m = dateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (m) {
        let yr = m[3];
        if (yr.length === 2) yr = '20' + yr;
        date = `${yr}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
      }
      // 2) YYYY-MM-DD
      else if ((m = dateRaw.match(/(\d{4})-(\d{2})-(\d{2})/))) {
        date = `${m[1]}-${m[2]}-${m[3]}`;
      }
      // 3) Date object via SheetJS (cellDates: true)
      else if (dateRaw instanceof Date) {
        const y = dateRaw.getFullYear();
        const mo = String(dateRaw.getMonth()+1).padStart(2,'0');
        const d = String(dateRaw.getDate()).padStart(2,'0');
        date = `${y}-${mo}-${d}`;
      }
    }

    // Processos: pode vir separado por vírgula, ponto-e-vírgula, ou pipe
    const processes = [];
    let processOther = '';
    if (processesRaw) {
      const procList = String(processesRaw).split(/[,;|]/).map(p => p.trim()).filter(Boolean);
      const types = (typeof PROCESS_TYPES !== 'undefined') ? PROCESS_TYPES : [];
      const slug = (s) => s.toLowerCase()
        .replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i')
        .replace(/[óôõ]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c')
        .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
      procList.forEach(p => {
        // Remove sufixos tipo "- Completo", "- Arquivado", "- 3/5"
        const cleaned = p.replace(/\s*-\s*\d+\/\d+\s*$/g,'').replace(/\s*-\s*(arquivado|completo|pendente|cancelado)\s*$/i,'').trim();
        const ps = slug(cleaned);
        const found = types.find(t => slug(t) === ps || slug(t).includes(ps) || ps.includes(slug(t)));
        if (found && !processes.includes(found)) processes.push(found);
        else if (cleaned && !processOther) processOther = cleaned;
      });
    }

    // Tipo / Origem
    let type = 'referral';
    let origin = 'INDICAÇÃO PARCEIRO';
    const orgUpper = (originRaw || typeRaw || '').toUpperCase();
    if (/META|FACEBOOK|INSTAGRAM/i.test(orgUpper)) { type = 'digital'; origin = 'META'; }
    else if (/GOOGLE|ADS/i.test(orgUpper)) { type = 'digital'; origin = 'GOOGLE'; }
    else if (/ORG[ÂA]NICO|ORGANIC/i.test(orgUpper)) { type = 'digital'; origin = 'ORGÂNICO'; }
    else if (/INDICA[ÇC][ÃA]O\s*PARCEIRO|PARCEIRO/i.test(orgUpper)) { type = 'referral'; origin = 'INDICAÇÃO PARCEIRO'; }
    else if (/INDICA[ÇC][ÃA]O/i.test(orgUpper)) { type = 'referral'; origin = 'INDICAÇÃO'; }
    else if (/DIGITAL|ONLINE/i.test(orgUpper)) { type = 'digital'; }

    // Telefone (limpa, mantém formato (DD) XXXXX-XXXX)
    let phone = '';
    if (phoneRaw) {
      const onlyNums = phoneRaw.replace(/\D/g,'');
      if (onlyNums.length >= 10) {
        const dd = onlyNums.slice(0, 2);
        const rest = onlyNums.slice(2);
        if (rest.length === 9) phone = `(${dd}) ${rest.slice(0,5)}-${rest.slice(5)}`;
        else if (rest.length === 8) phone = `(${dd}) ${rest.slice(0,4)}-${rest.slice(4)}`;
        else phone = phoneRaw;
      } else phone = phoneRaw;
    }

    // Status
    let status = 'Fechado';
    if (statusRaw) {
      const s = statusRaw.toLowerCase();
      if (/negocia/.test(s)) status = 'Negociação';
      else if (/aguard/.test(s)) status = 'Aguardando Resposta';
      else if (/fechad|complet|auditad/.test(s)) status = 'Fechado';
    }

    return {
      type,
      date,
      client,
      phone,
      consultant: consultantRaw,
      city,
      uf,
      status,
      origin,
      neighborhood: '',
      processes,
      processOther,
      notes: 'Importado de planilha'
    };
  },

  // Detecta linhas de "header de consultor" (linhas que separam grupos por consultor)
  // Ex: linha que tem só uma palavra (nome do consultor) e o resto vazio
  isConsultantHeader(row, columnMap) {
    const filled = row.filter(c => String(c).trim() !== '');
    if (filled.length !== 1) return null;
    const val = String(filled[0]).trim();
    // Parece nome de pessoa (1-3 palavras com inicial maiúscula, sem dígitos/símbolos)
    if (/^[A-ZÀ-Ý][a-zA-ZÀ-ÿ]+(\s+[A-ZÀ-Ý][a-zA-ZÀ-ÿ]+){0,2}$/.test(val)) {
      return val;
    }
    return null;
  },

  // Pipeline completo: arquivo → array de fechamentos prontos pra salvar
  async parseFile(file) {
    const { rows, sheetName, allSheets } = await this.readFile(file);

    if (rows.length === 0) {
      throw new Error('Planilha vazia');
    }

    const headerIdx = this.detectHeaderRow(rows);
    const headers = rows[headerIdx];
    const columnMap = this.mapColumns(headers);

    if (Object.keys(columnMap).length < 2) {
      throw new Error('Não consegui identificar as colunas. Verifique se a planilha tem cabeçalhos como "Cliente", "Cidade", "Data", "Consultor"...');
    }

    const dataRows = rows.slice(headerIdx + 1);
    const closings = [];
    let currentConsultant = '';

    for (const row of dataRows) {
      // Pula linhas totalmente vazias
      if (row.every(c => String(c).trim() === '')) continue;

      // Detecta se é uma linha "cabeçalho de consultor" (uma palavra só, isolada)
      const consName = this.isConsultantHeader(row, columnMap);
      if (consName) {
        currentConsultant = consName;
        continue;
      }

      const closing = this.rowToClosing(row, columnMap, currentConsultant);
      if (closing) closings.push(closing);
    }

    return {
      closings,
      stats: {
        totalRows: dataRows.length,
        validClosings: closings.length,
        sheetName,
        allSheets,
        columnsDetected: Object.keys(columnMap),
        consultants: [...new Set(closings.map(c => c.consultant).filter(Boolean))]
      }
    };
  }
};
