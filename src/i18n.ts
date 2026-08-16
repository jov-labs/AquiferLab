export type Language = "es" | "en";

const STORAGE_KEY = "aquiferlab-language";

const translations = {
  es: {
    start: "Empecemos",
    home: "Inicio",
    controlsIntro: "Cambia cuánta agua extrae cada pozo y observa qué ocurre.",
    quickGuide: "Guía rápida",
    closeHelp: "Cerrar ayuda",
    learningDialogLabel: "Ayuda de AquiferLab",
    helpButtonAria: (term: string) => `Ayuda sobre ${term}`,
    meshResolution: "Resolución de malla",
    maximumIterations: "Iteraciones máximas",
    solverTolerance: "Tolerancia",
    darcyArrows: "Flechas de Darcy",
    intro: "Descubre qué ocurre con el agua subterránea cuando uno o más pozos extraen agua.",
    noKnowledge: "No necesitas conocimientos avanzados para empezar.",
    pumpingA: "¿Cuánta agua extrae el pozo A?",
    pumpingB: "¿Cuánta agua extrae el pozo B?",
    drawdownAquifer: "Descenso mostrado en el acuífero",
    technicalControls: "Ver controles técnicos",
    qualitativeFlow: "Mostrar líneas de flujo cualitativas",
    geologicalCut: "Activar corte geológico",
    cutPosition: "Posición del corte",
    aquiferParameters: "Parámetros del acuífero",
    hydraulicConductivity: "Conductividad hidráulica K",
    recharge: "Recarga",
    aquiferThickness: "Espesor del acuífero",
    riverHead: "Carga del río",
    aquiferTopElevation: "Cota del techo del acuífero",
    hydraulicBlockNote:
      "Espesor hidráulico configurable; bloque geológico esquemático sin escala vertical.",
    aquiferTopNote:
      "La cota del techo usa el mismo datum que la carga hidráulica y sólo evalúa la validez del modelo confinado.",
    riverLevel: (value: string) => `Nivel del agua del río: ${value}\u00A0m`,
    piezometricSurface: "Superficie piezométrica",
    qualitativeFlowLegend: "Líneas de flujo cualitativas",
    confinedAquiferLegend: "Acuífero confinado modelado",
    visualContextNote:
      "Las unidades superior y basal son sólo contexto visual; no participan en el cálculo.",
    piezometricReference:
      "Superficie piezométrica mostrada respecto a h = 100 m.",
    arrowScaleNote:
      "Longitud de flechas con escala visual de raíz cuadrada normalizada; la dirección y el orden relativo de magnitudes se conservan.",
    darcyDirectionNote:
      "Representan la dirección del flujo de Darcy; no representan velocidad intersticial ni tiempo de viaje.",
    geologicalCutNote:
      "Corte geológico: visualización; no modifica el modelo hidráulico.",
    river: "Río",
    sceneHint: "Arrastra para rotar · rueda para zoom · botón derecho para desplazar",
    currentSolution: "SOLUCIÓN ACTUAL",
    whatHappens: "¿Qué está pasando?",
    scenarioResult: "Resultado del escenario",
    wellA: "Pozo A",
    wellB: "Pozo B",
    technicalResults: "Ver resultados técnicos",
    wellRadiusA: "Radio pozo A",
    wellRadiusB: "Radio pozo B",
    status: "Estado",
    iterations: "Iteraciones",
    minimumGridHead: "Carga mínima de malla",
    maximumHead: "Carga máxima",
    headCellA: "Carga en celda A",
    headCellB: "Carga en celda B",
    estimatedHeadA: "Carga estimada pozo A",
    estimatedHeadB: "Carga estimada pozo B",
    maxDarcy: "Flujo específico de Darcy máximo",
    maximumGridDrawdown: "Abatimiento máx. de malla",
    drawdownCellA: "Abatimiento en celda A",
    drawdownCellB: "Abatimiento en celda B",
    estimatedDrawdownA: "Abatimiento estimado pozo A",
    estimatedDrawdownB: "Abatimiento estimado pozo B",
    peacemanNote:
      "Estimación Peaceman para pozo ideal completamente penetrante, sin pérdidas de pantalla ni skin.",
    rechargeUnit: "mm/año",
    metersPerDayUnit: "m/día",
    estimatedDecline: "Descenso estimado",
    pumpingDecline: "El bombeo simulado hace descender el nivel del agua.",
    noPumping:
      "No hay bombeo en este escenario, por lo que el nivel del agua no desciende por extracción.",
    insideWellNote:
      "Dentro del pozo, el descenso puede ser mayor que el observado alrededor.",
    converged: "Convergió",
    invalidElevation: "Cota inválida",
    valid: "Válido",
    outsideRange: "Fuera de rango",
    confinedValidityTitle: "Validez del modelo confinado",
    confinedValidityValidSummary:
      "Todas las cargas de malla y las estimaciones dentro de los pozos permanecen sobre el techo del acuífero.",
    confinedValidityValidStatus: "Modelo confinado válido",
    wellDegradedStatus: "Fuera del modelo confinado",
    meshInvalidStatus: "Escenario fuera del modelo confinado",
    wellDegradedSummary:
      "La malla permanece dentro del régimen confinado, pero una o más estimaciones Peaceman dentro de pozo quedan fuera de ese régimen.",
    meshInvalidSummary: (
      cells: number,
      percentage: string,
      deficit: string,
    ) =>
      `El solver convergió, pero la malla salió del régimen confinado. ${cells} celdas afectadas (${percentage} %). Déficit máximo de malla: ${deficit}.`,
    confinedValidityInvalidSummary: (
      cells: number,
      percentage: string,
      deficit: string,
    ) =>
      `El solver convergió, pero la carga cayó bajo el techo del acuífero. ${cells} celdas afectadas (${percentage} %). Déficit máximo de malla: ${deficit}.`,
    confinedWellWarning: (
      label: string,
      head: string,
      deficit: string,
    ) =>
      `Pozo ${label}: carga estimada ${head}; déficit respecto al techo ${deficit}.`,
    confinedValidityEvaluationFailed:
      "No se pudo evaluar la validez del modelo confinado.",
    confinedExtrapolation:
      "Estos resultados son una extrapolación del modelo confinado con T constante; no representan desaturación ni flujo no confinado.",
    wellDegradedExtrapolation:
      "La estimación Peaceman marcada queda fuera del modelo confinado; la malla permanece dentro del régimen evaluado.",
    publicGridWarning:
      "⚠ Parte del acuífero modelado salió del rango que este modelo simple puede representar correctamente.",
    wellRangeWarningTitle: (wells: string) => `⚠ Límite local en el pozo ${wells}`,
    wellRangeWarningEstimate:
      "La estimación dentro del pozo ya no es válida para un acuífero confinado.",
    wellRangeWarningGrid: "La malla alrededor permanece dentro del rango del modelo.",
    meshInvalidPublicWarning:
      "⚠ Escenario fuera del modelo confinado: los resultados se conservan para auditoría, pero no deben interpretarse como válidos.",
    outsideConfinedModel: "Fuera del modelo confinado",
    meshInvalidCardTitle: "Este resultado no es físicamente válido",
    meshInvalidCardDescription:
      "El bombeo bajó el agua por debajo del techo del acuífero. AquiferLab ya no puede representar este escenario como acuífero confinado.",
    meshInvalidCardAction: "Reduce el bombeo hasta que desaparezca esta advertencia.",
    validityCheckFailed:
      "No se pudo comprobar si este escenario está dentro de los límites del modelo simple.",
    calculationFailed: "No se pudo calcular este escenario.",
    checkScenario:
      "Revisa los datos del escenario antes de interpretar los resultados.",
    noConvergence: "NO CONVERGIÓ",
    and: " y ",
  },
  en: {
    start: "Let's begin",
    home: "Home",
    controlsIntro: "Change how much water each well extracts and see what happens.",
    quickGuide: "Quick guide",
    closeHelp: "Close help",
    learningDialogLabel: "AquiferLab help",
    helpButtonAria: (term: string) => `Help about ${term}`,
    meshResolution: "Mesh resolution",
    maximumIterations: "Maximum iterations",
    solverTolerance: "Tolerance",
    darcyArrows: "Darcy arrows",
    intro: "Discover what happens to groundwater when one or more wells extract water.",
    noKnowledge: "You don't need advanced knowledge to get started.",
    pumpingA: "How much water does well A extract?",
    pumpingB: "How much water does well B extract?",
    drawdownAquifer: "Water-level decline shown in the aquifer",
    technicalControls: "Show technical controls",
    qualitativeFlow: "Show qualitative flow lines",
    geologicalCut: "Enable geological cut",
    cutPosition: "Cut position",
    aquiferParameters: "Aquifer parameters",
    hydraulicConductivity: "Hydraulic conductivity K",
    recharge: "Recharge",
    aquiferThickness: "Aquifer thickness",
    riverHead: "River head",
    aquiferTopElevation: "Aquifer top elevation",
    hydraulicBlockNote:
      "Configurable hydraulic thickness; schematic geological block without vertical scale.",
    aquiferTopNote:
      "The aquifer-top elevation uses the same datum as hydraulic head and is used only to evaluate confined-model validity.",
    riverLevel: (value: string) => `River water level: ${value}\u00A0m`,
    piezometricSurface: "Piezometric surface",
    qualitativeFlowLegend: "Qualitative flow lines",
    confinedAquiferLegend: "Modeled confined aquifer",
    visualContextNote:
      "The upper and lower units are visual context only; they do not participate in the calculation.",
    piezometricReference:
      "Piezometric surface shown relative to h = 100 m.",
    arrowScaleNote:
      "Arrow length with normalized square-root visual scaling; direction and relative magnitude ordering are preserved.",
    darcyDirectionNote:
      "They represent Darcy-flow direction; they do not represent interstitial velocity or travel time.",
    geologicalCutNote:
      "Geological cut: visualization only; it does not modify the hydraulic model.",
    river: "River",
    sceneHint: "Drag to rotate · wheel to zoom · right button to pan",
    currentSolution: "CURRENT SOLUTION",
    whatHappens: "What's happening?",
    scenarioResult: "Scenario result",
    wellA: "Well A",
    wellB: "Well B",
    technicalResults: "Show technical results",
    wellRadiusA: "Well A radius",
    wellRadiusB: "Well B radius",
    status: "Status",
    iterations: "Iterations",
    minimumGridHead: "Minimum grid head",
    maximumHead: "Maximum head",
    headCellA: "Head in cell A",
    headCellB: "Head in cell B",
    estimatedHeadA: "Estimated well A head",
    estimatedHeadB: "Estimated well B head",
    maxDarcy: "Maximum Darcy flux",
    maximumGridDrawdown: "Maximum grid drawdown",
    drawdownCellA: "Drawdown in cell A",
    drawdownCellB: "Drawdown in cell B",
    estimatedDrawdownA: "Estimated well A drawdown",
    estimatedDrawdownB: "Estimated well B drawdown",
    peacemanNote:
      "Peaceman estimate for an ideal fully penetrating well, without screen or skin losses.",
    rechargeUnit: "mm/year",
    metersPerDayUnit: "m/day",
    estimatedDecline: "Estimated decline",
    pumpingDecline: "The simulated pumping lowers the water level.",
    noPumping:
      "There is no pumping in this scenario, so extraction does not lower the water level.",
    insideWellNote:
      "Inside the well, the decline may be greater than the decline observed around it.",
    converged: "Converged",
    invalidElevation: "Invalid elevation",
    valid: "Valid",
    outsideRange: "Outside range",
    confinedValidityTitle: "Confined model validity",
    confinedValidityValidSummary:
      "All grid heads and in-well estimates remain above the aquifer top.",
    confinedValidityValidStatus: "Confined model valid",
    wellDegradedStatus: "Outside the confined model",
    meshInvalidStatus: "Scenario outside the confined model",
    wellDegradedSummary:
      "The grid remains within the confined regime, but one or more Peaceman in-well estimates fall outside that regime.",
    meshInvalidSummary: (
      cells: number,
      percentage: string,
      deficit: string,
    ) =>
      `The solver converged, but the grid is outside the confined regime. ${cells} cells affected (${percentage} %). Maximum grid deficit: ${deficit}.`,
    confinedValidityInvalidSummary: (
      cells: number,
      percentage: string,
      deficit: string,
    ) =>
      `The solver converged, but hydraulic head fell below the aquifer top. ${cells} cells affected (${percentage} %). Maximum grid deficit: ${deficit}.`,
    confinedWellWarning: (
      label: string,
      head: string,
      deficit: string,
    ) =>
      `Well ${label}: estimated head ${head}; deficit below the aquifer top ${deficit}.`,
    confinedValidityEvaluationFailed:
      "The confined-model validity could not be evaluated.",
    confinedExtrapolation:
      "These results are an extrapolation of the confined model with constant T; they do not represent desaturation or unconfined flow.",
    wellDegradedExtrapolation:
      "The marked Peaceman estimate is outside the confined model; the grid remains within the evaluated regime.",
    publicGridWarning:
      "⚠ Part of the modeled aquifer is outside the range this simple model can represent correctly.",
    wellRangeWarningTitle: (wells: string) => `⚠ Local limit at Well ${wells}`,
    wellRangeWarningEstimate:
      "The estimate inside the well is no longer valid for a confined aquifer.",
    wellRangeWarningGrid: "The surrounding grid remains within the model’s valid range.",
    meshInvalidPublicWarning:
      "⚠ Scenario outside the confined model: results are retained for audit, but must not be interpreted as valid.",
    outsideConfinedModel: "Outside the confined model",
    meshInvalidCardTitle: "This result is not physically valid",
    meshInvalidCardDescription:
      "Pumping lowered the water below the aquifer top. AquiferLab can no longer represent this scenario as a confined aquifer.",
    meshInvalidCardAction: "Reduce pumping until this warning disappears.",
    validityCheckFailed:
      "It was not possible to verify whether this scenario is within the limits of the simple model.",
    calculationFailed: "This scenario could not be calculated.",
    checkScenario:
      "Check the scenario data before interpreting the results.",
    noConvergence: "DID NOT CONVERGE",
    and: " and ",
  },
} as const;

export type TranslationKey = keyof typeof translations.es;

export function getLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "es";
}

export function setLanguage(language: Language): void {
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;
}

export function t<Key extends TranslationKey>(
  key: Key,
): (typeof translations)[Language][Key] {
  return translate(getLanguage(), key);
}

export function translate<Key extends TranslationKey>(
  language: Language,
  key: Key,
): (typeof translations)[Language][Key] {
  return translations[language][key];
}
