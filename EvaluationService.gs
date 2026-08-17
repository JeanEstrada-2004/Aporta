function calculateContributionValue_(payload) {
  const type = cleanText_(payload.type, 100);
  const scopeLevel = parseBoundedInteger_(payload.scopeLevel, 0, 3, 'alcance');
  const complexityLevel = parseBoundedInteger_(payload.complexityLevel, 0, 2, 'complejidad');
  const rule = findRecord_('CONFIGURACION_VALORACION', function (item) {
    return item.activo !== false && item.tipo === type;
  });

  if (!rule) {
    throw new Error('Selecciona un tipo de contribucion valido.');
  }

  const base = Number(rule.base);
  const value = Math.min(10, base + scopeLevel + complexityLevel);

  return {
    type: type,
    base: base,
    scopeLevel: scopeLevel,
    complexityLevel: complexityLevel,
    value: value,
    ruleVersion: String(rule.version),
    explanation: base + ' base + ' + scopeLevel + ' alcance + ' + complexityLevel + ' complejidad'
  };
}

function parseBoundedInteger_(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error('Selecciona un nivel de ' + label + ' valido.');
  }
  return number;
}
