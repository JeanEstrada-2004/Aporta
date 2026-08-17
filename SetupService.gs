function inspectAportaResources() {
  const spreadsheetCandidates = [];
  const spreadsheetFiles = DriveApp.getFilesByName('Aporta - Base de Datos');
  while (spreadsheetFiles.hasNext()) {
    const file = spreadsheetFiles.next();
    if (!file.isTrashed() && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      spreadsheetCandidates.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl()
      });
    }
  }

  const folderCandidates = [];
  const rootFolders = DriveApp.getFoldersByName('Aporta');
  while (rootFolders.hasNext()) {
    const root = rootFolders.next();
    if (root.isTrashed()) continue;
    folderCandidates.push({
      id: root.getId(),
      name: root.getName(),
      url: root.getUrl(),
      evidenceFolders: collectChildFoldersByName_(root, 'Evidencias'),
      reportFolders: collectChildFoldersByName_(root, 'Reportes')
    });
  }

  const result = {
    account: Session.getEffectiveUser().getEmail(),
    configured: isDatabaseConfigured_(),
    spreadsheets: spreadsheetCandidates,
    folders: folderCandidates
  };
  console.log(JSON.stringify(result));
  return result;
}

function inspectAportaResourcesToLog() {
  const result = inspectAportaResources();
  console.log(JSON.stringify(result));
  return result;
}

function previewDiscoveredAportaResources() {
  const resources = getUniqueDiscoveredAportaResources_();
  const result = previewAportaResourceCompatibility(
    resources.spreadsheetId,
    resources.evidenceFolderId,
    resources.reportFolderId
  );
  console.log(JSON.stringify(result));
  return result;
}

function configureDiscoveredAportaResources() {
  const resources = getUniqueDiscoveredAportaResources_();
  const result = configureAportaWithExistingResources(
    resources.spreadsheetId,
    resources.evidenceFolderId,
    resources.reportFolderId
  );
  console.log(JSON.stringify(result));
  return result;
}

function previewAportaResourceCompatibility(spreadsheetId, evidenceFolderId, reportFolderId) {
  const spreadsheet = SpreadsheetApp.openById(cleanResourceId_(spreadsheetId));
  const evidenceFolder = DriveApp.getFolderById(cleanResourceId_(evidenceFolderId));
  const reportFolder = reportFolderId
    ? DriveApp.getFolderById(cleanResourceId_(reportFolderId))
    : null;
  const existingSheets = spreadsheet.getSheets().map(function (sheet) {
    return inspectSheetCompatibility_(sheet);
  });
  const existingNames = existingSheets.map(function (item) { return item.name; });
  const missingSheets = Object.keys(SHEET_SCHEMAS).filter(function (name) {
    return existingNames.indexOf(name) < 0;
  });
  const incompatibleSheets = existingSheets.filter(function (item) {
    return item.managed && item.status === 'incompatible';
  });

  return {
    spreadsheet: {
      id: spreadsheet.getId(),
      name: spreadsheet.getName(),
      url: spreadsheet.getUrl(),
      sheets: existingSheets
    },
    evidenceFolder: resourceFolderSummary_(evidenceFolder),
    reportFolder: reportFolder ? resourceFolderSummary_(reportFolder) : null,
    missingManagedSheets: missingSheets,
    incompatibleManagedSheets: incompatibleSheets,
    compatible: incompatibleSheets.length === 0,
    plannedChanges: [
      'Conservar todas las pestañas y datos compatibles.',
      'Agregar encabezados solamente a pestañas administradas que estén vacías.',
      'Crear las pestañas administradas que falten: ' + (missingSheets.join(', ') || 'ninguna') + '.',
      'Conservar la pestaña REPORTE sin modificarla.',
      'Registrar los IDs en propiedades privadas del proyecto Apps Script.'
    ]
  };
}

