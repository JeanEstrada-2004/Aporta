const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadServices(files, dependencies) {
  const sandbox = Object.assign({
    console,
    Date,
    Math,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    isFinite
  }, dependencies);
  vm.createContext(sandbox);
  const source = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  vm.runInContext(source, sandbox, { filename: files.join('+') });
  return sandbox;
}

function lockService() {
  return {
    getScriptLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  };
}

function cleanText(value, maximumLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').substring(0, maximumLength);
}

function repository(data) {
  return {
    getRecords_(sheet) {
      return data[sheet] || [];
    },
    getRecordById_(sheet, id) {
      return (data[sheet] || []).find((item) => item.id === id) || null;
    },
    findRecord_(sheet, predicate) {
      return (data[sheet] || []).find(predicate) || null;
    },
    appendRecord_(sheet, record) {
      if (!data[sheet]) data[sheet] = [];
      data[sheet].push(record);
      return record;
    },
    updateRecordById_(sheet, id, changes) {
      const record = (data[sheet] || []).find((item) => item.id === id);
      if (!record) throw new Error(`Registro inexistente: ${sheet}/${id}`);
      Object.assign(record, changes);
    }
  };
}

// Escenarios B, C y G: enlace compartido, exposición presencial y observaciones.
{
  const data = {
    ACTIVIDADES: [{ id: 'ACT-1', fecha_limite: '2099-01-01T00:00:00.000Z', estado: 'Pendiente' }],
    CONTRIBUCIONES: [
      { id: 'CTR-1', actividad_id: 'ACT-1', entregable_id: '', responsable_id: 'A', estado: 'Pendiente', vigente: true },
      { id: 'CTR-2', actividad_id: 'ACT-1', entregable_id: '', responsable_id: 'A', estado: 'Pendiente', vigente: true },
      { id: 'CTR-3', actividad_id: 'ACT-1', entregable_id: '', responsable_id: 'A', estado: 'Pendiente', vigente: true }
    ],
    EVIDENCIAS: [],
    OBSERVACIONES: [],
    HISTORIAL: []
  };
  const repo = repository(data);
  let actor = { id: 'A', rol: 'Integrante' };
  let evidenceCounter = 0;
  let observationCounter = 0;
  const context = loadServices(['FeatureService.gs', 'ObservationService.gs'], Object.assign({}, repo, {
    LockService: lockService(),
    getAuthenticatedMember_: () => actor,
    requireAdmin_: (member) => { if (member.rol !== 'Administrador') throw new Error('Administrador requerido'); },
    requireOpenActivity_: (id) => repo.getRecordById_('ACTIVIDADES', id),
    cleanText_: cleanText,
    isValidHttpUrl_: (value) => /^https?:\/\/[^\s]+$/i.test(String(value || '').trim()),
    saveEvidenceFile_: () => { throw new Error('No debe utilizar Drive en estos casos'); },
    nextId_: (type) => type === 'EVI' ? `EVI-${++evidenceCounter}` : `OBS-${++observationCounter}`,
    appendHistory_: (userId, action, entity, entityId, detail) => data.HISTORIAL.push({ userId, action, entity, entityId, detail }),
    getBootstrapData_: () => ({ ok: true })
  }));

  const sharedUrl = 'https://docs.google.com/document/d/archivo-compartido';
  context.submitEvidence_({ contributionId: 'CTR-1', type: 'Enlace', url: sharedUrl, description: 'Sección uno' });
  context.submitEvidence_({ contributionId: 'CTR-2', type: 'Enlace', url: sharedUrl, description: 'Sección dos' });
  assert.equal(data.EVIDENCIAS.length, 2);
  assert.equal(data.EVIDENCIAS[0].url, data.EVIDENCIAS[1].url, 'El mismo enlace debe servir para contribuciones diferentes');
  assert.notEqual(data.EVIDENCIAS[0].contribucion_id, data.EVIDENCIAS[1].contribucion_id, 'La trazabilidad debe permanecer separada');

  context.submitEvidence_({ contributionId: 'CTR-3', type: 'Presencial', description: 'Exposición oral realizada en clase' });
  assert.equal(repo.getRecordById_('CONTRIBUCIONES', 'CTR-3').estado, 'Entregado', 'Una exposición sin entregable digital debe funcionar');

  actor = { id: 'B', rol: 'Integrante' };
  context.reportObservation_({ contributionId: 'CTR-1', reason: 'El enlace no permite abrir la evidencia solicitada.' });
  assert.equal(data.OBSERVACIONES[0].estado, 'Reportada');
  assert.equal(repo.getRecordById_('CONTRIBUCIONES', 'CTR-1').estado, 'Entregado', 'Reportar no debe retirar puntos');

  actor = { id: 'ADMIN', rol: 'Administrador' };
  context.reviewObservation_({ observationId: data.OBSERVACIONES[0].id, decision: 'Confirmar', response: 'Enlace inaccesible confirmado.' });
  assert.equal(data.OBSERVACIONES[0].estado, 'Confirmada');
  assert.equal(repo.getRecordById_('CONTRIBUCIONES', 'CTR-1').estado, 'Observado');

  actor = { id: 'A', rol: 'Integrante' };
  context.submitEvidence_({ contributionId: 'CTR-1', type: 'Enlace', url: sharedUrl, description: 'Acceso corregido y verificado' });
  assert.equal(repo.getRecordById_('CONTRIBUCIONES', 'CTR-1').estado, 'Entregado');
  assert.equal(data.OBSERVACIONES[0].estado, 'Resuelta', 'Una nueva entrega debe resolver la observación confirmada');
}

