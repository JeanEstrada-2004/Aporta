function saveMember_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);

    const id = cleanText_(payload.id, 20);
    const name = cleanText_(payload.name, 100);
    const email = normalizeEmail_(payload.email);
    const role = payload.role === 'Administrador' ? 'Administrador' : 'Integrante';
    const active = payload.active !== false;

    if (!name) throw new Error('Escribe el nombre del integrante.');
    if (!isValidEmail_(email)) throw new Error('Escribe un correo valido.');
    if (id === actor.id && !active) {
      throw new Error('No puedes desactivar la cuenta que estas utilizando.');
    }

    const duplicate = findRecord_('INTEGRANTES', function (item) {
      return normalizeEmail_(item.correo) === email && item.id !== id;
    });
    if (duplicate) throw new Error('Ese correo ya pertenece a otro integrante.');

    let memberId = id;
    let action = 'ACTUALIZAR';
    let current = null;
    if (id) {
      current = getRecordById_('INTEGRANTES', id);
      if (!current) throw new Error('No se encontro el integrante.');
      validateAdminContinuity_(id, role, active);
    }

    if (active) shareWorkspaceWith_(email);
    if (current && (normalizeEmail_(current.correo) !== email || !active)) {
      unshareWorkspaceWith_(current.correo);
    }

    if (id) {
      updateRecordById_('INTEGRANTES', id, {
        nombre: name,
        correo: email,
        rol: role,
        activo: active
      });
    } else {
      memberId = nextId_('INT');
      action = 'CREAR';
      appendRecord_('INTEGRANTES', {
        id: memberId,
        nombre: name,
        correo: email,
        rol: role,
        activo: active,
        fecha_alta: new Date(),
        creado_por: actor.id
      });
    }

    appendHistory_(actor.id, action, 'INTEGRANTE', memberId, {
      nombre: name,
      correo: email,
      rol: role,
      activo: active
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function createDeliverable_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);
    const activity = requireOpenActivity_(payload.activityId);
    const name = cleanText_(payload.name, 120);
    const type = cleanText_(payload.type, 50) || 'Otro';
    const link = cleanText_(payload.link, 500);

    if (!name) throw new Error('Escribe el nombre del entregable.');
    if (link && !isValidHttpUrl_(link)) throw new Error('El enlace del entregable no es valido.');

    const deliverable = {
      id: nextId_('ENT'),
      actividad_id: activity.id,
      nombre: name,
      descripcion: cleanText_(payload.description, 500),
      tipo: type,
      enlace: link,
      activo: true,
      fecha_creacion: new Date()
    };
    appendRecord_('ENTREGABLES', deliverable);
    appendHistory_(actor.id, 'CREAR', 'ENTREGABLE', deliverable.id, {
      actividadId: activity.id,
      nombre: name,
      tipo: type
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function createContribution_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);
    const activity = requireOpenActivity_(payload.activityId);
    const responsible = getRecordById_('INTEGRANTES', cleanText_(payload.responsibleId, 20));
    const description = cleanText_(payload.description, 500);
    const deliverableId = cleanText_(payload.deliverableId, 20);

    if (!responsible || responsible.activo === false) {
      throw new Error('Selecciona un integrante activo.');
    }
    if (!description) throw new Error('Describe la contribucion esperada.');

    if (deliverableId) {
      const deliverable = getRecordById_('ENTREGABLES', deliverableId);
      if (!deliverable || deliverable.actividad_id !== activity.id || deliverable.activo === false) {
        throw new Error('El entregable seleccionado no pertenece a esta actividad.');
      }
    }

    const valuation = calculateContributionValue_(payload);
    const contribution = {
      id: nextId_('CTR'),
      actividad_id: activity.id,
      entregable_id: deliverableId,
      descripcion: description,
      tipo: valuation.type,
      responsable_id: responsible.id,
      fecha_asignacion: new Date(),
      estado: 'Pendiente',
      valor_base: valuation.base,
      alcance_nivel: valuation.scopeLevel,
      complejidad_nivel: valuation.complexityLevel,
      valor_calculado: valuation.value,
      regla_version: valuation.ruleVersion,
      fecha_entrega: '',
      vigente: true,
      reemplazada_por: '',
      alcance_detalle: cleanText_(payload.scopeDetail, 180),
      complejidad_detalle: cleanText_(payload.complexityDetail, 180),
      creador_id: actor.id,
      valor_bruto: valuation.value,
      origen_contribucion_id: ''
    };

    appendRecord_('CONTRIBUCIONES', contribution);
    appendHistory_(actor.id, 'ASIGNAR', 'CONTRIBUCION', contribution.id, {
      actividadId: activity.id,
      responsableId: responsible.id,
      valor: valuation.value,
      formula: valuation.explanation
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function submitEvidence_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let savedFile = null;

  try {
    const actor = getAuthenticatedMember_();
    const contribution = getRecordById_('CONTRIBUCIONES', cleanText_(payload.contributionId, 20));
    if (!contribution || contribution.vigente === false) {
      throw new Error('No se encontro la contribucion.');
    }
    const activity = requireOpenActivity_(contribution.actividad_id);
    if (contribution.responsable_id !== actor.id && actor.rol !== 'Administrador') {
      throw new Error('Solo el responsable puede registrar esta evidencia.');
    }

    const type = cleanText_(payload.type, 40);
    const allowedTypes = ['Archivo', 'Enlace', 'Referencia', 'Texto', 'Presencial'];
    if (allowedTypes.indexOf(type) < 0) throw new Error('Selecciona un tipo de evidencia valido.');

    const description = cleanText_(payload.description, 800);
    let url = cleanText_(payload.url, 700);
    let driveFileId = '';

    if (type === 'Archivo') {
      const deliverable = contribution.entregable_id
        ? getRecordById_('ENTREGABLES', contribution.entregable_id)
        : null;
      const result = saveEvidenceFile_(payload.file, activity, deliverable, contribution.id);
      savedFile = result.file;
      url = result.url;
      driveFileId = result.id;
    } else if (type === 'Enlace') {
      if (!isValidHttpUrl_(url)) throw new Error('Escribe un enlace valido.');
    } else if (!description) {
      throw new Error('Describe la evidencia registrada.');
    }

    const evidence = {
      id: nextId_('EVI'),
      contribucion_id: contribution.id,
      tipo: type,
      url: url,
      drive_file_id: driveFileId,
      descripcion: description,
      fecha: new Date(),
      creador_id: actor.id
    };

    appendRecord_('EVIDENCIAS', evidence);
    updateRecordById_('CONTRIBUCIONES', contribution.id, {
      estado: 'Entregado',
      fecha_entrega: new Date()
    });
    appendHistory_(actor.id, 'ENTREGAR', 'CONTRIBUCION', contribution.id, {
      evidenciaId: evidence.id,
      tipo: type
    });
    resolveConfirmedObservations_(contribution.id, actor.id);
    return getBootstrapData_(true);
  } catch (error) {
    if (savedFile) savedFile.setTrashed(true);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function requireOpenActivity_(activityId) {
  const activity = getRecordById_('ACTIVIDADES', cleanText_(activityId, 20));
  if (!activity) throw new Error('No se encontro la actividad.');
  if (new Date(activity.fecha_limite).getTime() <= Date.now()) {
    throw new Error('La actividad ya culmino y no admite cambios.');
  }
  return activity;
}

function validateAdminContinuity_(memberId, proposedRole, proposedActive) {
  const members = getRecords_('INTEGRANTES');
  const remainingAdmins = members.filter(function (item) {
    if (item.id === memberId) {
      return proposedActive && proposedRole === 'Administrador';
    }
    return item.activo !== false && item.rol === 'Administrador';
  });
  if (!remainingAdmins.length) {
    throw new Error('Aporta debe conservar al menos un administrador activo.');
  }
}

function shareWorkspaceWith_(email) {
  getDatabase_().addEditor(email);
  const folderId = PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.driveFolderProperty);
  if (folderId) DriveApp.getFolderById(folderId).addEditor(email);
}

function unshareWorkspaceWith_(email) {
  getDatabase_().removeEditor(email);
  const folderId = PropertiesService.getScriptProperties()
    .getProperty(APP_CONFIG.driveFolderProperty);
  if (folderId) DriveApp.getFolderById(folderId).removeEditor(email);
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl_(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}
