import type { Language } from "./i18n.js";

export const REQUIRED_HELP_KEYS = [
  "status",
  "iterations",
  "minimum-grid-head",
  "maximum-head",
  "well-a-cell-head",
  "well-b-cell-head",
  "well-a-estimated-head",
  "well-b-estimated-head",
  "maximum-darcy-flux",
  "maximum-grid-drawdown",
  "well-a-cell-drawdown",
  "well-b-cell-drawdown",
  "well-a-estimated-drawdown",
  "well-b-estimated-drawdown",
  "peaceman",
  "confined-validity",
  "well-a-pumping",
  "well-b-pumping",
  "well-radius",
  "geological-cut",
  "hydraulic-conductivity",
  "recharge",
  "mesh-resolution",
  "aquifer-thickness",
  "river-head",
  "maximum-iterations",
  "solver-tolerance",
  "darcy-arrows",
  "qualitative-flow-lines",
] as const;

export type HelpKey = (typeof REQUIRED_HELP_KEYS)[number];

export interface HelpEntry {
  title: string;
  description: string;
}

export interface QuickGuideSection {
  title: string;
  description: string;
  featured?: boolean;
}

type HelpCatalog = Record<HelpKey, HelpEntry>;

export const HELP_CATALOG: Record<Language, HelpCatalog> = {
  es: {
    status: {
      title: "Estado",
      description:
        "Indica si el cálculo numérico encontró una solución. “Convergió” no significa por sí solo que el resultado represente correctamente un acuífero real.",
    },
    iterations: {
      title: "Iteraciones",
      description:
        "Cantidad de repeticiones empleadas por el solver hasta cumplir la tolerancia numérica.",
    },
    "minimum-grid-head": {
      title: "Carga mínima de malla",
      description:
        "Es la menor carga hidráulica entre todas las celdas de la malla. La carga es energía del agua expresada como altura respecto a una referencia; no es necesariamente la profundidad del agua.",
    },
    "maximum-head": {
      title: "Carga máxima",
      description:
        "Es la mayor carga hidráulica entre todas las celdas de la malla. La carga expresa energía como altura respecto a una referencia, no necesariamente profundidad.",
    },
    "well-a-cell-head": {
      title: "Carga en celda A",
      description:
        "Valor medio calculado en la celda que contiene el pozo A. No equivale exactamente a la carga dentro del pozo.",
    },
    "well-b-cell-head": {
      title: "Carga en celda B",
      description:
        "Valor medio calculado en la celda que contiene el pozo B. No equivale exactamente a la carga dentro del pozo.",
    },
    "well-a-estimated-head": {
      title: "Carga estimada pozo A",
      description:
        "Aproximación subcelda mediante Peaceman para estimar la carga dentro del pozo A ideal.",
    },
    "well-b-estimated-head": {
      title: "Carga estimada pozo B",
      description:
        "Aproximación subcelda mediante Peaceman para estimar la carga dentro del pozo B ideal.",
    },
    "maximum-darcy-flux": {
      title: "Flujo específico de Darcy máximo",
      description:
        "Mayor flujo por unidad de área calculado mediante la ley de Darcy. No es la velocidad real de viaje del agua entre los poros.",
    },
    "maximum-grid-drawdown": {
      title: "Abatimiento máximo de malla",
      description:
        "Mayor disminución de la carga respecto al mismo escenario sin bombeo, calculada en las celdas de la malla.",
    },
    "well-a-cell-drawdown": {
      title: "Abatimiento en celda A",
      description:
        "Descenso calculado en la celda que contiene el pozo A, respecto al mismo escenario sin bombeo.",
    },
    "well-b-cell-drawdown": {
      title: "Abatimiento en celda B",
      description:
        "Descenso calculado en la celda que contiene el pozo B, respecto al mismo escenario sin bombeo.",
    },
    "well-a-estimated-drawdown": {
      title: "Abatimiento estimado pozo A",
      description:
        "Descenso aproximado dentro del pozo A ideal mediante la corrección subcelda de Peaceman.",
    },
    "well-b-estimated-drawdown": {
      title: "Abatimiento estimado pozo B",
      description:
        "Descenso aproximado dentro del pozo B ideal mediante la corrección subcelda de Peaceman.",
    },
    peaceman: {
      title: "Estimación Peaceman",
      description:
        "Corrección matemática para representar un pozo mucho menor que una celda. Supone un pozo completamente penetrante y no incluye pérdidas de pantalla ni skin.",
    },
    "confined-validity": {
      title: "Validez del modelo confinado",
      description:
        "Comprueba si las cargas permanecen sobre el techo del acuífero. Es una comprobación del supuesto confinado, no una validación de un acuífero real.",
    },
    "well-a-pumping": {
      title: "Bombeo del pozo A",
      description: "Caudal extraído por el pozo A, expresado en litros por segundo.",
    },
    "well-b-pumping": {
      title: "Bombeo del pozo B",
      description: "Caudal extraído por el pozo B, expresado en litros por segundo.",
    },
    "well-radius": {
      title: "Radio del pozo",
      description: "Radio interno idealizado utilizado por la corrección del pozo.",
    },
    "geological-cut": {
      title: "Corte geológico",
      description: "Recorta únicamente la visualización 3D. No modifica el cálculo.",
    },
    "hydraulic-conductivity": {
      title: "Conductividad hidráulica K",
      description:
        "Indica la facilidad con que el material permite circular el agua. El escenario educativo usa 1×10⁻⁴ m/s; no es un valor universal.",
    },
    recharge: {
      title: "Recarga",
      description: "Agua que entra al acuífero desde la superficie, expresada en milímetros por año.",
    },
    "mesh-resolution": {
      title: "Resolución de malla",
      description:
        "División del dominio en celdas numéricas. Más celdas pueden mejorar resolución, pero aumentan el cálculo y no garantizan mayor exactitud física.",
    },
    "aquifer-thickness": {
      title: "Espesor del acuífero",
      description: "Espesor saturado idealizado del acuífero confinado.",
    },
    "river-head": {
      title: "Carga del río",
      description: "Carga hidráulica fija impuesta en el borde occidental del modelo.",
    },
    "maximum-iterations": {
      title: "Iteraciones máximas",
      description: "Límite de repeticiones antes de detener un cálculo que no converge.",
    },
    "solver-tolerance": {
      title: "Tolerancia",
      description:
        "Cambio máximo aceptado entre iteraciones para considerar estable la solución numérica.",
    },
    "darcy-arrows": {
      title: "Flechas de Darcy",
      description:
        "Muestran dirección y magnitud relativa del flujo específico de Darcy; no representan velocidad intersticial ni tiempo de viaje.",
    },
    "qualitative-flow-lines": {
      title: "Líneas de flujo",
      description:
        "Muestran trayectorias cualitativas del campo de Darcy. Sin porosidad efectiva no proporcionan velocidad intersticial ni tiempo real de viaje.",
    },
  },
  en: {
    status: {
      title: "Status",
      description:
        "Shows whether the numerical calculation found a solution. “Converged” alone does not mean the result correctly represents a real aquifer.",
    },
    iterations: {
      title: "Iterations",
      description: "Number of solver repetitions used until the numerical tolerance was met.",
    },
    "minimum-grid-head": {
      title: "Minimum grid head",
      description:
        "The lowest hydraulic head among all grid cells. Head is water energy expressed as an elevation relative to a reference; it is not necessarily water depth.",
    },
    "maximum-head": {
      title: "Maximum head",
      description:
        "The highest hydraulic head among all grid cells. Head expresses energy as an elevation relative to a reference, not necessarily depth.",
    },
    "well-a-cell-head": {
      title: "Head in cell A",
      description:
        "Average value calculated in the cell containing well A. It is not exactly the head inside the well.",
    },
    "well-b-cell-head": {
      title: "Head in cell B",
      description:
        "Average value calculated in the cell containing well B. It is not exactly the head inside the well.",
    },
    "well-a-estimated-head": {
      title: "Estimated well A head",
      description: "Peaceman sub-cell approximation of head inside ideal well A.",
    },
    "well-b-estimated-head": {
      title: "Estimated well B head",
      description: "Peaceman sub-cell approximation of head inside ideal well B.",
    },
    "maximum-darcy-flux": {
      title: "Maximum Darcy flux",
      description:
        "Largest flow per unit area calculated with Darcy's law. It is not the actual travel velocity of water between pores.",
    },
    "maximum-grid-drawdown": {
      title: "Maximum grid drawdown",
      description: "Largest head decrease relative to the same scenario without pumping, calculated in grid cells.",
    },
    "well-a-cell-drawdown": {
      title: "Drawdown in cell A",
      description: "Decrease calculated in the cell containing well A relative to the same scenario without pumping.",
    },
    "well-b-cell-drawdown": {
      title: "Drawdown in cell B",
      description: "Decrease calculated in the cell containing well B relative to the same scenario without pumping.",
    },
    "well-a-estimated-drawdown": {
      title: "Estimated well A drawdown",
      description: "Approximate decline inside ideal well A using the Peaceman sub-cell correction.",
    },
    "well-b-estimated-drawdown": {
      title: "Estimated well B drawdown",
      description: "Approximate decline inside ideal well B using the Peaceman sub-cell correction.",
    },
    peaceman: {
      title: "Peaceman estimate",
      description:
        "Mathematical correction for a well much smaller than a cell. It assumes a fully penetrating well and excludes screen and skin losses.",
    },
    "confined-validity": {
      title: "Confined-model validity",
      description:
        "Checks whether heads remain above the aquifer top. It checks the confined-model assumption, not whether a real aquifer is valid.",
    },
    "well-a-pumping": {
      title: "Well A pumping",
      description: "Extraction rate from well A in litres per second.",
    },
    "well-b-pumping": {
      title: "Well B pumping",
      description: "Extraction rate from well B in litres per second.",
    },
    "well-radius": {
      title: "Well radius",
      description: "Idealized internal radius used by the well correction.",
    },
    "geological-cut": {
      title: "Geological cut",
      description: "Clips only the 3D visualization. It does not modify the calculation.",
    },
    "hydraulic-conductivity": {
      title: "Hydraulic conductivity K",
      description:
        "How easily the material allows water to flow. The educational scenario uses 1×10⁻⁴ m/s; it is not a universal value.",
    },
    recharge: {
      title: "Recharge",
      description: "Water entering the aquifer from the surface, expressed in millimetres per year.",
    },
    "mesh-resolution": {
      title: "Mesh resolution",
      description:
        "Division of the domain into numerical cells. More cells can improve resolution, but increase computation and do not guarantee better physical accuracy.",
    },
    "aquifer-thickness": {
      title: "Aquifer thickness",
      description: "Idealized saturated thickness of the confined aquifer.",
    },
    "river-head": {
      title: "River head",
      description: "Fixed hydraulic head imposed on the model's western boundary.",
    },
    "maximum-iterations": {
      title: "Maximum iterations",
      description: "Maximum number of repetitions before a non-converging calculation stops.",
    },
    "solver-tolerance": {
      title: "Tolerance",
      description:
        "Largest accepted change between iterations for the numerical solution to be considered stable.",
    },
    "darcy-arrows": {
      title: "Darcy arrows",
      description:
        "Show direction and relative magnitude of Darcy flux; they do not represent interstitial velocity or travel time.",
    },
    "qualitative-flow-lines": {
      title: "Flow lines",
      description:
        "Show qualitative paths of the Darcy field. Without effective porosity, they do not provide interstitial velocity or real travel time.",
    },
  },
};

