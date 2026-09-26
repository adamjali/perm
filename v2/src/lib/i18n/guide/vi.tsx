import { D, En } from "@/components/i18n/guideParts";
import { ENGLISH_GUIDE } from "../locales";
import type { GuideCopy } from "./types";

/**
 * Vietnamese, addressed to "bạn". Terms follow what Vietnamese applicants
 * already use: "lao động phổ thông" for EB-3 Other Workers, "ngày chung kết"
 * and "ngày nộp hồ sơ"
 * for the two bulletin charts, "Bản tin Thị thực" for the bulletin itself.
 */
export const vi: GuideCopy = {
  title: "Thẻ xanh qua việc làm, từng bước",
  description:
    "Cách tự tra cứu hồ sơ với Bộ Lao động, hàng chờ đang xét đến tháng nào, các bước sau PERM và ngày ưu tiên trong Bản tin Thị thực cho quốc gia của bạn.",
  eyebrow: "PERM Tracker tiếng Việt",
  h1: "Đang chờ thẻ xanh diện việc làm",
  lede: "Cách tự tra cứu tình trạng hồ sơ, hàng chờ của Bộ Lao động Hoa Kỳ (DOL) hôm nay đang xét đến đâu, những bước còn lại sau PERM, và các ngày ưu tiên trong Bản tin Thị thực áp dụng cho quốc gia của bạn. Trang này không phải là tư vấn pháp lý; luật sư của bạn là người hiểu rõ hồ sơ của bạn nhất.",
  translationNote: (
    <>
      Trang này được dịch và tóm tắt từ <En href={ENGLISH_GUIDE}>hướng dẫn tiếng Anh</En> của chúng tôi. Số hồ sơ, tên mẫu đơn, ngày tháng và các từ chỉ tình trạng mà DOL và USCIS dùng được giữ nguyên tiếng Anh, đúng như các cơ quan này ghi, kèm lời giải thích bên cạnh. Các trang dữ liệu mà hướng dẫn này dẫn tới đều bằng tiếng Anh.
    </>
  ),
  onThisPage: "Nội dung trang này",
  toc: {
    check: "Tra cứu hồ sơ",
    queue: "Hàng chờ của DOL",
    steps: "Sau PERM",
    "eb3-other-workers": "EB-3 lao động phổ thông",
    cutoffs: "Ngày ưu tiên của nước bạn",
    statuses: "Các từ chỉ tình trạng",
  },
  check: {
    h2: "Tự tra cứu hồ sơ",
    intro: "Hệ thống tra cứu tình trạng hồ sơ của Bộ Lao động (DOL) trả lời bất kỳ ai có số hồ sơ, kể cả hồ sơ đang chờ xét. Bạn không cần tài khoản hay đăng nhập.",
    label: "Số hồ sơ DOL",
    button: "Tra cứu",
    formats: (
      <>
        PERM: <D>G-100-26125-868956</D>. Đơn xác định mức lương hiện hành (PWD): bắt đầu bằng <D>P-100-</D>. LCA của H-1B: bắt đầu bằng <D>I-200-</D>.
      </>
    ),
    after: "Kết quả hiện bằng tiếng Anh: từ chỉ tình trạng của DOL, ngày DOL nhận hồ sơ và tên chủ lao động. Ý nghĩa của từng từ được giải thích bên dưới. Ở trang kết quả, bạn cũng có thể để lại email để nhận một thư mỗi khi tình trạng thay đổi (thư bằng tiếng Anh).",
    noNumber: (
      <>
        Không có số hồ sơ? Hãy hỏi người đã nộp hồ sơ cho bạn, số này có trên biên nhận. Bạn cũng có thể tìm theo tên chủ lao động ở trang <En href="/case-search">tìm kiếm hồ sơ</En> (tiếng Anh).
      </>
    ),
  },
  queue: {
    h2: "Hàng chờ của DOL đang ở đâu",
    permLabel: "DOL đang xét các đơn PERM nộp vào",
    averageLabel: "Số ngày trung bình đến khi có quyết định",
    days: (n) => <>{n} ngày</>,
    pwdLabel: "Các đơn lương hiện hành đang được xử lý, nhận vào",
    asOf: (d) => (
      <>Số liệu do chính DOL công bố, tính đến {d}. Số liệu thay đổi khi DOL công bố lại, thường là mỗi tuần.</>
    ),
    missing: (
      <>
        Hiện không đọc được số liệu của DOL. Bạn có thể xem ở trang <En href="/perm-queue">hàng chờ PERM</En> (tiếng Anh).
      </>
    ),
    meaning: [
      "DOL xét đơn PERM gần như theo thứ tự nhận đơn, từng tháng một. Nếu hồ sơ của bạn nộp vào tháng ghi ở trên hoặc sớm hơn, chuyên viên đang xử lý tháng của bạn. Nếu nộp muộn hơn, tháng của bạn vẫn còn ở phía sau trong hàng chờ.",
      "Con số trung bình ở trên tính mọi hồ sơ được quyết định gần đây, kể cả những hồ sơ chậm vì bị kiểm tra (audit) hoặc bị yêu cầu bổ sung thông tin (RFI). Vì vậy, một hồ sơ suôn sẻ thường nhanh hơn con số trung bình này.",
      <>
        Để ước tính theo ngày nộp của riêng bạn, hãy dùng <En href="/tools/perm-timeline-calculator">công cụ tính thời gian PERM</En> (tiếng Anh). Đó là ước tính, không phải lời hứa, và độ chính xác của nó được công khai ở <En href="/estimate-scorecard">bảng điểm ước tính</En> (tiếng Anh).
      </>,
    ],
  },
  steps: {
    h2: "Các bước sau PERM",
    intro: "Khi DOL chấp thuận PERM, hồ sơ chuyển sang Sở Di trú và Nhập tịch Hoa Kỳ (USCIS), và sau đó phụ thuộc vào Bản tin Thị thực.",
    items: [
      {
        form: "ETA-9089",
        name: "Chứng nhận lao động PERM (DOL)",
        body: "DOL xác nhận không có người lao động Mỹ đủ điều kiện cho vị trí này. Ngày DOL nhận đơn là ngày ưu tiên (priority date) của bạn, và ngày này quyết định mọi bước sau đó.",
      },
      {
        form: "I-140",
        name: "Đơn bảo lãnh định cư (USCIS)",
        body: (
          <>
            Chủ lao động phải nộp I-140 trong vòng 180 ngày kể từ khi PERM được chấp thuận, nếu không chứng nhận sẽ hết hạn. Xét duyệt thông thường mất vài tháng; nếu trả thêm phí xử lý nhanh (premium processing), USCIS quyết định phần lớn các đơn dựa trên PERM trong khoảng 15 ngày làm việc. USCIS cấp số biên nhận gồm ba chữ cái và mười chữ số, ví dụ <D>IOE0912345678</D>, để tra cứu trên trang web của USCIS.
          </>
        ),
      },
      {
        form: "Visa Bulletin",
        name: "Chờ ngày ưu tiên đến lượt",
        body: "Mỗi năm chỉ có một số lượng thẻ xanh diện việc làm cố định, kèm giới hạn cho từng quốc gia. Khi số người nộp nhiều hơn số visa, Bộ Ngoại giao công bố một ngày chốt mỗi tháng. Bạn chỉ làm được bước cuối khi ngày ưu tiên của bạn sớm hơn ngày chốt của diện và quốc gia của bạn. Xem bảng bên dưới.",
      },
      {
        form: "I-485",
        name: "Điều chỉnh tình trạng, trong nước Mỹ (USCIS)",
        body: "Khi đến lượt, bạn nộp I-485 để nhận thẻ xanh mà không phải rời nước Mỹ. Phần lớn mọi người nộp kèm I-765 (giấy phép lao động, gọi là EAD) và I-131 (advance parole, giấy phép đi lại). Mỗi tháng USCIS cho biết nhận bảng nào của Bản tin Thị thực: Ngày chung kết (Final Action Date) hay Ngày nộp hồ sơ (Date for Filing).",
      },
      {
        form: "DS-260",
        name: "Thủ tục lãnh sự, ngoài nước Mỹ (Bộ Ngoại giao)",
        body: "Nếu bạn ở nước ngoài, hồ sơ chuyển sang Trung tâm Thị thực Quốc gia (National Visa Center), bạn điền mẫu DS-260 và phỏng vấn tại đại sứ quán hoặc lãnh sự quán Mỹ.",
      },
    ],
    skipPerm: "Đơn EB-1 và đơn EB-2 miễn trừ vì lợi ích quốc gia (NIW) không cần PERM: bắt đầu thẳng từ I-140.",
  },
  ew3: {
    h2: "EB-3 lao động phổ thông (Other Workers)",
    body: [
      "EB-3 lao động phổ thông là phần của EB-3 dành cho các vị trí cần dưới hai năm đào tạo hoặc kinh nghiệm. Diện được quyết định bởi yêu cầu của vị trí ghi trong PERM, không phải bằng cấp của bạn: một người có bằng đại học làm vị trí chỉ đòi sáu tháng kinh nghiệm vẫn thuộc diện lao động phổ thông.",
      "Diện này có dòng riêng trong Bản tin Thị thực và hạn mức tối đa 10.000 visa mỗi năm, nên ngày chốt thường chậm hơn phần còn lại của EB-3 vài năm. Hãy so sánh hai dòng EB-3 và EB-3 lao động phổ thông trong bảng bên dưới.",
      <>
        Tìm hiểu thêm: <En href="/guides/eb3-other-workers">hướng dẫn đầy đủ về EB-3 Other Workers</En> (tiếng Anh) và <En href="/tools/green-card-line?category=EW3">có bao nhiêu người đứng trước bạn trong hàng này</En> (tiếng Anh).
      </>,
    ],
  },
  cutoffs: {
    h2: "Ngày ưu tiên cho quốc gia của bạn",
    intro: (m) => (
      <>Theo Bản tin Thị thực của Bộ Ngoại giao Hoa Kỳ, số {m}, số mới nhất mà trang này có. Một ngày ghi trong bảng nghĩa là ai có ngày ưu tiên sớm hơn ngày đó thì được đi tiếp.</>
    ),
    birth: "Bảng áp dụng cho bạn tùy vào nơi bạn sinh ra, không phải quốc tịch. Người sinh tại Việt Nam xem bảng dành cho tất cả các quốc gia khác. Trong một số trường hợp có thể tính theo nơi sinh của vợ hoặc chồng; hãy hỏi luật sư của bạn.",
    head: { category: "Diện", finalAction: "Ngày chung kết (Final Action)", datesForFiling: "Ngày nộp hồ sơ (Date for Filing)" },
    countryName: { worldwide: "Tất cả các quốc gia khác (gồm Việt Nam)" },
    category: {
      EB1: "EB-1 (lao động ưu tiên)",
      EB2: "EB-2 (bằng cấp cao)",
      EB3: "EB-3 (chuyên gia và lao động tay nghề)",
      EW3: "EB-3 lao động phổ thông",
    },
    current: "đang mở: mọi ngày ưu tiên đều được",
    unavailable: "tháng này không còn visa",
    notPrinted: "không công bố",
    legend: [
      "Ngày chung kết (Final Action Date): lúc thẻ xanh thật sự có thể được chấp thuận.",
      "Ngày nộp hồ sơ (Date for Filing): lúc bạn có thể nộp I-485 sớm, nếu tháng đó USCIS chấp nhận bảng này.",
      <>
        Tất cả các tháng có trên trang <En href="/visa-bulletin">Bản tin Thị thực</En> (tiếng Anh), và <En href="/tools/priority-date-calculator">công cụ tính ngày ưu tiên</En> (tiếng Anh) so sánh với ngày của riêng bạn.
      </>,
    ],
    missing: (
      <>
        Hiện không đọc được Bản tin Thị thực. Tất cả các tháng có trên trang <En href="/visa-bulletin">Bản tin Thị thực</En> (tiếng Anh).
      </>
    ),
  },
  statuses: {
    h2: "Các từ chỉ tình trạng của DOL",
    intro: "Kết quả tra cứu hiển thị tình trạng của DOL bằng tiếng Anh, đúng như DOL ghi. Ý nghĩa của từng từ:",
    gloss: {
      "ANALYST REVIEW": "Đang ở hàng chờ bình thường, chờ chuyên viên xét. Phần lớn hồ sơ đang chờ đều ở tình trạng này.",
      "APPLICATION ON HOLD": "Vẫn đang chờ xét nhưng bị tách khỏi hàng chờ bình thường. DOL không công bố lý do.",
      "RFI ISSUED": "DOL yêu cầu chủ lao động bổ sung thông tin trước khi quyết định. Đây không phải là từ chối.",
      "PENDING AUDIT RESPONSE": "Hồ sơ được chọn để kiểm tra (audit), và DOL đang chờ giấy tờ của chủ lao động.",
      "SUPERVISED RECRUITMENT": "DOL yêu cầu chủ lao động đăng tuyển lại vị trí này dưới sự giám sát của DOL.",
      "NORD ISSUED": "Một tình trạng đang chờ xét mà DOL không định nghĩa công khai. Rất ít hồ sơ ở tình trạng này.",
      "RECONSIDERATION APPEALS": "Hồ sơ bị từ chối và chủ lao động đã đề nghị DOL xem xét lại.",
      "BALCA APPEALS": "Chủ lao động đã kháng cáo quyết định từ chối lên Hội đồng Kháng cáo Chứng nhận Lao động (BALCA).",
      CERTIFIED: "DOL đã chấp thuận. Bước PERM kết thúc; bước tiếp theo là I-140.",
      "CERTIFIED - EXPIRED": "DOL hiển thị tình trạng này khi đã qua 180 ngày kể từ ngày chấp thuận. Nếu I-140 được nộp trong 180 ngày đó thì chứng nhận đã được dùng đúng hạn.",
      DENIED: "DOL đã từ chối đơn. Chủ lao động có thể đề nghị xem xét lại hoặc kháng cáo lên BALCA.",
      WITHDRAWN: "Chủ lao động đã rút đơn. Đây không phải là từ chối, và DOL không ghi lý do.",
    },
  },
  limits: {
    h2: "Những điều trang này không thể cho bạn biết",
    items: [
      "Chính xác khi nào hồ sơ của bạn được quyết định. Số liệu ở trên mô tả toàn bộ hàng chờ của DOL, không phải hồ sơ của bạn.",
      "Vì sao một quyết định lại như vậy. DOL công bố kết quả, không công bố lý do.",
      "Bất cứ điều gì thay thế được lời khuyên của luật sư. Đừng đổi việc, đi lại hay đưa ra quyết định lớn chỉ dựa vào một con số trong hàng chờ.",
    ],
  },
  more: {
    h2: "Các trang tiếng Anh",
    links: [
      { href: "/perm-case-status", label: "Tra cứu hồ sơ" },
      { href: "/perm-queue", label: "Hàng chờ PERM theo tháng nộp" },
      { href: "/tools/perm-timeline-calculator", label: "Công cụ tính thời gian PERM" },
      { href: "/visa-bulletin", label: "Bản tin Thị thực" },
      { href: "/tools/priority-date-calculator", label: "Công cụ tính ngày ưu tiên" },
      { href: "/tools/green-card-line", label: "Vị trí của bạn trong hàng chờ thẻ xanh" },
      { href: "/tools/which-green-card", label: "Loại thẻ xanh diện việc làm phù hợp với bạn" },
      { href: "/uscis-processing-times", label: "Thời gian xử lý của USCIS" },
      { href: ENGLISH_GUIDE, label: "Hướng dẫn đầy đủ bằng tiếng Anh" },
    ],
  },
};
