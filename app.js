// Comparador de facturas de luz y gas
// Todo se hace en el navegador: el PDF no sale de tu equipo.

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ---- Impuestos y costes regulados (revisar si cambian) ----
const IVA = 0.21;                         // IVA luz y gas
const IMPUESTO_ELECTRICO = 0.0511269632;  // 5,11 % sobre potencia + energía
const BONO_SOCIAL_ANIO = 9.011295;        // € por contrato y año (desde 01/07/2026)
const CONTADOR_LUZ_MES = 0.81;            // alquiler contador luz habitual
const IMPUESTO_HIDROCARBUROS = 0.00234;   // €/kWh gas
const CONTADOR_GAS_MES = { RL1: 0.66, RL2: 0.66, RL3: 1.43 }; // aproximado
const REPARTO_TIPICO = { punta: 0.30, llano: 0.25, valle: 0.45 };

const COMPANIAS = [
  'Iberdrola', 'Endesa', 'Naturgy', 'Repsol', 'TotalEnergies', 'EDP', 'Holaluz',
  'Octopus', 'Factor Energía', 'Lucera', 'Som Energia', 'Chc Energía', 'Nufri',
  'Niba', 'Audax', 'Podo', 'Energía XXI', 'Curenergía', 'Comercializadora Regulada',
  'Baser', 'Plenitude', 'Visalia', 'Imagina Energía', 'Aldro', 'Gana Energía'
];

let ofertas = { luz: [], gas: [] };
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
function numero(txt) {
  // Convierte "1.234,56" o "1234.56" en 1234.56
  if (txt == null) return null;
  let s = String(txt).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
const euros = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const val = (id) => numero($(id).value);
function poner(id, v) { if (v != null && !isNaN(v)) $(id).value = Math.round(v * 100) / 100; }

// ---------- Cargar ofertas ----------
fetch('ofertas.json')
  .then((r) => r.json())
  .then((d) => { ofertas = d; pintarOfertas(); })
  .catch(() => { $('listaOfertas').textContent = 'No se ha podido cargar ofertas.json.'; });

function pintarOfertas() {
  const cont = $('listaOfertas');
  let html = `<p class="nota">Precios del ${ofertas.actualizado || '?'} · ${ofertas.fuente || ''}</p>`;
  for (const tipo of ['luz', 'gas']) {
    const lista = ofertas[tipo] || [];
    html += `<h3>${tipo === 'luz' ? '💡 Luz' : '🔥 Gas'}</h3>`;
    if (!lista.length) { html += '<p class="nota">Aún no hay ofertas. Añádelas en ofertas.json.</p>'; continue; }
    html += '<ul>' + lista.map((o) =>
      `<li><b>${o.compania}</b> · ${o.nombre}${o.nota ? ' · <span class="nota">' + o.nota + '</span>' : ''}
       ${o.web ? ` · <a href="${o.web}" target="_blank" rel="noopener">web</a>` : ''}</li>`).join('') + '</ul>';
  }
  cont.innerHTML = html;
}

// ---------- Tipo luz / gas ----------
function mostrarTipo() {
  const gas = $('tipo').value === 'gas';
  document.querySelectorAll('.solo-luz').forEach((e) => (e.hidden = gas));
  document.querySelectorAll('.solo-gas').forEach((e) => (e.hidden = !gas));
}
$('tipo').addEventListener('change', mostrarTipo);

// ---------- Leer el PDF ----------
$('pdf').addEventListener('change', async (ev) => {
  const archivo = ev.target.files[0];
  if (!archivo) return;
  $('estadoPdf').textContent = 'Leyendo PDF…';
  try {
    const buf = await archivo.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const pag = await pdf.getPage(i);
      const c = await pag.getTextContent();
      texto += c.items.map((it) => it.str).join(' ') + '\n';
    }
    texto = texto.replace(/\s+/g, ' ');
    $('textoPdf').textContent = texto;
    if (texto.trim().length < 50) {
      $('estadoPdf').textContent = 'El PDF parece una imagen escaneada y no tiene texto. Rellena los datos a mano.';
      return;
    }
    const n = extraerDatos(texto);
    $('estadoPdf').textContent = `Listo: he encontrado ${n} dato(s). Revísalos abajo.`;
  } catch (e) {
    $('estadoPdf').textContent = 'No se ha podido leer el PDF: ' + e.message;
  }
});

function buscar(texto, regexes) {
  for (const re of regexes) {
    const m = texto.match(re);
    if (m) return numero(m[1]);
  }
  return null;
}

