/* ============================================
   OCR Importer — lê prints do ReVive Workspace
   e converte em fechamentos
   ============================================ */

const OCR = {
  TESSERACT_URL: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js',
  workerLoading: false,
  workerReady: false,
  worker: null,

  // Carrega Tesseract.js sob demanda (só quando o usuário abre o painel)
  async loadTesseract() {
    if (window.Tesseract) return true;
    if (this.workerLoading) {
      // Espera carregar
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (window.Tesseract) {
            clearInterval(check);
            resolve(true);
          }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(!!window.Tesseract); }, 30000);
      });
    }
    this.workerLoading = true;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = this.TESSERACT_URL;
      s.onload = () => { this.workerLoading = false; resolve(true); };
      s.onerror = () => { this.workerLoading = false; reject(new Error('Falha ao carregar Tesseract.js — verifique a conexão')); };
      document.head.appendChild(s);
    });
  },

  async ensureWorker(progressCb) {
    if (this.worker) return this.worker;
    await this.loadTesseract();
    // API Tesseract 5: createWorker
    this.worker = await window.Tesseract.createWorker('por', 1, {
      logger: m => {
        if (progressCb && m.status === 'recognizing text') {
          progressCb(Math.round(m.progress * 100));
        }
      }
    });
    this.workerReady = true;
    return this.worker;
  },

  async recognize(imageBlob, progressCb) {
    const worker = await this.ensureWorker(progressCb);
    const { data } = await worker.recognize(imageBlob);
    return data.text || '';
  },

  // ============= PARSER do ReVive Workspace =============
  // Recebe o texto bruto do OCR e tenta extrair os campos
  parse(rawText) {
    const text = rawText.replace(/\u00A0/g, ' ');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const result = {
      raw: rawText,
      client: '',
      consultant: '',
      phone: '',
      city: '',
      uf: '',
      date: '',
      processes: [],
      processOther: '',
      audited: false,
      origin: 'META',
      type: 'digital',
      confidence: { client: 0, phone: 0, city: 0, date: 0, processes: 0 }
    };

    // --- Auditado? ---
    if (/auditad[oa]/i.test(text)) result.audited = true;

    // --- Lead/Tipo ---
    if (/\bLEAD\b/i.test(text)) {
      result.type = 'digital';
      result.origin = 'META';
    }
    if (/indica[çc][ãa]o/i.test(text)) {
      result.type = 'referral';
      result.origin = 'INDICAÇÃO';
    }

    // --- Telefone --- (formato (DD) XXXXX-XXXX)
    const phoneMatch = text.match(/\(?\s*(\d{2})\s*\)?\s*([9]?\s*\d{4})\s*[-–\s]\s*(\d{4})/);
    if (phoneMatch) {
      result.phone = `(${phoneMatch[1]}) ${phoneMatch[2].replace(/\s/g,'')}-${phoneMatch[3]}`;
      result.confidence.phone = 0.9;
    }

    // --- Datas --- (formato DD/MM/YYYY) — pega a primeira que pareça data de fechamento
    // Prioriza linhas com "Fechamento:" se existir
    let dateStr = '';
    const fechamentoLine = lines.find(l => /fechamento\s*:/i.test(l));
    if (fechamentoLine) {
      const m = fechamentoLine.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) dateStr = `${m[3]}-${m[2]}-${m[1]}`;
    }
    // Se não achou em "Fechamento", pega qualquer data
    if (!dateStr) {
      const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) dateStr = `${m[3]}-${m[2]}-${m[1]}`;
    }
    if (dateStr) {
      result.date = dateStr;
      result.confidence.date = 0.85;
    }

    // --- Cidade / UF --- (formato "Cidade Nome / UF" ou "Cidade Nome - UF")
    // No ReVive aparece tipo: "Sao Jose Dos Pinhais / PR"
    const cityUFRegex = /([A-Za-zÀ-ÿ\s]+?)\s*\/\s*([A-Z]{2})\b/;
    const cityMatch = text.match(cityUFRegex);
    if (cityMatch) {
      result.city = cityMatch[1].trim();
      result.uf = cityMatch[2].trim();
      result.confidence.city = 0.85;
      // Tenta normalizar nome da cidade (acentuação/capitalização)
      result.city = this.normalizeCity(result.city);
    }

    // --- Processos --- (procura nomes da lista PROCESS_TYPES no texto)
    const processTypes = (typeof PROCESS_TYPES !== 'undefined') ? PROCESS_TYPES : [];
    const lowerText = text.toLowerCase();
    const found = new Set();
    processTypes.forEach(p => {
      if (p === 'Outros') return;
      const cleaned = p.toLowerCase()
        .replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i')
        .replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/[ç]/g, 'c');
      const cleanText = lowerText
        .replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i')
        .replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/[ç]/g, 'c');
      if (cleanText.includes(cleaned)) found.add(p);
    });
    if (found.size > 0) {
      result.processes = [...found];
      result.confidence.processes = 0.7;
    }

    // --- Cliente e Consultor ---
    // Heurística: a primeira linha "grande" (mais de 8 chars, sem números/símbolos especiais)
    // que NÃO contém palavras-chave (Fechamento, Editar, Auditado, LEAD, etc.) costuma ser o nome do cliente.
    // O consultor geralmente aparece numa "pill" ao lado — no OCR vira uma palavra solta antes/depois.
    const skipKeywords = /fechamento|editar|auditad|^lead$|alex|excluir|✓/i;
    const namePattern = /^[A-ZÀ-Ý][A-Za-zÀ-ÿ\s\.]{6,}$/;
    let clientLine = '';
    let consultantCandidate = '';

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (skipKeywords.test(ln)) continue;
      // Linha que parece um nome próprio
      if (namePattern.test(ln) && !ln.match(/\d/) && ln.length >= 8) {
        if (!clientLine) {
          clientLine = ln;
          // O consultor normalmente aparece NA MESMA linha (depois do nome) ou na próxima
          // Tenta extrair palavras "soltas" pequenas que sobraram nessa linha
          continue;
        }
      }
    }

    // Tenta achar o consultor: olha a linha do cliente e a próxima
    // No ReVive aparece um "pill" verde com o nome do consultor logo após o cliente
    if (clientLine) {
      // Quebra a linha procurando padrão: "Nome Completo Multi Palavras" + "Consultor"
      // Geralmente o cliente tem 3+ palavras e o consultor tem 1-2 palavras
      const tokens = clientLine.split(/\s+/);
      if (tokens.length >= 4) {
        // Os 3-4 primeiros tokens são o cliente, os últimos podem ser o consultor
        // Heurística: se o último token for uma palavra única curta, pode ser o consultor
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.length >= 4 && lastToken.length <= 12 && /^[A-ZÀ-Ý]/.test(lastToken)) {
          consultantCandidate = lastToken;
          result.client = tokens.slice(0, -1).join(' ');
        } else {
          result.client = clientLine;
        }
      } else {
        result.client = clientLine;
      }
      result.confidence.client = 0.7;
    }

    // Procura consultores conhecidos no texto inteiro (mais confiável)
    if (typeof Store !== 'undefined') {
      const consultants = Store.getConsultants();
      consultants.forEach(c => {
        const re = new RegExp(`\\b${escapeRegex(c)}\\b`, 'i');
        if (re.test(text)) {
          result.consultant = c;
        }
      });
    }
    if (!result.consultant && consultantCandidate) {
      result.consultant = consultantCandidate;
    }

    return result;
  },

  // Normaliza nome da cidade (procura na BRAZIL_CITIES uma correspondência por similaridade)
  normalizeCity(name) {
    if (typeof BRAZIL_CITIES === 'undefined') return this.titleCase(name);
    const slug = (s) => s.toLowerCase()
      .replace(/[áàâã]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i')
      .replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const target = slug(name);
    const found = BRAZIL_CITIES.find(c => slug(c.city) === target);
    if (found) return found.city;
    return this.titleCase(name);
  },

  titleCase(s) {
    return s.toLowerCase().replace(/(^|\s)(\w)/g, (m, sp, ch) => sp + ch.toUpperCase());
  }
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
