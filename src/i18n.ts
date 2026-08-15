export type Language = "es" | "en";

const STORAGE_KEY = "aquiferlab-language";

const translations = {
  es: {
    start: "Empecemos",
    home: "Inicio",
    controlsIntro: "Cambia cuánta agua extrae cada pozo y observa qué ocurre.",
    intro: "Descubre qué ocurre con el agua subterránea cuando uno o más pozos extraen agua.",
    noKnowledge: "No necesitas conocimientos avanzados para empezar.",
    pumpingA: "¿Cuánta agua extrae el pozo A?",
    pumpingB: "¿Cuánta agua extrae el pozo B?",
    drawdownAquifer: "Descenso mostrado en el acuífero",
    technicalControls: "Ver controles técnicos",
    river: "Río",
    sceneHint: "Arrastra para rotar · rueda para zoom · botón derecho para desplazar",
    currentSolution: "SOLUCIÓN ACTUAL",
    whatHappens: "¿Qué está pasando?",
    scenarioResult: "Resultado del escenario",
    wellA: "Pozo A",
    wellB: "Pozo B",
    technicalResults: "Ver resultados técnicos",
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
    publicGridWarning:
      "⚠ Parte del acuífero modelado salió del rango que este modelo simple puede representar correctamente.",
    wellRangeWarning: (wells: string) =>
      `⚠ La estimación dentro del pozo ${wells} queda fuera del rango que este modelo simple puede representar con fiabilidad. El acuífero mostrado alrededor todavía permanece dentro del rango confinado.`,
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
    intro: "Discover what happens to groundwater when one or more wells extract water.",
    noKnowledge: "You don't need advanced knowledge to get started.",
    pumpingA: "How much water does well A extract?",
    pumpingB: "How much water does well B extract?",
    drawdownAquifer: "Water-level decline shown in the aquifer",
    technicalControls: "Show technical controls",
    river: "River",
    sceneHint: "Drag to rotate · wheel to zoom · right button to pan",
    currentSolution: "CURRENT SOLUTION",
    whatHappens: "What's happening?",
    scenarioResult: "Scenario result",
    wellA: "Well A",
    wellB: "Well B",
    technicalResults: "Show technical results",
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
    publicGridWarning:
      "⚠ Part of the modeled aquifer is outside the range this simple model can represent correctly.",
    wellRangeWarning: (wells: string) =>
      `⚠ The estimate inside well ${wells} is outside the range this simple model can represent reliably. The surrounding modeled aquifer is still within the confined range.`,
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
  return translations[getLanguage()][key];
}
