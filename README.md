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

## Comandos

```bash
npm install
npm run dev
npm run build
npm test
npm run typecheck
```
