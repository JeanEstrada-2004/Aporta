function setupAporta() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (isDatabaseConfigured_()) {
      const currentDatabase = getDatabase_();
      initializeConfiguredResources_();
      return {
        alreadyConfigured: true,
        spreadsheetUrl: currentDatabase.getUrl(),
        folderUrl: getEvidenceFolderUrl_()
      };
    }

    const existingResources = inspectAportaResources();
    if (existingResources.spreadsheets.length || existingResources.folders.length) {
      throw new Error(
        'Se encontraron recursos existentes de Aporta. Ejecuta primero ' +
        'previewAportaResourceCompatibility y luego configureAportaWithExistingResources ' +
        'para reutilizarlos sin crear duplicados.'
      );
    }

    const ownerEmail = getSetupOwnerEmail_();
    if (!ownerEmail) {
      throw new Error('No se pudo identificar la cuenta que configura Aporta.');
    }

    const spreadsheet = SpreadsheetApp.create('Aporta - Datos');
    const defaultSheet = spreadsheet.getSheets()[0];
    defaultSheet.setName('INTEGRANTES');

    const rootFolder = DriveApp.createFolder('Aporta - Evidencias');
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(APP_CONFIG.spreadsheetProperty, spreadsheet.getId());
    properties.setProperty(APP_CONFIG.driveFolderProperty, rootFolder.getId());

    ensureSheets_(spreadsheet);
    setConfigValue_('SCHEMA_VERSION', APP_CONFIG.schemaVersion, 'Version de la estructura de datos');
    setConfigValue_('TIMEZONE', APP_CONFIG.timezone, 'Zona horaria utilizada por el sistema');

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

    appendHistory_(adminId, 'CONFIGURAR', 'SISTEMA', 'APORTA', {
      schemaVersion: APP_CONFIG.schemaVersion
    });

    return {
      alreadyConfigured: false,
      spreadsheetUrl: spreadsheet.getUrl(),
      folderUrl: rootFolder.getUrl()
    };
  } finally {
    lock.releaseLock();
  }
}

