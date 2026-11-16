/* OREO Live — 設定ファイル（ここだけ編集すれば3画面すべてに反映されます） */
window.OREO_CONFIG = {
  // Cloudflare Worker の URL。空欄のままだと「デモモード」（AIを使わず、このブラウザ内だけで動作）
  WORKER_URL: "https://oreo-live.goldfish0824.workers.dev",

  TOPIC: "Should Japan accept more refugees?",
  TOPIC_JA: "日本はもっと難民を受け入れるべきか",

  // 生徒のログイン画面の選択肢
  CLASSES: ["4", "5", "6"],
  MAX_NUMBER: 45,
  GROUPS: 8,

  // ライティング
  WRITING_MINUTES: 12,
  SUBMIT_HINT_MINUTE: 9, // この時点でモニターに「送信しよう」を表示
  TARGET_WORDS: 70,
  MAX_SUBMISSIONS: 3, // Worker の MAX_SUBMISSIONS と合わせる

  // ミニ・ディベートの進行（モニターのタイマー）
  DEBATE_PHASES: [
    { label: "① 作戦タイム", who: "Yes・No のペアで理由を2つ選ぶ", sec: 120 },
    { label: "② Yes側 立論", who: "A1（3人班：Yes）", sec: 60, side: "yes" },
    { label: "③ No側 立論", who: "N1（3人班：No）", sec: 60, side: "no" },
    { label: "④ 反論準備", who: "ペアで相談", sec: 60 },
    { label: "⑤ No側 反論", who: "N2（3人班：No）", sec: 60, side: "no" },
    { label: "⑥ Yes側 反論", who: "A2（3人班：Yes）", sec: 60, side: "yes" },
    { label: "⑦ フリートーク", who: "立場を離れて本音で／Judgeが講評", sec: 120 },
  ],
  DEBATE_HINTS: {
    yes: "I believe Japan should ...  First of all, ...",
    no: "I don't think ...  This is because ...",
    rebut: "You said that ..., but ...  /  I see your point, but ...",
  },

  // 授業の最後の問い
  FINAL_QUESTION: "Accepting refugees is one way to save lives.\nWhat else can Japan — and you — do to put “human life first”?",
  FINAL_QUESTION_JA: "受け入れることは命を救う方法の一つ。では「人命第一」のために、日本や私たちにできることは、ほかに何があるだろう？",

  // 生徒画面の「使える表現」
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
};
