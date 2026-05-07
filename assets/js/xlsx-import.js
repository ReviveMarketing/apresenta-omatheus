const XLSXImport = (() => {
  let XLSX = null;

  const loadXLSX = async () => {
    if (XLSX) return XLSX;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
      script.onload = () => {
        XLSX = window.XLSX;
        resolve(XLSX);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const parseDate = (dateValue) => {
    let dateStr = String(dateValue).trim();

    if (!dateStr) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    if (/^\d+$/.test(dateStr)) {
      const dateNum = parseInt(dateStr, 10);
      if (dateNum > 40000 && dateNum < 50000) {
        const date = new Date((dateNum - 25569) * 86400 * 1000);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(p => parseInt(p, 10));
      if (day && month && year && day <= 31 && month <= 12) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    return null;
  };

  const splitCityUF = (cityUFStr) => {
    const parts = cityUFStr.split('/').map(s => s.trim());
    return {
      city: parts[0] || '',
      uf: parts[1] || ''
    };
  };

  const parseProcesses = (processesStr) => {
    if (!processesStr) return [];
    return processesStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  };

  const parseRow = (row, consultantName) => {
    const client = String(row[0] || '').trim();
    const cityUFStr = String(row[1] || '').trim();
    const dateStr = String(row[2] || '').trim();
    const processesStr = String(row[3] || '').trim();
    const phone = String(row[5] || '').trim();

    if (!client || client.toLowerCase() === 'total') return null;

    const { city, uf } = splitCityUF(cityUFStr);
    const date = parseDate(dateStr);

    if (!date) return null;

    const processes = parseProcesses(processesStr);

    return {
      raw: client,
      client,
      consultant: consultantName,
      phone,
      city,
      uf,
      date,
      processes,
      processOther: '',
      audited: true,
      origin: 'INDICAÇÃO',
      type: 'referral',
      status: 'Fechado',
      confidence: {
        client: 1,
        phone: phone ? 1 : 0.5,
        city: city ? 1 : 0.5,
        date: 1,
        processes: processes.length > 0 ? 1 : 0.5
      }
    };
  };

  const parse = async (file) => {
    await loadXLSX();

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const results = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) continue;

      const consultant = sheetName.trim();

      let dataStartRow = -1;
      let cellA = worksheet['A1'];

      for (let r = 1; r <= 10; r++) {
        const cellKey = 'A' + r;
        cellA = worksheet[cellKey];
        if (cellA && cellA.v && String(cellA.v).toUpperCase() === 'CLIENTE') {
          dataStartRow = r;
          break;
        }
      }

      if (dataStartRow === -1) continue;

      const startDataRow = dataStartRow + 1;
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      for (let r = startDataRow; r <= range.e.r; r++) {
        const row = [];
        for (let c = 0; c <= 5; c++) {
          const cellKey = XLSX.utils.encode_col(c) + (r + 1);
          const cell = worksheet[cellKey];
          row.push(cell ? cell.v : '');
        }

        const parsed = parseRow(row, consultant);
        if (parsed) {
          results.push(parsed);
        }
      }
    }

    return results;
  };

  return {
    parse,
    loadXLSX
  };
})();
