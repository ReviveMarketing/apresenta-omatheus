/* ============================================
   Dados estáticos: UFs e cidades brasileiras
   Coordenadas (lat, lng) para o globo 3D
   ============================================ */

const BRAZIL_STATES = [
  { uf: 'AC', name: 'Acre', lat: -8.77, lng: -70.55 },
  { uf: 'AL', name: 'Alagoas', lat: -9.62, lng: -36.82 },
  { uf: 'AP', name: 'Amapá', lat: 1.41, lng: -51.77 },
  { uf: 'AM', name: 'Amazonas', lat: -3.07, lng: -61.66 },
  { uf: 'BA', name: 'Bahia', lat: -13.29, lng: -41.71 },
  { uf: 'CE', name: 'Ceará', lat: -5.20, lng: -39.53 },
  { uf: 'DF', name: 'Distrito Federal', lat: -15.83, lng: -47.86 },
  { uf: 'ES', name: 'Espírito Santo', lat: -19.19, lng: -40.34 },
  { uf: 'GO', name: 'Goiás', lat: -15.98, lng: -49.86 },
  { uf: 'MA', name: 'Maranhão', lat: -5.42, lng: -45.44 },
  { uf: 'MT', name: 'Mato Grosso', lat: -12.64, lng: -55.42 },
  { uf: 'MS', name: 'Mato Grosso do Sul', lat: -20.51, lng: -54.54 },
  { uf: 'MG', name: 'Minas Gerais', lat: -18.10, lng: -44.38 },
  { uf: 'PA', name: 'Pará', lat: -3.79, lng: -52.48 },
  { uf: 'PB', name: 'Paraíba', lat: -7.28, lng: -36.71 },
  { uf: 'PR', name: 'Paraná', lat: -24.89, lng: -51.55 },
  { uf: 'PE', name: 'Pernambuco', lat: -8.38, lng: -37.86 },
  { uf: 'PI', name: 'Piauí', lat: -6.60, lng: -42.28 },
  { uf: 'RJ', name: 'Rio de Janeiro', lat: -22.25, lng: -42.66 },
  { uf: 'RN', name: 'Rio Grande do Norte', lat: -5.81, lng: -36.59 },
  { uf: 'RS', name: 'Rio Grande do Sul', lat: -30.03, lng: -53.20 },
  { uf: 'RO', name: 'Rondônia', lat: -10.83, lng: -63.34 },
  { uf: 'RR', name: 'Roraima', lat: 1.99, lng: -61.33 },
  { uf: 'SC', name: 'Santa Catarina', lat: -27.45, lng: -50.95 },
  { uf: 'SP', name: 'São Paulo', lat: -22.19, lng: -48.79 },
  { uf: 'SE', name: 'Sergipe', lat: -10.57, lng: -37.39 },
  { uf: 'TO', name: 'Tocantins', lat: -9.46, lng: -48.26 }
];

