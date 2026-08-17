function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.appName = APP_CONFIG.name;

  return template.evaluate()
    .setTitle(APP_CONFIG.name + ' | Participación clara')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function apiGetBootstrap() {
  return getBootstrapData_();
}

function apiCreateActivity(payload) {
  return createActivity_(payload || {});
}

function apiSaveMember(payload) {
  return saveMember_(payload || {});
}

function apiCreateDeliverable(payload) {
  return createDeliverable_(payload || {});
}

function apiCreateContribution(payload) {
  return createContribution_(payload || {});
}

function apiSubmitEvidence(payload) {
  return submitEvidence_(payload || {});
}

function apiPreviewValuation(payload) {
  const member = getAuthenticatedMember_();
  requireAdmin_(member);
  return calculateContributionValue_(payload || {});
}

function apiReportObservation(payload) {
  return reportObservation_(payload || {});
}

function apiReviewObservation(payload) {
  return reviewObservation_(payload || {});
}

function apiReassignContribution(payload) {
  return reassignContribution_(payload || {});
}

function apiSplitContribution(payload) {
  return splitContribution_(payload || {});
}

function apiChangeActivityDeadline(payload) {
  return changeActivityDeadline_(payload || {});
}

function closeExpiredActivities() {
  if (!isDatabaseConfigured_()) return 0;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSheets_(getDatabase_());
    return synchronizeExpiredActivities_();
  } finally {
    lock.releaseLock();
  }
}
