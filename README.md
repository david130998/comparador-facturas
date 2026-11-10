# Comparador de facturas de luz y gas

**Web:** https://david130998.github.io/comparador-facturas/

Web gratuita (GitHub Pages) para:

1. Subir una factura de luz o gas en PDF (se lee en el navegador, no se envía a ningún sitio).
2. Revisar los datos que se han sacado del PDF (días, kWh, potencia, importe).
3. Comparar lo que pagarías con otras ofertas guardadas en `ofertas.json`.
4. Generar un mensaje para pedir a tu compañía que iguale la oferta más barata.

## Actualizar las ofertas

Edita `ofertas.json`. Mira precios en el comparador de la CNMC: https://comparador.cnmc.gob.es/

Oferta de luz:

```json
{
  "compania": "Nombre",
  "nombre": "Nombre de la tarifa",
  "energia": { "punta": 0.15, "llano": 0.12, "valle": 0.09 },
  "potencia_kw_anio": { "punta": 30.0, "valle": 25.0 },
  "nota": "Opcional",
  "web": "https://..."
}
```

Si la tarifa da la potencia en €/kW/día, multiplica por 365.

Oferta de gas:

```json
{
  "compania": "Nombre",
  "nombre": "Nombre de la tarifa",
  "fijo_dia": { "RL1": 0.20, "RL2": 0.35, "RL3": 0.70 },
  "energia_kwh": 0.07,
  "web": "https://..."
}
```

## Limitaciones

- Los PDF escaneados (imagen) no tienen texto: hay que rellenar los datos a mano.
- Cada compañía hace la factura distinta; revisa siempre los datos del paso 2.
- El cálculo es aproximado: incluye IVA, impuesto eléctrico, bono social y alquiler de contador, pero no descuentos promocionales.
