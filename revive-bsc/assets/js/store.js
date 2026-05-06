/* ============================================
   Store: persistência em LocalStorage
   ============================================ */

const STORAGE_KEY = 'revive-bsc-v1';

// Migração: converte schema antigo (organic/traffic) para o novo (meta/google/sc/ce/mg)
function migrateMK(raw) {
  const m = { ...raw };
  // Campos novos com defaults
  if (m.leads_meta === undefined) m.leads_meta = 0;
  if (m.leads_google === undefined) m.leads_google = 0;
  if (m.qualified === undefined) m.qualified = 0;
  if (m.closed_sc === undefined) m.closed_sc = 0;
  if (m.closed_ce === undefined) m.closed_ce = 0;
  if (m.closed_mg === undefined) m.closed_mg = 0;

  // Migração one-shot: se tiver valores antigos e os novos estiverem zerados, migra
  if (m.leads_traffic && !m.leads_meta && !m.leads_google) {
    // Distribui o tráfego antigo proporcionalmente ao investimento meta/google (ou 50/50)
    const totalPaid = (m.meta || 0) + (m.google || 0);
    if (totalPaid > 0) {
      m.leads_meta = Math.round(m.leads_traffic * ((m.meta || 0) / totalPaid));
      m.leads_google = m.leads_traffic - m.leads_meta;
    } else {
      m.leads_meta = Math.round(m.leads_traffic / 2);
      m.leads_google = m.leads_traffic - m.leads_meta;
    }
  }
  if ((m.qual_traffic || m.qual_organic) && !m.qualified) {
    m.qualified = (m.qual_traffic || 0) + (m.qual_organic || 0);
  }
  if (m.closed_traffic && !m.closed_sc && !m.closed_ce && !m.closed_mg) {
    // Coloca tudo em SC por default — usuário ajusta depois
    m.closed_sc = m.closed_traffic + (m.closed_organic || 0);
  }

  // Limpa campos antigos
  delete m.leads_organic; delete m.leads_traffic;
  delete m.qual_organic; delete m.qual_traffic;
  delete m.closed_organic; delete m.closed_traffic;
  return m;
}

const DEFAULT_STATE = {
  closings: [],   // [{ id, type, date, client, phone, consultant, city, uf, neighborhood, status, origin, value, notes }]
  marketing: {},  // { '2026-7': { meta, google, vagas, leads_organic, leads_traffic, qual_organic, qual_traffic, closed_organic, closed_traffic, ig, tt, fb, yt, kw, reviews } }
  meta: {
    createdAt: new Date().toISOString(),
    version: 1
  }
};

