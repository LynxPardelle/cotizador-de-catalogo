import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { RuntimeConfig } from '../../core/runtime-config';

@Component({
  imports: [RouterLink],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly auth = inject(Auth);
  protected readonly config = inject(RuntimeConfig);
  protected readonly plans = [
    { name: 'Esencial', audience: 'Tu primer catálogo, con orden.', description: 'Para un negocio que quiere convertir sus reglas de precio en propuestas consistentes.', features: ['Publicar catálogos versionados', 'Configurar productos y revisar el desglose', 'Guardar y reabrir propuestas'], next: 'Alcance comercial y límites por definir.', primary: true },
    { name: 'Equipo', audience: 'Una misma forma de cotizar.', description: 'Para equipos comerciales que necesitan trabajar con catálogos y criterios compartidos.', features: ['El núcleo de cotización de Esencial', 'Enfoque en varios catálogos', 'Roles de administrador, vendedor y lector'], next: 'Próximo: incorporar y gestionar miembros desde la aplicación.', primary: false },
    { name: 'Empresa', audience: 'Reglas que se ajustan a tu operación.', description: 'Para explorar catálogos más complejos y necesidades particulares de implementación.', features: ['El núcleo de cotización de Equipo', 'Evaluación del catálogo y sus reglas', 'Alcance acordado antes de implementar'], next: 'Por evaluar: integraciones y acompañamiento. Sin compromisos de servicio publicados.', primary: false },
  ];
  protected readonly faqs = [
    { question: '¿Qué pasa con una propuesta si después cambio mis precios?', answer: 'Publicas una nueva versión del catálogo. La propuesta guardada conserva los importes, la moneda, las opciones y las reglas con los que se emitió.' },
    { question: '¿Puedo empezar sin tener listo todo mi catálogo?', answer: 'Sí. Puedes crear tu cuenta y publicar un catálogo sintético para recorrer el flujo. Después adapta los productos y las reglas de tu catálogo antes de usarlo comercialmente.' },
    { question: '¿Qué puedo hacer hoy?', answer: 'Publicar versiones mediante un documento de catálogo, configurar productos y cantidades, revisar descuentos o recargos, guardar una propuesta y volver a consultarla. Los datos se separan por organización.' },
    { question: '¿Ya se cobran los planes?', answer: 'No hay contratación ni cobros en línea habilitados. Los precios, límites y condiciones de los planes están en validación; cualquier oferta comercial se comunicará antes de contratar.' },
    { question: '¿Incluye PDF, invitaciones o conexión con mi CRM?', answer: 'Todavía no. La exportación de documentos, la gestión de miembros y las integraciones se evaluarán en las siguientes etapas. El piloto se concentra en el catálogo y la propuesta reproducible.' },
  ];
}
