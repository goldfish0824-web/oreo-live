/* OREO Live — 設定ファイル（ここだけ編集すれば3画面すべてに反映されます） */
window.OREO_CONFIG = {
  // Cloudflare Worker の URL。空欄のままだと「デモモード」（AIを使わず、このブラウザ内だけで動作）
  WORKER_URL: "https://oreo-live.goldfish0824.workers.dev",

  // 生徒のログイン画面の選択肢
  CLASSES: ["4", "5", "6"],
  MAX_NUMBER: 45,
  GROUPS: 8,

  // ライティング
  WRITING_MINUTES: 12,
  SUBMIT_HINT_MINUTE: 9, // この時点でモニターに「送信しよう」を表示
  TARGET_WORDS: 70,
  MAX_SUBMISSIONS: 3, // Worker の MAX_SUBMISSIONS と合わせる

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
   * キー（refugees / konbini）と REASON_LABELS のキーは、worker/worker.js の TOPICS と必ずそろえる。
   * AI に渡す評価プロンプトは Worker 側にあり、ここを直しても AI の評価は変わらない。 */
  DEFAULT_TOPIC: "refugees",
  TOPICS: {
    // ---- 本番：Lesson 8「緒方貞子さんと難民支援」 ----
    refugees: {
      NAME: "本番（Lesson 8：難民の受け入れ）",
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
      // 生徒画面の「使える表現」
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
      // AIが付ける「理由タグ」の表示名
      REASON_LABELS: {
        humanitarian: ["Humanitarian obligation", "人道的責任"],
        international: ["Role in the world", "国際社会での役割"],
        labor: ["Labor shortage / contribution", "人手不足・社会への貢献"],
        diversity: ["Diversity & co-existence", "多様性・共生"],
        cost: ["Financial burden", "財政負担"],
        support: ["Support system", "支援体制の不足"],
        language: ["Language & culture", "言語・文化の壁"],
        safety: ["Public concerns", "社会の不安"],
        other: ["Other", "その他"],
      },
    },

    // ---- 練習：アプリと OREO の型に慣れるための回 ----
    konbini: {
      NAME: "練習（コンビニの24時間営業）",
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
      REASON_LABELS: {
        convenience: ["Convenience & lifestyle", "便利さ・生活スタイル"],
        safety: ["Safety at night", "防犯・夜の安心"],
        emergency: ["Emergencies", "災害・緊急時の備え"],
        economy: ["Sales & jobs", "売上・雇用"],
        labor: ["Labor shortage", "人手不足"],
        workers: ["Workers' health", "働く人の負担・健康"],
        environment: ["Energy & food waste", "電気・食品ロス"],
        demand: ["Few customers at night", "深夜の利用の少なさ"],
        other: ["Other", "その他"],
      },
    },
  },
};

// トピックの文言を取り出す（知らない id のときは本番のトピック）
window.OREO_TOPIC = function (id) {
  const C = window.OREO_CONFIG;
  return C.TOPICS[id] || C.TOPICS[C.DEFAULT_TOPIC];
};
