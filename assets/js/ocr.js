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
      origin: 'INDICAÇÃO PARCEIRO',
      type: 'referral',
      confidence: { client: 0, phone: 0, city: 0, date: 0, processes: 0 }
    };

    // --- Auditado? ---
    if (/auditad[oa]/i.test(text)) result.audited = true;

    // --- Lead/Tipo --- (sobrescreve default só se identificar tipo específico)
    if (/\bLEAD\b/i.test(text)) {
      result.type = 'digital';
      // mantém origem default Indicação Parceiro a menos que seja explicitamente META/GOOGLE
    }
    if (/\bmeta\b/i.test(text) && /\borigem|\bcanal/i.test(text)) {
      result.origin = 'META';
    } else if (/\bgoogle\b/i.test(text) && /\borigem|\bcanal/i.test(text)) {
      result.origin = 'GOOGLE';
    }
    if (/indica[çc][ãa]o/i.test(text) && !/parceiro/i.test(text)) {
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
    // Estratégia: limpar a linha removendo "ruídos" conhecidos (pills/labels), e o que sobrar é o nome do cliente.
    // O consultor é uma palavra (ou duas) que fica entre o nome do cliente e os labels (Auditado, LEAD, etc).

    // Lista de palavras-lixo que vêm de pills/botões/labels do ReVive
    const noiseWords = [
      'fechamento', 'editar', 'auditado', 'auditada', 'lead', 'leads',
      'excluir', 'salvar', 'cancelar', 'novo', 'cliente', 'consultor',
      'concluído', 'concluido', 'aguardando', 'pendente', 'visualizar',
      'cpf', 'rg', 'data', 'telefone', 'origem', 'status'
    ];
    const noiseRe = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');

    // Função pra limpar uma linha removendo ruído
    const cleanLine = (ln) => {
      return ln
        .replace(/[✓✔✗✘×]/g, ' ')               // ícones
        .replace(/\d{2}\/\d{2}\/\d{4}/g, ' ')   // datas
        .replace(/\d{2,}/g, ' ')                // qualquer número longo (telefone)
        .replace(/[(){}\[\]:;|]/g, ' ')         // pontuação
        .replace(noiseRe, ' ')                  // palavras-lixo
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Procura a linha mais provável do cliente:
    // - Geralmente é a linha mais "longa" depois de limpa (nome completo tem várias palavras)
    // - Toda em letras (sem dígitos significativos)
    let bestLine = '';
    let bestScore = 0;
    for (const ln of lines) {
      const cleaned = cleanLine(ln);
      if (!cleaned || cleaned.length < 6) continue;
      // Contar palavras alfabéticas com inicial maiúscula
      const tokens = cleaned.split(/\s+/).filter(t => /^[A-ZÀ-Ý][a-zA-ZÀ-ÿ\.]{1,}$/.test(t));
      if (tokens.length < 2) continue;
      // Score: mais palavras + linha mais longa = melhor
      const score = tokens.length * 10 + cleaned.length;
      if (score > bestScore) {
        bestScore = score;
        bestLine = cleaned;
      }
    }

    let clientFinal = '';
    let consultantCandidate = '';

    if (bestLine) {
      const tokens = bestLine.split(/\s+/).filter(Boolean);

      // Heurística pra separar cliente x consultor:
      // No ReVive Workspace, o consultor vem como 1 palavra (primeiro nome) DEPOIS do nome do cliente.
      // Cliente geralmente tem 3+ palavras (nome + sobrenomes); consultor é só 1 palavra.
      // Procura: se tem 4+ tokens E o último token é "isolado" (1 palavra só, com inicial maiúscula),
      // o último é o consultor e o restante é o cliente.

      if (tokens.length >= 4) {
        const last = tokens[tokens.length - 1];
        // Se o último parecer um primeiro nome (4-15 chars, só letras, inicial maiúscula)
        if (/^[A-ZÀ-Ý][a-zA-ZÀ-ÿ]{2,14}$/.test(last)) {
          // Verifica se algum consultor cadastrado bate com esse último token
          if (typeof Store !== 'undefined') {
            const consultantsList = Store.getConsultants();
            const matched = consultantsList.find(c =>
              c.toLowerCase() === last.toLowerCase() ||
              c.split(/\s+/)[0].toLowerCase() === last.toLowerCase()
            );
            if (matched) {
              consultantCandidate = matched;
              clientFinal = tokens.slice(0, -1).join(' ');
            } else {
              // Não bateu com nenhum consultor cadastrado — assume tudo como cliente
              clientFinal = bestLine;
            }
          } else {
            clientFinal = bestLine;
          }
        } else {
          clientFinal = bestLine;
        }
      } else {
        clientFinal = bestLine;
      }
      result.client = this.titleCase(clientFinal);
      result.confidence.client = 0.85;
    }

    // Procura consultores cadastrados no texto inteiro (mais confiável que a linha)
    if (typeof Store !== 'undefined') {
      const consultants = Store.getConsultants();
      // Tenta achar qualquer um deles em qualquer parte do texto
      for (const c of consultants) {
        const firstName = c.split(/\s+/)[0];
        const re = new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'i');
        if (re.test(text)) {
          result.consultant = c;
          // Se o nome do consultor estava grudado no nome do cliente, remover
          if (result.client) {
            const cleanedClient = result.client.replace(new RegExp(`\\s*\\b${escapeRegex(firstName)}\\b\\s*$`, 'i'), '').trim();
            if (cleanedClient && cleanedClient.split(/\s+/).length >= 2) {
              result.client = cleanedClient;
            }
          }
          break;
        }
      }
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