function configureAportaWithExistingResources(spreadsheetId, evidenceFolderId, reportFolderId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (isDatabaseConfigured_()) {
      throw new Error('Aporta ya tiene recursos configurados. No se realizo ningun cambio.');
    }

    const preview = previewAportaResourceCompatibility(spreadsheetId, evidenceFolderId, reportFolderId);
    if (!preview.compatible) {
      throw new Error('La hoja existente tiene pestañas administradas incompatibles. Revisa la vista previa antes de continuar.');
    }

    const ownerEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
    if (!ownerEmail) {
      throw new Error('No se pudo identificar la cuenta que configura Aporta.');
    }

    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(APP_CONFIG.spreadsheetProperty, preview.spreadsheet.id);
    properties.setProperty(APP_CONFIG.driveFolderProperty, preview.evidenceFolder.id);
    if (preview.reportFolder) {
      properties.setProperty(APP_CONFIG.reportFolderProperty, preview.reportFolder.id);
    }

    initializeConfiguredResources_();
    return {
      configured: true,
      reusedExistingResources: true,
      spreadsheetUrl: preview.spreadsheet.url,
      evidenceFolderUrl: preview.evidenceFolder.url,
      reportFolderUrl: preview.reportFolder ? preview.reportFolder.url : '',
      createdSheets: preview.missingManagedSheets
    };
  } finally {
    lock.releaseLock();
  }
}

function initializeConfiguredResources_() {
  const spreadsheet = getDatabase_();
  ensureSheets_(spreadsheet);
  setConfigValue_('SCHEMA_VERSION', APP_CONFIG.schemaVersion, 'Version de la estructura de datos');
  setConfigValue_('TIMEZONE', APP_CONFIG.timezone, 'Zona horaria utilizada por el sistema');

  const ownerEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
  if (!ownerEmail) {
    throw new Error('No se pudo identificar la cuenta que configura Aporta.');
  }
  if (!getRecords_('INTEGRANTES').length) {
    const adminId = nextId_('INT');
    appendRecord_('INTEGRANTES', {
      id: adminId,
      nombre: ownerEmail.split('@')[0],
      correo: ownerEmail,
      rol: 'Administrador',
      activo: true,
      fecha_alta: new Date(),
      creado_por: adminId
    });
  }

  if (!getRecords_('CONFIGURACION_VALORACION').length) {
    const createdAt = new Date();
    DEFAULT_VALUATION_RULES.forEach(function (rule) {
      appendRecord_('CONFIGURACION_VALORACION', {
        id: rule[0],
        version: rule[1],
        tipo: rule[2],
        base: rule[3],
        parametros_json: rule[4],
        activo: rule[5],
        fecha_creacion: createdAt
      });
    });
  }

  if (!getRecords_('HISTORIAL').length) {
    const admin = getRecords_('INTEGRANTES')[0];
    appendHistory_(admin.id, 'CONFIGURAR', 'SISTEMA', 'APORTA', {
      schemaVersion: APP_CONFIG.schemaVersion,
      recursosReutilizados: true
    });
  }
  ensureClosureTrigger_();
}

function inspectSheetCompatibility_(sheet) {
  const name = sheet.getName();
  const expected = SHEET_SCHEMAS[name];
  if (!expected) {
    return { name: name, managed: false, status: 'preserved' };
  }
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    return { name: name, managed: true, status: 'empty' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const exact = headers.join('|') === expected.join('|');
  const additive = headers.every(function (header, index) { return header === expected[index]; });
  return {
    name: name,
    managed: true,
    status: exact ? 'compatible' : (additive ? 'additive-migration' : 'incompatible'),
    currentHeaders: headers,
    expectedHeaders: expected
  };
}

function collectChildFoldersByName_(parent, name) {
  const results = [];
  const folders = parent.getFoldersByName(name);
  while (folders.hasNext()) {
    const folder = folders.next();
    if (!folder.isTrashed()) results.push(resourceFolderSummary_(folder));
  }
  return results;
}

function getUniqueDiscoveredAportaResources_() {
  const inspection = inspectAportaResources();
  if (inspection.spreadsheets.length !== 1) {
    throw new Error(
      'Se esperaba exactamente un archivo Aporta - Base de Datos y se encontraron ' +
      inspection.spreadsheets.length + '.'
    );
  }
  if (inspection.folders.length !== 1) {
    throw new Error(
      'Se esperaba exactamente una carpeta Aporta y se encontraron ' +
      inspection.folders.length + '.'
    );
  }

  const root = inspection.folders[0];
  if (root.evidenceFolders.length !== 1 || root.reportFolders.length !== 1) {
    throw new Error(
      'La carpeta Aporta debe contener exactamente una subcarpeta Evidencias y una Reportes.'
    );
  }

  return {
    spreadsheetId: inspection.spreadsheets[0].id,
    evidenceFolderId: root.evidenceFolders[0].id,
    reportFolderId: root.reportFolders[0].id
  };
}

function resourceFolderSummary_(folder) {
  return { id: folder.getId(), name: folder.getName(), url: folder.getUrl() };
}

function cleanResourceId_(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('ID de recurso no valido.');
  return id;
}