// Principais cidades — usadas como sugestão e para auto-geocoding
const BRAZIL_CITIES = [
  // SC (foco principal — Blumenau e região)
  { city: 'Blumenau', uf: 'SC', lat: -26.9194, lng: -49.0661 },
  { city: 'Indaial', uf: 'SC', lat: -26.8979, lng: -49.2317 },
  { city: 'Timbó', uf: 'SC', lat: -26.8231, lng: -49.2706 },
  { city: 'Pomerode', uf: 'SC', lat: -26.7406, lng: -49.1763 },
  { city: 'Gaspar', uf: 'SC', lat: -26.9311, lng: -48.9558 },
  { city: 'Brusque', uf: 'SC', lat: -27.0978, lng: -48.9106 },
  { city: 'Itajaí', uf: 'SC', lat: -26.9078, lng: -48.6614 },
  { city: 'Balneário Camboriú', uf: 'SC', lat: -26.9907, lng: -48.6354 },
  { city: 'Joinville', uf: 'SC', lat: -26.3045, lng: -48.8487 },
  { city: 'Florianópolis', uf: 'SC', lat: -27.5954, lng: -48.5480 },
  { city: 'Chapecó', uf: 'SC', lat: -27.0966, lng: -52.6184 },
  { city: 'Criciúma', uf: 'SC', lat: -28.6776, lng: -49.3697 },
  { city: 'Lages', uf: 'SC', lat: -27.8156, lng: -50.3262 },
  { city: 'Tubarão', uf: 'SC', lat: -28.4666, lng: -49.0070 },
  { city: 'Rio do Sul', uf: 'SC', lat: -27.2153, lng: -49.6427 },
  { city: 'Jaraguá do Sul', uf: 'SC', lat: -26.4849, lng: -49.0667 },

  // CE (Fortaleza)
  { city: 'Fortaleza', uf: 'CE', lat: -3.7172, lng: -38.5433 },
  { city: 'Caucaia', uf: 'CE', lat: -3.7363, lng: -38.6531 },
  { city: 'Maracanaú', uf: 'CE', lat: -3.8767, lng: -38.6256 },
  { city: 'Sobral', uf: 'CE', lat: -3.6889, lng: -40.3489 },
  { city: 'Juazeiro do Norte', uf: 'CE', lat: -7.2128, lng: -39.3158 },

  // MG
  { city: 'Belo Horizonte', uf: 'MG', lat: -19.9167, lng: -43.9345 },
  { city: 'Uberlândia', uf: 'MG', lat: -18.9186, lng: -48.2772 },
  { city: 'Contagem', uf: 'MG', lat: -19.9319, lng: -44.0537 },
  { city: 'Juiz de Fora', uf: 'MG', lat: -21.7642, lng: -43.3503 },
  { city: 'Betim', uf: 'MG', lat: -19.9678, lng: -44.1986 },

  // SP
  { city: 'São Paulo', uf: 'SP', lat: -23.5505, lng: -46.6333 },
  { city: 'Campinas', uf: 'SP', lat: -22.9099, lng: -47.0626 },
  { city: 'Ribeirão Preto', uf: 'SP', lat: -21.1775, lng: -47.8103 },
  { city: 'Santos', uf: 'SP', lat: -23.9608, lng: -46.3331 },
  { city: 'Sorocaba', uf: 'SP', lat: -23.5018, lng: -47.4581 },
  { city: 'São José dos Campos', uf: 'SP', lat: -23.2237, lng: -45.9009 },

  // RJ
  { city: 'Rio de Janeiro', uf: 'RJ', lat: -22.9068, lng: -43.1729 },
  { city: 'Niterói', uf: 'RJ', lat: -22.8833, lng: -43.1036 },
  { city: 'Nova Iguaçu', uf: 'RJ', lat: -22.7595, lng: -43.4509 },

  // PR
  { city: 'Curitiba', uf: 'PR', lat: -25.4284, lng: -49.2733 },
  { city: 'Londrina', uf: 'PR', lat: -23.3045, lng: -51.1696 },
  { city: 'Maringá', uf: 'PR', lat: -23.4205, lng: -51.9331 },

  // RS
  { city: 'Porto Alegre', uf: 'RS', lat: -30.0346, lng: -51.2177 },
  { city: 'Caxias do Sul', uf: 'RS', lat: -29.1685, lng: -51.1796 },
  { city: 'Pelotas', uf: 'RS', lat: -31.7654, lng: -52.3373 },

  // BA
  { city: 'Salvador', uf: 'BA', lat: -12.9714, lng: -38.5014 },
  { city: 'Feira de Santana', uf: 'BA', lat: -12.2664, lng: -38.9663 },

  // PE
  { city: 'Recife', uf: 'PE', lat: -8.0476, lng: -34.8770 },

  // DF
  { city: 'Brasília', uf: 'DF', lat: -15.7975, lng: -47.8919 },

  // GO
  { city: 'Goiânia', uf: 'GO', lat: -16.6869, lng: -49.2648 },

  // PA
  { city: 'Belém', uf: 'PA', lat: -1.4554, lng: -48.5044 },

  // AM
  { city: 'Manaus', uf: 'AM', lat: -3.1190, lng: -60.0217 },

  // ES
  { city: 'Vitória', uf: 'ES', lat: -20.3155, lng: -40.3128 },

  // PB
  { city: 'João Pessoa', uf: 'PB', lat: -7.1195, lng: -34.8450 },

  // RN
  { city: 'Natal', uf: 'RN', lat: -5.7945, lng: -35.2110 }
];

const STATUS_OPTIONS = [
  'Aguardando Resposta',
  'Fechado',
  'Letalk / Novo Contato',
  'Não consegui contato/IA',
  'Negociação',
  'Repetido',
  'Sem Dados',
  'Sem Possibilidade / Concorrente',
  'Sem Possibilidade / Não Encontrou',
  'Sem Possibilidade / Sem Acidente',
  'Sem Possibilidade / Sem Direito',
  'Sem Possibilidade / Sem Fraturas',
  'Sem Possibilidade / Sem Interesse',
  'Sem Possibilidade / Sem Retorno',
  'Visita Corriqueira'
];

const ORIGIN_OPTIONS = ['META', 'GOOGLE', 'ORGÂNICO', 'INDICAÇÃO', 'INDICAÇÃO PARCEIRO', 'OUTRO'];

const PROCESS_TYPES = [
  'Seguro de Vida',
  'Auxílio-Acidente',
  'Auxílio-Maternidade',
  'BPC/LOAS',
  'Aposentadoria por Idade',
  'Aposentadoria por Tempo',
  'Aposentadoria por Invalidez',
  'Pensão por Morte',
  'Auxílio-Doença',
  'DPVAT',
  'DPVAT Óbito',
  'Seguro Terceiro',
  'Ação Acidente de Trânsito',
  'Fraude',
  'Outros'
];

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_ABBR = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

// Helper para encontrar cidade pelo nome
function findCity(name, uf) {
  const n = name.trim().toLowerCase();
  return BRAZIL_CITIES.find(c =>
    c.city.toLowerCase() === n && (!uf || c.uf === uf)
  );
}

function findStateCenter(uf) {
  return BRAZIL_STATES.find(s => s.uf === uf);
}
