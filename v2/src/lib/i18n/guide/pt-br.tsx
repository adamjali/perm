import { D, En } from "@/components/i18n/guideParts";
import { ENGLISH_GUIDE } from "../locales";
import type { GuideCopy } from "./types";

/**
 * Brazilian Portuguese, "você" register. "Visa Bulletin", "green card" and
 * "EB-3 Other Workers" stay in English because that is how Brazilian
 * applicants search for and say them; each is explained where it first appears.
 */
export const ptBr: GuideCopy = {
  title: "Green card por emprego, passo a passo",
  description:
    "Como consultar seu caso no Departamento do Trabalho, em que mês está a fila, o que vem depois do PERM e as datas do Visa Bulletin para o seu país.",
  eyebrow: "PERM Tracker em português",
  h1: "Esperando um green card por emprego",
  lede: "Como consultar seu caso por conta própria, em que mês está hoje a fila do Departamento do Trabalho (DOL), quais etapas vêm depois do PERM e as datas de corte do Visa Bulletin para o seu país. Nada aqui é orientação jurídica: seu advogado conhece o seu caso.",
  translationNote: (
    <>
      Esta página é uma versão traduzida do nosso <En href={ENGLISH_GUIDE}>guia em inglês</En>. Números de caso, nomes de formulários, datas e os termos de status usados pelo DOL e pelo USCIS ficam em inglês, exatamente como as agências publicam, com uma explicação ao lado. As páginas de dados indicadas neste guia estão em inglês.
    </>
  ),
  onThisPage: "Nesta página",
  toc: {
    check: "Consulte seu caso",
    queue: "A fila do DOL hoje",
    steps: "Depois do PERM",
    "eb3-other-workers": "EB-3 Other Workers",
    cutoffs: "Datas para o seu país",
    statuses: "Termos de status",
  },
  check: {
    h2: "Consulte seu caso você mesmo",
    intro: "O sistema de status de casos do Departamento do Trabalho (DOL) responde a qualquer pessoa que tenha um número de caso, inclusive casos ainda pendentes. Não é preciso conta nem senha.",
    label: "Número do caso no DOL",
    button: "Consultar",
    formats: (
      <>
        PERM: <D>G-100-26125-868956</D>. Pedido de salário prevalecente (PWD): começa com <D>P-100-</D>. LCA de H-1B: começa com <D>I-200-</D>.
      </>
    ),
    after: "O resultado abre em inglês: o termo de status do DOL, a data em que o DOL recebeu o caso e o nome do empregador. O significado de cada termo está explicado mais abaixo. Na página do resultado você também pode deixar seu e-mail e receber uma mensagem sempre que o status mudar (os e-mails são em inglês).",
    noNumber: (
      <>
        Não tem o número? Peça a quem protocolou o seu caso: ele aparece no recibo. Você também pode procurar pelo empregador na <En href="/case-search">busca de casos</En> (em inglês).
      </>
    ),
  },
  queue: {
    h2: "Em que mês está a fila do DOL",
    permLabel: "O DOL está analisando pedidos PERM protocolados em",
    averageLabel: "Média de dias até a decisão",
    days: (n) => <>{n} dias</>,
    pwdLabel: "Pedidos de salário prevalecente em análise, recebidos em",
    asOf: (d) => (
      <>Números publicados pelo próprio DOL, em {d}. Eles mudam quando o DOL publica de novo, em geral toda semana.</>
    ),
    missing: (
      <>
        Não é possível ler os números do DOL agora. Eles estão na <En href="/perm-queue">página da fila do PERM</En> (em inglês).
      </>
    ),
    meaning: [
      "O DOL analisa os pedidos PERM mais ou menos na ordem em que os recebeu, mês a mês. Se o seu caso foi protocolado no mês mostrado acima, ou antes, um analista está trabalhando no seu mês agora. Se foi depois, o seu mês ainda está mais atrás na fila.",
      "A média acima inclui todos os casos decididos recentemente, inclusive os lentos, com auditoria ou com pedido de informações (RFI). Por isso, um caso sem complicações costuma levar menos tempo que essa média.",
      <>
        Para uma estimativa a partir da sua própria data de protocolo, use a <En href="/tools/perm-timeline-calculator">calculadora de prazos do PERM</En> (em inglês). É uma estimativa, não uma promessa, e a precisão dela é publicada no <En href="/estimate-scorecard">placar das estimativas</En> (em inglês).
      </>,
    ],
  },
  steps: {
    h2: "O que vem depois do PERM",
    intro: "Quando o DOL certifica o PERM, o caso passa para o USCIS (Serviço de Cidadania e Imigração dos EUA) e, daí em diante, depende do Visa Bulletin.",
    items: [
      {
        form: "ETA-9089",
        name: "Certificação trabalhista PERM (DOL)",
        body: "O DOL confirma que não havia trabalhador americano qualificado disponível para a vaga. A data em que o DOL recebeu o pedido é a sua data de prioridade (priority date), e ela vale para todas as etapas seguintes.",
      },
      {
        form: "I-140",
        name: "Petição de imigrante (USCIS)",
        body: (
          <>
            O empregador precisa protocolar a I-140 em até 180 dias depois da certificação; senão, a certificação expira. O processamento normal leva meses; com o processamento premium (premium processing), pago à parte, o USCIS decide a maioria das petições baseadas em PERM em cerca de 15 dias úteis. O USCIS dá um número de recibo com três letras e dez dígitos, como <D>IOE0912345678</D>, que você consulta no site do próprio USCIS.
          </>
        ),
      },
      {
        form: "Visa Bulletin",
        name: "A espera pela data de prioridade",
        body: "Todo ano existe um número fixo de green cards por emprego, com um limite por país. Quando há mais candidatos do que vistos, o Departamento de Estado publica todo mês uma data de corte. Você só pode dar o último passo quando a sua data de prioridade é anterior à data de corte da sua categoria e do seu país. Veja a tabela mais abaixo.",
      },
      {
        form: "I-485",
        name: "Ajuste de status, dentro dos EUA (USCIS)",
        body: "Quando chega a sua vez, você protocola a I-485 para receber o green card sem sair do país. A maioria protocola junto a I-765 (autorização de trabalho, a EAD) e a I-131 (advance parole, uma autorização de viagem). Todo mês o USCIS informa qual tabela do boletim aceita: as datas de ação final ou as datas para protocolo.",
      },
      {
        form: "DS-260",
        name: "Processamento consular, fora dos EUA (Departamento de Estado)",
        body: "Se você está fora do país, o caso vai para o National Visa Center (Centro Nacional de Vistos), você preenche o DS-260 e faz uma entrevista em uma embaixada ou consulado dos EUA.",
      },
    ],
    skipPerm: "Petições EB-1 e EB-2 com dispensa por interesse nacional (NIW) não passam pelo PERM: começam direto na I-140.",
  },
  ew3: {
    h2: "EB-3 Other Workers (outros trabalhadores)",
    body: [
      "EB-3 Other Workers é a parte do EB-3 para vagas que exigem menos de dois anos de treinamento ou experiência. Quem decide a categoria são os requisitos da vaga no PERM, não a sua formação: uma pessoa com diploma, numa vaga que pede seis meses de experiência, conta como Other Worker.",
      "Ele tem a sua própria linha no Visa Bulletin e um limite de até 10.000 vistos por ano, por isso a data de corte costuma ficar anos atrás do restante do EB-3. Compare as linhas EB-3 e EB-3 Other Workers na tabela abaixo.",
      <>
        Saiba mais: o <En href="/guides/eb3-other-workers">guia completo do EB-3 Other Workers</En> (em inglês) e <En href="/tools/green-card-line?category=EW3">quantas pessoas estão à sua frente nessa fila</En> (em inglês).
      </>,
    ],
  },
  cutoffs: {
    h2: "Datas de corte para o seu país",
    intro: (m) => (
      <>Do Visa Bulletin do Departamento de Estado de {m}, o mais recente que este site tem. Uma data significa que quem tem data de prioridade anterior a ela pode seguir adiante.</>
    ),
    birth: "A tabela que vale para você depende do país onde você nasceu, não da nacionalidade. Quem nasceu no Brasil ou em Portugal usa a tabela de todos os outros países. Em alguns casos é possível usar o país de nascimento do cônjuge; converse com seu advogado.",
    head: { category: "Categoria", finalAction: "Data de ação final", datesForFiling: "Data para protocolo" },
    countryName: { worldwide: "Todos os outros países (inclui o Brasil)" },
    category: {
      EB1: "EB-1 (trabalhadores prioritários)",
      EB2: "EB-2 (formação avançada)",
      EB3: "EB-3 (profissionais e trabalhadores qualificados)",
      EW3: "EB-3 Other Workers",
    },
    current: "em dia: aberta para qualquer data de prioridade",
    unavailable: "sem vistos neste mês",
    notPrinted: "não publicada",
    legend: [
      "Data de ação final (Final Action Date): quando o green card pode de fato ser aprovado.",
      "Data para protocolo (Date for Filing): quando você pode protocolar a I-485 antes, se o USCIS aceitar essa tabela naquele mês.",
      <>
        Todos os meses estão na <En href="/visa-bulletin">página do Visa Bulletin</En> (em inglês), e a <En href="/tools/priority-date-calculator">calculadora de data de prioridade</En> (em inglês) compara a sua própria data.
      </>,
    ],
    missing: (
      <>
        Não é possível ler o boletim agora. Todos os meses estão na <En href="/visa-bulletin">página do Visa Bulletin</En> (em inglês).
      </>
    ),
  },
  statuses: {
    h2: "Os termos de status do DOL",
    intro: "A consulta mostra o status do DOL em inglês, do jeito que ele publica. O que cada um quer dizer:",
    gloss: {
      "ANALYST REVIEW": "Na fila normal, esperando um analista. A maioria dos casos pendentes está aqui.",
      "APPLICATION ON HOLD": "Pendente, mas separado da fila normal. O DOL não publica o motivo.",
      "RFI ISSUED": "O DOL pediu mais informações ao empregador antes de decidir. Não é uma negativa.",
      "PENDING AUDIT RESPONSE": "O caso foi escolhido para auditoria e o DOL está esperando os documentos do empregador.",
      "SUPERVISED RECRUITMENT": "O DOL exige que o empregador anuncie a vaga de novo, sob a supervisão dele.",
      "NORD ISSUED": "Um status pendente que o DOL não define publicamente. Pouquíssimos casos estão nele.",
      "RECONSIDERATION APPEALS": "O caso foi negado e o empregador pediu ao DOL que reconsiderasse.",
      "BALCA APPEALS": "O empregador recorreu da negativa à junta de recursos de certificação trabalhista (BALCA).",
      CERTIFIED: "Aprovado pelo DOL. A etapa do PERM termina aqui; a próxima é a I-140.",
      "CERTIFIED - EXPIRED": "O DOL mostra isso quando passam 180 dias da certificação. Se a I-140 foi protocolada dentro desses 180 dias, a certificação foi usada a tempo.",
      DENIED: "O DOL negou o pedido. O empregador pode pedir reconsideração ou recorrer à BALCA.",
      WITHDRAWN: "O empregador retirou o pedido. Não é uma negativa, e o DOL não registra o motivo.",
    },
  },
  limits: {
    h2: "O que esta página não consegue dizer",
    items: [
      "Quando o seu caso específico vai ser decidido. Os números acima descrevem a fila inteira do DOL, não o seu processo.",
      "Por que uma decisão saiu do jeito que saiu. O DOL publica resultados, não motivos.",
      "Nada que substitua a orientação do seu advogado. Não mude de emprego, não viaje e não tome outra decisão importante com base num número da fila.",
    ],
  },
  more: {
    h2: "Páginas em inglês",
    links: [
      { href: "/perm-case-status", label: "Consulta de casos" },
      { href: "/perm-queue", label: "A fila do PERM por mês de protocolo" },
      { href: "/tools/perm-timeline-calculator", label: "Calculadora de prazos do PERM" },
      { href: "/visa-bulletin", label: "Visa Bulletin" },
      { href: "/tools/priority-date-calculator", label: "Calculadora de data de prioridade" },
      { href: "/tools/green-card-line", label: "O seu lugar na fila do green card" },
      { href: "/tools/which-green-card", label: "Qual green card por emprego se aplica a você" },
      { href: "/uscis-processing-times", label: "Prazos de processamento do USCIS" },
      { href: ENGLISH_GUIDE, label: "O guia completo em inglês" },
    ],
  },
};