function extraerDatos(t) {
  let encontrados = 0;
  const NUM = '(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';

  // Tipo
  const esGas = /gas natural|RL\.?\s?[123]\b|t[ée]rmino fijo/i.test(t) && !/potencia contratada/i.test(t);
  $('tipo').value = esGas ? 'gas' : 'luz';
  mostrarTipo();

  // Compañía
  const comp = COMPANIAS.find((c) => new RegExp(c.replace(/ /g, '\\s*'), 'i').test(t));
  if (comp) { $('compania').value = comp; encontrados++; }

  // Días
  const dias = buscar(t, [
    /(\d{1,3})\s*d[ií]as/i,
  ]);
  if (dias && dias > 0 && dias < 400) { poner('dias', dias); encontrados++; }

  // Importe total
  const total = buscar(t, [
    new RegExp('total\\s*a\\s*pagar[^0-9]{0,40}' + NUM + '\\s*€', 'i'),
    new RegExp('importe\\s*total[^0-9]{0,40}' + NUM + '\\s*€', 'i'),
    new RegExp('total\\s*(?:de\\s*la\\s*)?factura[^0-9]{0,40}' + NUM + '\\s*€', 'i'),
    new RegExp('total\\s*importe[^0-9]{0,40}' + NUM + '\\s*€', 'i'),
  ]);
  if (total) { poner('total', total); encontrados++; }

  // Consumo total
  const kwh = buscar(t, [
    new RegExp('consumo\\s*(?:total|del\\s*periodo|en\\s*este\\s*periodo|facturado)?[^0-9]{0,40}' + NUM + '\\s*kWh', 'i'),
    new RegExp('energ[ií]a\\s*consumida[^0-9]{0,40}' + NUM + '\\s*kWh', 'i'),
  ]);
  if (kwh) { poner('kwh', kwh); encontrados++; }

  if (!esGas) {
    const pot = buscar(t, [
      new RegExp('potencia\\s*contratada[^0-9]{0,60}' + NUM + '\\s*kW(?!h)', 'i'),
      new RegExp('potencia[^0-9]{0,30}(?:P1|punta)?[^0-9]{0,10}' + NUM + '\\s*kW(?!h)', 'i'),
    ]);
    if (pot && pot < 15) { poner('potencia', pot); encontrados++; }

    for (const p of ['punta', 'llano', 'valle']) {
      const v = buscar(t, [new RegExp(p + '[^0-9]{0,30}' + NUM + '\\s*kWh', 'i')]);
      if (v != null) { poner(p, v); encontrados++; }
    }
    // Si no hay total pero sí tramos, súmalos
    if (!val('kwh') && val('punta') != null) {
      poner('kwh', (val('punta') || 0) + (val('llano') || 0) + (val('valle') || 0));
    }
  } else {
    const rl = t.match(/RL\.?\s?([123])\b/i);
    if (rl) { $('rl').value = 'RL' + rl[1]; encontrados++; }
  }
  return encontrados;
}

// ---------- Cálculos ----------
function costeLuz(o, d) {
  const dias = d.dias;
  const potencia = d.potencia * (o.potencia_kw_anio.punta + o.potencia_kw_anio.valle) / 365 * dias;
  const energia = d.punta * o.energia.punta + d.llano * o.energia.llano + d.valle * o.energia.valle;
  const bono = BONO_SOCIAL_ANIO / 365 * dias;
  const ie = (potencia + energia + bono) * IMPUESTO_ELECTRICO;
  const contador = CONTADOR_LUZ_MES * 12 / 365 * dias;
  return (potencia + energia + bono + ie + contador) * (1 + IVA);
}

function costeGas(o, d) {
  const dias = d.dias;
  const fijo = (o.fijo_dia[d.rl] ?? o.fijo_dia.RL1) * dias;
  const energia = d.kwh * o.energia_kwh;
  const ih = d.kwh * IMPUESTO_HIDROCARBUROS;
  const contador = (CONTADOR_GAS_MES[d.rl] || 0.66) * 12 / 365 * dias;
  return (fijo + energia + ih + contador) * (1 + IVA);
}

