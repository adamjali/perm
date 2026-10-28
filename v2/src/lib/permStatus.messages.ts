import type { Messages } from "@/lib/i18n/lang";
import type { MeaningTexts, StatusKind } from "@/lib/permStatus";

/**
 * What DOL's status words mean, in the five translations. The English is permStatus.ts's MEANINGS table, the
 * one English source; each entry here says the same thing and no more. DOL's status words, the regulation's
 * section numbers, form names (I-140), and the names Certifying Officer and BALCA stay as printed, each glossed
 * in the reader's language the first time an entry uses it, because an entry is shown on its own. As in the
 * English, the party who acts is always the employer, never the reader.
 *
 * The type follows the English entry's nulls, so a translation can't add or drop a clock (permStatus.ts,
 * MeaningText).
 */
export const MEANING_TRANSLATIONS = {
  es: {
    "ANALYST REVIEW": {
      summary:
        "La fila normal. Un analista trabaja los casos en el orden en que se presentaron, y hasta que llegue a este nada cambia en el caso. Aquí está la gran mayoría de los casos pendientes, y lo único que queda es esperar.",
      action: null,
      deadline: null,
    },
    "IN PROCESS": {
      summary:
        "Un estado pendiente que existe junto a la revisión por un analista. El DOL no publica ninguna definición que distinga los dos, y hay tan pocos casos en él que tampoco se puede sacar un patrón de los datos.",
      action: null,
      deadline: null,
    },
    "APPLICATION ON HOLD": {
      summary:
        "El caso está pendiente y fue apartado de la fila normal. El DOL no publica ninguna definición de este estado, así que esta página no puede decirle por qué un caso en particular está aquí.",
      action: "El abogado del empleador puede preguntarle directamente al DOL. Ninguna página pública lo responde.",
      deadline: null,
    },
    "RFI ISSUED": {
      summary:
        "El DOL le pidió más información al empleador antes de decidir. La regulación permite que el funcionario certificador (Certifying Officer) pida información o documentación adicional en cualquier momento antes de una determinación final. Una solicitud de información (RFI) no es una auditoría. La auditoría es un instrumento formal de otra subsección, con un plazo fijo de 30 días, y el DOL maneja las dos como estados separados, en filas separadas.",
      action:
        "El empleador tiene que responder. La propia carta fija el plazo, y no cumplirlo es la forma en que un caso que iba a ser certificado termina negado.",
      deadline: "Lo que diga la carta. A diferencia de una auditoría, la regulación no fija un plazo para esto.",
    },
    "PENDING AUDIT RESPONSE": {
      summary:
        "El caso fue seleccionado para una auditoría, porque la revisión encontró algo o al azar como control de calidad, y el DOL espera los documentos.",
      action:
        "El empleador tiene que enviar la documentación que indica la carta de auditoría. No cumplir la fecha no solo arriesga una negación. También cuenta como negarse a agotar los recursos administrativos, y eso cierra la puerta a una apelación ante la Junta de Apelaciones de Certificación Laboral (BALCA).",
      deadline:
        "30 días desde la fecha de la carta de auditoría. El funcionario certificador (Certifying Officer) puede dar, a su criterio, una prórroga de hasta 30 días más.",
    },
    "SUPERVISED RECRUITMENT": {
      summary:
        "El DOL tomó el control del reclutamiento. El empleador tiene que volver a anunciar el puesto donde el DOL le indique, con un texto que el DOL aprueba antes, y las solicitudes van al funcionario certificador (Certifying Officer), no al empleador.",
      action: "El empleador tiene que enviar un borrador del anuncio al funcionario certificador para su aprobación.",
      deadline: "30 días desde que se le notifica que se requiere reclutamiento supervisado.",
    },
    "NORD ISSUED": {
      summary:
        "El DOL no publica qué significa esta sigla ni una definición del estado, así que esta página no le pondrá una. Lo que se puede medir es que es un estado pendiente y que tiene muy pocos casos.",
      action: "La propia notificación dice qué quiere el DOL y para cuándo. La tiene el abogado del empleador.",
      deadline: null,
    },
    "DETERMINATION ISSUED": {
      summary:
        "Ya se emitió una decisión sobre el caso, y el estado en vivo todavía no muestra el resultado. El DOL no publica ninguna definición de este estado intermedio.",
      action: null,
      deadline: null,
    },
    "RECONSIDERATION APPEALS": {
      summary:
        "El caso fue negado y el empleador le pidió al funcionario certificador (Certifying Officer) que lo revise de nuevo. La reconsideración es limitada a propósito: solo puede basarse en documentos que el DOL ya recibió, o en documentos que existían cuando se presentó la solicitud y que se guardaron para respaldarla.",
      action:
        "El funcionario certificador decide si reconsidera, y puede tratar la solicitud como una apelación ante la Junta de Apelaciones de Certificación Laboral (BALCA).",
      deadline: "La solicitud tenía que enviarse dentro de los 30 días siguientes a la negación.",
    },
    "REQUEST FOR REVIEW": {
      summary:
        "El empleador pidió a la Junta de Apelaciones de Certificación Laboral (BALCA) que revise una negación. BALCA revisa con base en el expediente: las pruebas son las que ya tenía el funcionario certificador (Certifying Officer), y los escritos son argumentos legales.",
      action: "BALCA decide. No se le pide nada más al empleador.",
      deadline: "La solicitud tenía que enviarse dentro de los 30 días siguientes a la determinación.",
    },
    "BALCA APPEALS": {
      summary:
        "El caso está ante la Junta de Apelaciones de Certificación Laboral (BALCA). BALCA puede confirmar la negación, ordenar al funcionario certificador (Certifying Officer) que otorgue la certificación, u ordenar una audiencia.",
      action: "BALCA decide. Todas las partes tienen 30 días para presentar un escrito o renunciar a hacerlo.",
      deadline: null,
    },
    "DENIED - BALCA DISMISSED": {
      summary:
        "Un caso negado cuya apelación ante la Junta de Apelaciones de Certificación Laboral (BALCA) terminó sin que la Junta decidiera sobre el fondo. El DOL no publica ninguna definición de este estado, y las palabras dismiss y dismissal (desestimar) ni siquiera aparecen en la sección que rige las decisiones de BALCA. Esa sección solo menciona confirmar la negación, ordenar al funcionario que otorgue la certificación u ordenar una audiencia. Un solo caso en todos los datos tiene este estado.",
      action: null,
      deadline: null,
    },
    "DENIED - BALCA AFFIRMED": {
      summary:
        "El empleador apeló la negación ante la Junta de Apelaciones de Certificación Laboral (BALCA), y la Junta la confirmó. La Junta revisa el expediente sobre el que se tomó la decisión y debe confirmar la negación, ordenar al funcionario certificador (Certifying Officer) que otorgue la certificación u ordenar una audiencia. Este es el primero de los tres. La regulación no menciona ningún paso más dentro del DOL.",
      action: null,
      deadline: null,
    },
    CERTIFIED: {
      summary:
        "El DOL otorgó la certificación laboral. Ahí termina la etapa del PERM. No es una green card ni una petición: es el documento con el que el empleador presenta la I-140.",
      action:
        "El empleador tiene que presentar la I-140 mientras la certificación siga vigente. Una certificación que no se presenta a tiempo vence, y hay que hacer toda la etapa del PERM de nuevo.",
      deadline: "180 días calendario desde la fecha en que el DOL la otorgó, para presentarla junto con un Formulario I-140.",
    },
    "CERTIFIED - EXPIRED": {
      summary:
        "El DOL otorgó la certificación y ya pasó el plazo de 180 días para presentar una I-140 con ella. La regulación es clara: una certificación vence si no se presenta junto con una petición I-140 dentro de los 180 días calendario desde la fecha en que el DOL la otorgó.",
      action:
        "Esta es nuestra lectura, no la del DOL, porque el DOL no publica ninguna nota al respecto: el vencimiento es un hecho del calendario, no la conclusión de que no se presentó nada. El DOL otorga la certificación, USCIS recibe la I-140, y nada indica que al DOL le avisen cuando llega una. Así que un caso en el que el empleador presentó la I-140 el día 30 y uno en el que nadie la presentó terminan los dos aquí. Si una I-140 se presentó dentro del plazo, no le afecta. El abogado del empleador sabe cuál de los dos ocurrió. Esta página no puede saberlo.",
      deadline: null,
    },
    DENIED: {
      summary:
        "El funcionario certificador (Certifying Officer) rechazó la solicitud. La carta de negación indica los motivos, y hay dos caminos a partir de ella: la reconsideración por el mismo funcionario, o la revisión por la Junta de Apelaciones de Certificación Laboral (BALCA).",
      action:
        "El empleador puede pedir la reconsideración o pedir que BALCA revise el caso. Dejar pasar los dos plazos cuenta como no agotar los recursos administrativos, y la negación queda firme. Presentar una solicitud nueva también es una opción, y muchas veces es la más rápida.",
      deadline: "30 días desde la fecha en que se emitió la negación, para cualquiera de los dos caminos.",
    },
    WITHDRAWN: {
      summary:
        "El empleador retiró la solicitud. El DOL no registra el motivo, así que aquí no se puede saber por qué. Retirar una solicitud no es una negación y no cuenta en contra de nadie.",
      action: null,
      deadline: null,
    },
  },
  zh: {
    "ANALYST REVIEW": {
      summary:
        "正常队列。审查员按递交顺序处理案件，轮到这个案件之前，案件不会有任何变化。绝大多数审理中的案件都在这个状态，能做的只有等待。",
      action: null,
      deadline: null,
    },
    "IN PROCESS": {
      summary:
        "与审查员审核并存的一种审理中状态。劳工部没有公布区分两者的定义，而且处于这个状态的案件很少，也无法从数据中看出规律。",
      action: null,
      deadline: null,
    },
    "APPLICATION ON HOLD": {
      summary:
        "案件仍在审理，但已被移出正常队列。劳工部没有公布这个状态的定义，所以本页无法告诉您某个案件为什么会处于这个状态。",
      action: "雇主的律师可以直接询问劳工部。任何公开网页都无法回答这个问题。",
      deadline: null,
    },
    "RFI ISSUED": {
      summary:
        "劳工部在作出判定前，要求雇主补充信息。法规允许认证官（Certifying Officer）在作出最终判定前的任何时候要求补充信息或文件。补充信息要求（RFI）不是审计：审计是另一款规定下的正式程序，有固定的 30 天期限，劳工部把两者作为不同的状态，放在不同的队列里处理。",
      action: "雇主必须回复。期限由信函本身规定，错过期限，原本会获批的案件就会被拒。",
      deadline: "以信函为准。与审计不同，法规没有为此规定固定期限。",
    },
    "PENDING AUDIT RESPONSE": {
      summary:
        "案件被抽中审计，原因可能是审核中发现了问题，也可能是质量控制的随机抽查，劳工部正在等待文件。",
      action:
        "雇主必须寄送审计信函列出的文件。错过日期不只是有被拒的风险，还会被视为拒绝用尽行政救济，从而无法向劳工证上诉委员会（BALCA）上诉。",
      deadline: "自审计信函日期起 30 天。认证官（Certifying Officer）可自行决定给予一次最多 30 天的延期。",
    },
    "SUPERVISED RECRUITMENT": {
      summary:
        "劳工部接管了招聘。雇主必须在劳工部指定的地方重新刊登招聘广告，广告用语须先经劳工部批准，求职申请交给认证官（Certifying Officer），而不是雇主。",
      action: "雇主必须向认证官提交广告草稿，供其批准。",
      deadline: "自收到需要进行监督招聘的通知起 30 天。",
    },
    "NORD ISSUED": {
      summary:
        "劳工部没有公布这个缩写的全称，也没有公布这个状态的定义，所以本页不会自行解释。可以确定的是，它是一种审理中状态，处于这个状态的案件很少。",
      action: "通知本身写明了劳工部要什么、什么时候要。雇主的律师手上有这份通知。",
      deadline: null,
    },
    "DETERMINATION ISSUED": {
      summary: "案件已作出判定，但实时状态还没有更新为结果。劳工部没有公布这个中间状态的定义。",
      action: null,
      deadline: null,
    },
    "RECONSIDERATION APPEALS": {
      summary:
        "案件被拒，雇主请认证官（Certifying Officer）重新考虑。重新考虑的范围有意定得很窄：只能依据劳工部已经收到的文件，或在递交申请时已经存在、并为支持申请而保存的文件。",
      action: "由认证官决定是否重新考虑，认证官也可以把这项请求当作向劳工证上诉委员会（BALCA）提出的上诉处理。",
      deadline: "请求必须在拒绝决定发出后 30 天内提交。",
    },
    "REQUEST FOR REVIEW": {
      summary:
        "雇主已请劳工证上诉委员会（BALCA）复审拒绝决定。BALCA 依据案卷复审：证据就是认证官（Certifying Officer）当时已有的材料，提交的内容是法律论证。",
      action: "由 BALCA 作出决定。雇主无需再做任何事。",
      deadline: "请求必须在判定后 30 天内提交。",
    },
    "BALCA APPEALS": {
      summary:
        "案件在劳工证上诉委员会（BALCA）审理中。BALCA 可以维持拒绝决定、指示认证官（Certifying Officer）批准劳工证，或下令举行听证。",
      action: "由 BALCA 作出决定。各方有 30 天时间提交书状，也可以选择不提交。",
      deadline: null,
    },
    "DENIED - BALCA DISMISSED": {
      summary:
        "一个被拒的案件，向劳工证上诉委员会（BALCA）提出的上诉在委员会未就实质问题作出裁决的情况下结束。劳工部没有公布这个状态的定义，规范 BALCA 裁决的条文中也完全没有出现 dismiss 或 dismissal（驳回）这两个词。该条只列出维持拒绝、指示认证官批准或下令举行听证三种结果。所有数据中只有一个案件处于这个状态。",
      action: null,
      deadline: null,
    },
    "DENIED - BALCA AFFIRMED": {
      summary:
        "雇主就拒绝决定向劳工证上诉委员会（BALCA）上诉，委员会维持了拒绝。委员会依据作出决定时的案卷进行复审，必须在维持拒绝、指示认证官（Certifying Officer）批准劳工证或下令举行听证三者中择一，这是第一种。法规没有规定劳工部内部还有下一步。",
      action: null,
      deadline: null,
    },
    CERTIFIED: {
      summary:
        "劳工部批准了劳工证。PERM 这一步到此结束。它不是绿卡，也不是移民申请：它是雇主递交 I-140 时要用的文件。",
      action:
        "雇主必须在劳工证仍然有效时递交 I-140。没有按时使用的劳工证会过期，整个 PERM 步骤都得重来。",
      deadline: "自劳工部批准之日起 180 个日历日内，用于支持 I-140 表格的递交。",
    },
    "CERTIFIED - EXPIRED": {
      summary:
        "劳工部批准了劳工证，而用它递交 I-140 的 180 天期限已经过了。法规写得很明确：劳工证若没有在劳工部批准之日起 180 个日历日内用于支持 I-140 申请，就会过期。",
      action:
        "这是我们的解读，不是劳工部的，因为劳工部对此没有任何说明：过期只是日历上的事件，并不代表认定没有递交任何申请。劳工部批准劳工证，移民局（USCIS）接收 I-140，没有迹象表明有 I-140 送到时劳工部会得到通知。因此，雇主在第 30 天就递交了的案件，和从未有人递交的案件，最后都会显示这个状态。如果 I-140 是在期限内递交的，就不受影响。雇主的律师知道是哪一种情况，本页无法知道。",
      deadline: null,
    },
    DENIED: {
      summary:
        "认证官（Certifying Officer）拒绝了申请。拒绝信写明了理由，之后有两条路可走：请同一位认证官重新考虑，或请劳工证上诉委员会（BALCA）复审。",
      action:
        "雇主可以请求重新考虑，或请 BALCA 复审。两个期限都错过，就视为未用尽行政救济，拒绝决定即成为最终决定。重新递交一份申请也是一个选择，而且往往更快。",
      deadline: "两条路都是自拒绝决定发出之日起 30 天。",
    },
    WITHDRAWN: {
      summary: "雇主撤回了申请。劳工部不记录原因，所以这里无法说明为什么。撤回不是拒绝，也不会对任何人不利。",
      action: null,
      deadline: null,
    },
  },
  "pt-br": {
    "ANALYST REVIEW": {
      summary:
        "A fila normal. Um analista trabalha os casos na ordem em que foram protocolados, e até chegar a este nada muda no caso. É aqui que está a grande maioria dos casos pendentes, e a única coisa a fazer é esperar.",
      action: null,
      deadline: null,
    },
    "IN PROCESS": {
      summary:
        "Um status pendente que existe ao lado da revisão por analista. O DOL não publica nenhuma definição que separe os dois, e há tão poucos casos nele que também não dá para tirar um padrão dos dados.",
      action: null,
      deadline: null,
    },
    "APPLICATION ON HOLD": {
      summary:
        "O caso está pendente e foi separado da fila normal. O DOL não publica nenhuma definição para este status, então esta página não pode dizer por que um caso específico está aqui.",
      action: "O advogado do empregador pode perguntar diretamente ao DOL. Nenhuma página pública responde a isso.",
      deadline: null,
    },
    "RFI ISSUED": {
      summary:
        "O DOL pediu mais informações ao empregador antes de decidir. A regulamentação permite que o funcionário certificador (Certifying Officer) peça informações ou documentos adicionais a qualquer momento antes de uma determinação final. Um pedido de informações (RFI) não é uma auditoria. A auditoria é um instrumento formal de outra subseção, com prazo fixo de 30 dias, e o DOL trata os dois como status separados, em filas separadas.",
      action:
        "O empregador tem que responder. A própria carta define o prazo, e perdê-lo é como um caso que seria certificado acaba negado.",
      deadline: "O que a carta disser. Ao contrário de uma auditoria, a regulamentação não fixa um prazo para isto.",
    },
    "PENDING AUDIT RESPONSE": {
      summary:
        "O caso foi selecionado para auditoria, porque a revisão encontrou algo ou por sorteio para controle de qualidade, e o DOL está esperando os documentos.",
      action:
        "O empregador tem que enviar a documentação que a carta de auditoria lista. Perder a data não só arrisca uma negativa. Também conta como recusa em esgotar os recursos administrativos, e isso fecha a porta para um recurso ao Conselho de Recursos de Certificação Trabalhista (BALCA).",
      deadline:
        "30 dias a partir da data da carta de auditoria. O funcionário certificador (Certifying Officer) pode conceder, a seu critério, uma prorrogação de até mais 30 dias.",
    },
    "SUPERVISED RECRUITMENT": {
      summary:
        "O DOL assumiu o recrutamento. O empregador tem que anunciar a vaga de novo, onde o DOL mandar, com um texto que o DOL aprova antes, e as candidaturas vão para o funcionário certificador (Certifying Officer), não para o empregador.",
      action: "O empregador tem que enviar um rascunho do anúncio ao funcionário certificador para aprovação.",
      deadline: "30 dias a partir da notificação de que o recrutamento supervisionado é exigido.",
    },
    "NORD ISSUED": {
      summary:
        "O DOL não publica o que significa esta sigla nem uma definição do status, então esta página não vai inventar uma. O que se pode medir é que é um status pendente e que tem muito poucos casos.",
      action: "A própria notificação diz o que o DOL quer e até quando. O advogado do empregador tem essa notificação.",
      deadline: null,
    },
    "DETERMINATION ISSUED": {
      summary:
        "Uma decisão já foi emitida sobre o caso, e o status ao vivo ainda não mostra o resultado. O DOL não publica nenhuma definição para este status intermediário.",
      action: null,
      deadline: null,
    },
    "RECONSIDERATION APPEALS": {
      summary:
        "O caso foi negado e o empregador pediu ao funcionário certificador (Certifying Officer) que o analisasse de novo. A reconsideração é restrita de propósito: só pode se apoiar em documentos que o DOL já recebeu, ou em documentos que existiam quando o pedido foi protocolado e foram guardados para sustentá-lo.",
      action:
        "O funcionário certificador decide se reconsidera, e pode, em vez disso, tratar o pedido como um recurso ao Conselho de Recursos de Certificação Trabalhista (BALCA).",
      deadline: "O pedido tinha que ser enviado em até 30 dias a partir da negativa.",
    },
    "REQUEST FOR REVIEW": {
      summary:
        "O empregador pediu ao Conselho de Recursos de Certificação Trabalhista (BALCA) que revise uma negativa. O BALCA revisa com base no processo: as provas são as que o funcionário certificador (Certifying Officer) já tinha, e as manifestações são argumentos jurídicos.",
      action: "O BALCA decide. Não se exige mais nada do empregador.",
      deadline: "O pedido tinha que ser enviado em até 30 dias a partir da determinação.",
    },
    "BALCA APPEALS": {
      summary:
        "O caso está no Conselho de Recursos de Certificação Trabalhista (BALCA). O BALCA pode manter a negativa, determinar que o funcionário certificador (Certifying Officer) conceda a certificação ou ordenar uma audiência.",
      action: "O BALCA decide. Todas as partes têm 30 dias para apresentar uma manifestação ou abrir mão disso.",
      deadline: null,
    },
    "DENIED - BALCA DISMISSED": {
      summary:
        "Um caso negado cujo recurso ao Conselho de Recursos de Certificação Trabalhista (BALCA) terminou sem que o Conselho decidisse o mérito. O DOL não publica nenhuma definição para este status, e as palavras dismiss e dismissal (arquivamento) nem aparecem na seção que rege as decisões do BALCA. Essa seção lista apenas manter a negativa, determinar que o funcionário conceda a certificação ou ordenar uma audiência. Só um caso em todos os dados tem este status.",
      action: null,
      deadline: null,
    },
    "DENIED - BALCA AFFIRMED": {
      summary:
        "O empregador recorreu da negativa ao Conselho de Recursos de Certificação Trabalhista (BALCA), e o Conselho a manteve. O Conselho revisa o processo em que a decisão foi tomada e deve manter a negativa, determinar que o funcionário certificador (Certifying Officer) conceda a certificação ou ordenar uma audiência. Este é o primeiro dos três. A regulamentação não prevê nenhuma outra etapa dentro do DOL.",
      action: null,
      deadline: null,
    },
    CERTIFIED: {
      summary:
        "O DOL concedeu a certificação trabalhista. Aí termina a etapa do PERM. Não é um green card nem uma petição: é o documento com o qual o empregador protocola a I-140.",
      action:
        "O empregador tem que protocolar a I-140 enquanto a certificação ainda for válida. Uma certificação que não é usada a tempo expira, e toda a etapa do PERM tem que ser feita de novo.",
      deadline: "180 dias corridos a partir da data em que o DOL a concedeu, para protocolar junto com um Formulário I-140.",
    },
    "CERTIFIED - EXPIRED": {
      summary:
        "O DOL concedeu a certificação e o prazo de 180 dias para protocolar uma I-140 com ela já passou. A regulamentação é explícita: uma certificação expira se não for usada em uma petição I-140 em até 180 dias corridos a partir da data em que o DOL a concedeu.",
      action:
        "Esta é a nossa leitura, não a do DOL, porque o DOL não publica nenhuma nota sobre isso: a expiração é um evento do calendário, não uma constatação de que nada foi protocolado. O DOL concede a certificação, o USCIS recebe a I-140, e nada indica que o DOL seja avisado quando uma chega. Então um caso em que o empregador protocolou no dia 30 e um caso em que ninguém protocolou acabam os dois aqui. Se uma I-140 foi protocolada dentro do prazo, ela não é afetada. O advogado do empregador sabe qual dos dois aconteceu. Esta página não tem como saber.",
      deadline: null,
    },
    DENIED: {
      summary:
        "O funcionário certificador (Certifying Officer) recusou o pedido. A carta de negativa indica os motivos, e há dois caminhos a partir dela: a reconsideração pelo mesmo funcionário ou a revisão pelo Conselho de Recursos de Certificação Trabalhista (BALCA).",
      action:
        "O empregador pode pedir reconsideração ou pedir que o BALCA revise. Perder os dois prazos conta como não esgotar os recursos administrativos, e a negativa se torna definitiva. Um pedido novo também é uma opção, e muitas vezes é a mais rápida.",
      deadline: "30 dias a partir da data em que a negativa foi emitida, para qualquer um dos dois caminhos.",
    },
    WITHDRAWN: {
      summary:
        "O empregador retirou o pedido. O DOL não registra o motivo, então nada aqui pode dizer por quê. A retirada não é uma negativa e não conta contra ninguém.",
      action: null,
      deadline: null,
    },
  },
  ko: {
    "ANALYST REVIEW": {
      summary:
        "일반 대기열입니다. 심사관이 접수 순서대로 케이스를 처리하며, 이 케이스에 이르기 전까지는 아무것도 바뀌지 않습니다. 심사 중인 케이스 대부분이 이 상태에 있으며, 할 일은 기다리는 것뿐입니다.",
      action: null,
      deadline: null,
    },
    "IN PROCESS": {
      summary:
        "심사관 검토와 나란히 있는 심사 중 상태입니다. 노동부는 둘을 구분하는 정의를 공개하지 않으며, 이 상태의 케이스가 매우 적어 데이터에서도 패턴을 읽어 낼 수 없습니다.",
      action: null,
      deadline: null,
    },
    "APPLICATION ON HOLD": {
      summary:
        "케이스는 심사 중이지만 일반 대기열에서 빠져 있습니다. 노동부는 이 상태의 정의를 공개하지 않으므로, 특정 케이스가 왜 이 상태가 되었는지는 이 페이지에서 알려 드릴 수 없습니다.",
      action: "고용주의 변호사가 노동부에 직접 문의할 수 있습니다. 공개된 페이지로는 답을 알 수 없습니다.",
      deadline: null,
    },
    "RFI ISSUED": {
      summary:
        "노동부가 결정 전에 고용주에게 추가 정보를 요청했습니다. 규정은 인증 담당관(Certifying Officer)이 최종 결정 전 언제든지 추가 정보나 서류를 요청할 수 있도록 합니다. 추가 정보 요청(RFI)은 감사가 아닙니다. 감사는 다른 조항에 따른 공식 절차로 30일이라는 정해진 기한이 있으며, 노동부는 두 가지를 별도의 상태와 별도의 대기열로 운영합니다.",
      action:
        "고용주가 답변해야 합니다. 기한은 통지서에 적혀 있으며, 기한을 놓치면 승인될 수 있었던 케이스도 거부됩니다.",
      deadline: "통지서에 적힌 대로입니다. 감사와 달리 규정은 이 경우 정해진 기한을 두지 않습니다.",
    },
    "PENDING AUDIT RESPONSE": {
      summary:
        "케이스가 감사 대상으로 선정되었습니다. 검토 중 문제가 제기되었거나 품질 관리를 위해 무작위로 뽑힌 것이며, 노동부는 서류를 기다리고 있습니다.",
      action:
        "고용주는 감사 통지서에 적힌 서류를 보내야 합니다. 기한을 놓치면 거부될 위험만 있는 것이 아닙니다. 행정 구제 절차를 다하기를 거부한 것으로 간주되어, 노동 인증 항소 위원회(BALCA)에 항소할 길도 막힙니다.",
      deadline:
        "감사 통지서 날짜로부터 30일입니다. 인증 담당관(Certifying Officer)은 재량으로 최대 30일까지 한 번 연장해 줄 수 있습니다.",
    },
    "SUPERVISED RECRUITMENT": {
      summary:
        "노동부가 모집 절차를 직접 맡았습니다. 고용주는 노동부가 지정한 곳에, 노동부가 먼저 승인한 문구로 다시 구인 광고를 내야 하며, 지원서는 고용주가 아니라 인증 담당관(Certifying Officer)에게 갑니다.",
      action: "고용주는 광고 초안을 인증 담당관에게 제출해 승인을 받아야 합니다.",
      deadline: "감독 모집이 필요하다는 통지를 받은 날로부터 30일입니다.",
    },
    "NORD ISSUED": {
      summary:
        "노동부는 이 약어의 뜻이나 이 상태의 정의를 공개하지 않으므로, 이 페이지도 임의로 설명하지 않습니다. 확인할 수 있는 것은 심사 중 상태라는 점과, 이 상태의 케이스가 매우 적다는 점입니다.",
      action: "통지서에 노동부가 무엇을 언제까지 원하는지 적혀 있습니다. 고용주의 변호사가 통지서를 가지고 있습니다.",
      deadline: null,
    },
    "DETERMINATION ISSUED": {
      summary:
        "케이스에 대한 결정이 내려졌지만, 실시간 상태에는 아직 결과가 반영되지 않았습니다. 노동부는 이 중간 상태의 정의를 공개하지 않습니다.",
      action: null,
      deadline: null,
    },
    "RECONSIDERATION APPEALS": {
      summary:
        "케이스가 거부되었고, 고용주가 인증 담당관(Certifying Officer)에게 다시 검토해 달라고 요청했습니다. 재심은 일부러 범위가 좁게 정해져 있습니다. 노동부가 이미 받은 서류, 또는 신청 당시 이미 존재했고 신청을 뒷받침하기 위해 보관된 서류만 근거로 삼을 수 있습니다.",
      action:
        "인증 담당관이 재심 여부를 결정하며, 대신 이 요청을 노동 인증 항소 위원회(BALCA)에 대한 항소로 처리할 수도 있습니다.",
      deadline: "요청은 거부 결정이 내려진 날로부터 30일 안에 보내야 했습니다.",
    },
    "REQUEST FOR REVIEW": {
      summary:
        "고용주가 노동 인증 항소 위원회(BALCA)에 거부 결정을 검토해 달라고 요청했습니다. BALCA는 기록에 근거해 검토합니다. 증거는 인증 담당관(Certifying Officer)이 이미 가지고 있던 자료이며, 제출하는 내용은 법적 주장입니다.",
      action: "BALCA가 결정합니다. 고용주가 더 할 일은 없습니다.",
      deadline: "요청은 결정이 내려진 날로부터 30일 안에 보내야 했습니다.",
    },
    "BALCA APPEALS": {
      summary:
        "케이스가 노동 인증 항소 위원회(BALCA)에 있습니다. BALCA는 거부 결정을 유지하거나, 인증 담당관(Certifying Officer)에게 인증을 승인하도록 지시하거나, 청문회를 명할 수 있습니다.",
      action: "BALCA가 결정합니다. 모든 당사자는 30일 안에 의견서를 내거나 내지 않겠다고 밝힐 수 있습니다.",
      deadline: null,
    },
    "DENIED - BALCA DISMISSED": {
      summary:
        "노동 인증 항소 위원회(BALCA)에 대한 항소가 위원회의 본안 판단 없이 끝난 거부 케이스입니다. 노동부는 이 상태의 정의를 공개하지 않으며, BALCA 결정을 규정하는 조항에는 dismiss나 dismissal(기각)이라는 단어가 아예 나오지 않습니다. 그 조항은 거부 유지, 담당관에게 승인 지시, 청문회 명령만 열거합니다. 전체 데이터에서 이 상태의 케이스는 하나뿐입니다.",
      action: null,
      deadline: null,
    },
    "DENIED - BALCA AFFIRMED": {
      summary:
        "고용주가 거부 결정에 대해 노동 인증 항소 위원회(BALCA)에 항소했고, 위원회는 거부를 유지했습니다. 위원회는 결정의 근거가 된 기록을 검토하며, 거부 유지, 인증 담당관(Certifying Officer)에게 인증 승인 지시, 청문회 명령 중 하나를 내려야 합니다. 이 경우는 그중 첫 번째입니다. 규정은 노동부 안에서 더 이어지는 단계를 두지 않습니다.",
      action: null,
      deadline: null,
    },
    CERTIFIED: {
      summary:
        "노동부가 노동 인증을 승인했습니다. 여기서 PERM 단계가 끝납니다. 영주권도 아니고 청원서도 아닙니다. 고용주가 I-140을 제출할 때 쓰는 서류입니다.",
      action:
        "고용주는 인증이 유효한 동안 I-140을 제출해야 합니다. 기한 안에 제출하지 않은 인증은 만료되며, PERM 단계 전체를 다시 해야 합니다.",
      deadline: "노동부가 승인한 날로부터 역일 기준 180일 안에 I-140과 함께 제출해야 합니다.",
    },
    "CERTIFIED - EXPIRED": {
      summary:
        "노동부가 인증을 승인했고, 그 인증으로 I-140을 제출할 수 있는 180일 기한이 지났습니다. 규정은 분명합니다. 노동부가 승인한 날로부터 역일 기준 180일 안에 I-140 청원과 함께 제출되지 않은 인증은 만료됩니다.",
      action:
        "이것은 노동부가 아니라 저희의 해석입니다. 노동부는 이에 대해 아무 설명도 공개하지 않습니다. 만료는 달력상의 사건일 뿐, 아무것도 제출되지 않았다는 판단이 아닙니다. 노동부는 인증을 승인하고, USCIS는 I-140을 접수하며, I-140이 접수될 때 노동부에 알려진다는 근거는 없습니다. 그래서 고용주가 30일째에 제출한 케이스와 아무도 제출하지 않은 케이스가 모두 이 상태가 됩니다. 기한 안에 I-140이 제출되었다면 영향이 없습니다. 둘 중 어느 경우인지는 고용주의 변호사가 알고 있으며, 이 페이지는 알 수 없습니다.",
      deadline: null,
    },
    DENIED: {
      summary:
        "인증 담당관(Certifying Officer)이 신청을 거부했습니다. 거부 통지서에 사유가 적혀 있으며, 이후 두 가지 길이 있습니다. 같은 담당관의 재심, 또는 노동 인증 항소 위원회(BALCA)의 검토입니다.",
      action:
        "고용주는 재심을 요청하거나 BALCA에 검토를 요청할 수 있습니다. 두 기한을 모두 놓치면 행정 구제 절차를 다하지 않은 것으로 간주되어 거부가 확정됩니다. 새로 신청하는 것도 방법이며, 그쪽이 더 빠른 경우가 많습니다.",
      deadline: "두 가지 모두 거부 결정이 내려진 날로부터 30일입니다.",
    },
    WITHDRAWN: {
      summary:
        "고용주가 신청을 철회했습니다. 노동부는 사유를 기록하지 않으므로 여기서는 이유를 알 수 없습니다. 철회는 거부가 아니며 누구에게도 불리하게 작용하지 않습니다.",
      action: null,
      deadline: null,
    },
  },
  vi: {
    "ANALYST REVIEW": {
      summary:
        "Hàng chờ thông thường. Chuyên viên xét duyệt xử lý hồ sơ theo thứ tự nộp, và cho đến khi tới lượt hồ sơ này, không có gì thay đổi. Phần lớn hồ sơ đang chờ nằm ở đây, và việc duy nhất là chờ đợi.",
      action: null,
      deadline: null,
    },
    "IN PROCESS": {
      summary:
        "Một tình trạng đang chờ tồn tại song song với chuyên viên xét duyệt. DOL không công bố định nghĩa nào phân biệt hai tình trạng này, và số hồ sơ ở đây ít đến mức dữ liệu cũng không cho thấy quy luật nào.",
      action: null,
      deadline: null,
    },
    "APPLICATION ON HOLD": {
      summary:
        "Hồ sơ đang chờ và đã bị tách khỏi hàng chờ thông thường. DOL không công bố định nghĩa cho tình trạng này, nên trang này không thể cho bạn biết vì sao một hồ sơ cụ thể lại ở đây.",
      action: "Luật sư của chủ lao động có thể hỏi trực tiếp DOL. Không trang công khai nào trả lời được câu hỏi này.",
      deadline: null,
    },
    "RFI ISSUED": {
      summary:
        "DOL đã yêu cầu chủ lao động cung cấp thêm thông tin trước khi quyết định. Quy định cho phép viên chức chứng nhận (Certifying Officer) yêu cầu thông tin hoặc tài liệu bổ sung bất cứ lúc nào trước khi có quyết định cuối cùng. Yêu cầu bổ sung thông tin (RFI) không phải là kiểm tra (audit). Kiểm tra là một thủ tục chính thức theo một tiểu mục khác, với thời hạn cố định 30 ngày, và DOL xử lý hai việc này như hai tình trạng riêng, trong hai hàng chờ riêng.",
      action:
        "Chủ lao động phải trả lời. Chính lá thư đặt ra thời hạn, và lỡ thời hạn là lý do một hồ sơ lẽ ra được chứng nhận lại bị từ chối.",
      deadline: "Theo những gì lá thư ghi. Khác với kiểm tra, quy định không đặt thời hạn cố định cho việc này.",
    },
    "PENDING AUDIT RESPONSE": {
      summary:
        "Hồ sơ đã được chọn để kiểm tra (audit), hoặc vì quá trình xét duyệt phát hiện điều gì đó, hoặc ngẫu nhiên để kiểm soát chất lượng, và DOL đang chờ tài liệu.",
      action:
        "Chủ lao động phải gửi các tài liệu mà thư kiểm tra liệt kê. Lỡ hạn không chỉ có nguy cơ bị từ chối. Việc đó còn bị coi là từ chối sử dụng hết các biện pháp hành chính, và đóng lại con đường kháng cáo lên Hội đồng Kháng cáo Chứng nhận Lao động (BALCA).",
      deadline:
        "30 ngày kể từ ngày ghi trên thư kiểm tra. Viên chức chứng nhận (Certifying Officer) có thể tùy ý gia hạn một lần, tối đa thêm 30 ngày.",
    },
    "SUPERVISED RECRUITMENT": {
      summary:
        "DOL đã tiếp quản việc tuyển dụng. Chủ lao động phải đăng tuyển lại ở nơi DOL chỉ định, với nội dung DOL duyệt trước, và đơn ứng tuyển được gửi đến viên chức chứng nhận (Certifying Officer) thay vì chủ lao động.",
      action: "Chủ lao động phải gửi bản nháp quảng cáo tuyển dụng cho viên chức chứng nhận để được duyệt.",
      deadline: "30 ngày kể từ khi được thông báo rằng phải tuyển dụng có giám sát.",
    },
    "NORD ISSUED": {
      summary:
        "DOL không công bố tên đầy đủ của chữ viết tắt này hay định nghĩa của tình trạng, nên trang này sẽ không tự đặt ra. Điều đo được là đây là một tình trạng đang chờ, và rất ít hồ sơ ở tình trạng này.",
      action: "Chính thông báo ghi rõ DOL cần gì và hạn chót khi nào. Luật sư của chủ lao động có thông báo đó.",
      deadline: null,
    },
    "DETERMINATION ISSUED": {
      summary:
        "Một quyết định đã được đưa ra cho hồ sơ, nhưng tình trạng trực tuyến chưa cập nhật kết quả. DOL không công bố định nghĩa cho tình trạng trung gian này.",
      action: null,
      deadline: null,
    },
    "RECONSIDERATION APPEALS": {
      summary:
        "Hồ sơ đã bị từ chối và chủ lao động đã đề nghị viên chức chứng nhận (Certifying Officer) xem xét lại. Việc xem xét lại có phạm vi hẹp một cách có chủ ý: chỉ được dựa vào tài liệu DOL đã nhận, hoặc tài liệu đã có khi nộp đơn và được lưu lại để hỗ trợ đơn.",
      action:
        "Viên chức chứng nhận quyết định có xem xét lại hay không, và có thể xử lý yêu cầu như một đơn kháng cáo lên Hội đồng Kháng cáo Chứng nhận Lao động (BALCA).",
      deadline: "Yêu cầu phải được gửi trong vòng 30 ngày kể từ ngày ra quyết định từ chối.",
    },
    "REQUEST FOR REVIEW": {
      summary:
        "Chủ lao động đã đề nghị Hội đồng Kháng cáo Chứng nhận Lao động (BALCA) xem xét lại quyết định từ chối. BALCA xem xét dựa trên hồ sơ: bằng chứng là những gì viên chức chứng nhận (Certifying Officer) đã có, và phần gửi lên là lập luận pháp lý.",
      action: "BALCA quyết định. Chủ lao động không cần làm gì thêm.",
      deadline: "Yêu cầu phải được gửi trong vòng 30 ngày kể từ ngày có quyết định.",
    },
    "BALCA APPEALS": {
      summary:
        "Hồ sơ đang ở Hội đồng Kháng cáo Chứng nhận Lao động (BALCA). BALCA có thể giữ nguyên quyết định từ chối, chỉ thị viên chức chứng nhận (Certifying Officer) cấp chứng nhận, hoặc yêu cầu mở phiên điều trần.",
      action: "BALCA quyết định. Mọi bên có 30 ngày để nộp bản lập luận hoặc từ chối nộp.",
      deadline: null,
    },
    "DENIED - BALCA DISMISSED": {
      summary:
        "Một hồ sơ bị từ chối có đơn kháng cáo lên Hội đồng Kháng cáo Chứng nhận Lao động (BALCA) kết thúc mà Hội đồng không phán quyết về nội dung. DOL không công bố định nghĩa của tình trạng này, và các từ dismiss và dismissal (bác bỏ) hoàn toàn không xuất hiện trong mục quy định các quyết định của BALCA. Mục đó chỉ liệt kê giữ nguyên quyết định từ chối, chỉ thị viên chức cấp chứng nhận, hoặc yêu cầu mở phiên điều trần. Chỉ một hồ sơ trong toàn bộ dữ liệu có tình trạng này.",
      action: null,
      deadline: null,
    },
    "DENIED - BALCA AFFIRMED": {
      summary:
        "Chủ lao động đã kháng cáo quyết định từ chối lên Hội đồng Kháng cáo Chứng nhận Lao động (BALCA), và Hội đồng đã giữ nguyên quyết định. Hội đồng xem xét hồ sơ làm căn cứ cho quyết định và phải giữ nguyên quyết định từ chối, chỉ thị viên chức chứng nhận (Certifying Officer) cấp chứng nhận, hoặc yêu cầu mở phiên điều trần. Đây là trường hợp thứ nhất trong ba. Quy định không nêu bước nào tiếp theo trong DOL.",
      action: null,
      deadline: null,
    },
    CERTIFIED: {
      summary:
        "DOL đã cấp chứng nhận lao động. Giai đoạn PERM kết thúc ở đây. Đây không phải thẻ xanh (green card) và cũng không phải đơn bảo lãnh: đây là giấy tờ chủ lao động dùng khi nộp I-140.",
      action:
        "Chủ lao động phải nộp I-140 khi chứng nhận vẫn còn hiệu lực. Chứng nhận không được dùng đúng hạn sẽ hết hạn, và phải làm lại toàn bộ giai đoạn PERM.",
      deadline: "180 ngày theo lịch kể từ ngày DOL cấp, để nộp kèm Mẫu I-140.",
    },
    "CERTIFIED - EXPIRED": {
      summary:
        "DOL đã cấp chứng nhận và thời hạn 180 ngày để nộp I-140 kèm chứng nhận đó đã qua. Quy định ghi rõ: chứng nhận hết hạn nếu không được nộp kèm đơn I-140 trong vòng 180 ngày theo lịch kể từ ngày DOL cấp.",
      action:
        "Đây là cách hiểu của chúng tôi, không phải của DOL, vì DOL không công bố ghi chú nào về việc này: hết hạn là một sự kiện theo lịch, không phải kết luận rằng không có gì được nộp. DOL cấp chứng nhận, USCIS nhận I-140, và không có gì cho thấy DOL được báo khi có một đơn I-140 được nộp. Vì vậy, một hồ sơ mà chủ lao động đã nộp vào ngày thứ 30 và một hồ sơ chưa từng ai nộp đều hiện tình trạng này. Nếu I-140 đã được nộp trong thời hạn thì không bị ảnh hưởng. Luật sư của chủ lao động biết đó là trường hợp nào. Trang này không thể biết.",
      deadline: null,
    },
    DENIED: {
      summary:
        "Viên chức chứng nhận (Certifying Officer) đã từ chối đơn. Thư từ chối nêu lý do, và sau đó có hai con đường: xin chính viên chức đó xem xét lại, hoặc xin Hội đồng Kháng cáo Chứng nhận Lao động (BALCA) xem xét.",
      action:
        "Chủ lao động có thể xin xem xét lại hoặc đề nghị BALCA xem xét. Lỡ cả hai thời hạn bị coi là không sử dụng hết các biện pháp hành chính, và quyết định từ chối trở thành chung cuộc. Nộp một đơn mới cũng là một lựa chọn, và thường nhanh hơn.",
      deadline: "30 ngày kể từ ngày ra quyết định từ chối, cho cả hai con đường.",
    },
    WITHDRAWN: {
      summary:
        "Chủ lao động đã rút đơn. DOL không ghi lại lý do, nên ở đây không thể biết vì sao. Rút đơn không phải là bị từ chối và không bất lợi cho ai.",
      action: null,
      deadline: null,
    },
  },
} satisfies Omit<Messages<MeaningTexts>, "en">;

/** How to word the fact that a status carries a clock: the verdict chip above a case's answer. */
export const KIND_LABELS: Messages<Record<StatusKind, string>> = {
  en: { queue: "Waiting", action: "Something is due", appeal: "Under appeal", decided: "Decided" },
  es: { queue: "Esperando", action: "Hay algo que hacer", appeal: "En apelación", decided: "Decidido" },
  zh: { queue: "等待中", action: "需要处理", appeal: "上诉中", decided: "已判定" },
  "pt-br": { queue: "Aguardando", action: "Há algo a fazer", appeal: "Em recurso", decided: "Decidido" },
  ko: { queue: "대기 중", action: "조치 필요", appeal: "항소 중", decided: "결정됨" },
  vi: { queue: "Đang chờ", action: "Cần xử lý", appeal: "Đang kháng cáo", decided: "Đã có quyết định" },
};
