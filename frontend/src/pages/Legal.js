import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Seo } from "@/components/Seo";

function LegalShell({ title, path, description, children }) {
  return (
    <div className="min-h-screen bg-white">
      <Seo path={path} title={title} description={description} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#0052FF] mb-6"><ArrowLeft className="w-4 h-4" strokeWidth={2} /> Volver</Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-8">Última actualización: {new Date().toLocaleDateString("es-ES")}</p>
        <div className="prose prose-slate max-w-none text-slate-600 space-y-4 text-[15px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <LegalShell title="Términos y condiciones" path="/terminos" description="Términos y condiciones de uso de OpenFactura.es, el software de facturación para autónomos y pymes en España.">
      <p>Bienvenido a OpenFactura.es. Al crear una cuenta y utilizar la plataforma aceptas estos términos.</p>
      <h3 className="font-semibold text-slate-900">1. Servicio</h3>
      <p>OpenFactura.es es una herramienta de facturación y gestión fiscal para autónomos y empresas en España. Ofrecemos emisión de facturas, cálculo de IVA e IRPF, registro VeriFactu y funciones de IA de apoyo. No prestamos asesoramiento fiscal vinculante; la responsabilidad final de las declaraciones recae en el usuario.</p>
      <h3 className="font-semibold text-slate-900">2. Cuenta y prueba gratuita</h3>
      <p>Dispones de 14 días de prueba gratuita con todas las funciones. Transcurrido ese plazo podrás contratar un plan de pago (mensual o anual). Eres responsable de la veracidad de los datos y de la custodia de tus credenciales.</p>
      <h3 className="font-semibold text-slate-900">3. Pagos y suscripciones</h3>
      <p>Los pagos se procesan mediante Stripe. Las suscripciones se renuevan automáticamente al finalizar cada periodo hasta que las canceles desde tu panel. No se realizan reembolsos por periodos ya iniciados salvo obligación legal.</p>
      <h3 className="font-semibold text-slate-900">4. Uso aceptable</h3>
      <p>Te comprometes a no usar la plataforma para fines ilícitos ni a emitir facturas falsas. Podremos suspender cuentas que incumplan estos términos.</p>
      <h3 className="font-semibold text-slate-900">5. Disponibilidad y responsabilidad</h3>
      <p>Trabajamos para ofrecer un servicio continuo, pero no garantizamos disponibilidad ininterrumpida. En la medida permitida por la ley, nuestra responsabilidad se limita al importe abonado en los últimos 12 meses.</p>
      <h3 className="font-semibold text-slate-900">6. Cambios</h3>
      <p>Podemos actualizar estos términos notificándolo con antelación razonable. El uso continuado implica su aceptación.</p>
      <h3 className="font-semibold text-slate-900">7. Contacto</h3>
      <p>Para cualquier consulta: soporte@openfactura.es</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Política de privacidad" path="/privacidad" description="Política de privacidad de OpenFactura.es. Tratamos tus datos conforme al RGPD y la LOPDGDD.">
      <p>En OpenFactura.es tratamos tus datos conforme al RGPD y a la LOPDGDD.</p>
      <h3 className="font-semibold text-slate-900">1. Responsable</h3>
      <p>OpenFactura.es. Contacto de privacidad: privacy@openfactura.es</p>
      <h3 className="font-semibold text-slate-900">2. Datos que tratamos</h3>
      <p>Datos de registro (nombre, email), datos fiscales de tu empresa y clientes, facturas, gastos y datos de pago gestionados por Stripe. No almacenamos los datos completos de tu tarjeta.</p>
      <h3 className="font-semibold text-slate-900">3. Finalidad</h3>
      <p>Prestar el servicio de facturación, calcular impuestos, cumplir con VeriFactu (AEAT), gestionar tu suscripción y ofrecerte soporte.</p>
      <h3 className="font-semibold text-slate-900">4. Base legal</h3>
      <p>Ejecución del contrato, cumplimiento de obligaciones legales (fiscales) y tu consentimiento para comunicaciones.</p>
      <h3 className="font-semibold text-slate-900">5. Conservación</h3>
      <p>Conservamos los datos fiscales durante los plazos exigidos por la normativa tributaria (habitualmente 4-6 años).</p>
      <h3 className="font-semibold text-slate-900">6. Tus derechos</h3>
      <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición y portabilidad escribiendo a privacy@openfactura.es.</p>
      <h3 className="font-semibold text-slate-900">7. Encargados de tratamiento</h3>
      <p>Utilizamos proveedores como Stripe (pagos) y servicios de IA para funciones de asistencia, con las garantías adecuadas.</p>
    </LegalShell>
  );
}
