const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('Index.html');
const scripts = read('Scripts.html');
const styles = read('Styles.html');
const lifecycle = read('LifecycleService.gs');
const manifest = JSON.parse(read('appsscript.json'));

assert.match(index, /id="page-description"/, 'La cabecera debe tener una descripción única por vista');
assert.doesNotMatch(index, /<div class="page-intro">/, 'Las vistas no deben repetir el encabezado principal');
assert.match(index, /Nombre visible en Aporta/, 'El formulario debe aclarar de dónde sale el nombre mostrado');
assert.match(index, /No corresponde observar una entrega por gustos personales/, 'Observaciones debe excluir criterios subjetivos');
assert.match(index, /Guía rápida/, 'La valoración debe incluir una guía comprensible');
assert.match(index, /<option value="1" selected>Medio<\/option>/, 'El alcance debe ocultar sus puntos parciales');
assert.match(index, /<option value="1" selected>Estructurada<\/option>/, 'La complejidad debe ocultar sus puntos parciales');
assert.doesNotMatch(index, /(?:Pequeño|Medio|Amplio|Excepcional|Básica|Estructurada|Analítica o técnica) \(\+\d\)/, 'El formulario no debe mostrar incrementos parciales');

assert.match(scripts, /Aún no hay actividades registradas por el administrador/, 'El estado vacío del integrante no debe pedirle crear actividades');
assert.match(scripts, /Los resultados aparecerán cuando el administrador asigne contribuciones/, 'Resultados debe respetar el rol del integrante');
assert.match(scripts, /Corregir evidencia/, 'Una contribución observada debe ofrecer una corrección clara');
assert.match(scripts, /Añadir evidencia/, 'Una contribución entregada debe distinguir evidencia adicional');
assert.match(scripts, /updateReassignmentFields/, 'El formulario debe explicar el efecto del tipo de reasignación');
assert.match(scripts, /timeline-detail/, 'La trazabilidad debe mostrar el detalle seguro de una reasignación');
assert.match(scripts, /Valor automático final/, 'La vista previa debe destacar únicamente el valor final');
assert.doesNotMatch(scripts, /escapeHtml\(rule\.type\) \+ ' · base '/, 'El tipo de tarea no debe mostrar su base');
assert.doesNotMatch(scripts, /rule\.base \+ ' base \+ '/, 'La vista previa no debe revelar el desglose numérico');

assert.match(styles, /@media \(max-width: 850px\)/, 'Debe existir un ajuste para portátil o tableta');
assert.match(styles, /@media \(max-width: 600px\)/, 'Debe existir un ajuste para móvil');
assert.match(styles, /@media \(max-width: 380px\)/, 'Debe existir un ajuste para pantallas pequeñas');
assert.match(styles, /overflow-x: auto/, 'Las tablas o navegaciones anchas deben permitir desplazamiento');
assert.match(styles, /max-height: calc\(100dvh - 20px\)/, 'Los modales móviles deben respetar la altura visible');

assert.doesNotMatch(lifecycle, /ScriptApp\./, 'El cierre no debe exigir permisos de administración de activadores a todos los usuarios');
assert.equal(
  manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.scriptapp'),
  false,
  'El despliegue no debe solicitar el permiso amplio de activadores'
);

console.log('OK: contrato de interfaz, responsive y permisos del trigger validado.');
