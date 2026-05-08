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
    // Estratégia: no ReVive Workspace o nome do cliente é a PRIMEIRA linha "boa" do texto.
    // Vamos limpar cada linha removendo ruído e pegar a primeira que pareça nome de pessoa.

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
        .replace(/\d{2,}/g, ' ')                // números longos (telefone)
        .replace(/[(){}\[\]:;|]/g, ' ')         // pontuação
        .replace(noiseRe, ' ')                  // palavras-lixo
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Detector: linha parece "cidade"? (ex: "São Francisco Do Sul / SC", "Blumenau / SC")
    // Critério: contém " / UF" no final (UF = 2 letras maiúsculas)
    const looksLikeCityLine = (ln) => /\/\s*[A-Z]{2}\b/.test(ln);

    // Detector: linha parece "nome de pessoa"? (várias palavras com inicial maiúscula, sem barra/UF)
    const isPersonName = (ln) => {
      if (looksLikeCityLine(ln)) return false;
      const tokens = ln.split(/\s+/).filter(Boolean);
      if (tokens.length < 2) return false;
      // Pelo menos 2 tokens com inicial maiúscula e o resto minúsculo (ex: "Daniely", "Fructuoso")
      const properNames = tokens.filter(t => /^[A-ZÀ-Ý][a-zA-ZÀ-ÿ\.]{1,}$/.test(t) && t.length >= 2);
      return properNames.length >= 2;
    };

    let bestLine = '';

    // 1ª passada: pega a PRIMEIRA linha que pareça nome de pessoa (sem ser a cidade)
    for (const ln of lines) {
      const cleaned = cleanLine(ln);
      if (!cleaned || cleaned.length < 6) continue;
      if (isPersonName(cleaned)) {
        bestLine = cleaned;
        break;
      }
    }

    // Fallback: se nada, pega a linha mais longa que NÃO seja cidade
    if (!bestLine) {
      let bestScore = 0;
      for (const ln of lines) {
        const cleaned = cleanLine(ln);
        if (!cleaned || cleaned.length < 6) continue;
        if (looksLikeCityLine(cleaned)) continue;
        const tokens = cleaned.split(/\s+/).filter(t => /^[A-ZÀ-Ý][a-zA-ZÀ-ÿ\.]{1,}$/.test(t));
        if (tokens.length < 2) continue;
        const score = tokens.length * 10 + cleaned.length;
        if (score > bestScore) {
          bestScore = score;
          bestLine = cleaned;
        }
      }
    }

    let clientFinal = '';
    let consultantCandidate = '';

    if (bestLine) {
      const tokens = bestLine.split(/\s+/).filter(Boolean);

      // Heurística: separar cliente x consultor
      // Cliente = nome em negrito (várias palavras); Consultor = 1 palavra após o nome
      if (tokens.length >= 3) {
        const last = tokens[tokens.length - 1];
        if (/^[A-ZÀ-Ý][a-zA-ZÀ-ÿ]{2,14}$/.test(last)) {
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

    // Procura consultores cadastrados no texto inteiro (mais confiável)
    if (typeof Store !== 'undefined') {
      const consultants = Store.getConsultants();
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

  // Detecta MÚLTIPLOS clientes em um único texto/print
  // Retorna array de resultados (1 ou mais)
  parseMultiple(rawText) {
    const text = rawText.replace(/\u00A0/g, ' ');

    // FORMATO 1: lista do ReVive com labels (Processo:, Fechamento:, Cidade:, Consultor:)
    const hasListFormat = /processo\s*:/i.test(text) && /(consultor\s*:|cidade\s*:)/i.test(text);
    if (hasListFormat) {
      const blocks = this.splitListBlocks(text);
      if (blocks.length >= 1) {
        return blocks.map(b => this.parseBlock(b));
      }
    }

    // FORMATO 2: lista compacta — uma linha por fechamento
    // Ex: "Curitiba PR | Seguro de Vida | 28/04/2026 | Augusto"
    // Ex: "Curitiba - PR - Seguro de Vida - 28/04/2026"
    // Ex: "Curitiba/PR · Seguro de Vida · 28/04/2026"
    const linesCompact = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const compactResults = [];
    let consultantHint = '';

    // Tenta detectar consultor "global" no topo (ex: "Augusto:" ou "Consultor: Augusto" no início)
    const headerConsultorMatch = text.match(/^[^\n]*?(?:consultor\s*:?\s*)([A-ZÀ-Ý][a-zA-ZÀ-ÿ]+)/im);
    if (headerConsultorMatch) consultantHint = headerConsultorMatch[1];
    // Ou se a primeira linha for SÓ um nome (Augusto)
    if (!consultantHint && linesCompact.length > 0) {
      const first = linesCompact[0];
      if (/^[A-ZÀ-Ý][a-zA-ZÀ-ÿ]{2,15}\s*:?\s*$/.test(first)) {
        consultantHint = first.replace(':', '').trim();
      }
    }

    for (const line of linesCompact) {
      // Pula linha de header com só o consultor
      if (consultantHint && new RegExp(`^${escapeRegex(consultantHint)}\\s*:?\\s*$`, 'i').test(line)) continue;
      // Pula linha vazia ou muito curta
      if (line.length < 5) continue;

      const parsed = this.parseLine(line, consultantHint);
      if (parsed) compactResults.push(parsed);
    }

    if (compactResults.length > 0) return compactResults;

    // FORMATO 3 (fallback): tenta como 1 fechamento só (formato card)
    return [this.parse(rawText)];
  },

  // Parse de uma linha única no formato compacto
  // Tenta extrair: cidade, UF, processo(s), data, consultor
  parseLine(line, consultantHint = '') {
    const result = {
      raw: line,
      client: '',
      consultant: consultantHint || '',
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

    let work = line;

    // 1) Data DD/MM/YYYY ou DD/MM/YY
    const dateMatch = work.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (dateMatch) {
      let yr = dateMatch[3];
      if (yr.length === 2) yr = '20' + yr;
      result.date = `${yr}-${dateMatch[2]}-${dateMatch[1]}`;
      result.confidence.date = 0.95;
      work = work.replace(dateMatch[0], ' ');
    }

    // 2) Processos — varre TODA a lista PROCESS_TYPES e marca os que aparecem
    const processTypes = (typeof PROCESS_TYPES !== 'undefined') ? PROCESS_TYPES : [];
    const slug = (s) => s.toLowerCase()
      .replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i')
      .replace(/[óôõ]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c')
      .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
    const wSlug = slug(work);
    processTypes.forEach(p => {
      if (p === 'Outros') return;
      const pSlug = slug(p);
      if (wSlug.includes(pSlug) && !result.processes.includes(p)) {
        result.processes.push(p);
        // Remove o processo da string de trabalho pra não atrapalhar a cidade
        work = work.replace(new RegExp(escapeRegex(p), 'gi'), ' ');
      }
    });
    if (result.processes.length > 0) result.confidence.processes = 0.85;

    // 3) Tipo / Origem por keyword
    if (/\bindica[çc][ãa]o\s*parceir/i.test(work)) {
      result.type = 'referral';
      result.origin = 'INDICAÇÃO PARCEIRO';
      work = work.replace(/indica[çc][ãa]o\s*parceir[oa]?/gi, ' ');
    } else if (/\bindica[çc][ãa]o/i.test(work)) {
      result.type = 'referral';
      result.origin = 'INDICAÇÃO';
      work = work.replace(/indica[çc][ãa]o/gi, ' ');
    } else if (/\bmeta\b/i.test(work)) {
      result.type = 'digital';
      result.origin = 'META';
      work = work.replace(/\bmeta\b/gi, ' ');
    } else if (/\bgoogle\b/i.test(work)) {
      result.type = 'digital';
      result.origin = 'GOOGLE';
      work = work.replace(/\bgoogle\b/gi, ' ');
    } else if (/\borg[âa]nico\b/i.test(work)) {
      result.type = 'digital';
      result.origin = 'ORGÂNICO';
      work = work.replace(/org[âa]nico/gi, ' ');
    }

    // 4) Status (Fechado, Negociação, Aguardando)
    const statusMatch = work.match(/\b(fechado|negocia[çc][ãa]o|aguardando(\s*resposta)?)\b/i);
    if (statusMatch) {
      const s = statusMatch[1].toLowerCase();
      if (s.startsWith('fechad')) result.status = 'Fechado';
      else if (s.startsWith('negoc')) result.status = 'Negociação';
      else result.status = 'Aguardando Resposta';
      work = work.replace(statusMatch[0], ' ');
    }

    // 5) UF (2 letras maiúsculas válidas)
    const ufRegex = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;
    const ufMatch = work.match(ufRegex);
    if (ufMatch) {
      result.uf = ufMatch[1];
      work = work.replace(ufMatch[0], ' ');
    }

    // 6) Cidade — depois de remover tudo, o que sobrar de "palavras com letras" é a cidade
    // Limpa separadores (- | / · , ;)
    let cityCandidate = work
      .replace(/[-|\/·,;:]/g, ' ')
      .replace(/\b\d+\b/g, ' ')   // números soltos
      .replace(/\s+/g, ' ')
      .trim();

    // Se o consultor foi dado, remove do candidate da cidade
    if (consultantHint) {
      cityCandidate = cityCandidate.replace(new RegExp(`\\b${escapeRegex(consultantHint)}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    }

    // Tenta achar consultor no que sobrou (se ainda não tem)
    if (!result.consultant && typeof Store !== 'undefined') {
      const consultants = Store.getConsultants();
      for (const c of consultants) {
        const firstName = c.split(/\s+/)[0];
        const re = new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'i');
        if (re.test(cityCandidate)) {
          result.consultant = c;
          cityCandidate = cityCandidate.replace(re, ' ').replace(/\s+/g, ' ').trim();
          break;
        }
      }
    }

    // O que sobrou de palavras alfabéticas é a cidade
    if (cityCandidate.length >= 3) {
      // Tenta normalizar com BRAZIL_CITIES
      const normalized = this.normalizeCity(cityCandidate);
      result.city = normalized;
      result.confidence.city = 0.7;

      // Se não temos UF, tenta inferir pela cidade conhecida
      if (!result.uf && typeof BRAZIL_CITIES !== 'undefined') {
        const found = BRAZIL_CITIES.find(c => c.city.toLowerCase() === normalized.toLowerCase());
        if (found) result.uf = found.uf;
      }
    }

    // Status default
    if (!result.status) result.status = 'Fechado';

    // Linha precisa ter o mínimo: cidade OU processo OU data
    if (!result.city && result.processes.length === 0 && !result.date) {
      return null;
    }

    return result;
  },

  // Quebra texto da lista em blocos por cliente
  splitListBlocks(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    const blocks = [];
    let current = [];

    // Heurística: novo bloco começa quando temos uma linha "nome de pessoa" seguida na próxima
    // linha (ou alguma logo depois) de "Processo:" ou similar
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln) continue;

      // Linha que parece ser um nome de pessoa (sem labels, várias palavras com inicial maiúscula)
      const isLabel = /^(processo|fechamento|telefone|cidade|consultor|origem|status|cpf|rg|data)\s*:/i.test(ln);
      const tokens = ln.split(/\s+/);
      const properNames = tokens.filter(t => /^[A-ZÀ-Ý][a-zA-ZÀ-ÿ\.]{1,}$/.test(t));
      const isPersonName = !isLabel && properNames.length >= 2 && tokens.length >= 2 && !/\d/.test(ln);

      if (isPersonName) {
        // Confirma olhando próximas 5 linhas se tem "Processo:" ou similar
        const next5 = lines.slice(i + 1, i + 7).join(' ');
        const hasFollowingLabels = /processo\s*:|consultor\s*:|telefone\s*:/i.test(next5);

        if (hasFollowingLabels) {
          // É início de novo bloco
          if (current.length > 0) blocks.push(current.join('\n'));
          current = [ln];
          continue;
        }
      }
      current.push(ln);
    }
    if (current.length > 0) blocks.push(current.join('\n'));
    return blocks.filter(b => b.trim().length > 10);
  },

  // Parser específico para um bloco do formato "lista" (com labels)
  parseBlock(blockText) {
    const result = {
      raw: blockText,
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

    const lines = blockText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1ª linha = nome do cliente (formato lista)
    if (lines.length > 0) {
      const first = lines[0];
      // Se a primeira linha não tem ":" e parece nome, é o cliente
      if (!/:/.test(first)) {
        result.client = this.titleCase(first);
        result.confidence.client = 0.9;
      }
    }

    // Processa cada linha com label
    for (const ln of lines) {
      // Processo: ...
      const procMatch = ln.match(/^processo\s*:\s*(.+)$/i);
      if (procMatch) {
        const procText = procMatch[1];
        // Pode ter múltiplos: "Seguro Terceiro - 3/5 | Auxílio-Acidente - 3/5"
        const parts = procText.split(/[|,]/).map(p => p.replace(/\s*-\s*\d+\/\d+/g, '').replace(/\s*-\s*(arquivado|completo|pendente)\s*$/i, '').trim());
        const processTypes = (typeof PROCESS_TYPES !== 'undefined') ? PROCESS_TYPES : [];
        const slug = (s) => s.toLowerCase().replace(/[áàâã]/g,'a').replace(/[éê]/g,'e').replace(/[í]/g,'i').replace(/[óôõ]/g,'o').replace(/[ú]/g,'u').replace(/[ç]/g,'c');
        parts.forEach(p => {
          const ps = slug(p);
          const found = processTypes.find(pt => slug(pt) === ps || slug(pt).includes(ps) || ps.includes(slug(pt)));
          if (found && !result.processes.includes(found)) result.processes.push(found);
        });
        if (result.processes.length > 0) result.confidence.processes = 0.9;
        continue;
      }

      // Fechamento: DD/MM/YYYY
      const fechMatch = ln.match(/^fechamento\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (fechMatch) {
        result.date = `${fechMatch[3]}-${fechMatch[2]}-${fechMatch[1]}`;
        result.confidence.date = 0.95;
        continue;
      }

      // Telefone: (XX) XXXXX-XXXX
      const phoneMatch = ln.match(/^telefone\s*:\s*(.+)$/i);
      if (phoneMatch) {
        const phoneRe = phoneMatch[1].match(/\(?\s*(\d{2})\s*\)?\s*([9]?\s*\d{4,5})\s*[-–\s]?\s*(\d{4})/);
        if (phoneRe) {
          result.phone = `(${phoneRe[1]}) ${phoneRe[2].replace(/\s/g,'')}-${phoneRe[3]}`;
        } else {
          // Pode estar sem formatação: 47989265920
          const onlyNums = phoneMatch[1].replace(/\D/g, '');
          if (onlyNums.length >= 10) {
            const dd = onlyNums.slice(0, 2);
            const rest = onlyNums.slice(2);
            const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
            const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
            result.phone = `(${dd}) ${mid}-${end}`;
          }
        }
        result.confidence.phone = 0.9;
        continue;
      }

      // Cidade: nome / UF (ou só nome)
      const cidMatch = ln.match(/^cidade\s*:\s*(.+)$/i);
      if (cidMatch) {
        const cidText = cidMatch[1];
        const ufMatch = cidText.match(/^(.+?)\s*\/\s*([A-Z]{2})\s*$/);
        if (ufMatch) {
          result.city = this.normalizeCity(ufMatch[1].trim());
          result.uf = ufMatch[2];
        } else {
          result.city = this.normalizeCity(cidText.trim());
        }
        result.confidence.city = 0.9;
        continue;
      }

      // Consultor: nome
      const consMatch = ln.match(/^consultor\s*:\s*(.+)$/i);
      if (consMatch) {
        let consName = consMatch[1].trim();
        // Tenta achar correspondência exata na lista cadastrada
        if (typeof Store !== 'undefined') {
          const consultants = Store.getConsultants();
          const matched = consultants.find(c =>
            c.toLowerCase() === consName.toLowerCase() ||
            c.split(/\s+/)[0].toLowerCase() === consName.toLowerCase()
          );
          if (matched) consName = matched;
        }
        result.consultant = consName;
        continue;
      }
    }

    // Se não achou cidade/UF mas a UF aparece na primeira linha, tenta puxar
    if (!result.uf) {
      const m = blockText.match(/\b([A-Z]{2})\b/);
      if (m && /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(m[1])) {
        result.uf = m[1];
      }
    }

    // Tipo / Origem default — se for "Arquivado" ou "Completo" pode indicar origem
    // (mantém Indicação Parceiro como default)

    return result;
  },

  // Normaliza nome da cidade
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
