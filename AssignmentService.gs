function reassignContribution_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);
    const contribution = getRecordById_('CONTRIBUCIONES', cleanText_(payload.contributionId, 20));
    if (!contribution || contribution.vigente === false) throw new Error('No se encontro la contribucion.');
    requireOpenActivity_(contribution.actividad_id);
    const evidenceCount = getRecords_('EVIDENCIAS').filter(function (item) {
      return item.contribucion_id === contribution.id;
    }).length;
    if (contribution.estado !== 'Pendiente' || evidenceCount) {
      throw new Error('Una tarea con trabajo registrado debe dividirse, no reasignarse completamente.');
    }
    assertNoOpenObservation_(contribution.id);

    const newResponsible = getRecordById_('INTEGRANTES', cleanText_(payload.responsibleId, 20));
    if (!newResponsible || newResponsible.activo === false) throw new Error('Selecciona un integrante activo.');
    if (newResponsible.id === contribution.responsable_id) throw new Error('Selecciona un responsable diferente.');

    const reassignmentType = cleanText_(payload.reassignmentType, 40);
    if (reassignmentType !== REASSIGNMENT_TYPES.REORGANIZATION &&
        reassignmentType !== REASSIGNMENT_TYPES.NONCOMPLIANCE) {
      throw new Error('Selecciona si el cambio es una reorganización o un incumplimiento.');
    }
    const reason = cleanText_(payload.reason, 300);
    if (reassignmentType === REASSIGNMENT_TYPES.NONCOMPLIANCE && reason.length < 10) {
      throw new Error('Explica brevemente el incumplimiento de forma verificable.');
    }

    const previousResponsibleId = contribution.responsable_id;
    const previousAssignmentDate = contribution.fecha_asignacion;
    const reassignment = {
      id: nextId_('REA'),
      contribucion_id: contribution.id,
      actividad_id: contribution.actividad_id,
      responsable_anterior_id: previousResponsibleId,
      responsable_nuevo_id: newResponsible.id,
      tipo: reassignmentType,
      valor: Number(contribution.valor_calculado || 0),
      motivo: reason,
      fecha: new Date(),
      creado_por: actor.id
    };

    updateRecordById_('CONTRIBUCIONES', contribution.id, {
      responsable_id: newResponsible.id,
      fecha_asignacion: reassignment.fecha
    });
    try {
      appendRecord_('REASIGNACIONES', reassignment);
    } catch (error) {
      updateRecordById_('CONTRIBUCIONES', contribution.id, {
        responsable_id: previousResponsibleId,
        fecha_asignacion: previousAssignmentDate
      });
      throw error;
    }

    const historyAction = reassignmentType === REASSIGNMENT_TYPES.NONCOMPLIANCE
      ? 'REASIGNAR_INCUMPLIMIENTO'
      : 'REASIGNAR_REORGANIZACION';
    appendHistory_(actor.id, historyAction, 'CONTRIBUCION', contribution.id, {
      reasignacionId: reassignment.id,
      responsableAnterior: previousResponsibleId,
      responsableAnteriorNombre: (getRecordById_('INTEGRANTES', previousResponsibleId) || {}).nombre || previousResponsibleId,
      responsableNuevo: newResponsible.id,
      responsableNuevoNombre: newResponsible.nombre,
      tipo: reassignmentType,
      valor: reassignment.valor,
      motivo: reason
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function normalizeSplitValues_(originalValue, rawValues) {
  const totalValue = Number(originalValue || 0);
  const values = Array.isArray(rawValues) ? rawValues.map(Number) : [];
  if (values.length !== 2 || values.some(function (value) { return !isFinite(value) || value <= 0; })) {
    throw new Error('La división requiere dos valores brutos positivos.');
  }
  const rawTotal = values[0] + values[1];
  const firstValue = roundTwoDecimals_(totalValue * values[0] / rawTotal);
  return [firstValue, roundTwoDecimals_(totalValue - firstValue)];
}

function splitContribution_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);
    const original = getRecordById_('CONTRIBUCIONES', cleanText_(payload.contributionId, 20));
    if (!original || original.vigente === false) throw new Error('No se encontro la contribucion original.');
    requireOpenActivity_(original.actividad_id);
    assertNoOpenObservation_(original.id);

    const parts = Array.isArray(payload.parts) ? payload.parts : [];
    if (parts.length !== 2) throw new Error('La division debe producir exactamente dos contribuciones.');
    const preparedParts = parts.map(function (part) {
      const responsible = getRecordById_('INTEGRANTES', cleanText_(part.responsibleId, 20));
      if (!responsible || responsible.activo === false) throw new Error('Selecciona responsables activos para ambas partes.');
      const description = cleanText_(part.description, 500);
      if (!description) throw new Error('Describe ambas partes de la division.');
      return {
        description: description,
        responsible: responsible,
        valuation: calculateContributionValue_(part),
        scopeDetail: cleanText_(part.scopeDetail, 180),
        complexityDetail: cleanText_(part.complexityDetail, 180)
      };
    });

    const originalValue = Number(original.valor_calculado || 0);
    const normalizedValues = normalizeSplitValues_(originalValue, preparedParts.map(function (part) {
      return part.valuation.value;
    }));
    const evidence = getRecords_('EVIDENCIAS').filter(function (item) {
      return item.contribucion_id === original.id;
    });
    if (evidence.length && preparedParts[0].responsible.id !== original.responsable_id) {
      throw new Error('La primera parte debe conservar al responsable de la evidencia existente.');
    }
    const newIds = [];

    preparedParts.forEach(function (part, index) {
      const id = nextId_('CTR');
      newIds.push(id);
      appendRecord_('CONTRIBUCIONES', {
        id: id,
        actividad_id: original.actividad_id,
        entregable_id: original.entregable_id,
        descripcion: part.description,
        tipo: part.valuation.type,
        responsable_id: part.responsible.id,
        fecha_asignacion: new Date(),
        estado: index === 0 && evidence.length ? 'Entregado' : 'Pendiente',
        valor_base: part.valuation.base,
        alcance_nivel: part.valuation.scopeLevel,
        complejidad_nivel: part.valuation.complexityLevel,
        valor_calculado: normalizedValues[index],
        regla_version: part.valuation.ruleVersion,
        fecha_entrega: index === 0 && evidence.length ? original.fecha_entrega : '',
        vigente: true,
        reemplazada_por: '',
        alcance_detalle: part.scopeDetail,
        complejidad_detalle: part.complexityDetail,
        creador_id: actor.id,
        valor_bruto: part.valuation.value,
        origen_contribucion_id: original.id
      });
    });

    evidence.forEach(function (item) {
      updateRecordById_('EVIDENCIAS', item.id, { contribucion_id: newIds[0] });
    });
    updateRecordById_('CONTRIBUCIONES', original.id, {
      vigente: false,
      reemplazada_por: newIds.join(',')
    });
    appendHistory_(actor.id, 'DIVIDIR', 'CONTRIBUCION', original.id, {
      nuevasContribuciones: newIds,
      valorOriginal: originalValue,
      valoresNuevos: normalizedValues,
      responsablesNuevos: preparedParts.map(function (part) { return part.responsible.id; }),
      motivo: cleanText_(payload.reason, 300)
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function assertNoOpenObservation_(contributionId) {
  const pending = findRecord_('OBSERVACIONES', function (item) {
    return item.contribucion_id === contributionId &&
      (item.estado === 'Reportada' || item.estado === 'Confirmada');
  });
  if (pending) throw new Error('Resuelve la observacion antes de modificar esta contribucion.');
}
