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

    const previousResponsibleId = contribution.responsable_id;
    updateRecordById_('CONTRIBUCIONES', contribution.id, {
      responsable_id: newResponsible.id,
      fecha_asignacion: new Date()
    });
    appendHistory_(actor.id, 'REASIGNAR', 'CONTRIBUCION', contribution.id, {
      responsableAnterior: previousResponsibleId,
      responsableNuevo: newResponsible.id,
      motivo: cleanText_(payload.reason, 300)
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
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
    const rawTotal = preparedParts.reduce(function (sum, part) { return sum + part.valuation.value; }, 0);
    const firstValue = roundTwoDecimals_(originalValue * preparedParts[0].valuation.value / rawTotal);
    const normalizedValues = [firstValue, roundTwoDecimals_(originalValue - firstValue)];
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
