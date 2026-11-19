import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { RuntimeConfig } from '../../core/runtime-config';
import proposal from '../../../../../services/shared/plans.json';
import { MoneyPipe } from '../../data/money';

@Component({
  imports: [RouterLink, MoneyPipe],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly auth = inject(Auth);
  protected readonly config = inject(RuntimeConfig);
  protected readonly proposal = proposal;
  protected readonly plans = proposal.plans;
  protected readonly faqs = [
    { question: '¿Qué pasa con una propuesta si después cambio mis precios?', answer: 'Publicas una nueva versión del catálogo. La propuesta guardada conserva los importes, la moneda, las opciones y las reglas con los que se emitió.' },
    { question: '¿Puedo empezar sin tener listo todo mi catálogo?', answer: 'Sí. Puedes crear tu cuenta y publicar un catálogo sintético para recorrer el flujo. Después adapta los productos y las reglas de tu catálogo antes de usarlo comercialmente.' },
    { question: '¿Qué puedo hacer hoy?', answer: 'Publicar versiones mediante un documento de catálogo, configurar productos y cantidades, revisar descuentos o recargos, guardar una propuesta y volver a consultarla. También puedes invitar a tu equipo y asignar sus roles. Los datos se separan por organización.' },
    { question: '¿Cómo invito a otra persona?', answer: 'Un administrador crea una invitación para un correo y un rol, y comparte el enlace directamente. La persona inicia sesión con ese correo verificado y acepta. El enlace caduca en siete días; no se envía un correo automático.' },
    { question: '¿Ya se cobran los planes?', answer: 'El piloto continúa sin cargos. Los precios y límites publicados son una propuesta en validación, antes de impuestos; crear una cuenta no contrata una suscripción. La contratación y los cobros en línea aún no están habilitados.' },
    { question: '¿Con qué plan empieza mi espacio?', answer: 'Los espacios nuevos empiezan con Esencial y sus límites operativos. Durante el piloto, los cambios a Equipo o Empresa los coordina la persona que opera el piloto. Pulsar una opción en esta página crea una cuenta; no selecciona ni contrata un plan de pago.' },
    { question: '¿Incluye PDF o conexión con mi CRM?', answer: 'Todavía no. La exportación de documentos y las integraciones se evaluarán en las siguientes etapas. Los planes propuestos no incluyen compromisos de integración, SSO ni niveles de servicio.' },
  ];
}