$('comparar').addEventListener('click', () => {
  const tipo = $('tipo').value;
  const d = {
    dias: val('dias'), kwh: val('kwh'), total: val('total'),
    potencia: val('potencia'), rl: $('rl').value,
    punta: val('punta'), llano: val('llano'), valle: val('valle'),
  };
  const faltan = [];
  if (!d.dias) faltan.push('días');
  if (!d.total) faltan.push('importe total');
  if (tipo === 'luz' && !d.potencia) faltan.push('potencia');
  if (tipo === 'luz' && !d.kwh && d.punta == null) faltan.push('consumo');
  if (tipo === 'gas' && !d.kwh) faltan.push('consumo');
  if (faltan.length) { alert('Faltan datos: ' + faltan.join(', ')); return; }

  let estimado = false;
  if (tipo === 'luz') {
    if (d.punta == null && d.llano == null && d.valle == null) {
      d.punta = d.kwh * REPARTO_TIPICO.punta;
      d.llano = d.kwh * REPARTO_TIPICO.llano;
      d.valle = d.kwh * REPARTO_TIPICO.valle;
      estimado = true;
    } else {
      d.punta = d.punta || 0; d.llano = d.llano || 0; d.valle = d.valle || 0;
    }
  }

  const lista = ofertas[tipo] || [];
  if (!lista.length) {
    alert('Todavía no hay ofertas de ' + tipo + ' en ofertas.json.');
    return;
  }

  const factorAnio = 365 / d.dias;
  const actualAnio = d.total * factorAnio;
  const filas = lista.map((o) => {
    const coste = tipo === 'luz' ? costeLuz(o, d) : costeGas(o, d);
    return { o, coste, anio: coste * factorAnio, ahorro: actualAnio - coste * factorAnio };
  }).sort((a, b) => a.coste - b.coste);

  const mejor = filas[0];
  $('resumen').innerHTML = `
    <p>Tu factura actual (${$('compania').value || 'tu compañía'}): <b>${euros(d.total)}</b> en ${d.dias} días,
       unos <b>${euros(actualAnio)}</b> al año.</p>
    ${mejor.ahorro > 0
      ? `<p class="bien">Con <b>${mejor.o.compania} · ${mejor.o.nombre}</b> pagarías unos <b>${euros(mejor.coste)}</b>.
         Ahorro estimado: <b>${euros(mejor.ahorro)} al año</b>.</p>`
      : `<p class="bien">Tu tarifa ya es más barata que las ofertas guardadas. 👍</p>`}
    ${estimado ? '<p class="nota">Consumo por tramos estimado (no venía en la factura).</p>' : ''}`;

  $('tabla').innerHTML = filas.map((f) => `
    <tr>
      <td><b>${f.o.compania}</b><br><span class="nota">${f.o.nombre}</span></td>
      <td>${euros(f.coste)}</td>
      <td>${euros(f.anio)}</td>
      <td class="${f.ahorro > 0 ? 'bien' : 'mal'}">${euros(f.ahorro)}</td>
    </tr>`).join('');
  $('avisoOfertas').textContent =
    'Cálculo aproximado con impuestos incluidos y sin descuentos promocionales. Comprueba la permanencia antes de cambiarte.';
  $('resultado').hidden = false;

  if (mejor.ahorro > 0) {
    $('mensaje').value = mensajeMejora(d, tipo, mejor, actualAnio);
    $('mejora').hidden = false;
  } else {
    $('mejora').hidden = true;
  }
  $('resultado').scrollIntoView({ behavior: 'smooth' });
});

function mensajeMejora(d, tipo, mejor, actualAnio) {
  const compania = $('compania').value || 'mi compañía';
  return `Hola,

Soy cliente de ${compania} con un contrato de ${tipo === 'luz' ? 'luz' : 'gas'}.

He comparado mi última factura (${euros(d.total)} por ${d.dias} días${tipo === 'luz' ? `, ${d.potencia} kW de potencia` : ''} y ${Math.round(d.kwh || (d.punta + d.llano + d.valle))} kWh) con las ofertas del mercado. Con la tarifa "${mejor.o.nombre}" de ${mejor.o.compania} pagaría unos ${euros(mejor.coste)} por el mismo consumo, lo que supone un ahorro de unos ${euros(mejor.ahorro)} al año.

Me gustaría seguir con vosotros, así que os pido que me ofrezcáis una tarifa que iguale o mejore ese precio. Si no es posible, tramitaré el cambio de compañía.

¿Me podéis decir qué podéis ofrecerme?

Gracias.`;
}

$('copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('mensaje').value);
    $('copiar').textContent = '✅ Copiado';
  } catch {
    $('mensaje').select();
    document.execCommand('copy');
    $('copiar').textContent = '✅ Copiado';
  }
  setTimeout(() => ($('copiar').textContent = 'Copiar mensaje'), 2000);
});

mostrarTipo();
