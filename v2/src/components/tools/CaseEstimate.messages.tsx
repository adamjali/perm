import type { ReactNode } from "react";

import type { Messages } from "@/lib/i18n/lang";
import type { EstimateModelId } from "@/lib/perm";

/**
 * The estimate panel's own words. A sentence that carries a bold figure or a link takes the rendered piece and
 * places it, so each language puts it where its grammar wants it; the English entries keep the panel's markup as
 * it was. DOL's status words stay as printed. The two pages it links to exist only in English, and say so.
 */
export interface EstimatePanelText {
  noDateTitle: string;
  /** A measured stage's population average: "{170 days}" in bold. */
  stageAge: (days: ReactNode) => ReactNode;
  /** This one case's own wait, never called an average. */
  caseAge: (days: ReactNode) => ReactNode;
  days: (n: string) => string;
  /** "Cases that reach this stage leave it after {about 30 days} (the median)." */
  leave: (about: ReactNode) => ReactNode;
  aboutDays: (n: string) => ReactNode;
  leaveMeasured: (eligible: string) => ReactNode;
  /** `to` is the bold destination; `analyst` says it is the ordinary queue. */
  nextStep: (pct: ReactNode, observed: string, to: ReactNode, analyst: boolean) => ReactNode;
  /** The destination printed when it's analyst review: DOL's words, glossed. */
  analystReview: string;
  nextUnknown: string;
  dateTitle: string;
  around: (date: ReactNode) => ReactNode;
  /** The window sentence, worded for what each model's range is. */
  window: (model: EstimateModelId, measured: boolean, from: ReactNode, to: ReactNode) => ReactNode;
  totalDays: (n: string) => ReactNode;
  howSummary: string;
  modelLine: (label: string, basis: string, source: string) => ReactNode;
  adjusted: (percentile: number) => ReactNode;
  everyModel: (calculator: ReactNode, methodology: ReactNode) => ReactNode;
  calculatorLink: string;
  methodologyLink: string;
}

