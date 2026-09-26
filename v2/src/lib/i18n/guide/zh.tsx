import { D, En } from "@/components/i18n/guideParts";
import { ENGLISH_GUIDE } from "../locales";
import type { GuideCopy } from "./types";

/**
 * Simplified Chinese. Terms follow what Chinese-speaking applicants in the US
 * already use: 劳工证 for the PERM certification, 排期 for bulletin cutoffs,
 * 表A/表B for the two bulletin charts, 工卡 and 回美证 for the EAD and
 * advance parole. Full-width punctuation throughout; no dashes.
 */
export const zh: GuideCopy = {
  title: "职业移民绿卡：查询案件与排期",
  description:
    "给等待职业移民绿卡的人：怎样自己查询劳工部的案件状态，劳工部审理到哪个月，PERM 之后的每一步，以及您出生国家的排期。",
  eyebrow: "PERM Tracker 中文版",
  h1: "等待职业移民绿卡：一步一步说清楚",
  lede: "怎样自己查询案件状态，美国劳工部（DOL）今天审理到哪里，PERM 之后还有哪些步骤，以及您所在国家的排期（签证公告的截止日期）。本页内容不构成法律建议，您的律师最了解您的案件。",
  translationNote: (
    <>
      本页由我们的<En href={ENGLISH_GUIDE}>英文指南</En>翻译整理而成。案件编号、表格名称、日期，以及劳工部和移民局使用的状态用语都保留英文原文，与政府机构的写法完全一致，旁边附中文解释。本页链接的数据页面均为英文。
    </>
  ),
  onThisPage: "本页内容",
  toc: {
    check: "查询您的案件",
    queue: "劳工部审理进度",
    steps: "PERM 之后的步骤",
    "eb3-other-workers": "EB-3 其他工人",
    cutoffs: "您国家的排期",
    statuses: "状态用语解释",
  },
  check: {
    h2: "自己查询案件",
    intro: "美国劳工部（DOL）的案件状态系统对任何持有案件编号的人开放，包括仍在审理中的案件，无需注册或登录。",
    label: "劳工部案件编号",
    button: "查询",
    formats: (
      <>
        PERM 劳工证：<D>G-100-26125-868956</D>；现行工资认定（PWD）申请：以 <D>P-100-</D> 开头；H-1B 劳工情况申请（LCA）：以 <D>I-200-</D> 开头。
      </>
    ),
    after: "查询结果以英文显示：劳工部的状态用语、劳工部收到案件的日期和雇主名称。每个状态用语的意思见本页下方。在结果页面还可以留下电子邮箱，状态每变化一次就会收到一封邮件（邮件为英文）。",
    noNumber: (
      <>
        没有案件编号？请向提交案件的律师或雇主索取，编号就在收据上。也可以在<En href="/case-search">案件搜索页面</En>（英文）按雇主名称查找。
      </>
    ),
  },
  queue: {
    h2: "劳工部审理到哪里了",
    permLabel: "劳工部正在审理的 PERM 申请，提交于",
    averageLabel: "从提交到裁决的平均天数",
    days: (n) => <>{n} 天</>,
    pwdLabel: "正在处理的现行工资认定申请，收到于",
    asOf: (d) => <>以上是劳工部自己公布的数据，截至 {d}。劳工部重新发布时（通常每周一次）会更新。</>,
    missing: (
      <>
        暂时无法读取劳工部的数据。可以在<En href="/perm-queue">PERM 排队页面</En>（英文）查看。
      </>
    ),
    meaning: [
      "劳工部大致按收到申请的先后顺序，一个月一个月地审理 PERM。如果您的案件是在上面显示的月份或更早提交的，分析员现在正在处理您那个月的案件；如果提交得更晚，您的月份还在队列后面。",
      "上面的平均天数涵盖最近裁决的所有案件，其中也包括因审计（audit）或补充信息要求（RFI）而拖慢的案件，所以一个顺利的案件通常比这个平均值快。",
      <>
        想根据自己的提交日期估算，可以使用 <En href="/tools/perm-timeline-calculator">PERM 时间计算器</En>（英文）。那是估算，不是承诺；它的准确度公开在<En href="/estimate-scorecard">估算成绩单</En>（英文）上。
      </>,
    ],
  },
  steps: {
    h2: "PERM 之后的步骤",
    intro: "劳工部批准 PERM 以后，案件转到美国公民及移民服务局（USCIS，常称移民局），之后取决于签证公告的排期。",
    items: [
      {
        form: "ETA-9089",
        name: "PERM 劳工证（劳工部）",
        body: "劳工部确认这个职位找不到合格的美国工人。劳工部收到申请的日期就是您的优先日期（priority date），之后的每一步都看这个日期。",
      },
      {
        form: "I-140",
        name: "移民申请（移民局）",
        body: (
          <>
            雇主必须在 PERM 批准后 180 天内递交 I-140，否则劳工证失效。普通处理需要几个月；付费加急（premium processing）时，大多数基于 PERM 的申请移民局约在 15 个工作日内作出决定。移民局会给出一个由三个字母加十位数字组成的收据号，例如 <D>IOE0912345678</D>，可以在移民局自己的网站上查询。
          </>
        ),
      },
      {
        form: "Visa Bulletin",
        name: "等待排期",
        body: "每年的职业移民绿卡名额固定，而且每个国家有上限。申请人数超过名额时，美国国务院每月公布截止日期。只有当您的优先日期早于您的类别和国家的截止日期时，才能进行最后一步。请看下面的表格。",
      },
      {
        form: "I-485",
        name: "身份调整，在美国境内（移民局）",
        body: "排期到了以后，递交 I-485，不用离开美国就可以拿到绿卡。大多数人同时递交 I-765（工卡，即 EAD）和 I-131（回美证，即 advance parole）。移民局每个月会说明当月接受哪一张表：表A（最终行动日期）或表B（递交申请日期）。",
      },
      {
        form: "DS-260",
        name: "领事程序，在美国境外（国务院）",
        body: "如果您在美国境外，案件会转到国家签证中心（National Visa Center），您填写 DS-260，然后在美国大使馆或领事馆面谈。",
      },
    ],
    skipPerm: "EB-1 和 EB-2 国家利益豁免（NIW）的申请不需要 PERM，直接从 I-140 开始。",
  },
  ew3: {
    h2: "EB-3 其他工人（Other Workers）",
    body: [
      "EB-3 其他工人是 EB-3 中针对只需不到两年培训或工作经验的职位的部分。决定类别的是 PERM 上写明的职位要求，不是您本人的学历：一位有学位的人，如果职位只要求六个月经验，就属于其他工人。",
      "它在签证公告上有单独的一行，每年名额最多 10,000 个，所以它的截止日期通常比 EB-3 的其他部分晚好几年。请对照下面表格中 EB-3 和 EB-3 其他工人两行。",
      <>
        更多内容：<En href="/guides/eb3-other-workers">EB-3 其他工人完整指南</En>（英文），以及<En href="/tools/green-card-line?category=EW3">这条队伍里排在您前面的人数</En>（英文）。
      </>,
    ],
  },
  cutoffs: {
    h2: "您国家的排期",
    intro: (m) => (
      <>数据来自美国国务院 {m} 的签证公告，这是本站目前收录的最新一期。表中的日期表示优先日期早于这个日期的人可以往前走。</>
    ),
    birth: "看哪一列取决于您的出生地，而不是国籍：出生在中国大陆的人看“中国大陆出生”一表；出生在台湾或香港的人看“其他所有国家”一表。在某些情况下，可以改按配偶的出生国计算，这一点请咨询律师。",
    head: { category: "类别", finalAction: "最终行动日期（表A）", datesForFiling: "递交申请日期（表B）" },
    countryName: { china: "中国大陆出生", worldwide: "其他所有国家" },
    category: {
      EB1: "EB-1（优先工作者）",
      EB2: "EB-2（高学历专业人士）",
      EB3: "EB-3（专业人士及技术工人）",
      EW3: "EB-3 其他工人",
    },
    current: "当前开放：所有优先日期都可以",
    unavailable: "本月没有名额",
    notPrinted: "未公布",
    legend: [
      "表A（最终行动日期，Final Action Date）：绿卡可以真正批准的时间。",
      "表B（递交申请日期，Date for Filing）：如果移民局当月接受这张表，您可以提早递交 I-485。",
      <>
        每个月的完整数据见<En href="/visa-bulletin">签证公告页面</En>（英文），也可以用<En href="/tools/priority-date-calculator">优先日期计算器</En>（英文）对照您自己的日期。
      </>,
    ],
    missing: (
      <>
        暂时无法读取签证公告。每个月的数据都在<En href="/visa-bulletin">签证公告页面</En>（英文）。
      </>
    ),
  },
  statuses: {
    h2: "劳工部的状态用语",
    intro: "案件查询结果显示的是劳工部自己的英文状态。每个状态的意思：",
    gloss: {
      "ANALYST REVIEW": "在正常队列中，等待分析员审理。大多数审理中的案件都在这个状态。",
      "APPLICATION ON HOLD": "仍在审理，但被移出正常队列。劳工部不公布原因。",
      "RFI ISSUED": "劳工部在作出决定前要求雇主补充信息。这不是拒绝。",
      "PENDING AUDIT RESPONSE": "案件被抽中审计，劳工部在等雇主提交文件。",
      "SUPERVISED RECRUITMENT": "劳工部要求雇主在它的监督下重新招聘这个职位。",
      "NORD ISSUED": "劳工部没有公开定义的一种审理中状态，处于这个状态的案件很少。",
      "RECONSIDERATION APPEALS": "案件被拒，雇主请劳工部重新考虑。",
      "BALCA APPEALS": "雇主就拒绝决定向劳工证上诉委员会（BALCA）提出上诉。",
      CERTIFIED: "劳工部已批准。PERM 这一步结束，下一步是 I-140。",
      "CERTIFIED - EXPIRED": "批准满 180 天后，劳工部会显示这个状态。如果 I-140 在这 180 天内已经递交，劳工证就是按时用上了。",
      DENIED: "劳工部拒绝了申请。雇主可以请劳工部重新考虑，或向 BALCA 上诉。",
      WITHDRAWN: "雇主撤回了申请。这不是拒绝，劳工部也不记录原因。",
    },
  },
  limits: {
    h2: "本页无法告诉您的事",
    items: [
      "您的案件具体哪天裁决。上面的数据描述的是劳工部的整个队列，不是您的档案。",
      "裁决的原因。劳工部只公布结果，不公布理由。",
      "任何可以代替律师意见的东西。请不要根据排队数据换工作、出行或做其他重大决定。",
    ],
  },
  more: {
    h2: "英文页面",
    links: [
      { href: "/perm-case-status", label: "案件查询" },
      { href: "/perm-queue", label: "按提交月份的 PERM 队列" },
      { href: "/tools/perm-timeline-calculator", label: "PERM 时间计算器" },
      { href: "/visa-bulletin", label: "签证公告" },
      { href: "/tools/priority-date-calculator", label: "优先日期计算器" },
      { href: "/tools/green-card-line", label: "您在绿卡队伍中的位置" },
      { href: "/tools/which-green-card", label: "哪种职业移民绿卡适合您" },
      { href: "/uscis-processing-times", label: "移民局处理时间" },
      { href: ENGLISH_GUIDE, label: "完整的英文指南" },
    ],
  },
};
