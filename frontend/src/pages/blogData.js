export const POSTS = [
  {
    slug: "como-facturar-como-autonomo",
    title: "Cómo facturar como autónomo en España (guía 2026)",
    description: "Aprende a emitir tu primera factura como autónomo: datos obligatorios, IVA, IRPF, numeración y VeriFactu. Guía práctica paso a paso.",
    date: "2026-01-15",
    read: "6 min",
    html: `
<p>Si acabas de darte de alta como autónomo, emitir tu primera factura correctamente es clave para evitar problemas con Hacienda. En esta guía te explicamos, paso a paso, cómo facturar como autónomo en España en 2026.</p>
<h2>1. Datos obligatorios de una factura</h2>
<p>Toda factura debe incluir: número y serie correlativos, fecha de expedición, tus datos y NIF, los datos y NIF del cliente, la descripción de los servicios o productos, la base imponible, el tipo y la cuota de IVA, y el total.</p>
<h2>2. El IVA</h2>
<p>El tipo general es del 21%, con tipos reducidos del 10% y 4% para ciertos bienes y servicios. Repercutes el IVA a tu cliente y lo declaras trimestralmente con el <strong>modelo 303</strong>.</p>
<h2>3. La retención de IRPF</h2>
<p>Si facturas a empresas o a otros autónomos, normalmente debes aplicar una retención de IRPF del 15% (o del 7% durante los tres primeros años de actividad). Esa retención la ingresa tu cliente por ti.</p>
<h2>4. Numeración correlativa</h2>
<p>Las facturas deben numerarse de forma correlativa y sin saltos dentro de cada serie. Un buen programa de facturación te asigna el número automáticamente.</p>
<h2>5. VeriFactu y la ley antifraude</h2>
<p>Con la nueva normativa, tu software de facturación debe generar registros con huella encadenada y código QR (VeriFactu). Con OpenFactura cumples con la AEAT sin esfuerzo.</p>
<h2>Conclusión</h2>
<p>Facturar como autónomo es sencillo si usas una herramienta que calcula el IVA y el IRPF por ti y cumple con VeriFactu. <strong>Prueba OpenFactura gratis 14 días</strong> y emite tu primera factura en minutos.</p>
`,
  },
  {
    slug: "verifactu-explicado",
    title: "VeriFactu explicado: qué es y cómo afecta a tu facturación",
    description: "Qué es VeriFactu, la ley antifraude de la AEAT, plazos y cómo adaptar tu facturación con huella encadenada, QR y certificado digital.",
    date: "2026-02-03",
    read: "5 min",
    html: `
<p>VeriFactu es el sistema de la Agencia Tributaria para garantizar la integridad de las facturas emitidas por autónomos y empresas, dentro de la conocida como "ley antifraude". Te explicamos qué es y cómo cumplir.</p>
<h2>¿Qué es VeriFactu?</h2>
<p>Es un estándar que obliga a que el software de facturación genere, por cada factura, un <strong>registro de facturación</strong> con una <strong>huella (hash) encadenada</strong> con la factura anterior, un <strong>código QR</strong> y, opcionalmente, el envío en tiempo real a la AEAT.</p>
<h2>¿A quién afecta?</h2>
<p>A autónomos y empresas que emitan facturas con programas informáticos. El objetivo es impedir la manipulación o el borrado de facturas ya emitidas.</p>
<h2>¿Qué debe hacer tu software?</h2>
<ul>
<li>Encadenar cada factura con la huella de la anterior.</li>
<li>Incluir un código QR verificable en el PDF.</li>
<li>Firmar los registros (por ejemplo, con tu certificado digital .pfx).</li>
<li>Permitir el envío del registro a la sede de la AEAT.</li>
</ul>
<h2>Cómo cumplir sin complicarte</h2>
<p>OpenFactura genera automáticamente la huella encadenada, el QR y firma los registros con tu certificado, y los envía a la AEAT. Es un <strong>software compatible con VeriFactu</strong> listo para usar.</p>
`,
  },
  {
    slug: "iva-irpf-autonomos-modelos-303-130",
    title: "IVA e IRPF para autónomos: modelos 303 y 130 sin líos",
    description: "Cómo funcionan el IVA (modelo 303) y el IRPF (modelo 130) para autónomos, qué se declara cada trimestre y cómo automatizarlo.",
    date: "2026-02-20",
    read: "6 min",
    html: `
<p>El IVA y el IRPF son las dos obligaciones trimestrales más importantes para un autónomo. Aquí te explicamos los modelos 303 y 130 de forma sencilla.</p>
<h2>Modelo 303 (IVA)</h2>
<p>Cada trimestre declaras el IVA repercutido (el que cobras a tus clientes) menos el IVA soportado (el de tus gastos deducibles). La diferencia es lo que ingresas o te sale a compensar.</p>
<h2>Modelo 130 (IRPF)</h2>
<p>Es el pago fraccionado del IRPF: ingresas un 20% del rendimiento neto (ingresos menos gastos) acumulado del año, descontando lo ya pagado en trimestres anteriores.</p>
<h2>Resumen anual (modelo 390)</h2>
<p>Al cierre del año se presenta el resumen anual del IVA. Un buen programa lo prepara con los datos ya introducidos.</p>
<h2>Automatízalo</h2>
<p>Con OpenFactura, tus modelos 303, 130 y 390 se calculan solos a medida que facturas y registras gastos. Menos errores y cero hojas de cálculo. <strong>Pruébalo gratis.</strong></p>
`,
  },
];

export const getPost = (slug) => POSTS.find((p) => p.slug === slug);
