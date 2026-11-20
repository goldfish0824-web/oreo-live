/* OREO Live — 設定ファイル（ここだけ編集すれば3画面すべてに反映されます） */
window.OREO_CONFIG = {
  // Cloudflare Worker の URL。空欄のままだと「デモモード」（AIを使わず、このブラウザ内だけで動作）
  WORKER_URL: "https://oreo-live.goldfish0824.workers.dev",

  // 生徒のログイン：4けたの番号（学年1けた＋組1けた＋番号2けた。例：2年4組1番 → 2401）と名字。
  // 最初に入れた名字が、その生徒のパスワードになる（名字そのものは保存しない）
  // 使うクラスは「2年1・2組」と「2年4・5・6組（研究授業）」。クラスごとに別のセッションコードを使う
  GRADE: "2",
  CLASSES: ["1", "2", "4", "5", "6"],
  MAX_NUMBER: 45,

  // ライティング（読む前・授業の後とも、1人1回だけ提出。提出すると、AI のコメント・問いかけ・添削が届く）
  PRE_WRITING_MINUTES: 10, // 本文を読む前のライティング（単元前）
  PRE_SUBMIT_HINT_MINUTE: 8, // この時点でモニターに「提出しよう」を表示
  WRITING_MINUTES: 12, // 研究授業のライティング（ディベートの後）
  SUBMIT_HINT_MINUTE: 9,
  REFLECTION_MINUTES: 5, // 振り返り（モニターの「5 振り返り」タブのタイマー。時間調整を兼ねる）

  // 書き出しの候補（生徒画面でタップすると入る。OREO の順に並べている）
  WRITE_CHIPS: ["First of all, ", "This is because ", "For example, ", "In addition, ", "However, ", "Therefore, "],

  // ミニ・ディベートの進行（モニターのタイマー）。どのトピックでも共通で、合計10分。
  // 三浦孝先生の「マイクロ・ディベート」にならい、最初に立論メモを書いて相手チームと交換してから話す（2026-11-21）。
  // 4人班が基本（Yes：A1・A2、No：N1・N2）。4人にならない班は3人にし、1人の側の生徒が立論と反論の2役をする。
  // Judge は置かない（全員が話す役を持つ。先生の判断。2026-11-20）
  // memo: true の段階では、モニターと生徒画面にトピックの「3つの視点」（VIEWPOINTS）を大きく出す。
  // hint はモニターに出す表現（トピックの DEBATE_HINTS のキー）
  DEBATE_PHASES: [
    { label: "① 立論メモを書く", who: "ペアで、3つの視点から理由を書く（1人の側は1人で）", sec: 120, memo: true },
    { label: "② 立論メモを交換", who: "相手チームのメモを読んで、反論の作戦を立てる", sec: 120, hint: "rebut" },
    { label: "③ Yes側 立論", who: "A1", sec: 60, hint: "yes" },
    { label: "④ No側 立論", who: "N1", sec: 60, hint: "no" },
    { label: "⑤ No側 反論", who: "N2（No が1人の班は、その人がもう一度）", sec: 60, hint: "rebut" },
    { label: "⑥ Yes側 反論", who: "A2（Yes が1人の班は、その人がもう一度）", sec: 60, hint: "rebut" },
    { label: "⑦ フリートーク", who: "立場を離れて本音で。最後に1人1文ずつ（Honestly, I think ...）", sec: 120 },
  ],

  // チーム分けの座席表（モニターの「2 ディベート」タブ →「チーム分け」）。行・列の最大と、新しく作るときの大きさ
  SEAT_MAX: 10,
  SEAT_DEFAULT: { rows: 6, cols: 6 },

  // 先生からのスタンプ（授業者と参観の先生が、先生用の一覧・参観者用ページで押す）。
  // 生徒の画面には「先生から」とだけ届く（誰が押したかは出さない）。1人の先生が1人の生徒に、同じスタンプは1回まで。もう一度押すと取り消し。
  // id は worker/worker.js の STAMPS とそろえる
  STAMPS: [
    { id: "clear", icon: "💬", ja: "伝わる英語！", en: "Clear English!" },
    { id: "reasons", icon: "💡", ja: "理由がいいね", en: "Good reasons!" },
    { id: "growth", icon: "🌱", ja: "成長が感じられます", en: "Great progress!" },
  ],

  /* トピックごとの文言。
   * どのトピックを使うかはセッションごとに決まる（モニターの「準備」タブの「詳細設定」で切り替え）。
   * キー（refugees / part1〜part4）は、worker/worker.js の TOPICS と必ずそろえる。
   * AI に渡すプロンプト（和訳・添削・まとめ）は Worker 側にあり、ここを直しても AI の動きは変わらない。
   * VIEWPOINTS は、ディベートの「① 立論メモを書く」で使う3つの視点（[英語, 日本語]）。資料2の立論メモの欄とそろえる。 */
  DEFAULT_TOPIC: "refugees",
  TOPICS: {
    // ---- 本番：Lesson 8「緒方貞子さんと難民支援」 ----
    refugees: {
      NAME: "本番（Lesson 8：難民の受け入れ）",
      PRE_WRITING: true, // 本文を読む前にも書く（読む前と授業の後の2回）
      TOPIC: "Should Japan accept more refugees?",
      TOPIC_JA: "日本はもっと難民を受け入れるべきか",
      TOPIC_SHORT_JA: "日本の難民受け入れ",
      YES_JA: "受け入れるべき",
      NO_JA: "増やすべきではない",
      OPINION_CHIPS: ["I believe that Japan should ", "I don't think Japan should ", "In my opinion, "],
      DEBATE_HINTS: {
        yes: "I believe Japan should ...  First of all, ...",
        no: "I don't think ...  This is because ...",
        rebut: "You said that ..., but ...  /  I see your point, but ...",
      },
      VIEWPOINTS: [["human life", "命と安全"], ["daily life", "言葉・仕事・住まい"], ["cost", "費用と負担"]],
      // 授業の最後の問い
      QUOTE: "“Human life first.” — Ogata Sadako",
      FINAL_QUESTION: "Accepting refugees is one way to save lives.\nWhat else can Japan — and you — do to put “human life first”?",
      FINAL_QUESTION_JA: "受け入れることは命を救う方法の一つ。では「人命第一」のために、日本や私たちにできることは、ほかに何があるだろう？",
      // 授業の後の振り返り（日本語）。生徒画面とモニターの「5 振り返り」タブに出す
      REFLECTION: {
        PROMPT: "本文を読む前に書いた英文と、今日の英文を読み比べよう。自分の考えや英語は、どう変わった？（変わらなかったことも書いてよい）",
        HINTS: ["考え（立場や理由）は、どう変わった？", "使った英語の表現や、書いた量は？", "本文やディベートで、心に残ったことは？", "AI の問いかけについて、考えたことは？"],
      },
      // 生徒画面の「使える表現」（授業の後のライティングだけで出す。本文を読む前には出さない）
      EXPRESSIONS_TITLE: "使える表現（資料1）",
      EXPRESSIONS: [
        ["humanitarian obligation", "人道的な義務"],
        ["financial burden", "財政的な負担"],
        ["labor shortage / aging society", "人手不足／高齢化社会"],
        ["support system", "支援体制"],
        ["language barrier / be isolated", "言葉の壁／孤立する"],
        ["contribute to ~", "～に貢献する"],
        ["the international community", "国際社会"],
        ["put human life first", "人命を第一に考える"],
      ],
    },

    // ---- 練習：教科書の各 Part を読んだ後に、同じ形のディベートをする（研究授業の練習。ライティングは1回だけ） ----
    part1: {
      NAME: "Part 1 のディベート（外国を助けるお金）",
      PRE_WRITING: false, // 書くのは授業の中の1回だけ
      TOPIC: "Should Japan spend more money to help people in other countries?",
      TOPIC_JA: "日本は、外国の人々を助けるために、もっとお金を使うべきか",
      TOPIC_SHORT_JA: "外国を助けるためのお金",
      YES_JA: "もっと使うべき",
      NO_JA: "増やすべきではない",
      OPINION_CHIPS: ["I believe that Japan should ", "I don't think Japan should ", "In my opinion, "],
      DEBATE_HINTS: {
        yes: "I believe Japan should spend more ...  First of all, ...",
        no: "I don't think ...  This is because ...",
        rebut: "You said that ..., but ...  /  I see your point, but ...",
      },
      VIEWPOINTS: [["people in need", "困っている人の命と生活"], ["Japan's role", "世界の中の日本の役割"], ["money at home", "日本のお金と国内の課題"]],
      QUOTE: "",
      FINAL_QUESTION: "Money is one way to help.\nWhat else can we do for people in other countries?",
      FINAL_QUESTION_JA: "お金は助け方の一つ。ほかに、外国で困っている人のために、私たちにできることは？",
      REFLECTION: {
        PROMPT: "ディベートの前と今とで、自分の考えはどう変わった？（変わらなかった人は、何がはっきりした？）",
        HINTS: ["相手の意見で、なるほどと思ったことは？", "本文の内容で、理由に使えたことは？", "英語で書いてみて、できたこと・難しかったことは？", "AI の問いかけについて、考えたことは？"],
      },
      EXPRESSIONS_TITLE: "使える表現",
      EXPRESSIONS: [
        ["foreign aid", "海外への援助"],
        ["developing countries", "発展途上国"],
        ["tax money", "税金"],
        ["poverty / hunger", "貧困／飢え"],
        ["the international community", "国際社会"],
        ["Japan has its own problems.", "日本にも課題がある"],
        ["help each other", "助け合う"],
        ["in the long run", "長い目で見ると"],
      ],
    },
    part2: {
      NAME: "Part 2 のディベート（命とルール）",
      PRE_WRITING: false,
      TOPIC: "Is it OK to break the rules to save people's lives?",
      TOPIC_JA: "命を救うためなら、ルールを破ってもよいか",
      TOPIC_SHORT_JA: "命を救うためのルール破り",
      YES_JA: "破ってもよい",
      NO_JA: "破るべきではない",
      OPINION_CHIPS: ["I think it is OK to break the rules ", "I don't think we should break the rules ", "In my opinion, "],
      DEBATE_HINTS: {
        yes: "I think it is OK to ...  First of all, ...",
        no: "I don't think we should ...  This is because ...",
        rebut: "You said that ..., but ...  /  I see your point, but ...",
      },
      VIEWPOINTS: [["human life", "命を救うこと"], ["rules", "ルールを守る意味"], ["after that", "その後への影響（信頼・まねをする人）"]],
      QUOTE: "",
      FINAL_QUESTION: "Rules are made to protect people.\nWhen should we change a rule?",
      FINAL_QUESTION_JA: "ルールは人を守るためにある。では、ルールはどんなときに変えるべきだろう？",
      REFLECTION: {
        PROMPT: "ディベートの前と今とで、自分の考えはどう変わった？（変わらなかった人は、何がはっきりした？）",
        HINTS: ["相手の意見で、なるほどと思ったことは？", "本文の内容で、理由に使えたことは？", "英語で書いてみて、できたこと・難しかったことは？", "AI の問いかけについて、考えたことは？"],
      },
      EXPRESSIONS_TITLE: "使える表現",
      EXPRESSIONS: [
        ["break the rules / follow the rules", "ルールを破る／守る"],
        ["save lives", "命を救う"],
        ["in an emergency", "緊急のときに"],
        ["make an exception", "例外をつくる"],
        ["lose trust", "信頼を失う"],
        ["take responsibility", "責任をとる"],
        ["cross the border", "国境を越える"],
        ["put human life first", "人命を第一に考える"],
      ],
    },
    part3: {
      NAME: "Part 3 のディベート（難民が暮らす国）",
      PRE_WRITING: false,
      TOPIC: "Should refugees live in a country near their home country?",
      TOPIC_JA: "難民は、自分の国に近い国で暮らすほうがよいか",
      TOPIC_SHORT_JA: "難民が暮らす国",
      YES_JA: "近い国がよい",
      NO_JA: "近い国とは限らない",
      OPINION_CHIPS: ["I believe that refugees should ", "I don't think refugees have to ", "In my opinion, "],
      DEBATE_HINTS: {
        yes: "I believe refugees should live ...  First of all, ...",
        no: "I don't think ...  This is because ...",
        rebut: "You said that ..., but ...  /  I see your point, but ...",
      },
      VIEWPOINTS: [["going home", "いつか国に帰ること"], ["safety", "安全と生活の安定"], ["culture and language", "文化と言葉"]],
      QUOTE: "",
      FINAL_QUESTION: "Many refugees hope to go home someday.\nWhat do refugee children need most while they wait?",
      FINAL_QUESTION_JA: "多くの難民は、いつか国に帰りたいと願っている。それまでの間、難民の子どもたちにいちばん必要なものは何だろう？",
      REFLECTION: {
        PROMPT: "ディベートの前と今とで、自分の考えはどう変わった？（変わらなかった人は、何がはっきりした？）",
        HINTS: ["相手の意見で、なるほどと思ったことは？", "本文の内容で、理由に使えたことは？", "英語で書いてみて、できたこと・難しかったことは？", "AI の問いかけについて、考えたことは？"],
      },
      EXPRESSIONS_TITLE: "使える表現",
      EXPRESSIONS: [
        ["neighboring countries", "近くの国々"],
        ["go back home", "故郷に帰る"],
        ["refugee camp", "難民キャンプ"],
        ["a similar culture / language", "似た文化／言葉"],
        ["far from home", "故郷から遠く"],
        ["safe and stable", "安全で安定した"],
        ["education", "教育"],
        ["start a new life", "新しい生活を始める"],
      ],
    },
    part4: {
      NAME: "Part 4 のディベート（危険な場所での支援）",
      PRE_WRITING: false,
      TOPIC: "Should aid workers stay in dangerous places to protect refugees?",
      TOPIC_JA: "支援する人は、危険があっても現場にとどまるべきか",
      TOPIC_SHORT_JA: "危険な場所にとどまる支援",
      YES_JA: "とどまるべき",
      NO_JA: "離れるべき",
      OPINION_CHIPS: ["I believe that aid workers should ", "I don't think aid workers should ", "In my opinion, "],
      DEBATE_HINTS: {
        yes: "I believe aid workers should stay ...  First of all, ...",
        no: "I don't think ...  This is because ...",
        rebut: "You said that ..., but ...  /  I see your point, but ...",
      },
      VIEWPOINTS: [["refugees", "難民の安全と安心"], ["aid workers", "支援する人の命と家族"], ["other ways", "ほかの守り方"]],
      QUOTE: "",
      FINAL_QUESTION: "Ms. Ogata worked for “co-existence.”\nWhat can you do to live together with people from other countries?",
      FINAL_QUESTION_JA: "緒方さんは「共に生きること」のために働いた。外国から来た人と共に生きるために、あなたにできることは？",
      REFLECTION: {
        PROMPT: "ディベートの前と今とで、自分の考えはどう変わった？（変わらなかった人は、何がはっきりした？）",
        HINTS: ["相手の意見で、なるほどと思ったことは？", "本文の内容で、理由に使えたことは？", "英語で書いてみて、できたこと・難しかったことは？", "AI の問いかけについて、考えたことは？"],
      },
      EXPRESSIONS_TITLE: "使える表現",
      EXPRESSIONS: [
        ["aid workers", "支援する人（援助活動をする人）"],
        ["stay at risk", "危険を覚悟してとどまる"],
        ["protect / be protected", "守る／守られる"],
        ["dangerous / safe", "危険な／安全な"],
        ["leave the area", "その地域を離れる"],
        ["send supplies", "物資を送る"],
        ["their families", "その人たちの家族"],
        ["respect", "尊重する"],
      ],
    },
  },
};