// Escenario F: división después de evidencia, sin inflar el valor.
{
  const data = {
    INTEGRANTES: [
      { id: 'A', nombre: 'Persona A', activo: true },
      { id: 'B', nombre: 'Persona B', activo: true }
    ],
    CONTRIBUCIONES: [{
      id: 'CTR-ORIGINAL', actividad_id: 'ACT-1', entregable_id: '', descripcion: 'Trabajo compartido',
      tipo: 'Parte A', responsable_id: 'A', estado: 'Entregado', valor_calculado: 8,
      fecha_entrega: '2026-08-17T00:00:00.000Z', vigente: true
    }],
    EVIDENCIAS: [{ id: 'EVI-1', contribucion_id: 'CTR-ORIGINAL' }],
    OBSERVACIONES: [],
    HISTORIAL: []
  };
  const repo = repository(data);
  let contributionCounter = 0;
  const context = loadServices(['AssignmentService.gs'], Object.assign({}, repo, {
    LockService: lockService(),
    getAuthenticatedMember_: () => ({ id: 'ADMIN', rol: 'Administrador' }),
    requireAdmin_: () => {},
    requireOpenActivity_: () => ({ id: 'ACT-1' }),
    cleanText_: cleanText,
    nextId_: () => `CTR-NUEVA-${++contributionCounter}`,
    calculateContributionValue_: (part) => ({
      type: part.type,
      base: 3,
      scopeLevel: 1,
      complexityLevel: 1,
      value: part.type === 'Parte A' ? 7 : 9,
      ruleVersion: '1'
    }),
    roundTwoDecimals_: (value) => Math.round((value + Number.EPSILON) * 100) / 100,
    appendHistory_: (userId, action, entity, entityId, detail) => data.HISTORIAL.push({ userId, action, entity, entityId, detail }),
    getBootstrapData_: () => ({ ok: true })
  }));

  context.splitContribution_({
    contributionId: 'CTR-ORIGINAL',
    reason: 'Una persona realizó el inicio y otra completará el resto.',
    parts: [
      { responsibleId: 'A', description: 'Parte realizada', type: 'Parte A', scopeDetail: 'Inicio', complexityDetail: 'Inicio' },
      { responsibleId: 'B', description: 'Parte restante', type: 'Parte B', scopeDetail: 'Cierre', complexityDetail: 'Cierre' }
    ]
  });

  const current = data.CONTRIBUCIONES.filter((item) => item.vigente !== false);
  assert.equal(current.length, 2);
  assert.equal(current[0].valor_calculado + current[1].valor_calculado, 8);
  assert.deepEqual(current.map((item) => item.valor_calculado), [3.5, 4.5]);
  assert.equal(current[0].estado, 'Entregado');
  assert.equal(current[1].estado, 'Pendiente');
  assert.equal(data.EVIDENCIAS[0].contribucion_id, current[0].id, 'La evidencia debe permanecer con la primera parte');
  assert.equal(data.HISTORIAL[0].detail.responsablesNuevos.join(','), 'A,B');
}

