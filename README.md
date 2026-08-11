# AQUIFER LAB

Motor científico mínimo para flujo subterráneo estacionario 2D en un acuífero
confinado, homogéneo e isotrópico. Esta etapa no incluye visualización 3D.

## Modelo

El solver resuelve `∇ · (T ∇h) + R - Q = 0`, con `T = K × b`, mediante
Gauss-Seidel determinista sobre una malla regular de 41 × 41 celdas para el
dominio predeterminado de 2 000 m × 2 000 m. Un río se representa con celdas
de carga fija; los demás bordes son de no flujo. Se admiten hasta dos pozos de
extracción.

Las unidades internas son m y día: K en m/día, T en m²/día, recarga en m/día,
bombeo en m³/día y carga hidráulica en m. El módulo expone conversiones de
m/s, mm/año y L/s a esas unidades internas.

Hipótesis: acuífero confinado homogéneo e isotrópico, espesor constante y
régimen estacionario. No es MODFLOW ni un modelo de acuífero libre.

## Comandos

```bash
npm install
npm test
npx tsc --noEmit
```
