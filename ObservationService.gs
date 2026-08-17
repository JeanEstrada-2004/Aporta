function reportObservation_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const actor = getAuthenticatedMember_();
    const contribution = getRecordById_('CONTRIBUCIONES', cleanText_(payload.contributionId, 20));
    if (!contribution || contribution.vigente === false) throw new Error('No se encontro la contribucion.');
    requireOpenActivity_(contribution.actividad_id);
    if (contribution.estado !== 'Entregado') {
      throw new Error('Solo se pueden observar contribuciones entregadas.');
    }
    if (contribution.responsable_id === actor.id) {
      throw new Error('El responsable no puede observar su propia contribucion.');
    }

    const reason = cleanText_(payload.reason, 600);
    if (reason.length < 10) throw new Error('Describe el problema de forma verificable.');
    const duplicate = findRecord_('OBSERVACIONES', function (item) {
      return item.contribucion_id === contribution.id &&
        (item.estado === 'Reportada' || item.estado === 'Confirmada');
    });
    if (duplicate) throw new Error('Esta contribucion ya tiene una observacion pendiente.');

    const observation = {
      id: nextId_('OBS'),
      contribucion_id: contribution.id,
      creador_id: actor.id,
      motivo: reason,
      estado: 'Reportada',
      fecha_creacion: new Date(),
      resuelto_por: '',
      fecha_resolucion: '',
      confirmado_por: '',
      fecha_confirmacion: '',
      respuesta: ''
    };
    appendRecord_('OBSERVACIONES', observation);
    appendHistory_(actor.id, 'REPORTAR_OBSERVACION', 'CONTRIBUCION', contribution.id, {
      observacionId: observation.id,
      motivo: reason
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function reviewObservation_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);
    const observation = getRecordById_('OBSERVACIONES', cleanText_(payload.observationId, 20));
    if (!observation || observation.estado !== 'Reportada') {
      throw new Error('La observacion ya fue atendida o no existe.');
    }
    const contribution = getRecordById_('CONTRIBUCIONES', observation.contribucion_id);
    if (!contribution) throw new Error('No se encontro la contribucion observada.');
    requireOpenActivity_(contribution.actividad_id);

    const decision = payload.decision === 'Confirmar' ? 'Confirmar' : 'Descartar';
    const response = cleanText_(payload.response, 400);
    if (decision === 'Confirmar') {
      updateRecordById_('OBSERVACIONES', observation.id, {
        estado: 'Confirmada',
        confirmado_por: actor.id,
        fecha_confirmacion: new Date(),
        respuesta: response
      });
      updateRecordById_('CONTRIBUCIONES', contribution.id, { estado: 'Observado' });
    } else {
      updateRecordById_('OBSERVACIONES', observation.id, {
        estado: 'Descartada',
        resuelto_por: actor.id,
        fecha_resolucion: new Date(),
        respuesta: response || 'Reporte descartado por el administrador.'
      });
    }

    appendHistory_(actor.id, decision === 'Confirmar' ? 'CONFIRMAR_OBSERVACION' : 'DESCARTAR_OBSERVACION', 'OBSERVACION', observation.id, {
      contribucionId: contribution.id,
      respuesta: response
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function resolveConfirmedObservations_(contributionId, actorId) {
  getRecords_('OBSERVACIONES').forEach(function (observation) {
    if (observation.contribucion_id === contributionId && observation.estado === 'Confirmada') {
      updateRecordById_('OBSERVACIONES', observation.id, {
        estado: 'Resuelta',
        resuelto_por: actorId,
        fecha_resolucion: new Date(),
        respuesta: observation.respuesta || 'El responsable registro una nueva entrega.'
      });
      appendHistory_(actorId, 'CORREGIR', 'CONTRIBUCION', contributionId, {
        observacionId: observation.id
      });
    }
  });
}
