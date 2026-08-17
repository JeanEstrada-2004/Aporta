function verifyAportaReady() {
  const spreadsheet = getDatabase_();
  const ownerEmail = getConfiguredOwnerEmail_();
  const sheetNames = spreadsheet.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  const missingSheets = Object.keys(SHEET_SCHEMAS).filter(function (name) {
    return sheetNames.indexOf(name) < 0;
  });
  const incompatibleSheets = spreadsheet.getSheets()
    .map(inspectSheetCompatibility_)
    .filter(function (item) {
      return item.managed && item.status === 'incompatible';
    });
  const owner = findRecord_('INTEGRANTES', function (member) {
    return normalizeEmail_(member.correo) === ownerEmail;
  });
  const activeRules = getRecords_('CONFIGURACION_VALORACION').filter(function (rule) {
    return rule.activo !== false;
  });

  const result = {
    ready: Boolean(
      owner &&
      owner.rol === 'Administrador' &&
      owner.activo !== false &&
      activeRules.length &&
      !missingSheets.length &&
      !incompatibleSheets.length
    ),
    spreadsheet: {
      id: spreadsheet.getId(),
      name: spreadsheet.getName(),
      url: spreadsheet.getUrl()
    },
    owner: owner ? {
      id: owner.id,
      email: owner.correo,
      role: owner.rol,
      active: owner.activo !== false
    } : null,
    activeValuationRules: activeRules.length,
    missingManagedSheets: missingSheets,
    incompatibleManagedSheets: incompatibleSheets,
    evidenceFolderUrl: getEvidenceFolderUrl_(),
    reportFolderUrl: DriveApp.getFolderById(
      PropertiesService.getScriptProperties().getProperty(APP_CONFIG.reportFolderProperty)
    ).getUrl()
  };
  console.log(JSON.stringify(result));
  return result;
}
