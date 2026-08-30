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
      <p>Bienvenido a OpenFactura.es. Al crear una cuenta y utilizar la plataforma aceptas estos términos y condiciones.</p>
      <h3 className="font-semibold text-slate-900">1. Identificación</h3>
      <p>OpenFactura.es es un servicio operado por GoRoky (en adelante, "OpenFactura"). Web: https://openfactura.es. Contacto: soporte@goroky.com.</p>
      <h3 className="font-semibold text-slate-900">2. Servicio</h3>
      <p>OpenFactura es una herramienta de facturación y gestión fiscal para autónomos y empresas en España. Ofrecemos emisión de facturas y presupuestos, gestión multiempresa, cálculo de IVA e IRPF, facturación intracomunitaria, registro VeriFactu y funciones de IA de apoyo. No prestamos asesoramiento fiscal vinculante; la responsabilidad final de las declaraciones y del cumplimiento normativo recae en el usuario.</p>
      <h3 className="font-semibold text-slate-900">3. Cuenta y prueba gratuita</h3>
      <p>Dispones de 14 días de prueba gratuita con todas las funciones. Transcurrido ese plazo podrás contratar un plan de pago (mensual o anual). Eres responsable de la veracidad de los datos introducidos y de la custodia de tus credenciales y certificados digitales.</p>
      <h3 className="font-semibold text-slate-900">4. Planes y pagos</h3>
      <p>Ofrecemos los planes Básico, Medio, Platino y Multiempresas (20 o 50 empresas), además de planes a medida. Los pagos se procesan mediante Stripe. Las suscripciones se renuevan automáticamente al finalizar cada periodo hasta que las canceles desde tu panel. No se realizan reembolsos por periodos ya iniciados salvo obligación legal.</p>
      <h3 className="font-semibold text-slate-900">5. Uso aceptable</h3>
      <p>Te comprometes a no usar la plataforma para fines ilícitos ni a emitir facturas falsas. Podremos suspender cuentas que incumplan estos términos o la normativa vigente.</p>
      <h3 className="font-semibold text-slate-900">6. Disponibilidad y responsabilidad</h3>
      <p>Trabajamos para ofrecer un servicio continuo, pero no garantizamos disponibilidad ininterrumpida. En la medida permitida por la ley, nuestra responsabilidad se limita al importe abonado en los últimos 12 meses.</p>
      <h3 className="font-semibold text-slate-900">7. Propiedad intelectual</h3>
      <p>El software, la marca y los contenidos de OpenFactura son propiedad de GoRoky. Los datos y documentos que generes son de tu propiedad y puedes exportarlos en cualquier momento.</p>
      <h3 className="font-semibold text-slate-900">8. Cambios</h3>
      <p>Podemos actualizar estos términos notificándolo con antelación razonable. El uso continuado implica su aceptación.</p>
      <h3 className="font-semibold text-slate-900">9. Ley aplicable</h3>
      <p>Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa de consumidores y usuarios.</p>
      <h3 className="font-semibold text-slate-900">10. Contacto</h3>
      <p>Para cualquier consulta: soporte@goroky.com</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Política de privacidad" path="/privacidad" description="Política de privacidad de OpenFactura.es. Tratamos tus datos conforme al RGPD y la LOPDGDD.">
      <p>En OpenFactura.es tratamos tus datos conforme al Reglamento (UE) 2016/679 (RGPD) y a la LOPDGDD.</p>
      <h3 className="font-semibold text-slate-900">1. Responsable del tratamiento</h3>
      <p>OpenFactura.es (operado por GoRoky). Contacto de privacidad: soporte@goroky.com.</p>
      <h3 className="font-semibold text-slate-900">2. Datos que tratamos</h3>
      <p>Datos de registro (nombre, email), datos fiscales de tus empresas, autónomos y clientes, facturas, presupuestos, gastos, certificados digitales (cifrados) y datos de pago gestionados por Stripe. No almacenamos los datos completos de tu tarjeta.</p>
      <h3 className="font-semibold text-slate-900">3. Finalidad</h3>
      <p>Prestar el servicio de facturación y presupuestos, gestionar varias empresas, calcular impuestos, cumplir con VeriFactu (AEAT), gestionar tu suscripción y ofrecerte soporte.</p>
      <h3 className="font-semibold text-slate-900">4. Base legal</h3>
      <p>Ejecución del contrato, cumplimiento de obligaciones legales (fiscales) e interés legítimo/consentimiento para comunicaciones.</p>
      <h3 className="font-semibold text-slate-900">5. Conservación</h3>
      <p>Conservamos los datos fiscales durante los plazos exigidos por la normativa tributaria (habitualmente 4-6 años) y el resto mientras tu cuenta esté activa.</p>
      <h3 className="font-semibold text-slate-900">6. Tus derechos</h3>
      <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a soporte@goroky.com. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
      <h3 className="font-semibold text-slate-900">7. Encargados de tratamiento</h3>
      <p>Utilizamos proveedores como Stripe (pagos), Resend (email) y servicios de IA para funciones de asistencia, con las garantías y acuerdos de tratamiento adecuados.</p>
      <h3 className="font-semibold text-slate-900">8. Seguridad</h3>
      <p>Aplicamos medidas técnicas y organizativas para proteger tus datos, incluido el cifrado de certificados y credenciales sensibles.</p>
    </LegalShell>
  );
}
