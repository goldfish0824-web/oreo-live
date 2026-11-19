/* OREO Live — 設定ファイル（ここだけ編集すれば3画面すべてに反映されます） */
window.OREO_CONFIG = {
  // Cloudflare Worker の URL。空欄のままだと「デモモード」（AIを使わず、このブラウザ内だけで動作）
  WORKER_URL: "https://oreo-live.goldfish0824.workers.dev",

  // 生徒のログイン：4けたの番号（学年1けた＋組1けた＋番号2けた。例：2年4組1番 → 2401）と名字。
  // 最初に入れた名字が、その生徒のパスワードになる（名字そのものは保存しない）
  GRADE: "2",
  CLASSES: ["4", "5", "6"],
  MAX_NUMBER: 45,
  GROUPS: 8,

  // ライティング（読む前・授業の後とも、1人1回だけ提出。提出すると、AI のコメント・問いかけ・添削が届く）
  PRE_WRITING_MINUTES: 10, // 本文を読む前のライティング（単元前）
  PRE_SUBMIT_HINT_MINUTE: 8, // この時点でモニターに「提出しよう」を表示
  WRITING_MINUTES: 12, // 研究授業のライティング（ディベートの後）
  SUBMIT_HINT_MINUTE: 9,
  REFLECTION_MINUTES: 5, // 振り返り（モニターの「5 振り返り」タブのタイマー。時間調整を兼ねる）

  // 書き出しの候補（生徒画面でタップすると入る。OREO の順に並べている）
  WRITE_CHIPS: ["First of all, ", "This is because ", "For example, ", "In addition, ", "However, ", "Therefore, "],

  // ミニ・ディベートの進行（モニターのタイマー）。どのトピックでも共通
  DEBATE_PHASES: [
    { label: "① 作戦タイム", who: "Yes・No のペアで理由を2つ選ぶ", sec: 120 },
    { label: "② Yes側 立論", who: "A1（3人班：Yes）", sec: 60, side: "yes" },
    { label: "③ No側 立論", who: "N1（3人班：No）", sec: 60, side: "no" },
    { label: "④ 反論準備", who: "ペアで相談", sec: 60 },
    { label: "⑤ No側 反論", who: "N2（3人班：No）", sec: 60, side: "no" },
    { label: "⑥ Yes側 反論", who: "A2（3人班：Yes）", sec: 60, side: "yes" },
    { label: "⑦ フリートーク", who: "立場を離れて本音で／Judgeが講評", sec: 120 },
  ],

  /* トピックごとの文言。
   * どのトピックを使うかはセッションごとに決まる（モニターの「準備」タブで切り替え）。
   * キー（refugees / konbini）は、worker/worker.js の TOPICS と必ずそろえる。
   * AI に渡すプロンプト（和訳・添削・まとめ）は Worker 側にあり、ここを直しても AI の動きは変わらない。 */
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
      // 授業の最後の問い
      QUOTE: "“Human life first.” — Ogata Sadako",
      FINAL_QUESTION: "Accepting refugees is one way to save lives.\nWhat else can Japan — and you — do to put “human life first”?",
      FINAL_QUESTION_JA: "受け入れることは命を救う方法の一つ。では「人命第一」のために、日本や私たちにできることは、ほかに何があるだろう？",
      // 生徒画面の「使える表現」（授業の後のライティングだけで出す。本文を読む前には出さない）
      // 授業の後の振り返り（日本語）。生徒画面とモニターの「5 振り返り」タブに出す
      REFLECTION: {
        PROMPT: "本文を読む前に書いた英文と、今日の英文を読み比べよう。自分の考えや英語は、どう変わった？（変わらなかったことも書いてよい）",
        HINTS: ["考え（立場や理由）は、どう変わった？", "使った英語の表現や、書いた量は？", "本文やディベートで、心に残ったことは？", "AI の問いかけについて、考えたことは？"],
      },
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

    // ---- 練習：アプリとディベートの進め方に慣れるための回（ライティングは1回だけ） ----
    konbini: {
      NAME: "練習（コンビニの24時間営業）",
      PRE_WRITING: false, // 書くのは授業の中の1回だけ
      TOPIC: "Should convenience stores stay open 24 hours?",
      TOPIC_JA: "コンビニは24時間営業を続けるべきか",
      TOPIC_SHORT_JA: "コンビニの24時間営業",
      YES_JA: "続けるべき",
      NO_JA: "やめるべき",
      OPINION_CHIPS: ["I believe that convenience stores should ", "I don't think convenience stores should ", "In my opinion, "],
      DEBATE_HINTS: {
        yes: "I believe convenience stores should ...  First of all, ...",
        no: "I don't think ...  This is because ...",
        rebut: "You said that ..., but ...  /  I see your point, but ...",
      },
      QUOTE: "",
      FINAL_QUESTION: "Convenience is nice, but someone has to work for it.\nWhat other “convenient” things should we think about again?",
      FINAL_QUESTION_JA: "便利さの裏には、働いている人がいる。ほかにも、見直したほうがよい「便利なもの」はあるだろうか？",
      REFLECTION: {
        PROMPT: "ディベートの前と今とで、自分の考えはどう変わった？（変わらなかった人は、何がはっきりした？）",
        HINTS: ["相手の意見で、なるほどと思ったことは？", "自分の理由は、はっきりした？", "英語で書いてみて、できたこと・難しかったことは？", "AI の問いかけについて、考えたことは？"],
      },
      EXPRESSIONS_TITLE: "使える表現",
      EXPRESSIONS: [
        ["labor shortage", "人手不足"],
        ["working conditions / night shift", "労働条件／夜勤"],
        ["convenient / lifestyle", "便利な／生活スタイル"],
        ["in an emergency", "緊急のときに"],
        ["save energy / food waste", "エネルギーを節約する／食品ロス"],
        ["customers / staff", "客／店員"],
        ["feel safe at night", "夜に安心できる"],
        ["have a bad effect on ~", "～に悪い影響を与える"],
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
