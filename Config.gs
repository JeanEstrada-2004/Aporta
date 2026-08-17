const APP_CONFIG = Object.freeze({
  name: 'Aporta',
  version: '0.3.0',
  schemaVersion: '3',
  timezone: 'America/Lima',
  maxUploadBytes: 5 * 1024 * 1024,
  spreadsheetProperty: 'APORTA_SPREADSHEET_ID',
  driveFolderProperty: 'APORTA_DRIVE_FOLDER_ID',
  reportFolderProperty: 'APORTA_REPORT_FOLDER_ID'
});

const SHEET_SCHEMAS = Object.freeze({
  INTEGRANTES: [
    'id', 'nombre', 'correo', 'rol', 'activo', 'fecha_alta', 'creado_por'
  ],
  ACTIVIDADES: [
    'id', 'nombre', 'descripcion', 'fecha_limite', 'estado', 'creador_id',
    'fecha_creacion', 'version_cierre', 'fecha_cierre'
  ],
  ENTREGABLES: [
    'id', 'actividad_id', 'nombre', 'descripcion', 'tipo', 'enlace', 'activo',
    'fecha_creacion'
  ],
  CONTRIBUCIONES: [
    'id', 'actividad_id', 'entregable_id', 'descripcion', 'tipo',
    'responsable_id', 'fecha_asignacion', 'estado', 'valor_base',
    'alcance_nivel', 'complejidad_nivel', 'valor_calculado', 'regla_version',
    'fecha_entrega', 'vigente', 'reemplazada_por', 'alcance_detalle',
    'complejidad_detalle', 'creador_id', 'valor_bruto',
    'origen_contribucion_id'
  ],
  EVIDENCIAS: [
    'id', 'contribucion_id', 'tipo', 'url', 'drive_file_id', 'descripcion',
    'fecha', 'creador_id'
  ],
  OBSERVACIONES: [
    'id', 'contribucion_id', 'creador_id', 'motivo', 'estado',
    'fecha_creacion', 'resuelto_por', 'fecha_resolucion',
    'confirmado_por', 'fecha_confirmacion', 'respuesta'
  ],
  HISTORIAL: [
    'id', 'fecha_hora', 'usuario_id', 'accion', 'entidad', 'entidad_id',
    'detalle_json'
  ],
  CONFIGURACION_VALORACION: [
    'id', 'version', 'tipo', 'base', 'parametros_json', 'activo',
    'fecha_creacion'
  ],
  RESULTADOS: [
    'id_cierre', 'version_cierre', 'actividad_id', 'integrante_id',
    'valor_asignado', 'valor_efectivo', 'participacion_individual',
    'participacion_relativa', 'fecha_cierre'
  ],
  CONFIGURACION: ['clave', 'valor', 'descripcion']
});

const DEFAULT_VALUATION_RULES = Object.freeze([
  ['VAL-001', '1', 'Recolección de datos', 2, '{"scope":"respuestas"}', true],
  ['VAL-002', '1', 'Revisión', 2, '{"scope":"elementos"}', true],
  ['VAL-003', '1', 'Redacción', 3, '{"scope":"secciones"}', true],
  ['VAL-004', '1', 'Resolución de preguntas', 3, '{"scope":"preguntas"}', true],
  ['VAL-005', '1', 'Gráficos y visualización', 3, '{"scope":"graficos"}', true],
  ['VAL-006', '1', 'Presentación', 3, '{"scope":"diapositivas"}', true],
  ['VAL-007', '1', 'Diseño gráfico', 3, '{"scope":"piezas"}', true],
  ['VAL-008', '1', 'Exposición', 3, '{"scope":"minutos"}', true],
  ['VAL-009', '1', 'Trabajo de campo', 3, '{"scope":"acciones"}', true],
  ['VAL-010', '1', 'Coordinación demostrable', 3, '{"scope":"acciones"}', true],
  ['VAL-011', '1', 'Investigación', 4, '{"scope":"temas_fuentes"}', true],
  ['VAL-012', '1', 'Diseño de instrumento', 4, '{"scope":"preguntas"}', true],
  ['VAL-013', '1', 'Excel y datos', 4, '{"scope":"operaciones"}', true],
  ['VAL-014', '1', 'Consolidación', 4, '{"scope":"aportes"}', true],
  ['VAL-015', '1', 'Análisis e interpretación', 5, '{"scope":"elementos"}', true]
]);