function getBootstrapData_(skipSynchronization) {
  if (!isDatabaseConfigured_()) {
    return {
      needsSetup: true,
      app: getPublicAppConfig_()
    };
  }

  ensureSheets_(getDatabase_());
  if (String(getConfigValue_('SCHEMA_VERSION')) !== APP_CONFIG.schemaVersion) {
    setConfigValue_('SCHEMA_VERSION', APP_CONFIG.schemaVersion, 'Version de la estructura de datos');
  }

  if (!skipSynchronization) {
    const synchronizationLock = LockService.getScriptLock();
    synchronizationLock.waitLock(30000);
    try {
      synchronizeExpiredActivities_();
    } finally {
      synchronizationLock.releaseLock();
    }
  }

  const member = getAuthenticatedMember_();
  const isAdmin = member.rol === 'Administrador';
  const members = getRecords_('INTEGRANTES');
  const memberMap = members.reduce(function (map, item) {
    map[item.id] = item;
    return map;
  }, {});
  const deliverables = getRecords_('ENTREGABLES').filter(function (item) {
    return item.activo !== false;
  });
  const evidences = getRecords_('EVIDENCIAS');
  const observations = getRecords_('OBSERVACIONES');
  const reassignments = getRecords_('REASIGNACIONES');
  const allContributions = getRecords_('CONTRIBUCIONES')
    .filter(function (item) {
      return item.vigente !== false;
    });
  const activities = getRecords_('ACTIVIDADES')
    .map(prepareActivityForClient_)
    .map(function (activity) {
      activity.deliverableCount = deliverables.filter(function (item) {
        return item.actividad_id === activity.id;
      }).length;
      activity.contributionCount = allContributions.filter(function (item) {
        return item.actividad_id === activity.id;
      }).length;
      return activity;
    })
    .sort(function (left, right) {
      return new Date(left.fecha_limite) - new Date(right.fecha_limite);
    });
  const activityMap = activities.reduce(function (map, item) {
    map[item.id] = item;
    return map;
  }, {});
  const contributions = allContributions.map(function (item) {
    const responsible = memberMap[item.responsable_id] || {};
    const activity = activityMap[item.actividad_id] || {};
    const contribution = Object.assign({}, item);
    contribution.responsable_nombre = responsible.nombre || 'Sin responsable';
    contribution.actividad_nombre = activity.nombre || item.actividad_id;
    contribution.actividad_estado = activity.estado || 'Pendiente';
    contribution.fecha_limite = activity.fecha_limite || '';
    contribution.evidenceCount = evidences.filter(function (evidence) {
      return evidence.contribucion_id === item.id;
    }).length;
    return contribution;
  }).sort(function (left, right) {
    return new Date(left.fecha_limite) - new Date(right.fecha_limite);
  });
  const myContributions = contributions.filter(function (item) {
    return item.responsable_id === member.id;
  });
  const rules = getRecords_('CONFIGURACION_VALORACION').filter(function (item) {
    return item.activo !== false;
  }).map(function (item) {
    return {
      id: item.id,
      version: String(item.version),
      type: item.tipo,
      base: Number(item.base)
    };
  });

  const publicMembers = members.map(function (item) {
    return {
      id: item.id,
      name: item.nombre,
      email: isAdmin ? item.correo : '',
      role: item.rol,
      active: item.activo !== false
    };
  });

  const publicEvidence = evidences.map(function (item) {
    return {
      id: item.id,
      contributionId: item.contribucion_id,
      type: item.tipo,
      url: item.url,
      description: item.descripcion,
      date: item.fecha,
      creatorId: item.creador_id
    };
  });
  const publicObservations = observations.map(function (item) {
    const creator = memberMap[item.creador_id] || {};
    return {
      id: item.id,
      contributionId: item.contribucion_id,
      creatorId: item.creador_id,
      creatorName: creator.nombre || item.creador_id,
      reason: item.motivo,
      status: item.estado,
      createdAt: item.fecha_creacion,
      response: item.respuesta || ''
    };
  });
  const history = getRecords_('HISTORIAL').slice(-200).reverse().map(function (item) {
    const historyMember = memberMap[item.usuario_id] || {};
    return {
      id: item.id,
      date: item.fecha_hora,
      userName: item.usuario_id === 'SISTEMA' ? 'Sistema' : (historyMember.nombre || item.usuario_id),
      action: item.accion,
      entity: item.entidad,
      entityId: item.entidad_id,
      summary: getHistorySummaryForClient_(item, memberMap)
    };
  });

  return {
    needsSetup: false,
    app: getPublicAppConfig_(),
    user: {
      id: member.id,
      name: member.nombre,
      email: member.correo,
      role: member.rol,
      isAdmin: isAdmin
    },
    summary: {
      openActivities: activities.filter(function (item) {
        return item.estado === 'Pendiente';
      }).length,
      pendingContributions: myContributions.filter(function (item) {
        return item.estado === 'Pendiente';
      }).length,
      deliveredContributions: myContributions.filter(function (item) {
        return item.estado === 'Entregado';
      }).length
    },
    activities: activities,
    deliverables: deliverables,
    contributions: contributions,
    myContributions: myContributions,
    members: publicMembers,
    valuationRules: rules,
    evidences: publicEvidence,
    observations: publicObservations,
    history: history,
    resultSets: getResultSetsForClient_(activities, members, contributions, reassignments)
  };
}

