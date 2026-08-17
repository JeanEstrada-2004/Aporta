function isDatabaseConfigured_() {
  return Boolean(PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.spreadsheetProperty));
}

function getDatabase_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.spreadsheetProperty);

  if (!spreadsheetId) {
    throw new Error('Aporta todavia no fue configurado. Ejecuta setupAporta desde Apps Script.');
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheets_(spreadsheet) {
  Object.keys(SHEET_SCHEMAS).forEach(function (sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    const headers = SHEET_SCHEMAS[sheetName];
    const currentHeaders = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    if (currentHeaders.join('|') !== headers.join('|')) {
      const isAdditiveMigration = currentHeaders.length > 0 && currentHeaders.every(function (header, index) {
        return header === headers[index];
      });

      if (sheet.getLastRow() > 1 && !isAdditiveMigration) {
        throw new Error('La hoja ' + sheetName + ' tiene una estructura incompatible.');
      }

      if (isAdditiveMigration) {
        const missingHeaders = headers.slice(currentHeaders.length);
        if (missingHeaders.length) {
          sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length)
            .setValues([missingHeaders]);
        }
      } else {
        sheet.clear();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#252b4a')
        .setFontColor('#ffffff');
    }
  });
}

function getSheet_(sheetName) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('No existe la hoja requerida: ' + sheetName);
  }
  return sheet;
}

function appendRecord_(sheetName, record) {
  const headers = SHEET_SCHEMAS[sheetName];
  if (!headers) {
    throw new Error('Esquema desconocido: ' + sheetName);
  }

  const row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
  });
  getSheet_(sheetName).appendRow(row);
  return record;
}

function getRecords_(sheetName) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const headers = SHEET_SCHEMAS[sheetName];

  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    .map(function (row) {
      return headers.reduce(function (record, header, index) {
        record[header] = serializeSheetValue_(row[index]);
        return record;
      }, {});
    });
}

function serializeSheetValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }
  return value;
}

function findRecord_(sheetName, predicate) {
  const records = getRecords_(sheetName);
  for (let index = 0; index < records.length; index += 1) {
    if (predicate(records[index])) {
      return records[index];
    }
  }
  return null;
}

function getRecordById_(sheetName, id) {
  return findRecord_(sheetName, function (record) {
    return record.id === id;
  });
}

function updateRecordById_(sheetName, id, changes) {
  const sheet = getSheet_(sheetName);
  const headers = SHEET_SCHEMAS[sheetName];
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) {
    throw new Error('La hoja ' + sheetName + ' no utiliza identificadores editables.');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('No se encontro el registro ' + id + '.');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (values[index][idIndex] === id) {
      headers.forEach(function (header, columnIndex) {
        if (Object.prototype.hasOwnProperty.call(changes, header)) {
          values[index][columnIndex] = changes[header];
        }
      });
      sheet.getRange(index + 2, 1, 1, headers.length).setValues([values[index]]);
      return;
    }
  }

  throw new Error('No se encontro el registro ' + id + '.');
}

function getConfigValue_(key) {
  const record = findRecord_('CONFIGURACION', function (item) {
    return item.clave === key;
  });
  return record ? record.valor : '';
}

function setConfigValue_(key, value, description) {
  const sheet = getSheet_('CONFIGURACION');
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues()
    : [];

  for (let index = 0; index < values.length; index += 1) {
    if (values[index][0] === key) {
      sheet.getRange(index + 2, 2, 1, 2).setValues([[String(value), description || '']]);
      return;
    }
  }

  appendRecord_('CONFIGURACION', {
    clave: key,
    valor: String(value),
    descripcion: description || ''
  });
}

function nextId_(entity) {
  const key = 'COUNTER_' + entity;
  const nextValue = Number(getConfigValue_(key) || 0) + 1;
  setConfigValue_(key, nextValue, 'Ultimo correlativo utilizado para ' + entity);
  return entity.substring(0, 3) + '-' + String(nextValue).padStart(4, '0');
}
