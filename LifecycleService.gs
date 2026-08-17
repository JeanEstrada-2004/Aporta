function synchronizeExpiredActivities_() {
  const now = Date.now();
  const activities = getRecords_('ACTIVIDADES');
  let closedCount = 0;

  activities.forEach(function (activity) {
    const deadline = new Date(activity.fecha_limite).getTime();
    if (activity.estado !== 'Culminada' && deadline <= now) {
      closeActivityRecord_(activity, 'SISTEMA', 'PLAZO_VENCIDO');
      closedCount += 1;
    }
  });
  return closedCount;
}

function closeActivityRecord_(activity, actorId, reason) {
  const version = Number(activity.version_cierre || 0) + 1;
  const closedAt = new Date();
  const closureId = nextId_('CIE');
  const contributions = getRecords_('CONTRIBUCIONES').filter(function (item) {
    return item.actividad_id === activity.id && item.vigente !== false;
  });
  const reassignments = getRecords_('REASIGNACIONES').filter(function (item) {
    return item.actividad_id === activity.id;
  });
  const contributionIds = contributions.map(function (item) { return item.id; });

  getRecords_('OBSERVACIONES').forEach(function (observation) {
    if (contributionIds.indexOf(observation.contribucion_id) >= 0 && observation.estado === 'Reportada') {
      updateRecordById_('OBSERVACIONES', observation.id, {
        estado: 'Descartada',
        resuelto_por: 'SISTEMA',
        fecha_resolucion: closedAt,
        respuesta: 'No fue confirmada antes del cierre.'
      });
    }
  });

  const rows = calculateParticipationRows_(contributions, reassignments);
  rows.forEach(function (row) {
    appendRecord_('RESULTADOS', {
      id_cierre: closureId,
      version_cierre: version,
      actividad_id: activity.id,
      integrante_id: row.memberId,
      valor_asignado: row.assignedValue,
      valor_efectivo: row.effectiveValue,
      participacion_individual: row.individualPercentage,
      participacion_relativa: row.relativePercentage,
      fecha_cierre: closedAt
    });
  });

  updateRecordById_('ACTIVIDADES', activity.id, {
    estado: 'Culminada',
    version_cierre: version,
    fecha_cierre: closedAt
  });
  appendHistory_(actorId, 'CERRAR', 'ACTIVIDAD', activity.id, {
    motivo: reason,
    version: version,
    cierreId: closureId,
    resultados: rows.length
  });
}

function calculateParticipationRows_(contributions, reassignments) {
  const totals = {};
  contributions.forEach(function (item) {
    const memberId = item.responsable_id;
    if (!memberId) return;
    if (!totals[memberId]) {
      totals[memberId] = { memberId: memberId, assignedValue: 0, effectiveValue: 0 };
    }
    const value = Number(item.valor_calculado || 0);
    totals[memberId].assignedValue += value;
    if (isEffectiveContribution_(item)) totals[memberId].effectiveValue += value;
  });

  (reassignments || []).forEach(function (item) {
    if (item.tipo !== REASSIGNMENT_TYPES.NONCOMPLIANCE) return;
    const memberId = item.responsable_anterior_id;
    if (!memberId) return;
    if (!totals[memberId]) {
      totals[memberId] = { memberId: memberId, assignedValue: 0, effectiveValue: 0 };
    }
    totals[memberId].assignedValue += Number(item.valor || 0);
  });

  const rows = Object.keys(totals).sort().map(function (memberId) {
    const row = totals[memberId];
    row.assignedValue = roundTwoDecimals_(row.assignedValue);
    row.effectiveValue = roundTwoDecimals_(row.effectiveValue);
    row.individualPercentage = row.assignedValue > 0
      ? roundTwoDecimals_(row.effectiveValue / row.assignedValue * 100)
      : null;
    return row;
  });

  allocateRelativePercentages_(rows);
  return rows;
}

function isEffectiveContribution_(contribution) {
  return contribution && contribution.estado === 'Entregado';
}

