import { describe, expect, it } from "vitest";

import {
  HELP_CATALOG,
  QUICK_GUIDE,
  REQUIRED_HELP_KEYS,
  getHelpEntry,
} from "./help-content.js";
import {
  closeHelp,
  getHelpButtonAriaLabel,
  openContextHelp,
  openQuickGuide,
} from "./help-ui.js";
import { translate } from "./i18n.js";

describe("catálogo de ayuda educativa", () => {
  it("incluye todos los términos obligatorios en español e inglés sin claves desalineadas", () => {
    const expectedKeys = [...REQUIRED_HELP_KEYS].sort();
    expect(Object.keys(HELP_CATALOG.es).sort()).toEqual(expectedKeys);
    expect(Object.keys(HELP_CATALOG.en).sort()).toEqual(expectedKeys);
  });

  it("no contiene explicaciones obligatorias vacías", () => {
    for (const language of ["es", "en"] as const) {
      for (const key of REQUIRED_HELP_KEYS) {
        const entry = getHelpEntry(language, key);
        expect(entry.title.trim()).not.toBe("");
        expect(entry.description.trim()).not.toBe("");
      }
    }
  });

  it("distingue la carga de celda de la estimación dentro del pozo", () => {
    expect(getHelpEntry("es", "well-a-cell-head").description).not.toBe(
      getHelpEntry("es", "well-a-estimated-head").description,
    );
    expect(getHelpEntry("es", "well-a-cell-head").description).toMatch(/celda/i);
    expect(getHelpEntry("es", "well-a-estimated-head").description).toMatch(/Peaceman/i);
  });

  it("aclara que Darcy no es velocidad intersticial y que las líneas no dan tiempo de viaje", () => {
    expect(getHelpEntry("es", "maximum-darcy-flux").description).toMatch(/No es la velocidad/i);
    expect(getHelpEntry("es", "qualitative-flow-lines").description).toMatch(/tiempo real de viaje/i);
    expect(getHelpEntry("en", "maximum-darcy-flux").description).toMatch(/not the actual travel velocity/i);
    expect(getHelpEntry("en", "qualitative-flow-lines").description).toMatch(/real travel time/i);
  });

  it("incluye en la guía todos los límites científicos obligatorios", () => {
    const spanishGuide = QUICK_GUIDE.es.map((section) => `${section.title} ${section.description}`).join(" ");
    const englishGuide = QUICK_GUIDE.en.map((section) => `${section.title} ${section.description}`).join(" ");
    expect(QUICK_GUIDE.es).toHaveLength(8);
    expect(QUICK_GUIDE.en).toHaveLength(8);
    expect(spanishGuide).toMatch(/2D, estacionario, confinado, homogéneo, isotrópico/i);
    expect(spanishGuide).toMatch(/carga fija.*no flujo/i);
    expect(spanishGuide).toMatch(/0 y 50 L\/s/i);
    expect(spanishGuide).toMatch(/K=1×10⁻⁴ m\/s y espesor=20 m/i);
    expect(spanishGuide).toMatch(/no proporcionan tiempos de viaje/i);
    expect(spanishGuide).toMatch(/perforación, bombeo, permisos, inversión/i);
    expect(englishGuide).toMatch(/fixed-head boundary.*no-flow/i);
    expect(englishGuide).toMatch(/drilling, pumping, permits, investment/i);
  });

  it("consolida el aviso del acuífero de ejemplo dentro de una sola sección destacada", () => {
    const exampleSections = QUICK_GUIDE.es.filter(
      (section) => section.title === "Acuífero transmisivo de ejemplo",
    );
    const exampleSectionEn = QUICK_GUIDE.en.filter(
      (section) => section.title === "Example high-transmissivity aquifer",
    );
    expect(exampleSections).toHaveLength(1);
    expect(exampleSections[0]).toMatchObject({ featured: true });
    expect(exampleSections[0].description).toContain(
      "Este escenario educativo no representa un lugar real ni determina caudales seguros.",
    );
    expect(exampleSectionEn).toHaveLength(1);
    expect(exampleSectionEn[0]).toMatchObject({ featured: true });
    expect(exampleSectionEn[0].description).toContain(
      "This educational scenario does not represent a real location or determine safe pumping rates.",
    );
  });

  it("usa la etiqueta visible corregida y actualiza las etiquetas aria por idioma", () => {
    expect(translate("es", "maxDarcy")).toBe("Flujo específico de Darcy máximo");
    expect(translate("en", "maxDarcy")).toBe("Maximum Darcy flux");
    expect(translate("es", "maxDarcy")).not.toContain("Q Darcy máx.");
    expect(getHelpButtonAriaLabel("es", "status")).toBe("Ayuda sobre Estado");
    expect(getHelpButtonAriaLabel("en", "status")).toBe("Help about Status");
  });

  it("restaura el estado de ayuda al cerrar y permite abrirlo de nuevo", () => {
    const context = openContextHelp("status");
    expect(context).toEqual({ kind: "context", key: "status" });
    expect(closeHelp()).toEqual({ kind: "closed" });
    expect(openQuickGuide()).toEqual({ kind: "guide" });
    expect(openContextHelp("confined-validity")).toEqual({
      kind: "context",
      key: "confined-validity",
    });
  });
});
