# AQUIFER LAB

Aplicación web 3D mínima para un acuífero confinado, homogéneo e isotrópico,
con un motor científico estacionario 2D y una visualización Three.js de su
superficie piezométrica.

## Modelo

El solver resuelve `∇ · (T ∇h) + R - Q = 0`, con `T = K × b`, mediante
Gauss-Seidel determinista sobre una malla regular de 41 × 41 celdas para el
dominio predeterminado de 2 000 m × 2 000 m. Un río se representa con celdas
de carga fija; los demás bordes son de no flujo. Se admiten dos pozos fijos de
extracción.

Las unidades internas son m y día: K en m/día, T en m²/día, recarga en m/día,
bombeo en m³/día y carga hidráulica en m. El módulo expone conversiones de
m/s, mm/año y L/s a esas unidades internas.

Hipótesis: acuífero confinado homogéneo e isotrópico, espesor constante y
régimen estacionario. No es MODFLOW ni un modelo de acuífero libre.

## Escena 3D

La escena representa el bloque de 2 000 m × 2 000 m, el río del borde de
carga fija y dos pozos de posición fija. Three.js únicamente transforma el
campo de carga calculado por el motor en una superficie piezométrica; no
resuelve el flujo. Las unidades superior y basal son contexto visual
esquemático: sólo el acuífero confinado participa en el modelo hidráulico.

La escena también superpone un campo horizontal de descarga específica de
Darcy, calculado como `q = -K ∇h` a partir de las cargas del solver. No
representa velocidad intersticial ni trayectorias de partículas; la longitud
de las flechas está normalizada sólo para su visualización.

Además, las líneas de flujo cualitativas se integran independientemente sobre
la dirección normalizada `q / |q|`, con interpolación bilineal entre celdas y
RK4 hacia adelante y atrás desde semillas interiores. Se detienen en el borde,
un río o pozo, flujo prácticamente nulo, repetición o los límites configurados.
Representan la dirección del flujo de Darcy; no representan velocidad
intersticial ni tiempo de viaje. No se calcula porosidad efectiva, transporte,
dispersión ni tiempos de viaje.

El corte geológico interactivo es exclusivamente visual: abre el bloque con
un plano vertical y no modifica el modelo hidráulico ni recalcula el flujo.

La interfaz permite variar K, recarga, espesor hidráulico y carga prescrita
del río. El bloque geológico continúa siendo esquemático y no cambia su escala
vertical al modificar el espesor hidráulico.

La superficie piezométrica conserva su geometría basada en la carga hidráulica
actual y usa color por vértice para mostrar el abatimiento estacionario respecto
del mismo escenario sin bombeo. El color no representa la magnitud de Darcy.

## Estimación dentro del pozo

La carga calculada en la celda que contiene un pozo es una magnitud de malla y
no equivale a la carga física a un radio de pozo concreto. AQUIFER LAB conserva
esa carga de celda y añade por separado una estimación dentro del pozo mediante
la corrección de Peaceman para el modelo isotrópico actual.

El radio equivalente es `re = 0.14 × √(Δx² + Δz²)`, la transmisividad es
`T = K × b` y la pérdida entre celda y pozo se estima como
`Δh = Q/(2πT) × ln(re/rw)`. Por tanto, `h_pozo = h_celda - Δh` y
`s_pozo = s_celda + Δh`. El radio `rw` es un parámetro independiente para cada
pozo y sólo afecta estas métricas: no modifica el solve, la superficie
piezométrica, el campo de Darcy ni el mapa de abatimiento.

La estimación supone un pozo ideal completamente penetrante en un acuífero
confinado, homogéneo e isotrópico. No incluye skin, pérdidas de pantalla, flujo
turbulento, pérdidas en la columna del pozo ni penetración parcial.

## Validez del modelo confinado

La convergencia del solver sólo indica que la ecuación discreta se resolvió con
el criterio numérico configurado. Para que la aproximación de acuífero
completamente confinado sea físicamente válida, la carga debe mantenerse sobre
la cota del techo del acuífero, usando el mismo datum que las cargas hidráulicas.

La interfaz permite introducir esa cota y evalúa la solución sin modificar el
solve. Una carga de celda menor que el techo (con una tolerancia numérica de
`1e-9 m`) o una carga estimada dentro de A o B menor que el techo marca el
resultado como fuera de rango. Se informan las celdas afectadas, el déficit de
malla y las advertencias de pozo por separado: la carga de celda y la estimada
mediante Peaceman no son la misma magnitud.

Cuando `h` cae bajo el techo, `T = K × b` constante deja de representar
correctamente el espesor saturado. AQUIFER LAB conserva las cargas numéricas y
sólo advierte que son una extrapolación del modelo confinado; no limita cargas,
no representa desaturación y no resuelve flujo no confinado o convertible.

## Comandos

```bash
npm install
npm run dev
npm run build
npm test
npm run typecheck
```