// 4けたの番号（例：2401）から組・番号を取り出す。学年・組・番号が合わないときは null
window.OREO_PARSE_ID = function (v) {
  const C = window.OREO_CONFIG;
  const d = String(v ?? "").normalize("NFKC").replace(/\D/g, "");
  if (d.length !== 4) return null;
  const cls = d[1], num = parseInt(d.slice(2), 10);
  if (C.GRADE && d[0] !== String(C.GRADE)) return null;
  if (!C.CLASSES.includes(cls) || !(num >= 1 && num <= C.MAX_NUMBER)) return null;
  return { cls, num: String(num) };
};
// 組・番号から4けたの番号を作る（例：4組1番 → 2401）
window.OREO_ID_OF = function (cls, num) {
  return `${window.OREO_CONFIG.GRADE || ""}${cls}${String(num).padStart(2, "0")}`;
};

// トピックの文言を取り出す（知らない id のときは本番のトピック）
window.OREO_TOPIC = function (id) {
  const C = window.OREO_CONFIG;
  return C.TOPICS[id] || C.TOPICS[C.DEFAULT_TOPIC];
};

/* ---- チーム分け（座席表）：モニターと生徒画面で同じものを使う ----
 * 席の id は「行-列」（0 から。行 0 がいちばん前＝黒板側）。
 * teams = { rows, cols, seats: [使う席], absent: [欠席の席], assign: { 席: [班の番号, "yes"|"no"] }, at } */
