function saveEvidenceFile_(filePayload, activity, deliverable, contributionId) {
  if (!filePayload || !filePayload.base64 || !filePayload.name) {
    throw new Error('Selecciona el archivo que deseas adjuntar.');
  }

  const bytes = Utilities.base64Decode(filePayload.base64);
  if (bytes.length > APP_CONFIG.maxUploadBytes) {
    throw new Error('El archivo supera el limite de 5 MB.');
  }

  const rootFolderId = PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.driveFolderProperty);
  if (!rootFolderId) {
    throw new Error('No se encontro la carpeta de evidencias.');
  }

  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const activityFolder = getOrCreateFolder_(rootFolder, activity.id + ' - ' + safeDriveName_(activity.nombre));
  const targetName = deliverable
    ? deliverable.id + ' - ' + safeDriveName_(deliverable.nombre)
    : '_General';
  const targetFolder = getOrCreateFolder_(activityFolder, targetName);
  const uniqueName = contributionId + '__' + Utilities.formatDate(
    new Date(), APP_CONFIG.timezone, 'yyyyMMdd-HHmmss'
  ) + '__' + safeDriveName_(filePayload.name);
  const blob = Utilities.newBlob(bytes, filePayload.mimeType || 'application/octet-stream', uniqueName);
  const file = targetFolder.createFile(blob);

  return {
    id: file.getId(),
    url: file.getUrl(),
    file: file
  };
}

function getOrCreateFolder_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function safeDriveName_(value) {
  const safe = String(value || 'archivo')
    .replace(/[\\/:*?"<>|#%{}]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return safe.substring(0, 100) || 'archivo';
}