// Escenarios H e I: cierre mixto, idempotencia, reapertura y nueva versión.
{
  const expired = new Date(Date.now() - 60_000).toISOString();
  const data = {
    ACTIVIDADES: [{ id: 'ACT-1', fecha_limite: expired, estado: 'Pendiente', version_cierre: 0, fecha_cierre: '' }],
    CONTRIBUCIONES: [
      { id: 'CTR-1', actividad_id: 'ACT-1', responsable_id: 'A', valor_calculado: 5, estado: 'Entregado', vigente: true },
      { id: 'CTR-2', actividad_id: 'ACT-1', responsable_id: 'A', valor_calculado: 5, estado: 'Pendiente', vigente: true },
      { id: 'CTR-3', actividad_id: 'ACT-1', responsable_id: 'B', valor_calculado: 6, estado: 'Observado', vigente: true }
    ],
    REASIGNACIONES: [{
      id: 'REA-1', actividad_id: 'ACT-1', contribucion_id: 'CTR-3',
      responsable_anterior_id: 'C', responsable_nuevo_id: 'B', tipo: 'Incumplimiento', valor: 6
    }],
    OBSERVACIONES: [
      { id: 'OBS-1', contribucion_id: 'CTR-1', estado: 'Reportada' },
      { id: 'OBS-2', contribucion_id: 'CTR-3', estado: 'Confirmada' }
    ],
    RESULTADOS: [],
    HISTORIAL: []
  };
  const repo = repository(data);
  let closureCounter = 0;
  const context = loadServices(['Config.gs', 'LifecycleService.gs'], Object.assign({}, repo, {
    LockService: lockService(),
    getAuthenticatedMember_: () => ({ id: 'ADMIN', rol: 'Administrador' }),
    requireAdmin_: () => {},
    cleanText_: cleanText,
    nextId_: () => `CIE-${++closureCounter}`,
    appendHistory_: (userId, action, entity, entityId, detail) => data.HISTORIAL.push({ userId, action, entity, entityId, detail }),
    getBootstrapData_: () => ({ ok: true })
  }));

  assert.equal(context.synchronizeExpiredActivities_(), 1);
  assert.equal(data.ACTIVIDADES[0].estado, 'Culminada');
  assert.equal(data.ACTIVIDADES[0].version_cierre, 1);
  assert.equal(data.OBSERVACIONES[0].estado, 'Descartada', 'Una observación solo reportada no debe retirar puntos al cierre');
  assert.equal(data.OBSERVACIONES[1].estado, 'Confirmada', 'La observación bloqueante debe conservarse');
  const firstClosure = data.RESULTADOS.filter((row) => row.version_cierre === 1);
  assert.equal(firstClosure.find((row) => row.integrante_id === 'A').participacion_individual, 50);
  assert.equal(firstClosure.find((row) => row.integrante_id === 'B').valor_efectivo, 0);
  assert.equal(firstClosure.find((row) => row.integrante_id === 'C').participacion_individual, 0);

  const resultCount = data.RESULTADOS.length;
  assert.equal(context.synchronizeExpiredActivities_(), 0, 'El cierre debe ser idempotente');
  assert.equal(data.RESULTADOS.length, resultCount, 'No deben duplicarse snapshots');

  context.changeActivityDeadline_({
    activityId: 'ACT-1',
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    reason: 'Ampliación acordada'
  });
  assert.equal(data.ACTIVIDADES[0].estado, 'Pendiente');
  assert.equal(data.ACTIVIDADES[0].version_cierre, 1, 'Reabrir no debe borrar la versión anterior');

  repo.getRecordById_('CONTRIBUCIONES', 'CTR-2').estado = 'Entregado';
  data.ACTIVIDADES[0].fecha_limite = new Date(Date.now() - 1_000).toISOString();
  assert.equal(context.synchronizeExpiredActivities_(), 1);
  assert.equal(data.ACTIVIDADES[0].version_cierre, 2);
  assert.ok(data.RESULTADOS.some((row) => row.version_cierre === 1), 'Debe conservarse el primer cierre');
  assert.ok(data.RESULTADOS.some((row) => row.version_cierre === 2), 'Debe existir un nuevo cierre');
  const secondClosureA = data.RESULTADOS.find((row) => row.version_cierre === 2 && row.integrante_id === 'A');
  assert.equal(secondClosureA.participacion_individual, 100);
}

console.log('OK: escenarios funcionales B, C, F, G, H e I validados con los servicios reales.');
console.log('OK: escenarios A, D y E cubiertos por core-calculations.test.js.');