export const QUICK_GUIDE: Record<Language, readonly QuickGuideSection[]> = {
  es: [
    {
      title: "Qué es AquiferLab",
      description:
        "Es un modelo educativo 2D, estacionario, confinado, homogéneo, isotrópico y de espesor constante. No representa automáticamente la geología de un lugar.",
    },
    {
      title: "Cómo probar un escenario",
      description:
        "Mueva los bombeos entre 0 y 50 L/s y observe las cargas y abatimientos. Son valores para explorar este ejemplo, no caudales seguros.",
    },
    {
      title: "Cómo interpretar los colores y líneas",
      description:
        "Los colores muestran el abatimiento respecto al mismo escenario sin bombeo. Las flechas y líneas muestran el campo de Darcy de forma cualitativa; no proporcionan tiempos de viaje.",
    },
    {
      title: "Qué significa “Convergió”",
      description:
        "Sólo confirma que el cálculo alcanzó estabilidad numérica según la tolerancia. No confirma que el escenario sea físicamente aplicable a un acuífero real.",
    },
    {
      title: "Acuífero transmisivo de ejemplo",
      description:
        "Este escenario educativo no representa un lugar real ni determina caudales seguros. Este ejemplo usa K=1×10⁻⁴ m/s y espesor=20 m. El río es un límite de carga fija y las otras fronteras son de no flujo.",
      featured: true,
    },
    {
      title: "Diferencia entre celda y pozo",
      description:
        "La celda resume un valor medio de la malla. La estimación dentro del pozo usa Peaceman para aproximar un pozo ideal más pequeño que una celda.",
    },
    {
      title: "Cuándo aparece una advertencia",
      description:
        "Aparece cuando una estimación de pozo o una celda cae bajo el techo del acuífero y deja de cumplirse el supuesto confinado.",
    },
    {
      title: "Qué no puede concluirse",
      description:
        "No use este ejemplo para decidir perforación, bombeo, permisos, inversión ni afectación real entre pozos y ríos. No sustituye datos de campo, geología local ni un estudio hidrogeológico.",
    },
  ],
  en: [
    {
      title: "What AquiferLab is",
      description:
        "It is an educational 2D, steady-state, confined, homogeneous, isotropic model with constant thickness. It does not automatically represent the geology of a location.",
    },
    {
      title: "How to try a scenario",
      description:
        "Move pumping between 0 and 50 L/s and observe heads and drawdowns. These are values for exploring this example, not safe pumping rates.",
    },
    {
      title: "How to read colours and lines",
      description:
        "Colours show drawdown relative to the same scenario without pumping. Arrows and lines show the Darcy field qualitatively; they do not provide travel times.",
    },
    {
      title: "What “Converged” means",
      description:
        "It only confirms that the calculation reached numerical stability according to the tolerance. It does not confirm that the scenario applies physically to a real aquifer.",
    },
    {
      title: "Example high-transmissivity aquifer",
      description:
        "This educational scenario does not represent a real location or determine safe pumping rates. This example uses K=1×10⁻⁴ m/s and thickness=20 m. The river is a fixed-head boundary and the other boundaries are no-flow.",
      featured: true,
    },
    {
      title: "Difference between cell and well",
      description:
        "A cell summarizes an average grid value. The in-well estimate uses Peaceman to approximate an ideal well smaller than a cell.",
    },
    {
      title: "When a warning appears",
      description:
        "A warning appears when a well estimate or grid cell falls below the aquifer top and the confined assumption no longer holds.",
    },
    {
      title: "What cannot be concluded",
      description:
        "Do not use this example to decide drilling, pumping, permits, investment, or real effects between wells and rivers. It does not replace field data, local geology, or a hydrogeological study.",
    },
  ],
};

export function getHelpEntry(language: Language, key: HelpKey): HelpEntry {
  return HELP_CATALOG[language][key];
}

export function getQuickGuide(language: Language): readonly QuickGuideSection[] {
  return QUICK_GUIDE[language];
}
