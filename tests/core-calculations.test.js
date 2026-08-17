const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const source = [
  'Config.gs',
  'EvaluationService.gs',
  'LifecycleService.gs',
  'AssignmentService.gs'
].map((file) => fs.readFileSync(path.join(projectRoot, file), 'utf8')).join('\n');

vm.runInThisContext(source, { filename: 'aporta-core.gs' });

function contribution(memberId, value, status = 'Entregado') {
  return {
    responsable_id: memberId,
    valor_calculado: value,
    estado: status
  };
}

function transfer(previousId, nextId, value, type) {
  return {
    responsable_anterior_id: previousId,
    responsable_nuevo_id: nextId,
    valor: value,
    tipo: type
  };
}

function byMember(rows, memberId) {
  return rows.find((row) => row.memberId === memberId);
}

const valuationCases = [
  ['Diseñar 10 preguntas de encuesta', 4, 1, 1, 6],
  ['Conseguir 10 encuestados', 2, 1, 0, 3],
  ['Consolidar 50 respuestas', 4, 2, 1, 7],
  ['Procesar un Excel', 4, 1, 2, 7],
  ['Crear 4 gráficos', 3, 1, 1, 5],
  ['Analizar resultados', 5, 2, 2, 9],
  ['Redactar conclusiones', 3, 1, 2, 6],
  ['Investigar 2 temas con 5 fuentes', 4, 2, 2, 8],
  ['Preparar 5 diapositivas sencillas', 3, 1, 0, 4],
  ['Preparar 2 diapositivas analíticas', 3, 0, 2, 5],
  ['Exponer una introducción de 1 minuto', 3, 0, 0, 3],
  ['Exponer análisis durante 2 minutos', 3, 1, 2, 6],
  ['Consolidar aportes de 4 integrantes', 4, 2, 1, 7],
  ['Revisar formalmente un documento', 2, 1, 1, 4]
];

valuationCases.forEach(([description, base, scope, complexity, expected]) => {
  assert.equal(
    calculateContributionPoints_(base, scope, complexity),
    expected,
    description
  );
});
assert.equal(calculateContributionPoints_(8, 3, 2), 10, 'El valor debe respetar el máximo de 10');

let rows = calculateParticipationRows_([
  contribution('A', 5),
  contribution('A', 5)
], []);
assert.equal(byMember(rows, 'A').individualPercentage, 100, 'Todo entregado debe producir 100%');

rows = calculateParticipationRows_([
  contribution('A', 5),
  contribution('A', 5, 'Pendiente')
], []);
assert.equal(byMember(rows, 'A').individualPercentage, 50, 'Una de dos tareas iguales debe producir 50%');

rows = calculateParticipationRows_([
  contribution('B', 6)
], [transfer('A', 'B', 6, REASSIGNMENT_TYPES.REORGANIZATION)]);
assert.equal(byMember(rows, 'A'), undefined, 'Una reorganización no debe perjudicar al responsable anterior');
assert.equal(byMember(rows, 'B').individualPercentage, 100);

rows = calculateParticipationRows_([
  contribution('B', 6)
], [transfer('A', 'B', 6, REASSIGNMENT_TYPES.NONCOMPLIANCE)]);
assert.deepEqual(
  {
    assigned: byMember(rows, 'A').assignedValue,
    effective: byMember(rows, 'A').effectiveValue,
    individual: byMember(rows, 'A').individualPercentage,
    relative: byMember(rows, 'A').relativePercentage
  },
  { assigned: 6, effective: 0, individual: 0, relative: 0 },
  'El incumplimiento debe conservar la obligación anterior sin atribuir trabajo efectivo'
);
assert.equal(byMember(rows, 'B').individualPercentage, 100);
assert.equal(byMember(rows, 'B').relativePercentage, 100);

rows = calculateParticipationRows_([
  contribution('A', 4),
  contribution('B', 6)
], [transfer('A', 'B', 6, REASSIGNMENT_TYPES.NONCOMPLIANCE)]);
assert.equal(byMember(rows, 'A').individualPercentage, 40, 'El incumplidor entregó 4 de 10 puntos bajo su responsabilidad');
assert.equal(byMember(rows, 'A').relativePercentage, 40);
assert.equal(byMember(rows, 'B').relativePercentage, 60);

rows = calculateParticipationRows_([
  contribution('A', 5, 'Observado')
], []);
assert.equal(byMember(rows, 'A').individualPercentage, 0, 'Una contribución observada debe aportar cero efectivo');
assert.equal(byMember(rows, 'A').relativePercentage, null, 'Sin trabajo efectivo la participación relativa no es calculable');
assert.equal(isEffectiveContribution_({ estado: 'Entregado' }), true);
assert.equal(isEffectiveContribution_({ estado: 'Pendiente' }), false);
assert.equal(isEffectiveContribution_({ estado: 'Observado' }), false);

const splitValues = normalizeSplitValues_(8, [7, 9]);
assert.deepEqual(splitValues, [3.5, 4.5], 'La división debe respetar la proporción bruta');
assert.equal(splitValues[0] + splitValues[1], 8, 'La división debe conservar exactamente el valor original');
rows = calculateParticipationRows_([
  contribution('A', splitValues[0]),
  contribution('B', splitValues[1])
], []);
assert.equal(byMember(rows, 'A').individualPercentage, 100);
assert.equal(byMember(rows, 'B').individualPercentage, 100);
assert.equal(byMember(rows, 'A').relativePercentage, 43.75);
assert.equal(byMember(rows, 'B').relativePercentage, 56.25);

rows = calculateParticipationRows_([
  contribution('A', 1),
  contribution('B', 1),
  contribution('C', 1)
], []);
assert.equal(
  rows.reduce((sum, row) => sum + row.relativePercentage, 0),
  100,
  'La participación relativa debe sumar exactamente 100,00%'
);

rows = calculateParticipationRows_([
  contribution('C', 6)
], [
  transfer('A', 'B', 6, REASSIGNMENT_TYPES.NONCOMPLIANCE),
  transfer('B', 'C', 6, REASSIGNMENT_TYPES.NONCOMPLIANCE)
]);
assert.equal(byMember(rows, 'A').individualPercentage, 0, 'El primer incumplimiento debe conservarse');
assert.equal(byMember(rows, 'B').individualPercentage, 0, 'El segundo incumplimiento debe conservarse');
assert.equal(byMember(rows, 'C').individualPercentage, 100, 'El responsable final recibe reconocimiento');
assert.equal(rows.reduce((sum, row) => sum + row.effectiveValue, 0), 6, 'Los traspasos no duplican trabajo efectivo');

console.log(`OK: ${valuationCases.length} valoraciones y 10 escenarios de cálculo validados.`);