window.OREO_SEAT = {
  id: (r, c) => `${r}-${c}`,
  rc: (id) => String(id).split("-").map((x) => parseInt(x, 10)),
  label: (a) => (a ? `G${a[0]}-${a[1] === "yes" ? "Yes" : "No"}` : ""),
  // 座席表の HTML。cell(席の id) が { cls, html } を返した席だけボタンにする（null の席は空けておく）。2列ごとに通路をあける
  html(rows, cols, cell) {
    const tpl = [];
    for (let c = 0; c < cols; c++) { if (c && c % 2 === 0) tpl.push("12px"); tpl.push("minmax(0, 1fr)"); }
    let out = `<div class="seatgrid" style="grid-template-columns:${tpl.join(" ")};grid-template-rows:repeat(${rows}, minmax(var(--seat-h), auto))">`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `${r}-${c}`, x = cell(id);
        if (x) out += `<button type="button" class="seat ${x.cls || ""}" data-seat="${id}" style="grid-row:${r + 1};grid-column:${c + Math.floor(c / 2) + 1}">${x.html || ""}</button>`;
      }
    }
    return out + "</div>";
  },
  // 出席している席を、4人班と3人班に分ける。
  // 前後2列ずつの4席（2人がけの机を前後に2つ）を1班にし、前の2人と後ろの2人で Yes と No に分かれるのを基本にする。
  // 欠席の出た班は、なるべくそのまま3人班にする（席を動かさなくてよいように）。
  // 席の並び（2列ごとに、前から後ろ・後ろから前と折り返す）を 3〜4席ずつに区切り、区切り方は
  // 「3行にまたがる班・通路をまたぐ班を作らない」「3人班を増やしすぎない」で選ぶ（いろいろな欠席の出方で試して決めた重み）。
  split(rows, cols, present) {
    const S = window.OREO_SEAT;
    const on = new Set(present);
    const order = [];
    for (let lane = 0; lane * 2 < cols; lane++) {
      const rs = [...Array(rows).keys()];
      if (lane % 2) rs.reverse();
      for (const r of rs) for (const c of [lane * 2, lane * 2 + 1]) if (c < cols && on.has(S.id(r, c))) order.push([r, c]);
    }
    const n = order.length;
    if (!n) return {};
    // 区切り方を選ぶ（班の席の広がり＋3行にまたがる・通路をまたぐと大きな減点＋3人班は少し減点）
    const cost = (a, b) => {
      const g = order.slice(a, b);
      const rs = g.map((x) => x[0]), cs = g.map((x) => x[1]);
      const rowSpan = Math.max(...rs) - Math.min(...rs), colSpan = Math.max(...cs) - Math.min(...cs);
      const lanes = new Set(g.map(([, c]) => c >> 1)).size;
      return rowSpan + colSpan + 6 * Math.max(0, rowSpan - 1) + 6 * (lanes - 1) + (b - a === 3 ? 2 : 0);
    };
    const best = Array(n + 1).fill(Infinity), cut = Array(n + 1).fill(0);
    best[0] = 0;
    for (let i = 3; i <= n; i++) for (const k of [4, 3]) if (i - k >= 0 && best[i - k] + cost(i - k, i) < best[i]) { best[i] = best[i - k] + cost(i - k, i); cut[i] = k; }
    const groups = [];
    if (best[n] < Infinity) { for (let i = n; i > 0; i -= cut[i]) groups.unshift(order.slice(i - cut[i], i)); }
    else groups.push(order); // 1〜2人・5人のときは1つの班にする（授業では起こらない）
    const assign = {};
    let solo = 0;
    groups.forEach((g, k) => {
      const seats = g.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let yes, no;
      if (seats.length === 3) {
        // 3人班：隣どうしの2人をペアにし、残りの1人が1人の側。1人の側は Yes と No を交互にする
        const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
        const pairs = [[0, 1, 2], [0, 2, 1], [1, 2, 0]].sort((p, q) => adj(seats[p[0]], seats[p[1]]) - adj(seats[q[0]], seats[q[1]]));
        const [i, j, s] = pairs[0];
        const soloYes = solo++ % 2 === 0;
        yes = soloYes ? [seats[s]] : [seats[i], seats[j]];
        no = soloYes ? [seats[i], seats[j]] : [seats[s]];
      } else {
        const h = Math.ceil(seats.length / 2);
        yes = seats.slice(0, h); // 前の2人が Yes、後ろの2人が No
        no = seats.slice(h);
      }
      yes.forEach(([r, c]) => (assign[S.id(r, c)] = [k + 1, "yes"]));
      no.forEach(([r, c]) => (assign[S.id(r, c)] = [k + 1, "no"]));
    });
    return assign;
  },
};
