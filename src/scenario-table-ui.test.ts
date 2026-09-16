import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createInitialModelInput } from "./initial-model-input.js";
import { createScenarioTableInterface } from "./scenario-table-ui.js";
import { getScenarioTableMinWidth } from "./scenario-table-layout.js";

class FakeElement {
  readonly tagName: string;
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, () => void>();
  readonly attributes = new Map<string, string>();
  readonly style = { minWidth: "" };
  text = "";
  className = "";
  type = "";
  value = "";
  disabled = false;
  readOnly = false;
  min = "";
  max = "";
  step = "";
  scope = "";

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string | null) {
    this.text = value ?? "";
    this.children.length = 0;
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.text = "";
    this.children.splice(0, this.children.length, ...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }

  click(): void {
    this.listeners.get("click")?.();
  }

  findAll(predicate: (element: FakeElement) => boolean): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(predicate(child) ? [child] : []),
      ...child.findAll(predicate),
    ]);
  }
}

function makeDocument(): { createElement: (tagName: string) => FakeElement } {
  return { createElement: (tagName) => new FakeElement(tagName) };
}

describe("scenario comparator DOM rendering", () => {
  const originalDocument = globalThis.document;
  const originalStorage = globalThis.localStorage;

  beforeEach(() => {
    globalThis.document = makeDocument() as unknown as Document;
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.localStorage = originalStorage;
  });

  it("preserves headers, labels, controls, and K with one scenario", () => {
    const container = new FakeElement("div");
    const comparator = createScenarioTableInterface(
      container as unknown as HTMLElement,
      createInitialModelInput(),
    );
    comparator.render();

    const removeButtons = container.findAll(
      (element) => element.tagName === "button" && element.textContent === "Eliminar",
    );
    removeButtons[1]?.click();

    expect(container.textContent).toContain("Parámetro");
    const scenarioNames = container.findAll(
      (element) => element.tagName === "input" && element.value === "Escenario 1",
    );
    expect(scenarioNames).toHaveLength(1);
    const hydraulicReferenceLabels = container.findAll(
      (element) => element.attributes.get("aria-label") === "Referencia hidráulica",
    );
    expect(hydraulicReferenceLabels).toHaveLength(1);
    expect(container.textContent).toContain("K");
    expect(container.textContent).toContain("Recarga");
    expect(container.textContent).toContain("l/s");
    expect(container.textContent).not.toContain("L/s");
    expect(container.textContent).toContain("Activo");
    expect(container.textContent).toContain("Eliminar");

    const kInputs = container.findAll(
      (element) => element.tagName === "input" && element.value === "0.0001",
    );
    expect(kInputs).toHaveLength(1);
  });

  it("aligns the unit column after all scenarios", () => {
    const container = new FakeElement("div");
    const comparator = createScenarioTableInterface(
      container as unknown as HTMLElement,
      createInitialModelInput(),
    );
    comparator.render();

    const columns = container.findAll((element) => element.tagName === "col");
    expect(columns).toHaveLength(4);
    expect(columns[0]?.className).toBe("scenario-parameter-column");
    expect(columns[1]?.className).toBe("scenario-value-column");
    expect(columns[2]?.className).toBe("scenario-value-column");
    expect(columns.at(-1)?.className).toBe("scenario-unit-column");
  });

  it("calculates the minimum table width based on the number of scenarios", () => {
    expect(getScenarioTableMinWidth(1)).toBe(325);
    expect(getScenarioTableMinWidth(2)).toBe(445);
    expect(getScenarioTableMinWidth(3)).toBe(565);
    expect(getScenarioTableMinWidth(4)).toBe(685);
  });
});
