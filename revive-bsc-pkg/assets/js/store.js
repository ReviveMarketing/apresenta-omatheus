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
  if (m.referralCost === undefined) m.referralCost = 0;

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
  closings: [],
  marketing: {},
  consultants: ['Carla', 'Rafael', 'Bruno'], // editável pelo usuário
  partners: [],     // [{ id, name, createdAt }]
  partnerStats: {}, // { '2026-4': [{ partnerId, leads, closed }] }
  meta: {
    createdAt: new Date().toISOString(),
    version: 2
  }
};

const Store = {
  state: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        if (!this.state.closings) this.state.closings = [];
        if (!this.state.marketing) this.state.marketing = {};
        if (!this.state.consultants) this.state.consultants = ['Carla', 'Rafael', 'Bruno'];
        if (!this.state.partners) this.state.partners = [];
        if (!this.state.partnerStats) this.state.partnerStats = {};
        if (!this.state.consultantLeads) this.state.consultantLeads = {};
        if (!this.state.partnerCost) this.state.partnerCost = {};
        if (!this.state.meta) this.state.meta = DEFAULT_STATE.meta;

        // Migração: fechamentos importados de planilha vieram como "INDICAÇÃO"
        // mas o padrão correto é "INDICAÇÃO PARCEIRO"
        let migrated = 0;
        this.state.closings.forEach(c => {
          if (c.origin === 'INDICAÇÃO' && c.notes && /importad/i.test(c.notes)) {
            c.origin = 'INDICAÇÃO PARCEIRO';
            migrated++;
          }
        });
        if (migrated > 0) {
          console.log(`[Store] Migrados ${migrated} fechamentos pra INDICAÇÃO PARCEIRO`);
          this.save();
        }
      } else {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
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
    // Apenas marketing dos meses de exemplo da planilha. Sem closings.
    const seedMK = {
      '2024-7':  { meta: 8539.94,  google: 2719.79, vagas: 1041.78, leads_meta: 600, leads_google: 204, qualified: 102, closed_sc: 22, closed_ce: 5, closed_mg: 2,  ig: 2650, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 29 },
      '2024-8':  { meta: 6552.74,  google: 2736.12, vagas: 1039.18, leads_meta: 490, leads_google: 207, qualified: 183, closed_sc: 30, closed_ce: 8, closed_mg: 3,  ig: 2905, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 29 },
      '2024-9':  { meta: 9515.43,  google: 3449.39, vagas: 1856.02, leads_meta: 520, leads_google: 214, qualified: 103, closed_sc: 40, closed_ce: 12,closed_mg: 4,  ig: 3320, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 29 },
      '2024-10': { meta: 5769.42,  google: 3005.32, vagas: 2896.87, leads_meta: 320, leads_google: 187, qualified: 149, closed_sc: 42, closed_ce: 11,closed_mg: 5,  ig: 3600, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 35 },
      '2024-11': { meta: 10782.80, google: 2247.63, vagas: 2745.86, leads_meta: 540, leads_google: 137, qualified: 0,   closed_sc: 38, closed_ce: 9, closed_mg: 4,  ig: 3800, tt: 41, fb: 0, yt: 0, kw: 0, reviews: 35 }
    };
    this.state.marketing = seedMK;

    // Marketing do mês atual também
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
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

  removeAllClosings() {
    const count = (this.state.closings || []).length;
    this.state.closings = [];
    this.save();
    return count;
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
        reviews: 0,
        referralCost: 0
      };
    }
    return migrateMK(raw);
  },

  setMarketing(year, month, data) {
    const key = `${year}-${month}`;
    this.state.marketing[key] = { ...this.getMarketing(year, month), ...data };
    this.save();
  },

  // ===== Consultores =====
  getConsultants() {
    return this.state.consultants || [];
  },
  addConsultant(name) {
    const n = name.trim();
    if (!n) return false;
    if (!this.state.consultants) this.state.consultants = [];
    if (this.state.consultants.includes(n)) return false;
    this.state.consultants.push(n);
    this.save();
    return true;
  },
  removeConsultant(name) {
    this.state.consultants = (this.state.consultants || []).filter(c => c !== name);
    this.save();
  },

  // ===== Leads por consultor (input manual mensal) =====
  getConsultantLeads(year, month) {
    if (!this.state.consultantLeads) this.state.consultantLeads = {};
    const key = `${year}-${month}`;
    return this.state.consultantLeads[key] || {};
  },
  setConsultantLeads(year, month, name, qty) {
    if (!this.state.consultantLeads) this.state.consultantLeads = {};
    const key = `${year}-${month}`;
    if (!this.state.consultantLeads[key]) this.state.consultantLeads[key] = {};
    this.state.consultantLeads[key][name] = Number(qty) || 0;
    this.save();
  },

  // ===== Parceiros =====
  getPartners() {
    return this.state.partners || [];
  },
  addPartner(name) {
    const n = name.trim();
    if (!n) return null;
    if (!this.state.partners) this.state.partners = [];
    if (this.state.partners.find(p => p.name.toLowerCase() === n.toLowerCase())) return null;
    const partner = { id: 'pt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: n, createdAt: new Date().toISOString() };
    this.state.partners.push(partner);
    this.save();
    return partner;
  },
  removePartner(id) {
    this.state.partners = (this.state.partners || []).filter(p => p.id !== id);
    // Remove também as estatísticas desse parceiro
    Object.keys(this.state.partnerStats || {}).forEach(k => {
      this.state.partnerStats[k] = (this.state.partnerStats[k] || []).filter(s => s.partnerId !== id);
    });
    this.save();
  },

  // ===== Estatísticas de parceiros =====
  getPartnerStats(year, month) {
    const key = `${year}-${month}`;
    return (this.state.partnerStats && this.state.partnerStats[key]) || [];
  },
  setPartnerStats(year, month, partnerId, leads, closed) {
    const key = `${year}-${month}`;
    if (!this.state.partnerStats) this.state.partnerStats = {};
    if (!this.state.partnerStats[key]) this.state.partnerStats[key] = [];
    const arr = this.state.partnerStats[key];
    const i = arr.findIndex(s => s.partnerId === partnerId);
    const stat = { partnerId, leads: Number(leads) || 0, closed: Number(closed) || 0 };
    if (i >= 0) arr[i] = stat; else arr.push(stat);
    this.save();
  },
  removePartnerStats(year, month, partnerId) {
    const key = `${year}-${month}`;
    if (!this.state.partnerStats || !this.state.partnerStats[key]) return;
    this.state.partnerStats[key] = this.state.partnerStats[key].filter(s => s.partnerId !== partnerId);
    this.save();
  },

  // ===== Custo total com parceiros (mensal) =====
  getPartnerCost(year, month) {
    if (!this.state.partnerCost) this.state.partnerCost = {};
    const key = `${year}-${month}`;
    return Number(this.state.partnerCost[key] || 0);
  },
  setPartnerCost(year, month, value) {
    if (!this.state.partnerCost) this.state.partnerCost = {};
    const key = `${year}-${month}`;
    this.state.partnerCost[key] = Number(value) || 0;
    this.save();
  },

  // ===== Filtros do período =====
  getClosingsForPeriod(year, month) {
    return this.state.closings.filter(c => {
      // Match direto na string YYYY-MM-DD (mais seguro que Date)
      const m = String(c.date || '').match(/^(\d{4})-(\d{2})/);
      if (m) {
        return Number(m[1]) === year && (Number(m[2]) - 1) === month;
      }
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
  // Se vier no formato YYYY-MM-DD (input de date HTML), interpretar como local
  // pra evitar problema de timezone (UTC convertido pra -3h vira o dia anterior)
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Parse de data ISO (YYYY-MM-DD) como data local (evita off-by-one por timezone)
function parseLocalDate(iso) {
  if (!iso) return new Date();
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

function periodLabel(year, month) {
  return `${MONTH_NAMES[month]} / ${year}`;
}