const Store = {
  state: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        // Garantir que tem todas as keys default
        if (!this.state.closings) this.state.closings = [];
        if (!this.state.marketing) this.state.marketing = {};
        if (!this.state.meta) this.state.meta = DEFAULT_STATE.meta;
      } else {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        // Seed com os dados da planilha de exemplo (AGO-DEZ 2024 do print)
        this.seed();
        this.save();
      }
    } catch (e) {
      console.error('Erro carregando state', e);
      this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    return this.state;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Erro salvando state', e);
    }
  },

  seed() {
    // Dados do print da planilha (AGO/SET/OUT/NOV/DEZ 2024) — exemplo
    const seedMK = {
      '2024-7':  { meta: 8539.94,  google: 2719.79, vagas: 1041.78, leads_meta: 600, leads_google: 204, qualified: 102, closed_sc: 22, closed_ce: 5, closed_mg: 2,  ig: 2650, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 29 },
      '2024-8':  { meta: 6552.74,  google: 2736.12, vagas: 1039.18, leads_meta: 490, leads_google: 207, qualified: 183, closed_sc: 30, closed_ce: 8, closed_mg: 3,  ig: 2905, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 29 },
      '2024-9':  { meta: 9515.43,  google: 3449.39, vagas: 1856.02, leads_meta: 520, leads_google: 214, qualified: 103, closed_sc: 40, closed_ce: 12,closed_mg: 4,  ig: 3320, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 29 },
      '2024-10': { meta: 5769.42,  google: 3005.32, vagas: 2896.87, leads_meta: 320, leads_google: 187, qualified: 149, closed_sc: 42, closed_ce: 11,closed_mg: 5,  ig: 3600, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 35 },
      '2024-11': { meta: 10782.80, google: 2247.63, vagas: 2745.86, leads_meta: 540, leads_google: 137, qualified: 0,   closed_sc: 38, closed_ce: 9, closed_mg: 4,  ig: 3800, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 35 }
    };
    this.state.marketing = seedMK;

    // Fechamentos de exemplo (mês atual) — para o globo e tabelas já mostrarem algo
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const dt = (day) => `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Marketing também do mês atual
    const currentKey = `${y}-${m}`;
    if (!seedMK[currentKey]) {
      this.state.marketing[currentKey] = { meta: 11200, google: 3100, vagas: 2400, leads_meta: 540, leads_google: 180, qualified: 168, closed_sc: 35, closed_ce: 12, closed_mg: 5, ig: 3950, tt: 42, fb: 0, yt: 0, kw: 0, reviews: 38 };
    }
    let pm = m - 1, py = y;
    if (pm < 0) { pm = 11; py = y - 1; }
    const prevKey = `${py}-${pm}`;
    if (!seedMK[prevKey]) {
      this.state.marketing[prevKey] = { meta: 9800, google: 2900, vagas: 2200, leads_meta: 460, leads_google: 180, qualified: 145, closed_sc: 30, closed_ce: 8, closed_mg: 3, ig: 3700, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 35 };
    }

    const sampleClosings = [
      { type: 'digital', date: dt(3),  client: 'Maria Eduarda Silva',     phone: '(47) 99812-3344', consultant: 'Carla',   city: 'Blumenau',           uf: 'SC', status: 'Fechado', origin: 'META',    value: 4800,  notes: '' },
      { type: 'digital', date: dt(5),  client: 'João Pedro Hoffmann',     phone: '(47) 99701-2211', consultant: 'Rafael',  city: 'Indaial',            uf: 'SC', status: 'Fechado', origin: 'GOOGLE',  value: 6200,  notes: '' },
      { type: 'referral', date: dt(7), client: 'Ana Paula Vieira',        phone: '(48) 99221-4455', consultant: 'Carla',   city: 'Florianópolis',      uf: 'SC', status: 'Fechado', origin: 'INDICAÇÃO', value: 8500, notes: '' },
      { type: 'digital', date: dt(8),  client: 'Roberto Carlos Lima',     phone: '(85) 98700-1122', consultant: 'Bruno',   city: 'Fortaleza',          uf: 'CE', status: 'Fechado', origin: 'META',    value: 5300,  notes: '' },
      { type: 'digital', date: dt(10), client: 'Fernanda Aparecida Sá',   phone: '(47) 99888-7766', consultant: 'Rafael',  city: 'Joinville',          uf: 'SC', status: 'Fechado', origin: 'GOOGLE',  value: 7100,  notes: '' },
      { type: 'referral', date: dt(11),client: 'Patricia Goulart',        phone: '(47) 99500-3344', consultant: 'Carla',   city: 'Itajaí',             uf: 'SC', status: 'Fechado', origin: 'INDICAÇÃO', value: 4200, notes: '' },
      { type: 'digital', date: dt(13), client: 'Marcelo Dutra',           phone: '(11) 98123-4567', consultant: 'Bruno',   city: 'São Paulo',          uf: 'SP', status: 'Fechado', origin: 'META',    value: 9200,  notes: '' },
      { type: 'digital', date: dt(15), client: 'Beatriz Carvalho',        phone: '(47) 99102-8899', consultant: 'Rafael',  city: 'Balneário Camboriú', uf: 'SC', status: 'Fechado', origin: 'META',    value: 5800,  notes: '' },
      { type: 'digital', date: dt(17), client: 'Eduardo Henrique Brand',  phone: '(85) 98555-2233', consultant: 'Bruno',   city: 'Caucaia',            uf: 'CE', status: 'Fechado', origin: 'GOOGLE',  value: 4500,  notes: '' },
      { type: 'referral', date: dt(18),client: 'Cláudio Boff',            phone: '(47) 99344-7788', consultant: 'Carla',   city: 'Brusque',            uf: 'SC', status: 'Fechado', origin: 'INDICAÇÃO', value: 6700, notes: '' },
      { type: 'digital', date: dt(20), client: 'Sandra Luiza Almeida',    phone: '(31) 99700-1100', consultant: 'Bruno',   city: 'Belo Horizonte',     uf: 'MG', status: 'Fechado', origin: 'META',    value: 7800,  notes: '' },
      { type: 'digital', date: dt(22), client: 'Lucas Vinícius Krieger',  phone: '(47) 99878-5544', consultant: 'Rafael',  city: 'Pomerode',           uf: 'SC', status: 'Fechado', origin: 'META',    value: 5200,  notes: '' },
      { type: 'referral', date: dt(24),client: 'Helena Marques',          phone: '(21) 99344-8877', consultant: 'Carla',   city: 'Rio de Janeiro',     uf: 'RJ', status: 'Fechado', origin: 'INDICAÇÃO', value: 8900, notes: '' },
      { type: 'digital', date: dt(26), client: 'Paulo Roberto Jung',      phone: '(47) 99811-3322', consultant: 'Rafael',  city: 'Timbó',              uf: 'SC', status: 'Fechado', origin: 'GOOGLE',  value: 4900,  notes: '' },
      { type: 'digital', date: dt(28), client: 'Cristina Ferreira',       phone: '(85) 98300-5544', consultant: 'Bruno',   city: 'Sobral',             uf: 'CE', status: 'Fechado', origin: 'META',    value: 5600,  notes: '' }
    ];

    sampleClosings.forEach(c => {
      const id = 'cls_seed_' + Math.random().toString(36).slice(2, 9);
      this.state.closings.push({ id, ...c, createdAt: new Date().toISOString() });
    });
  },

  // ===== Closings =====
  addClosing(data) {
    const id = 'cls_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const item = { id, ...data, createdAt: new Date().toISOString() };
    this.state.closings.unshift(item);
    this.save();
    return item;
  },

  updateClosing(id, data) {
    const i = this.state.closings.findIndex(c => c.id === id);
    if (i >= 0) {
      this.state.closings[i] = { ...this.state.closings[i], ...data };
      this.save();
    }
  },

  removeClosing(id) {
    this.state.closings = this.state.closings.filter(c => c.id !== id);
    this.save();
  },

  // ===== Marketing =====
  getMarketing(year, month) {
    const key = `${year}-${month}`;
    const raw = this.state.marketing[key];
    if (!raw) {
      return {
        meta: 0, google: 0, vagas: 0,
        leads_meta: 0, leads_google: 0,
        qualified: 0,
        closed_sc: 0, closed_ce: 0, closed_mg: 0,
        ig: 0, tt: 0, fb: 0, yt: 0, kw: 0,
        reviews: 0
      };
    }
    return migrateMK(raw);
  },

  setMarketing(year, month, data) {
    const key = `${year}-${month}`;
    this.state.marketing[key] = { ...this.getMarketing(year, month), ...data };
    this.save();
  },

  // ===== Filtros do período =====
  getClosingsForPeriod(year, month) {
    return this.state.closings.filter(c => {
      const d = new Date(c.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  getAllClosings() {
    return this.state.closings;
  },

  // ===== Export / Import =====
  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  },

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.closings || !parsed.marketing) {
        throw new Error('Formato inválido');
      }
      this.state = parsed;
      this.save();
      return true;
    } catch (e) {
      console.error('Erro importando', e);
      return false;
    }
  }
};

// ===== Helpers de formatação =====
function fmtBRL(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBRLshort(value) {
  if (!value) return 'R$ 0';
  return 'R$ ' + Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtNum(value) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Number(value).toLocaleString('pt-BR');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function periodLabel(year, month) {
  return `${MONTH_NAMES[month]} / ${year}`;
}
