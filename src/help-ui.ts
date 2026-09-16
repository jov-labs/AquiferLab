import { getHelpEntry, getQuickGuide, REQUIRED_HELP_KEYS, type HelpKey } from "./help-content.js";
import { getLanguage, translate, type Language } from "./i18n.js";

export type HelpDialogState =
  | { kind: "closed" }
  | { kind: "context"; key: HelpKey }
  | { kind: "guide" };

export function openContextHelp(key: HelpKey): HelpDialogState {
  return { kind: "context", key };
}

export function openQuickGuide(): HelpDialogState {
  return { kind: "guide" };
}

export function closeHelp(): HelpDialogState {
  return { kind: "closed" };
}

export function getHelpButtonAriaLabel(language: Language, key: HelpKey): string {
  return translate(language, "helpButtonAria")(getHelpEntry(language, key).title);
}

export interface HelpInterface {
  refreshLanguage(): void;
}

/** Manages one reusable dialog for contextual help and the quick guide. */
export function createHelpInterface(): HelpInterface {
  const dialog = getDialog("learning-dialog");
  const title = getElement<HTMLElement>("learning-dialog-title");
  const content = getElement<HTMLElement>("learning-dialog-content");
  const closeButton = getElement<HTMLButtonElement>("learning-dialog-close");
  const guideButton = getElement<HTMLButtonElement>("quick-guide-button");
  const helpButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-help-key]"));
  let state: HelpDialogState = closeHelp();
  let opener: HTMLElement | null = null;

  const render = () => {
    const language = getLanguage();
    guideButton.textContent = translate(language, "quickGuide");
    guideButton.setAttribute("aria-haspopup", "dialog");
    closeButton.textContent = translate(language, "closeHelp");
    closeButton.setAttribute("aria-label", translate(language, "closeHelp"));
    dialog.setAttribute("aria-label", translate(language, "learningDialogLabel"));

    for (const button of helpButtons) {
      const key = button.dataset.helpKey;
      if (!isHelpKey(key)) {
        continue;
      }
      button.setAttribute("aria-label", getHelpButtonAriaLabel(language, key));
      button.setAttribute("aria-haspopup", "dialog");
    }

    if (state.kind === "context") {
      const entry = getHelpEntry(language, state.key);
      title.textContent = entry.title;
      content.replaceChildren(makeParagraph(entry.description));
    } else if (state.kind === "guide") {
      title.textContent = translate(language, "quickGuide");
      content.replaceChildren(
        ...getQuickGuide(language).map((section) => {
          const item = document.createElement("section");
          item.className = section.featured ? "guide-featured" : "";
          const heading = document.createElement("h3");
          heading.textContent = section.title;
          item.append(heading, makeParagraph(section.description));
          return item;
        }),
      );
    }
  };

  const open = (nextState: HelpDialogState, nextOpener: HTMLElement) => {
    if (state.kind === "closed") {
      opener = nextOpener;
    }
    state = nextState;
    render();
    if (!dialog.open) {
      dialog.showModal();
    }
    closeButton.focus();
  };

  for (const button of helpButtons) {
    button.addEventListener("click", () => {
      const key = button.dataset.helpKey;
      if (isHelpKey(key)) {
        open(openContextHelp(key), button);
      }
    });
  }
  guideButton.addEventListener("click", () => open(openQuickGuide(), guideButton));
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    state = closeHelp();
    const previousOpener = opener;
    opener = null;
    previousOpener?.focus();
  });

  render();
  return { refreshLanguage: render };
}

function makeParagraph(text: string): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  return paragraph;
}

function isHelpKey(value: string | undefined): value is HelpKey {
  return value !== undefined && (REQUIRED_HELP_KEYS as readonly string[]).includes(value);
}

function getElement<ElementType extends HTMLElement>(id: string): ElementType {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No se encontró el elemento de ayuda #${id}.`);
  }
  return element as ElementType;
}

function getDialog(id: string): HTMLDialogElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDialogElement)) {
    throw new Error(`No se encontró el diálogo de ayuda #${id}.`);
  }
  return element;
}