export const ESTIMATE_PANEL = {
  en: {
    noDateTitle: "No date can honestly be put on this case",
    stageAge: (d) => (
      <>
        Cases at this stage have been pending a measured average of{" "}
        {d}{" "}
        since filing.
      </>
    ),
    caseAge: (d) => (
      <>
        This case has been pending{" "}
        {d}{" "}
        since it was filed.
      </>
    ),
    days: (n) => `${n} days`,
    leave: (about) => (
      <>
        Cases that reach this stage leave it after{" "}
        {about}
        {" "}(the median).
      </>
    ),
    aboutDays: (n) => <>about {n} days</>,
    leaveMeasured: (e) => (
      <>
        Measured over {e} cases followed from arrival: time
        at this stage, not time to a decision.
      </>
    ),
    nextStep: (pct, observed, to, analyst) => (
      <>
        What usually happens next:{" "}
        {pct}{" "}
        of the {observed} cases we have
        watched leave this stage went to{" "}
        {to}
        {analyst
          ? " - back into the ordinary queue, where DOL's published position applies again."
          : "."}
      </>
    ),
    analystReview: "analyst review",
    nextUnknown: "How long that takes is not something we can measure yet.",
    dateTitle: "When this case could be decided",
    around: (d) => <>Around {d}</>,
    window: (model, measured, a, b) => (
      <>
        {model === "decision-pace"
          ? measured
            ? "Going by how far recent decisions landed from their dates, between "
            : "If DOL keeps its recent pace, between "
          : model === "queue-advance"
            ? "At the fastest and slowest the queue has moved, between "
            : model === "rfi-clock"
              ? "Going by how RFIs have gone, between "
            : model === "stragglers"
              ? "Half of the cases still in line behind DOL's queue are decided by the date above, and eight in ten between "
              : "Between "}
        <b>{a}</b> and <b>{b}</b>.{" "}
      </>
    ),
    totalDays: (n) => <>{n} days from filing. An estimate, not a promise.</>,
    howSummary: "How this is worked out",
    modelLine: (l, basis, source) => (
      <>
        {l}: {basis} Source: {source}
      </>
    ),
    adjusted: (p) => <>Adjusted for the case&apos;s stage: the {p}th percentile of its filing month.</>,
    everyModel: (calc, method) => (
      <>
        Every model and its spread, side by side, is on{" "}
        {calc}, and how each
        is computed on {method}.
      </>
    ),
    calculatorLink: "the processing time calculator",
    methodologyLink: "the methodology page",
  },
  es: {
    noDateTitle: "No se puede poner una fecha honesta a este caso",
    stageAge: (d) => <>Los casos en esta etapa llevan pendientes un promedio medido de {d} desde la presentación.</>,
    caseAge: (d) => <>Este caso lleva pendiente {d} desde que se presentó.</>,
    days: (n) => `${n} días`,
    leave: (about) => <>Los casos que llegan a esta etapa salen de ella después de {about} (la mediana).</>,
    aboutDays: (n) => <>unos {n} días</>,
    leaveMeasured: (e) => <>Medido en {e} casos seguidos desde que llegaron. Es el tiempo en esta etapa, no el tiempo hasta una decisión.</>,
    nextStep: (pct, observed, to, analyst) => (
      <>
        Lo que suele pasar después: el {pct} de los {observed} casos que hemos visto salir de esta etapa pasaron a {to}
        {analyst ? ", es decir, volvieron a la fila normal, donde la posición que publica el DOL vuelve a aplicarse." : "."}
      </>
    ),
    analystReview: "ANALYST REVIEW (revisión por un analista)",
    nextUnknown: "Cuánto tarda eso todavía no lo podemos medir.",
    dateTitle: "Cuándo se podría decidir este caso",
    around: (d) => <>Alrededor del {d}</>,
    window: (model, measured, a, b) => (
      <>
        {model === "decision-pace"
          ? measured
            ? "Según cuánto se alejaron las decisiones recientes de sus fechas, entre el "
            : "Si el DOL mantiene su ritmo reciente, entre el "
          : model === "queue-advance"
            ? "Según lo más rápido y lo más lento que se ha movido la fila, entre el "
            : model === "rfi-clock"
              ? "Según cómo han ido las RFI, entre el "
              : model === "stragglers"
                ? "La mitad de los casos que la fila del DOL ya dejó atrás y siguen esperando se deciden antes de la fecha de arriba, y ocho de cada diez entre el "
                : "Entre el "}
        <b>{a}</b> y el <b>{b}</b>.{" "}
      </>
    ),
    totalDays: (n) => <>{n} días desde la presentación. Es una estimación, no una promesa.</>,
    howSummary: "Cómo se calcula",
    modelLine: (l, basis, source) => (
      <>
        {l}: {basis} Fuente: {source}
      </>
    ),
    adjusted: (p) => <>Ajustado a la etapa del caso: el percentil {p} de su mes de presentación.</>,
    everyModel: (calc, method) => (
      <>
        Todos los modelos y su rango, uno al lado del otro, están en {calc}, y cómo se calcula cada uno, en {method}.
      </>
    ),
    calculatorLink: "la calculadora de tiempos de procesamiento (en inglés)",
    methodologyLink: "la página de metodología (en inglés)",
  },
  zh: {
    noDateTitle: "目前无法为这个案件给出可靠的日期",
    stageAge: (d) => <>这个阶段的案件自递交以来，实测平均已等待 {d}。</>,
    caseAge: (d) => <>这个案件自递交以来已等待 {d}。</>,
    days: (n) => `${n} 天`,
    leave: (about) => <>进入这个阶段的案件，通常在{about}后离开这个阶段（中位数）。</>,
    aboutDays: (n) => <>约 {n} 天</>,
    leaveMeasured: (e) => <>根据从进入时起跟踪的 {e} 个案件测得。这是在这个阶段停留的时间，不是到判定的时间。</>,
    nextStep: (pct, observed, to, analyst) => (
      <>
        通常接下来会怎样：我们观察到离开这个阶段的 {observed} 个案件中，{pct}转到了 {to}
        {analyst ? "，也就是回到正常队列，劳工部公布的排队位置对它重新适用。" : "。"}
      </>
    ),
    analystReview: "ANALYST REVIEW（审查员审核）",
    nextUnknown: "这需要多长时间，我们目前还无法测量。",
    dateTitle: "这个案件可能何时判定",
    around: (d) => <>大约 {d}</>,
    window: (model, measured, a, b) => (
      <>
        {model === "decision-pace"
          ? measured
            ? "按最近的判定与预计日期的实际偏差，在 "
            : "如果劳工部保持最近的速度，在 "
          : model === "queue-advance"
            ? "按队列推进最快和最慢的速度，在 "
            : model === "rfi-clock"
              ? "按以往 RFI 的情况，在 "
              : model === "stragglers"
                ? "已被劳工部队列越过但仍在等待的案件，一半会在上面的日期前判定，十分之八在 "
                : "在 "}
        <b>{a}</b> 到 <b>{b}</b> 之间
        {model === "stragglers" ? "判定" : ""}。
      </>
    ),
    totalDays: (n) => <>距递交 {n} 天。这是估计，不是承诺。</>,
    howSummary: "计算方法",
    modelLine: (l, basis, source) => (
      <>
        {l}：{basis}来源：{source}
      </>
    ),
    adjusted: (p) => <>已按案件所处阶段调整：取其递交月份的第 {p} 百分位。</>,
    everyModel: (calc, method) => <>所有模型及其范围的并排对比见{calc}，每个模型的计算方法见{method}。</>,
    calculatorLink: "处理时间计算器（英文页面）",
    methodologyLink: "方法说明页面（英文页面）",
  },
  "pt-br": {
    noDateTitle: "Não dá para pôr uma data honesta neste caso",
    stageAge: (d) => <>Os casos nesta etapa estão pendentes há uma média medida de {d} desde o protocolo.</>,
    caseAge: (d) => <>Este caso está pendente há {d} desde que foi protocolado.</>,
    days: (n) => `${n} dias`,
    leave: (about) => <>Os casos que chegam a esta etapa saem dela depois de {about} (a mediana).</>,
    aboutDays: (n) => <>cerca de {n} dias</>,
    leaveMeasured: (e) => <>Medido em {e} casos acompanhados desde a chegada. É o tempo nesta etapa, não o tempo até uma decisão.</>,
    nextStep: (pct, observed, to, analyst) => (
      <>
        O que costuma acontecer depois: {pct} dos {observed} casos que vimos sair desta etapa foram para {to}
        {analyst ? ", ou seja, voltaram para a fila normal, onde a posição publicada pelo DOL volta a valer." : "."}
      </>
    ),
    analystReview: "ANALYST REVIEW (revisão por analista)",
    nextUnknown: "Quanto tempo isso leva ainda não conseguimos medir.",
    dateTitle: "Quando este caso pode ser decidido",
    around: (d) => <>Por volta de {d}</>,
    window: (model, measured, a, b) => (
      <>
        {model === "decision-pace"
          ? measured
            ? "Pela distância entre as decisões recentes e suas datas, entre "
            : "Se o DOL mantiver o ritmo recente, entre "
          : model === "queue-advance"
            ? "Pelo avanço mais rápido e mais lento da fila, entre "
            : model === "rfi-clock"
              ? "Pelo que aconteceu com os RFIs, entre "
              : model === "stragglers"
                ? "Metade dos casos que a fila do DOL já deixou para trás e que ainda esperam é decidida até a data acima, e oito em cada dez entre "
                : "Entre "}
        <b>{a}</b> e <b>{b}</b>.{" "}
      </>
    ),
    totalDays: (n) => <>{n} dias desde o protocolo. É uma estimativa, não uma promessa.</>,
    howSummary: "Como isto é calculado",
    modelLine: (l, basis, source) => (
      <>
        {l}: {basis} Fonte: {source}
      </>
    ),
    adjusted: (p) => <>Ajustado à etapa do caso: o percentil {p} do mês de protocolo.</>,
    everyModel: (calc, method) => (
      <>
        Todos os modelos e suas faixas, lado a lado, estão na {calc}, e como cada um é calculado, na {method}.
      </>
    ),
    calculatorLink: "calculadora de tempo de processamento (em inglês)",
    methodologyLink: "página de metodologia (em inglês)",
  },
  ko: {
    noDateTitle: "이 케이스에는 아직 근거 있는 날짜를 붙일 수 없습니다",
    stageAge: (d) => <>이 단계의 케이스는 접수 이후 실측 평균 {d} 동안 심사 중입니다.</>,
    caseAge: (d) => <>이 케이스는 접수 이후 {d} 동안 심사 중입니다.</>,
    days: (n) => `${n}일`,
    leave: (about) => <>이 단계에 들어온 케이스는 {about} 뒤에 이 단계를 벗어납니다(중앙값).</>,
    aboutDays: (n) => <>약 {n}일</>,
    leaveMeasured: (e) => <>진입 시점부터 추적한 {e}건으로 측정했습니다. 결정까지의 기간이 아니라 이 단계에 머문 기간입니다.</>,
    nextStep: (pct, observed, to, analyst) => (
      <>
        보통 다음에 일어나는 일: 이 단계를 벗어나는 것을 저희가 지켜본 {observed}건 중 {pct}가 {to}
        {analyst
          ? "로 갔습니다. 즉 일반 대기열로 돌아가며, 노동부가 공개한 대기 위치가 다시 적용됩니다."
          : "(으)로 갔습니다."}
      </>
    ),
    analystReview: "ANALYST REVIEW(심사관 검토)",
    nextUnknown: "그것이 얼마나 걸리는지는 아직 측정할 수 없습니다.",
    dateTitle: "이 케이스가 결정될 수 있는 시기",
    around: (d) => <>{d}경</>,
    window: (model, measured, a, b) => (
      <>
        {model === "decision-pace"
          ? measured
            ? "최근 결정이 예상일에서 얼마나 벗어났는지에 따르면 "
            : "노동부가 최근 속도를 유지하면 "
          : model === "queue-advance"
            ? "대기열이 가장 빠르게, 가장 느리게 움직였던 속도로 보면 "
            : model === "rfi-clock"
              ? "지금까지의 RFI 진행으로 보면 "
              : model === "stragglers"
                ? "노동부 대기열이 지나간 뒤에도 남아 있는 케이스의 절반은 위의 날짜까지 결정되고, 10건 중 8건은 "
                : ""}
        <b>{a}</b>부터 <b>{b}</b> 사이
        {model === "stragglers" ? "에 결정됩니다" : "입니다"}.{" "}
      </>
    ),
    totalDays: (n) => <>접수일로부터 {n}일. 추정일 뿐 약속이 아닙니다.</>,
    howSummary: "계산 방법",
    modelLine: (l, basis, source) => (
      <>
        {l}: {basis} 출처: {source}
      </>
    ),
    adjusted: (p) => <>케이스의 단계에 맞춰 보정: 접수 월의 {p}번째 백분위수.</>,
    everyModel: (calc, method) => (
      <>
        모든 모델과 그 범위는 {calc}에서 나란히 볼 수 있고, 각 모델의 계산 방식은 {method}에서 볼 수 있습니다.
      </>
    ),
    calculatorLink: "처리 기간 계산기(영어 페이지)",
    methodologyLink: "방법론 페이지(영어 페이지)",
  },
  vi: {
    noDateTitle: "Chưa thể đưa ra một ngày đáng tin cho hồ sơ này",
    stageAge: (d) => <>Các hồ sơ ở giai đoạn này đã chờ trung bình đo được {d} kể từ khi nộp.</>,
    caseAge: (d) => <>Hồ sơ này đã chờ {d} kể từ khi được nộp.</>,
    days: (n) => `${n} ngày`,
    leave: (about) => <>Hồ sơ vào giai đoạn này sẽ rời giai đoạn sau {about} (trung vị).</>,
    aboutDays: (n) => <>khoảng {n} ngày</>,
    leaveMeasured: (e) => <>Đo trên {e} hồ sơ được theo dõi từ khi vào giai đoạn. Đây là thời gian ở giai đoạn này, không phải thời gian đến khi có quyết định.</>,
    nextStep: (pct, observed, to, analyst) => (
      <>
        Điều thường xảy ra tiếp theo: {pct} trong số {observed} hồ sơ chúng tôi thấy rời giai đoạn này đã chuyển sang {to}
        {analyst ? ", tức là quay lại hàng chờ thông thường, nơi vị trí DOL công bố lại được áp dụng." : "."}
      </>
    ),
    analystReview: "ANALYST REVIEW (chuyên viên xét duyệt)",
    nextUnknown: "Việc đó mất bao lâu thì chúng tôi chưa đo được.",
    dateTitle: "Khi nào hồ sơ này có thể có quyết định",
    around: (d) => <>Khoảng {d}</>,
    window: (model, measured, a, b) => (
      <>
        {model === "decision-pace"
          ? measured
            ? "Theo mức lệch của các quyết định gần đây so với ngày ước tính, từ "
            : "Nếu DOL giữ tốc độ gần đây, từ "
          : model === "queue-advance"
            ? "Theo tốc độ nhanh nhất và chậm nhất mà hàng chờ từng đi, từ "
            : model === "rfi-clock"
              ? "Theo diễn biến của các RFI trước đây, từ "
              : model === "stragglers"
                ? "Một nửa số hồ sơ còn chờ sau khi hàng chờ của DOL đã đi qua được quyết định trước ngày ở trên, và tám phần mười trong khoảng từ "
                : "Từ "}
        <b>{a}</b> đến <b>{b}</b>.{" "}
      </>
    ),
    totalDays: (n) => <>{n} ngày kể từ khi nộp. Đây là ước tính, không phải lời hứa.</>,
    howSummary: "Cách tính",
    modelLine: (l, basis, source) => (
      <>
        {l}: {basis} Nguồn: {source}
      </>
    ),
    adjusted: (p) => <>Đã điều chỉnh theo giai đoạn của hồ sơ: bách phân vị thứ {p} của tháng nộp.</>,
    everyModel: (calc, method) => (
      <>
        Mọi mô hình và khoảng của chúng, đặt cạnh nhau, có trên {calc}, và cách tính từng mô hình có trên {method}.
      </>
    ),
    calculatorLink: "công cụ tính thời gian xử lý (trang tiếng Anh)",
    methodologyLink: "trang phương pháp (trang tiếng Anh)",
  },
} satisfies Messages<EstimatePanelText>;