function allocateRelativePercentages_(rows) {
  const total = rows.reduce(function (sum, row) { return sum + row.effectiveValue; }, 0);
  if (!total) {
    rows.forEach(function (row) { row.relativePercentage = null; });
    return;
  }

  let allocated = 0;
  const distributions = rows.map(function (row) {
    const exactUnits = row.effectiveValue / total * 10000;
    const units = Math.floor(exactUnits);
    allocated += units;
    return { row: row, units: units, remainder: exactUnits - units };
  });
  distributions.sort(function (left, right) {
    return right.remainder - left.remainder || left.row.memberId.localeCompare(right.row.memberId);
  });

  let missing = 10000 - allocated;
  for (let index = 0; index < missing; index += 1) {
    distributions[index % distributions.length].units += 1;
  }
  distributions.forEach(function (item) {
    item.row.relativePercentage = item.units / 100;
  });
}

function getResultSetsForClient_(activities, members, liveContributions, reassignments) {
  const memberMap = members.reduce(function (map, member) {
    map[member.id] = member;
    return map;
  }, {});
  const storedResults = getRecords_('RESULTADOS');

  return activities.map(function (activity) {
    let rows;
    let finalResult = activity.estado === 'Culminada';
    const version = Number(activity.version_cierre || 0);

    if (finalResult && version > 0) {
      rows = storedResults.filter(function (row) {
        return row.actividad_id === activity.id && Number(row.version_cierre) === version;
      }).map(function (row) {
        return {
          memberId: row.integrante_id,
          assignedValue: Number(row.valor_asignado || 0),
          effectiveValue: Number(row.valor_efectivo || 0),
          individualPercentage: toNullableNumber_(row.participacion_individual),
          relativePercentage: toNullableNumber_(row.participacion_relativa)
        };
      });
    } else {
      rows = calculateParticipationRows_(liveContributions.filter(function (item) {
        return item.actividad_id === activity.id;
      }), (reassignments || []).filter(function (item) {
        return item.actividad_id === activity.id;
      }));
      finalResult = false;
    }

    rows.forEach(function (row) {
      const member = memberMap[row.memberId] || {};
      row.memberName = member.nombre || row.memberId;
    });
    rows.sort(function (left, right) {
      return right.effectiveValue - left.effectiveValue || left.memberName.localeCompare(right.memberName);
    });

    return {
      activityId: activity.id,
      activityName: activity.nombre,
      version: version,
      final: finalResult,
      closedAt: activity.fecha_cierre || '',
      rows: rows
    };
  });
}

function changeActivityDeadline_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const actor = getAuthenticatedMember_();
    requireAdmin_(actor);
    let activity = getRecordById_('ACTIVIDADES', cleanText_(payload.activityId, 20));
    const deadline = new Date(payload.deadline);
    if (!activity) throw new Error('No se encontro la actividad.');
    if (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      throw new Error('La nueva fecha limite debe estar en el futuro.');
    }

    if (activity.estado !== 'Culminada' && new Date(activity.fecha_limite).getTime() <= Date.now()) {
      closeActivityRecord_(activity, 'SISTEMA', 'PLAZO_VENCIDO');
      activity = getRecordById_('ACTIVIDADES', activity.id);
    }
    const wasClosed = activity.estado === 'Culminada';
    updateRecordById_('ACTIVIDADES', activity.id, {
      fecha_limite: deadline,
      estado: 'Pendiente'
    });
    appendHistory_(actor.id, wasClosed ? 'REABRIR' : 'CAMBIAR_FECHA', 'ACTIVIDAD', activity.id, {
      fechaAnterior: activity.fecha_limite,
      fechaNueva: deadline.toISOString(),
      motivo: cleanText_(payload.reason, 300),
      versionAnterior: Number(activity.version_cierre || 0)
    });
    return getBootstrapData_(true);
  } finally {
    lock.releaseLock();
  }
}

function toNullableNumber_(value) {
  return value === '' || value === null || typeof value === 'undefined' ? null : Number(value);
}

function roundTwoDecimals_(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