function getHistorySummaryForClient_(historyItem, memberMap) {
  let detail = {};
  try {
    detail = JSON.parse(historyItem.detalle_json || '{}');
  } catch (error) {
    return '';
  }

  function memberName(id, storedName) {
    const member = memberMap[id] || {};
    return cleanText_(storedName || member.nombre || id, 100);
  }

  if (historyItem.accion === 'REASIGNAR_REORGANIZACION' ||
      historyItem.accion === 'REASIGNAR_INCUMPLIMIENTO') {
    const previous = memberName(detail.responsableAnterior, detail.responsableAnteriorNombre);
    const next = memberName(detail.responsableNuevo, detail.responsableNuevoNombre);
    const parts = [previous + ' → ' + next, cleanText_(detail.tipo, 40)];
    const reason = cleanText_(detail.motivo, 180);
    if (reason) parts.push(reason);
    return parts.filter(Boolean).join(' · ');
  }

  if (historyItem.accion === 'DIVIDIR') {
    const values = Array.isArray(detail.valoresNuevos) ? detail.valoresNuevos.join(' + ') : '';
    return values ? 'Valor conservado: ' + values + ' = ' + Number(detail.valorOriginal || 0) : '';
  }

  if (historyItem.accion === 'CERRAR' && detail.version) {
    return 'Versión de cierre ' + Number(detail.version);
  }

  return '';
}

function createActivity_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const member = getAuthenticatedMember_();
    requireAdmin_(member);

    const name = cleanText_(payload.name, 120);
    const description = cleanText_(payload.description, 800);
    const deadline = new Date(payload.deadline);

    if (!name) {
      throw new Error('Escribe el nombre de la actividad.');
    }
    if (isNaN(deadline.getTime())) {
      throw new Error('Selecciona una fecha y hora validas.');
    }
    if (deadline.getTime() <= Date.now()) {
      throw new Error('La fecha limite debe estar en el futuro.');
    }

    const activity = {
      id: nextId_('ACT'),
      nombre: name,
      descripcion: description,
      fecha_limite: deadline,
      estado: 'Pendiente',
      creador_id: member.id,
      fecha_creacion: new Date(),
      version_cierre: 0,
      fecha_cierre: ''
    };

    appendRecord_('ACTIVIDADES', activity);
    appendHistory_(member.id, 'CREAR', 'ACTIVIDAD', activity.id, {
      nombre: activity.nombre,
      fechaLimite: deadline.toISOString()
    });

    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function getAuthenticatedMember_() {
  const email = normalizeEmail_(Session.getActiveUser().getEmail());
  if (!email) {
    throw new Error('No se pudo identificar tu cuenta. Despliega la aplicacion para ejecutarse como el usuario que accede.');
  }

  const member = findRecord_('INTEGRANTES', function (item) {
    return normalizeEmail_(item.correo) === email;
  });

  if (!member || member.activo === false) {
    throw new Error('Tu cuenta no esta habilitada en Aporta.');
  }
  return member;
}

function requireAdmin_(member) {
  if (!member || member.rol !== 'Administrador') {
    throw new Error('Esta accion requiere permisos de administrador.');
  }
}

function prepareActivityForClient_(activity) {
  const now = Date.now();
  const deadline = new Date(activity.fecha_limite).getTime();
  const status = activity.estado === 'Culminada' || deadline <= now ? 'Culminada' : 'Pendiente';

  return {
    id: activity.id,
    nombre: activity.nombre,
    descripcion: activity.descripcion,
    fecha_limite: activity.fecha_limite,
    estado: status,
    creador_id: activity.creador_id,
    fecha_creacion: activity.fecha_creacion,
    version_cierre: Number(activity.version_cierre || 0),
    fecha_cierre: activity.fecha_cierre || ''
  };
}

function appendHistory_(userId, action, entity, entityId, detail) {
  appendRecord_('HISTORIAL', {
    id: nextId_('HIS'),
    fecha_hora: new Date(),
    usuario_id: userId,
    accion: action,
    entidad: entity,
    entidad_id: entityId,
    detalle_json: JSON.stringify(detail || {})
  });
}

function getEvidenceFolderUrl_() {
  const folderId = PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.driveFolderProperty);
  return folderId ? DriveApp.getFolderById(folderId).getUrl() : '';
}

function getPublicAppConfig_() {
  return {
    name: APP_CONFIG.name,
    version: APP_CONFIG.version,
    timezone: APP_CONFIG.timezone
  };
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText_(value, maximumLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').substring(0, maximumLength);
}
