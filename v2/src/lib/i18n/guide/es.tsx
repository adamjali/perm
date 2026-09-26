import { D, En } from "@/components/i18n/guideParts";
import { ENGLISH_GUIDE } from "../locales";
import type { GuideCopy } from "./types";

/**
 * Spanish, written for readers in the US: "usted", USCIS's own Spanish terms
 * where it publishes them (ajuste de estatus, fechas de acción final, fechas
 * para presentar), and "green card" left as the word people actually say.
 */
export const es: GuideCopy = {
  title: "Green card por empleo, paso a paso",
  description:
    "Cómo consultar su caso ante el Departamento de Trabajo, en qué mes va la fila, qué sigue después del PERM y las fechas del boletín de visas para su país.",
  eyebrow: "PERM Tracker en español",
  h1: "Esperando una green card por empleo",
  lede: "Cómo consultar su caso usted mismo, en qué mes va hoy la fila del Departamento de Trabajo (DOL), qué pasos siguen después del PERM y las fechas de corte del boletín de visas para su país. Nada de esto es asesoría legal: su abogado conoce su caso.",
  translationNote: (
    <>
      Esta página es una versión traducida de nuestra <En href={ENGLISH_GUIDE}>guía en inglés</En>. Los números de caso, los nombres de los formularios, las fechas y los términos de estado que usan el DOL y USCIS se dejan en inglés, tal como los publican las agencias, con una explicación al lado. Las páginas de datos a las que enlaza esta guía están en inglés.
    </>
  ),
  onThisPage: "En esta página",
  toc: {
    check: "Consulte su caso",
    queue: "La fila del DOL hoy",
    steps: "Después del PERM",
    "eb3-other-workers": "EB-3 Otros Trabajadores",
    cutoffs: "Fechas para su país",
    statuses: "Términos de estado",
  },
  check: {
    h2: "Consulte su caso usted mismo",
    intro: "El sistema de estado de casos del Departamento de Trabajo (DOL) le responde a cualquier persona que tenga un número de caso, aunque el caso siga pendiente. No necesita cuenta ni contraseña.",
    label: "Número de caso del DOL",
    button: "Consultar",
    formats: (
      <>
        PERM: <D>G-100-26125-868956</D>. Solicitud de salario prevaleciente (PWD): empieza con <D>P-100-</D>. LCA de H-1B: empieza con <D>I-200-</D>.
      </>
    ),
    after: "El resultado se abre en inglés: el término de estado del DOL, la fecha en que el DOL recibió el caso y el nombre del empleador. Más abajo se explica qué significa cada término. En la página del resultado también puede dejar su correo electrónico y recibir un mensaje cada vez que cambie el estado (los correos están en inglés).",
    noNumber: (
      <>
        ¿No tiene el número? Pídaselo a quien presentó su caso: aparece en el recibo. También puede buscar por empleador en la <En href="/case-search">búsqueda de casos</En> (en inglés).
      </>
    ),
  },
  queue: {
    h2: "En qué mes va la fila del DOL",
    permLabel: "El DOL está revisando solicitudes PERM presentadas en",
    averageLabel: "Días promedio hasta una decisión",
    days: (n) => <>{n} días</>,
    pwdLabel: "Solicitudes de salario prevaleciente en trámite, recibidas en",
    asOf: (d) => (
      <>Cifras publicadas por el propio DOL, al {d}. Cambian cuando el DOL las vuelve a publicar, normalmente cada semana.</>
    ),
    missing: (
      <>
        No se pueden leer las cifras del DOL en este momento. Están en la <En href="/perm-queue">página de la fila PERM</En> (en inglés).
      </>
    ),
    meaning: [
      "El DOL revisa las solicitudes PERM más o menos en el orden en que las recibió, mes por mes. Si su caso se presentó en el mes que aparece arriba, o antes, un analista está trabajando ahora en su mes. Si se presentó después, su mes todavía está más atrás en la fila.",
      "El promedio de arriba incluye todos los casos decididos hace poco, también los lentos, con auditoría o con una solicitud de información (RFI). Por eso un caso sin complicaciones suele tardar menos que ese promedio.",
      <>
        Para una estimación según su propia fecha de presentación, use la <En href="/tools/perm-timeline-calculator">calculadora de tiempos del PERM</En> (en inglés). Es una estimación, no una promesa, y su precisión se publica en el <En href="/estimate-scorecard">registro de precisión</En> (en inglés).
      </>,
    ],
  },
  steps: {
    h2: "Qué sigue después del PERM",
    intro: "Cuando el DOL certifica el PERM, el caso pasa al Servicio de Ciudadanía e Inmigración de los Estados Unidos (USCIS), y a partir de ahí depende del boletín de visas.",
    items: [
      {
        form: "ETA-9089",
        name: "Certificación laboral PERM (DOL)",
        body: "El DOL confirma que no había un trabajador estadounidense calificado disponible para el puesto. La fecha en que el DOL recibió la solicitud es su fecha de prioridad (priority date), y esa fecha cuenta en todos los pasos siguientes.",
      },
      {
        form: "I-140",
        name: "Petición de inmigrante (USCIS)",
        body: (
          <>
            Su empleador debe presentar la I-140 dentro de los 180 días siguientes a la certificación; si no, la certificación vence. El trámite normal tarda meses; con procesamiento prioritario (premium processing), pagando una tarifa adicional, USCIS decide la mayoría de las peticiones basadas en un PERM en unos 15 días hábiles. USCIS entrega un número de recibo de tres letras y diez dígitos, como <D>IOE0912345678</D>, que se consulta en el propio sitio de USCIS.
          </>
        ),
      },
      {
        form: "Visa Bulletin",
        name: "La espera de su fecha de prioridad",
        body: "Cada año hay un número fijo de green cards por empleo, con un límite por país. Cuando hay más solicitantes que visas, el Departamento de Estado publica cada mes una fecha de corte. Usted solo puede dar el último paso cuando su fecha de prioridad es anterior a la fecha de corte de su categoría y su país. Vea la tabla más abajo.",
      },
      {
        form: "I-485",
        name: "Ajuste de estatus, dentro de EE. UU. (USCIS)",
        body: "Cuando llega su fecha, presenta la I-485 para obtener la green card sin salir del país. La mayoría presenta al mismo tiempo la I-765 (permiso de trabajo, llamado EAD) y la I-131 (advance parole, un permiso de viaje). Cada mes USCIS indica qué tabla del boletín acepta: las fechas de acción final o las fechas para presentar.",
      },
      {
        form: "DS-260",
        name: "Procesamiento consular, fuera de EE. UU. (Departamento de Estado)",
        body: "Si está fuera del país, el caso pasa al Centro Nacional de Visas (National Visa Center), usted llena el DS-260 y tiene una entrevista en una embajada o un consulado de EE. UU.",
      },
    ],
    skipPerm: "Las peticiones EB-1 y EB-2 con exención por interés nacional (NIW) no pasan por el PERM: empiezan directamente en la I-140.",
  },
  ew3: {
    h2: "EB-3 Otros Trabajadores (Other Workers)",
    body: [
      "EB-3 Otros Trabajadores es la parte de EB-3 para puestos que requieren menos de dos años de capacitación o experiencia. La categoría la deciden los requisitos del puesto en el PERM, no su educación: una persona con título universitario en un puesto que pide seis meses de experiencia cuenta como Otro Trabajador.",
      "Tiene su propia fila en el boletín de visas y un límite de hasta 10,000 visas al año, por eso su fecha de corte suele ir varios años detrás del resto de EB-3. Compare las filas EB-3 y EB-3 Otros Trabajadores en la tabla de abajo.",
      <>
        Más información: la <En href="/guides/eb3-other-workers">guía completa de EB-3 Otros Trabajadores</En> (en inglés) y <En href="/tools/green-card-line?category=EW3">cuántas personas tiene por delante en esa fila</En> (en inglés).
      </>,
    ],
  },
  cutoffs: {
    h2: "Fechas de corte para su país",
    intro: (m) => (
      <>Del boletín de visas del Departamento de Estado de {m}, el más reciente que tiene este sitio. Una fecha significa que las personas con una fecha de prioridad anterior pueden avanzar.</>
    ),
    birth: "La tabla que le corresponde depende de su país de nacimiento, no de su nacionalidad: si nació en México, es la de México; si nació en Centroamérica, Sudamérica, el Caribe o España, es la de todos los demás países. En algunos casos se puede usar el país de nacimiento del cónyuge; consúltelo con su abogado.",
    head: { category: "Categoría", finalAction: "Fecha de acción final", datesForFiling: "Fecha para presentar" },
    countryName: { mexico: "Nacidos en México", worldwide: "Todos los demás países" },
    category: {
      EB1: "EB-1 (trabajadores prioritarios)",
      EB2: "EB-2 (títulos avanzados)",
      EB3: "EB-3 (profesionales y trabajadores calificados)",
      EW3: "EB-3 Otros Trabajadores",
    },
    current: "vigente: abierta a toda fecha de prioridad",
    unavailable: "sin visas disponibles este mes",
    notPrinted: "no publicada",
    legend: [
      "Fecha de acción final (Final Action Date): cuándo se puede aprobar de verdad la green card.",
      "Fecha para presentar (Date for Filing): cuándo puede presentar la I-485 antes de tiempo, si USCIS acepta esa tabla ese mes.",
      <>
        Todos los meses están en la <En href="/visa-bulletin">página del boletín de visas</En> (en inglés), y la <En href="/tools/priority-date-calculator">calculadora de fecha de prioridad</En> (en inglés) compara su propia fecha.
      </>,
    ],
    missing: (
      <>
        No se puede leer el boletín en este momento. Todos los meses están en la <En href="/visa-bulletin">página del boletín de visas</En> (en inglés).
      </>
    ),
  },
  statuses: {
    h2: "Los términos de estado del DOL",
    intro: "La consulta de casos muestra el estado del DOL en inglés, tal como lo publica. Esto significa cada uno:",
    gloss: {
      "ANALYST REVIEW": "En la fila normal, esperando a un analista. La mayoría de los casos pendientes están aquí.",
      "APPLICATION ON HOLD": "Pendiente, pero apartado de la fila normal. El DOL no publica el motivo.",
      "RFI ISSUED": "El DOL le pidió más información al empleador antes de decidir. No es una negación.",
      "PENDING AUDIT RESPONSE": "El caso fue seleccionado para una auditoría y el DOL espera los documentos del empleador.",
      "SUPERVISED RECRUITMENT": "El DOL exige que el empleador vuelva a anunciar el puesto bajo su supervisión.",
      "NORD ISSUED": "Un estado pendiente que el DOL no define públicamente. Muy pocos casos lo tienen.",
      "RECONSIDERATION APPEALS": "El caso fue negado y el empleador le pidió al DOL que lo reconsidere.",
      "BALCA APPEALS": "El empleador apeló la negación ante la Junta de Apelaciones de Certificación Laboral (BALCA).",
      CERTIFIED: "Aprobado por el DOL. Termina el paso del PERM; lo que sigue es la I-140.",
      "CERTIFIED - EXPIRED": "El DOL lo muestra cuando pasan 180 días desde la certificación. Si la I-140 se presentó dentro de esos 180 días, la certificación se usó a tiempo.",
      DENIED: "El DOL negó la solicitud. El empleador puede pedir una reconsideración o apelar ante BALCA.",
      WITHDRAWN: "El empleador retiró la solicitud. No es una negación y el DOL no registra el motivo.",
    },
  },
  limits: {
    h2: "Lo que esta página no puede decirle",
    items: [
      "Cuándo se decidirá su caso en particular. Las cifras de arriba describen toda la fila del DOL, no su expediente.",
      "Por qué una decisión salió como salió. El DOL publica resultados, no razones.",
      "Nada que reemplace el consejo de su abogado. No cambie de trabajo, no viaje ni tome otra decisión importante por una cifra de la fila.",
    ],
  },
  more: {
    h2: "Páginas en inglés",
    links: [
      { href: "/perm-case-status", label: "Consulta de casos" },
      { href: "/perm-queue", label: "La fila PERM por mes de presentación" },
      { href: "/tools/perm-timeline-calculator", label: "Calculadora de tiempos del PERM" },
      { href: "/visa-bulletin", label: "Boletín de visas" },
      { href: "/tools/priority-date-calculator", label: "Calculadora de fecha de prioridad" },
      { href: "/tools/green-card-line", label: "Su lugar en la fila de la green card" },
      { href: "/tools/which-green-card", label: "Qué green card por empleo le corresponde" },
      { href: "/uscis-processing-times", label: "Tiempos de procesamiento de USCIS" },
      { href: ENGLISH_GUIDE, label: "La guía completa en inglés" },
    ],
  },
};
