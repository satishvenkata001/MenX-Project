import ExcelJS from 'exceljs';

/**
 * Neutralizes spreadsheet formula injection (CSV/DDE injection) threats.
 * If a cell string value begins with =, +, -, @, \t, or \r, it prepends a single quote
 * so spreadsheet applications treat the value strictly as literal text.
 */
export function sanitizeSpreadsheetCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Preserve numbers and booleans directly
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // If value is a Date instance, return ISO string or format
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString();
  }

  const str = String(value);

  // Check for formula injection triggers (after trimming leading whitespace)
  const trimmed = str.trimStart();
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r')
  ) {
    // If it's a valid numeric string like "-50" or "+100" (negative/positive number), check if it's strictly a number
    if (!isNaN(Number(trimmed)) && !trimmed.startsWith('=')) {
      return Number(trimmed);
    }
    // Prefix dangerous formula string with single quote
    return `'${str}`;
  }

  return str;
}

/**
 * Escapes and formats a single value for RFC 4180 CSV compliance.
 */
function formatCsvField(val) {
  const sanitized = sanitizeSpreadsheetCell(val);
  if (sanitized === null || sanitized === undefined) return '';

  const str = String(sanitized);
  // If field contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant CSV buffer with UTF-8 BOM.
 * @param {Array<{ key: string, header: string }>} columns 
 * @param {Array<Object>} rows 
 * @returns {Buffer}
 */
export function generateCsvBuffer(columns, rows) {
  const headerLine = columns.map(c => formatCsvField(c.header)).join(',');
  const rowLines = rows.map(row => {
    return columns.map(col => formatCsvField(row[col.key])).join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel properly detects UTF-8 encoding (e.g. ₹ currency, accents)
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Generates an Excel (.xlsx) buffer with typed cells, auto-width, bold frozen header.
 * @param {string} sheetName 
 * @param {Array<{ key: string, header: string, width?: number, isNumber?: boolean, isDate?: boolean }>} columns 
 * @param {Array<Object>} rows 
 * @returns {Promise<Buffer>}
 */
export async function generateExcelBuffer(sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MENX Admin Data Center';
  workbook.lastModifiedBy = 'MENX E-Commerce System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName || 'Export_Data', {
    views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
  });

  // Define columns
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(16, col.header.length + 4)
  }));

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.font = {
    name: 'Segoe UI',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Dark slate background matching MENX admin aesthetics
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
  headerRow.height = 26;

  // Populate data rows
  rows.forEach((row, rowIndex) => {
    const rowData = {};
    columns.forEach(col => {
      let val = row[col.key];
      val = sanitizeSpreadsheetCell(val);

      // If typed as number, ensure it is numeric in Excel
      if (col.isNumber && typeof val === 'number') {
        rowData[col.key] = val;
      } else if (col.isDate && val) {
        rowData[col.key] = typeof val === 'string' ? val : (val instanceof Date ? val.toISOString() : String(val));
      } else {
        rowData[col.key] = val;
      }
    });

    const addedRow = worksheet.addRow(rowData);
    addedRow.height = 20;
    addedRow.font = { name: 'Segoe UI', size: 10 };
    addedRow.alignment = { vertical: 'middle', horizontal: 'left' };

    // Subtle zebra striping
    if (rowIndex % 2 === 1) {
      addedRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
    }
  });

  // Dynamic column width adjustment based on content
  worksheet.columns.forEach(column => {
    let maxLen = column.header ? column.header.length : 12;
    column.eachCell({ includeEmpty: false }, cell => {
      const cellVal = cell.value ? String(cell.value) : '';
      if (cellVal.length > maxLen) {
        maxLen = Math.min(60, cellVal.length); // Cap at 60 to prevent absurd widths
      }
    });
    column.width = Math.max(maxLen + 4, 15);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
