import { D, En } from "@/components/i18n/guideParts";
import { ENGLISH_GUIDE } from "../locales";
import type { GuideCopy } from "./types";

/**
 * Korean, formal polite register. Terms follow what Korean applicants in the
 * US use: 노동허가 for PERM, 문호 for bulletin cutoffs, 적정임금 for the
 * prevailing wage, 워크퍼밋 and 여행허가서 for the EAD and advance parole,
 * 비숙련직 for EB-3 Other Workers, 승인일/접수일 기준 for the two charts.
 */
export const ko: GuideCopy = {
  title: "취업이민 영주권, 단계별 안내",
  description:
    "미국 노동부 케이스를 직접 조회하는 방법, 노동부 심사가 몇 월까지 왔는지, PERM 이후의 절차, 출생 국가별 영주권 문호를 안내합니다.",
  eyebrow: "PERM Tracker 한국어",
  h1: "취업이민 영주권을 기다리는 분들께",
  lede: "케이스 상태를 직접 조회하는 방법, 미국 노동부(DOL) 심사가 오늘 어디까지 왔는지, PERM 이후에 남은 절차, 그리고 출생 국가별 영주권 문호(비자 블레틴의 기준일)를 정리했습니다. 이 페이지는 법률 자문이 아니며, 케이스는 담당 변호사가 가장 잘 압니다.",
  translationNote: (
    <>
      이 페이지는 <En href={ENGLISH_GUIDE}>영문 가이드</En>를 번역해 정리한 것입니다. 케이스 번호, 서류 이름, 날짜, 그리고 노동부와 이민국이 쓰는 상태 표현은 기관이 표기하는 그대로 영어로 두고 옆에 설명을 붙였습니다. 이 가이드에서 연결되는 데이터 페이지는 영어로 되어 있습니다.
    </>
  ),
  onThisPage: "이 페이지의 내용",
  toc: {
    check: "케이스 조회",
    queue: "노동부 심사 현황",
    steps: "PERM 이후의 절차",
    "eb3-other-workers": "EB-3 비숙련직",
    cutoffs: "국가별 문호",
    statuses: "상태 표현 설명",
  },
  check: {
    h2: "케이스를 직접 조회하기",
    intro: "미국 노동부(DOL)의 케이스 상태 시스템은 케이스 번호만 있으면 누구에게나 답합니다. 아직 심사 중인 케이스도 조회되며, 계정이나 로그인이 필요 없습니다.",
    label: "노동부 케이스 번호",
    button: "조회",
    formats: (
      <>
        PERM: <D>G-100-26125-868956</D>. 적정임금(PWD) 신청: <D>P-100-</D>으로 시작. H-1B LCA: <D>I-200-</D>으로 시작.
      </>
    ),
    after: "조회 결과는 영어로 표시됩니다. 노동부의 상태 표현, 노동부가 케이스를 접수한 날짜, 고용주 이름이 나옵니다. 각 상태 표현의 뜻은 아래에서 설명합니다. 결과 페이지에서 이메일 주소를 남기면 상태가 바뀔 때마다 알림을 한 통씩 받을 수 있습니다(알림 메일은 영어입니다).",
    noNumber: (
      <>
        케이스 번호가 없으신가요? 케이스를 제출한 변호사나 고용주에게 요청하세요. 접수증에 적혀 있습니다. <En href="/case-search">케이스 검색</En>(영어)에서 고용주 이름으로 찾을 수도 있습니다.
      </>
    ),
  },
  queue: {
    h2: "노동부 심사가 어디까지 왔나",
    permLabel: "노동부가 지금 심사 중인 PERM 신청의 접수 월",
    averageLabel: "결정까지 걸린 평균 일수",
    days: (n) => <>{n}일</>,
    pwdLabel: "지금 처리 중인 적정임금 신청의 접수 월",
    asOf: (d) => <>노동부가 직접 발표한 수치이며 {d} 기준입니다. 노동부가 새로 발표할 때(보통 매주) 바뀝니다.</>,
    missing: (
      <>
        지금은 노동부 수치를 읽을 수 없습니다. <En href="/perm-queue">PERM 대기열 페이지</En>(영어)에서 확인하세요.
      </>
    ),
    meaning: [
      "노동부는 PERM 신청을 대체로 접수한 순서대로, 한 달 단위로 심사합니다. 케이스를 위에 표시된 달이나 그 이전에 접수했다면 지금 분석관이 그 달을 처리하고 있습니다. 그보다 늦게 접수했다면 해당 달은 아직 대기열 뒤쪽에 있습니다.",
      "위의 평균에는 최근에 결정된 모든 케이스가 들어 있고, 감사(audit)나 추가 정보 요청(RFI)으로 늦어진 케이스도 포함됩니다. 그래서 문제없이 진행되는 케이스는 보통 이 평균보다 빨리 끝납니다.",
      <>
        본인의 접수일로 예상 시기를 계산하려면 <En href="/tools/perm-timeline-calculator">PERM 기간 계산기</En>(영어)를 이용하세요. 추정치일 뿐 약속이 아니며, 그 정확도는 <En href="/estimate-scorecard">추정 성적표</En>(영어)에 공개되어 있습니다.
      </>,
    ],
  },
  steps: {
    h2: "PERM 이후의 절차",
    intro: "노동부가 PERM을 승인하면 케이스는 미국 이민국(USCIS)으로 넘어가고, 그다음은 비자 블레틴의 문호에 달려 있습니다.",
    items: [
      {
        form: "ETA-9089",
        name: "PERM 노동허가(노동부)",
        body: "노동부가 이 직책에 자격을 갖춘 미국인 근로자가 없다는 것을 확인하는 단계입니다. 노동부가 신청서를 접수한 날짜가 우선일자(priority date)가 되며, 이후 모든 단계에서 이 날짜가 기준이 됩니다.",
      },
      {
        form: "I-140",
        name: "이민 청원(이민국)",
        body: (
          <>
            고용주는 PERM 승인 후 180일 안에 I-140을 제출해야 하며, 그러지 않으면 노동허가가 만료됩니다. 일반 처리는 몇 달이 걸리고, 추가 비용을 내는 급행 처리(premium processing)를 쓰면 이민국이 PERM 기반 청원 대부분을 약 15영업일 안에 결정합니다. 이민국은 <D>IOE0912345678</D>처럼 영문 세 글자와 숫자 열 자리로 된 접수번호(receipt number)를 주며, 이민국 웹사이트에서 조회합니다.
          </>
        ),
      },
      {
        form: "Visa Bulletin",
        name: "우선일자 문호 기다리기",
        body: "취업이민 영주권은 해마다 정해진 수만큼만 나오고, 국가별 상한도 있습니다. 신청자가 쿼터보다 많으면 국무부가 매달 기준일(문호)을 발표합니다. 우선일자가 해당 카테고리와 국가의 기준일보다 앞서야 마지막 단계를 진행할 수 있습니다. 아래 표를 참고하세요.",
      },
      {
        form: "I-485",
        name: "신분조정, 미국 내(이민국)",
        body: "문호가 열리면 I-485를 제출해 미국을 떠나지 않고 영주권을 받습니다. 대부분 I-765(워크퍼밋, EAD)와 I-131(여행허가서, advance parole)을 함께 제출합니다. 이민국은 매달 비자 블레틴의 두 표 가운데 어느 쪽을 받는지 발표합니다. 승인일 기준(Final Action Date) 아니면 접수일 기준(Date for Filing)입니다.",
      },
      {
        form: "DS-260",
        name: "영사 수속, 미국 밖(국무부)",
        body: "해외에 있다면 케이스는 국립비자센터(National Visa Center)로 넘어가고, DS-260을 작성한 뒤 미국 대사관이나 영사관에서 인터뷰를 합니다.",
      },
    ],
    skipPerm: "EB-1과 EB-2 국익면제(NIW) 청원은 PERM을 거치지 않고 I-140에서 바로 시작합니다.",
  },
  ew3: {
    h2: "EB-3 비숙련직(Other Workers)",
    body: [
      "EB-3 비숙련직은 EB-3 가운데 2년 미만의 훈련이나 경력이 필요한 직책을 위한 부분입니다. 카테고리를 정하는 것은 본인의 학력이 아니라 PERM에 적힌 직책의 요건입니다. 학위가 있는 사람이라도 경력 6개월을 요구하는 직책이면 비숙련직입니다.",
      "비자 블레틴에 별도의 줄이 있고 연간 쿼터가 최대 10,000개라서, 문호가 보통 나머지 EB-3보다 몇 년 뒤처져 있습니다. 아래 표에서 EB-3와 EB-3 비숙련직 두 줄을 비교해 보세요.",
      <>
        더 알아보기: <En href="/guides/eb3-other-workers">EB-3 비숙련직 전체 가이드</En>(영어), 그리고 <En href="/tools/green-card-line?category=EW3">그 줄에서 내 앞에 몇 명이 있는지</En>(영어).
      </>,
    ],
  },
  cutoffs: {
    h2: "출생 국가별 영주권 문호",
    intro: (m) => (
      <>국무부의 {m} 비자 블레틴 자료이며, 이 사이트에 있는 가장 최근 호입니다. 표의 날짜는 그보다 앞선 우선일자를 가진 사람이 다음 단계로 진행할 수 있다는 뜻입니다.</>
    ),
    birth: "어느 표를 볼지는 국적이 아니라 출생 국가로 정해집니다. 한국에서 태어났다면 '그 밖의 모든 국가' 표를 보면 됩니다. 경우에 따라 배우자의 출생 국가를 기준으로 할 수도 있으니 변호사와 상의하세요.",
    head: { category: "카테고리", finalAction: "승인일 기준(Final Action)", datesForFiling: "접수일 기준(Date for Filing)" },
    countryName: { worldwide: "그 밖의 모든 국가(한국 포함)" },
    category: {
      EB1: "EB-1 (우선 근로자)",
      EB2: "EB-2 (고학력 전문직)",
      EB3: "EB-3 (전문직·숙련직)",
      EW3: "EB-3 비숙련직",
    },
    current: "커런트: 모든 우선일자 진행 가능",
    unavailable: "이번 달 쿼터 없음",
    notPrinted: "발표되지 않음",
    legend: [
      "승인일 기준(Final Action Date): 영주권을 실제로 승인할 수 있는 시점입니다.",
      "접수일 기준(Date for Filing): 이민국이 그달에 이 표를 받는다면 I-485를 미리 제출할 수 있는 시점입니다.",
      <>
        매달의 전체 자료는 <En href="/visa-bulletin">비자 블레틴 페이지</En>(영어)에 있고, <En href="/tools/priority-date-calculator">우선일자 계산기</En>(영어)로 본인의 날짜를 비교할 수 있습니다.
      </>,
    ],
    missing: (
      <>
        지금은 비자 블레틴을 읽을 수 없습니다. 매달의 자료는 <En href="/visa-bulletin">비자 블레틴 페이지</En>(영어)에 있습니다.
      </>
    ),
  },
  statuses: {
    h2: "노동부의 상태 표현",
    intro: "케이스 조회 결과에는 노동부의 상태가 영어 그대로 나옵니다. 각각의 뜻은 다음과 같습니다.",
    gloss: {
      "ANALYST REVIEW": "일반 대기열에서 분석관의 심사를 기다리는 중입니다. 심사 중인 케이스 대부분이 이 상태입니다.",
      "APPLICATION ON HOLD": "심사 중이지만 일반 대기열에서 따로 빠져 있습니다. 노동부는 이유를 공개하지 않습니다.",
      "RFI ISSUED": "노동부가 결정 전에 고용주에게 추가 정보를 요청했습니다. 거절이 아닙니다.",
      "PENDING AUDIT RESPONSE": "케이스가 감사 대상으로 선정되어 노동부가 고용주의 서류를 기다리는 중입니다.",
      "SUPERVISED RECRUITMENT": "노동부가 고용주에게 노동부의 감독 아래 채용 광고를 다시 하도록 요구했습니다.",
      "NORD ISSUED": "노동부가 공개적으로 정의하지 않은 심사 중 상태입니다. 해당 케이스는 매우 적습니다.",
      "RECONSIDERATION APPEALS": "거절된 케이스에 대해 고용주가 노동부에 재심을 요청했습니다.",
      "BALCA APPEALS": "고용주가 거절 결정에 대해 노동허가 항소위원회(BALCA)에 항소했습니다.",
      CERTIFIED: "노동부가 승인했습니다. PERM 단계가 끝났고 다음은 I-140입니다.",
      "CERTIFIED - EXPIRED": "승인 후 180일이 지나면 노동부가 이렇게 표시합니다. I-140을 그 180일 안에 제출했다면 노동허가는 기한 안에 사용된 것입니다.",
      DENIED: "노동부가 신청을 거절했습니다. 고용주는 재심을 요청하거나 BALCA에 항소할 수 있습니다.",
      WITHDRAWN: "고용주가 신청을 철회했습니다. 거절이 아니며, 노동부는 이유를 기록하지 않습니다.",
    },
  },
  limits: {
    h2: "이 페이지로 알 수 없는 것",
    items: [
      "본인 케이스가 정확히 언제 결정될지. 위의 수치는 노동부 대기열 전체를 보여 줄 뿐, 개인 파일에 대한 것이 아닙니다.",
      "결정이 왜 그렇게 났는지. 노동부는 결과만 공개하고 이유는 공개하지 않습니다.",
      "변호사의 조언을 대신할 수 있는 것. 대기열 수치만 보고 이직이나 출국 같은 중요한 결정을 내리지 마세요.",
    ],
  },
  more: {
    h2: "영어 페이지",
    links: [
      { href: "/perm-case-status", label: "케이스 조회" },
      { href: "/perm-queue", label: "접수 월별 PERM 대기열" },
      { href: "/tools/perm-timeline-calculator", label: "PERM 기간 계산기" },
      { href: "/visa-bulletin", label: "비자 블레틴" },
      { href: "/tools/priority-date-calculator", label: "우선일자 계산기" },
      { href: "/tools/green-card-line", label: "영주권 대기줄에서 내 위치" },
      { href: "/tools/which-green-card", label: "나에게 맞는 취업 이민 영주권 종류" },
      { href: "/uscis-processing-times", label: "이민국 처리 기간" },
      { href: ENGLISH_GUIDE, label: "영문 전체 가이드" },
    ],
  },
};
