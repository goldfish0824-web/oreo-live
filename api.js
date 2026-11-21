/* OREO Live — API クライアント
 * config.js の WORKER_URL が空のときは「デモモード」：AIを呼ばず、localStorage に保存して動く。
 * 同じブラウザで index.html と monitor.html を開けば、提出がモニターに反映されるのを確認できる。
 */
(function () {
  const C = window.OREO_CONFIG;
  const BASE = (C.WORKER_URL || "").replace(/\/+$/, "");
  const DEMO = !BASE;

  async function http(path, { method = "GET", body, key, timeout = 60000, raw = false } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (key) headers["X-Key"] = key;
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "時間がかかりすぎています。もう一度押してください" : "通信できませんでした。Wi-Fiを確認して、もう一度試してください");
    } finally {
      clearTimeout(timer);
    }
    if (raw && res.ok) return res;
    let data = {};
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      const err = new Error(data.error || `エラーが発生しました（${res.status}）`);
      err.status = res.status;
      err.data = data; // 例：席がほかの人に選ばれている（taken）
      throw err;
    }
    return data;
  }
  const q = (o) => "?" + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();

  /* ---------------- 本番（Worker） ---------------- */
  // 生徒用：ログインで受け取った印（token）は、本文に入れずヘッダー X-Key で送る
  const asStudent = (path, p, opt = {}) => {
    const { token, ...body } = p;
    return http(path, { method: "POST", body, key: token, ...opt });
  };
  const remote = {
    login: (p) => http("/api/login", { method: "POST", body: p }),
    state: (s, cls, num, token) => http("/api/state" + q({ s, cls, num }), { key: token }),
    vote: (p) => asStudent("/api/vote", p),
    write: (p) => asStudent("/api/write", p),
    feedback: (p) => asStudent("/api/feedback", p, { timeout: 90000 }), // コメントが届かなかったときの頼み直し
    reflect: (p) => asStudent("/api/reflect", p),
    seat: (p) => asStudent("/api/seat", p), // ディベートの席をタップ（force：ほかの人が選んだ席を取り直す）
    unlock: (s, key, cls, num) => http("/api/admin/unlock", { method: "POST", key, body: { s, cls, num } }),
    // dev = 参観者用ページ・先生用の一覧の端末の印（スタンプを受け取るときだけ）
    live: (s, key, since, dev) => http("/api/live" + q({ s, since, dev }), { key }),
    stamp: (s, key, p) => http("/api/stamp", { method: "POST", key, body: { s, ...p } }),
    teams: (s, key, teams) => http("/api/admin/teams", { method: "POST", key, body: { s, teams } }),
    seatmaps: (key) => http("/api/admin/seatmaps", { key }),
    seatmap: (key, map) => http("/api/admin/seatmap", { method: "POST", key, body: map }),
    session: (s, key) => http("/api/admin/session", { method: "POST", key, body: { s } }),
    phase: (s, key, phase) => http("/api/admin/phase", { method: "POST", key, body: { s, phase } }),
    topic: (s, key, topic) => http("/api/admin/topic", { method: "POST", key, body: { s, topic } }),
    password: (s, key, password) => http("/api/admin/password", { method: "POST", key, body: { s, password } }),
    summarize: (s, key) => http("/api/admin/summarize", { method: "POST", key, body: { s }, timeout: 120000 }),
    clear: (s, key) => http("/api/admin/clear", { method: "POST", key, body: { s } }),
    info: (s, key) => http("/api/admin/info" + q({ s }), { key }),
    exportCsv: async (s, key) => (await http("/api/admin/export" + q({ s }), { key, raw: true })).blob(),
  };

  /* ---------------- デモ（localStorage） ---------------- */
  const LS = "oreolive_demo_v3";
  const DEMO_OBSERVER_KEY = "demo-obs"; // デモの参観者用パスワードの初期値（モニターの「準備」タブで変えられる）
  const DEMO_TEACHER_KEY = "demo"; // デモの教員キー（モニターで別のキーを使ったときは、そのキーも先生として扱う）
  const load = () => {
    let db = null;
    try {
      db = JSON.parse(localStorage.getItem(LS));
    } catch {}
    db = db || { sessions: {}, votes: [], writings: [], seq: 0 };
    db.logins = db.logins || [];
    db.members = db.members || []; // ディベートの席（生徒がタップ）
    db.stamps = db.stamps || []; // 先生からのスタンプ
    db.seatmaps = db.seatmaps || []; // 座席表（クラスごと。セッションをまたぐ）
    return db;
  };
  const topicOf = (se) => (C.TOPICS[se.topic] ? se.topic : C.DEFAULT_TOPIC);
  const save = (db) => {
    try {
      localStorage.setItem(LS, JSON.stringify(db));
    } catch {}
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const err = (m, status) => {
    const e = new Error(m);
    if (status) e.status = status;
    throw e;
  };
  const code = (s) => String(s || "").trim().toUpperCase();
  const sess = (db, s) => db.sessions[code(s)] || err("セッションが見つかりません。コードを確認してください", 404);
  const words = (t) => (String(t).match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  // 研究授業の部が開いているか（本番と同じ。読む前に書かないトピックは、いつでも開いている）
  const lessonOpen = (se) => !C.TOPICS[topicOf(se)].PRE_WRITING || se.phase !== "pre";
  const STANCES = { pre: ["yes", "no", "unsure"], post: ["yes", "no"] };
  const cleanBody = (v) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
  const DEMO_TR = "（デモモードでは和訳を作りません。本番では、ここに AI の参考訳が出ます）";

  // デモの添削：よくある誤りだけを機械的に直す（本番では AI が英文全体を見て直す）
  const FIXES = [
    [/\bi\b/g, "I", "「私は」の I は、いつも大文字です。"],
    [/\bmore refugee\b(?!s)/gi, "more refugees", "refugee は数えられる名詞なので、複数形にします。"],
    [/\bpeoples\b/gi, "people", "「人々」は people だけで複数の意味になります。"],
    [/\bshould accepts\b/gi, "should accept", "should の後ろは動詞の原形です。"],
    [/\bJapan have\b/g, "Japan has", "Japan は三人称単数なので has です。"],
    [/\bmany money\b/gi, "a lot of money", "money は数えられないので、many は使えません。"],
    [/\bdont\b/gi, "don't", "アポストロフィ（'）を忘れずに。"],
    [/\bit make\b/gi, "it makes", "主語が it なので makes です。"],
    [/\bJapan is safe country\b/gi, "Japan is a safe country", "数えられる名詞の前には a が必要です。"],
    [/\blive happy\b/gi, "live happily", "動詞 live を説明するので、副詞 happily にします。"],
    [/\bIf I am a refugee\b/g, "If I were a refugee", "事実と違う仮定なので、仮定法（were）にします。"],
  ];
  const JA_WORDS = { 困っている: "in trouble", 可哀想: "pitiful", かわいそう: "pitiful", 不安: "anxious", 人手不足: "labor shortage" };
  // デモの問いかけ（本番では AI が生徒の英文に合わせて作る）
  const DEMO_QUESTIONS = {
    refugees: {
      pre: [
        ["How many refugees do you think Japan accepts in a year?", "日本は1年に何人の難民を受け入れていると思う？"],
        ["Why do people have to leave their own countries?", "人々はなぜ、自分の国を離れなければならないのだろう？"],
        ["If you had to leave Japan, what would you need most?", "もしあなたが日本を離れなければならなくなったら、何がいちばん必要？"],
      ],
      post: [
        ["If people in your town felt worried, what would you say to them?", "町の人が不安に感じていたら、あなたは何と言う？"],
        ["What support do refugees need first when they arrive in Japan?", "難民が日本に着いたとき、まず必要な支援は何だろう？"],
        ["What would Ms. Ogata say about your idea?", "緒方さんなら、あなたの考えに何と言うだろう？"],
      ],
    },
    part1: { post: [
      ["Which is more important to you, helping people in Japan or in other countries?", "あなたにとって大切なのは、日本の人を助けることと外国の人を助けること、どちら？"],
      ["How would someone who pays taxes answer your opinion?", "税金を払っている人は、あなたの意見にどう答えるだろう？"],
    ] },
    part2: { post: [
      ["If everyone broke the rules for a good reason, what would happen?", "みんながよい理由でルールを破ったら、どうなるだろう？"],
      ["Who should decide when a rule can be broken?", "ルールを破ってよいときは、だれが決めるべきだろう？"],
    ] },
    part3: { post: [
      ["If you had to leave Japan, which country would you go to, and why?", "もし日本を離れなければならないなら、どの国に行く？ それはなぜ？"],
      ["What would a refugee child say about your idea?", "難民の子どもは、あなたの考えに何と言うだろう？"],
    ] },
    part4: { post: [
      ["If you were an aid worker's family, how would you feel?", "もしあなたが支援する人の家族だったら、どう感じる？"],
      ["How can people help refugees without going to dangerous places?", "危険な場所に行かずに、難民を助ける方法はあるだろうか？"],
    ] },
  };
  // デモのコメント・問いかけ・添削：よくある誤りだけを機械的に直す（本番では AI が英文全体を見て作る）
  function demoFeedback(w, topic, before) {
    let text = w.body;
    const points = [];
    for (const [re, to, why] of FIXES) {
      const m = text.match(re);
      if (m) { points.push({ original: m[0], corrected: to, why }); text = text.replace(re, to); }
    }
    text = text.replace(/[぀-ヿ㐀-鿿]+/g, (ja) => {
      const en = JA_WORDS[ja] || "(in English)";
      points.push({ original: ja, corrected: en, why: "日本語の部分は、英語ではこう言えます。" });
      return en;
    });
    const n = words(w.body);
    const hasNumber = /\d/.test(w.body);
    const good = hasNumber ? "数字を根拠に使っていて、説得力があります。" : "自分の考えが、自分の言葉ではっきり書けています。";
    const nb = before ? words(before.body) : 0;
    const comment = before
      ? (n > nb ? `読む前（${nb}語）より多い${n}語で書けました。` : `読む前は${nb}語、今日は${n}語でした。`) + good
      : w.round === "pre" ? "今の考えを、思いつくだけ英語で書けています。" + (/[぀-ヿ㐀-鿿]/.test(w.body) ? "日本語の部分も、英語で何と言うか見てみよう。" : "")
      : good;
    const qs = ((DEMO_QUESTIONS[topic] || DEMO_QUESTIONS.refugees)[w.round] || DEMO_QUESTIONS.refugees.post).map(([en, ja]) => ({ en, ja }));
    return { demo: true, comment, questions: qs, corrected: text, points: points.slice(0, 5), at: Date.now() };
  }

  const strip = (w) => Object.assign({}, w, { reflection: w.round === "post" ? w.reflection || null : null });
  const mineOf = (w) => {
    if (!w) return null;
    const o = { stance: w.stance, body: w.body, words: w.words, at: w.at, feedback: w.feedback || null };
    if (w.round === "post") o.reflection = w.reflection || "";
    return o;
  };
  const preOf = (db, se, st) => db.writings.find((x) => x.session === se.code && x.student === st && x.round === "pre");
  // デモのログイン（本番と同じく、名字そのものは保存せず照合用の値だけを置く。デモなので簡単なハッシュ）
  const normName = (v) => String(v ?? "").normalize("NFKC").replace(/\s+/g, "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).slice(0, 20);
  const demoHash = (t) => { let h = 0x811c9dc5; for (const ch of t) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
  const studentId = (p) => {
    const num = parseInt(p.num, 10);
    if (!/^[A-Za-z0-9]{1,4}$/.test(String(p.cls ?? "")) || !(num >= 1 && num <= 99)) err("組・番号が正しくありません");
    return `${p.cls}-${num}`;
  };
  function needLogin(db, se, st, token) {
    const l = db.logins.find((x) => x.session === se.code && x.student === st);
    if (!l || !token || l.token !== token) err("もう一度、番号と名字を入れてください", 401);
  }
  // デモの役割：参観者用パスワードなら参観者、教員キーなら先生
  function demoRole(se, key) {
    if (key && key === (se.obsPass || "")) return "observer";
    let mon = null;
    try { mon = JSON.parse(localStorage.getItem("oreolive_monitor")); } catch {}
    if (key && (key === DEMO_TEACHER_KEY || (mon && mon.key === key))) return "teacher";
    err(se.obsPass ? "パスワードが正しくありません" : "参観者用のパスワードがまだ決まっていません。授業の先生に確認してください", 401);
  }
  // チーム分け（本番と同じ考え方：班と立場は、生徒が選んだ席から決まる）
  const splitOf = (se) => (se.teams && se.teams.assign && Object.keys(se.teams.assign).length ? se.teams : null);
  const teamOf = (teams, seat) => {
    const a = teams && seat && teams.assign ? teams.assign[seat] : null;
    return a ? { seat, grp: String(a[0]), side: a[1] } : null;
  };
  const seatOf = (db, se, st) => (db.members.find((x) => x.session === se.code && x.student === st) || {}).seat;
  // スタンプ（Worker と同じ形）。参観者用：{ counts: { clear: 2, … }, mine: [...], who: [{ who: "田中", stamps: [...] }] }
  const STAMP_IDS = (C.STAMPS || []).map((x) => x.id);
  const stampName = (v) => String(v || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().replace(/\s*(先生|せんせい|センセイ)$/, "").trim().slice(0, 12);
  const stampsOut = (list, dev) => {
    const rows = list.filter((x) => STAMP_IDS.includes(x.stamp)).sort((a, b) => a.at - b.at);
    const by = new Map();
    rows.forEach((x) => { const w = x.name || ""; if (!by.has(w)) by.set(w, []); by.get(w).push(x.stamp); });
    return {
      counts: Object.fromEntries(STAMP_IDS.map((k) => [k, rows.filter((x) => x.stamp === k).length])),
      mine: rows.filter((x) => dev && x.dev === dev).map((x) => x.stamp),
      who: [...by].map(([who, stamps]) => ({ who, stamps })),
    };
  };
  // 生徒用：[{ stamp, who, at }]（押した順。端末の印は返さない）
  const stampList = (list) => list.filter((x) => STAMP_IDS.includes(x.stamp)).sort((a, b) => a.at - b.at).map((x) => ({ stamp: x.stamp, who: x.name || "", at: x.at }));

  const demo = {
    async login(p) {
      await wait(150);
      const db = load();
      const se = sess(db, p.s);
      const st = studentId(p);
      const name = normName(p.name);
      if (!name) err("名字を入力してください");
      const hash = demoHash(`${se.code}|${st}|${name}`);
      let l = db.logins.find((x) => x.session === se.code && x.student === st);
      const first = !l;
      if (!l) { l = { session: se.code, student: st, hash, token: newToken(), at: Date.now() }; db.logins.push(l); save(db); }
      if (l.hash !== hash) err("番号か名字がちがいます。わからないときは、先生に言ってください", 401);
      return { ok: true, token: l.token, first };
    },
    async state(s, cls, num, token) {
      await wait(120);
      const db = load();
      const se = sess(db, s);
      const out = { code: se.code, phase: se.phase, lesson: lessonOpen(se), topic: topicOf(se) };
      const split = splitOf(se);
      if (split) out.teams = { rows: split.rows, cols: split.cols, seats: split.seats, assign: split.assign, at: split.at };
      if (cls) {
        const st = studentId({ cls, num });
        needLogin(db, se, st, token);
        const v = db.votes.find((x) => x.session === se.code && x.student === st);
        const w = (r) => db.writings.find((x) => x.session === se.code && x.student === st && x.round === r);
        out.mine = {
          vote: v ? v.stance : null, pre: mineOf(w("pre")), post: mineOf(w("post")),
          team: teamOf(split, seatOf(db, se, st)),
          stamps: stampList(db.stamps.filter((x) => x.session === se.code && x.student === st)),
        };
      }
      return out;
    },
    async seat(p) {
      await wait(150);
      const db = load();
      const se = sess(db, p.s);
      const st = studentId(p);
      needLogin(db, se, st, p.token);
      const team = teamOf(splitOf(se), String(p.seat || ""));
      if (!team) err("その席は、今日のチームに入っていません。モニターの座席表を確かめてください", 409);
      const other = db.members.find((x) => x.session === se.code && x.seat === team.seat && x.student !== st);
      if (other && !p.force) { const e = new Error("その席は、ほかの人が選んでいます"); e.status = 409; e.data = { taken: true }; throw e; }
      db.members = db.members.filter((x) => !(x.session === se.code && (x.student === st || x.seat === team.seat)));
      db.members.push({ session: se.code, student: st, seat: team.seat, at: Date.now() });
      save(db);
      return { ok: true, team };
    },
    async vote(p) {
      await wait(200);
      const db = load();
      const se = sess(db, p.s);
      if (!lessonOpen(se)) err("続きは本文を学習した後で", 409);
      const st = studentId(p);
      needLogin(db, se, st, p.token);
      db.votes = db.votes.filter((x) => !(x.session === se.code && x.student === st));
      db.votes.push({ session: se.code, student: st, grp: String(p.grp || ""), stance: p.stance });
      save(db);
      return { ok: true, stance: p.stance };
    },
    async write(p) {
      await wait(500);
      const db = load();
      const se = sess(db, p.s);
      const open = lessonOpen(se);
      const round = p.round || (open ? "post" : "pre");
      if (round !== "pre" && round !== "post") err("どちらの英文かが正しくありません");
      if (round === "pre" && open) err("本文を読む前の英文は、もう書けません", 409);
      if (round === "post" && !open) err("続きは本文を学習した後で", 409);
      const st = studentId(p);
      needLogin(db, se, st, p.token);
      if (!STANCES[round].includes(p.stance)) err(round === "pre" ? "Yes・No・Not sure のどれかを選んでください" : "Yes か No を選んでください");
      const body = cleanBody(p.body);
      const w = words(body);
      if (w < 5) err("英文をもう少し書いてから提出しましょう");
      if (db.writings.some((x) => x.session === se.code && x.student === st && x.round === round)) err("この英文はもう提出しています", 409);
      const at = Date.now();
      const id = ++db.seq;
      const team = teamOf(splitOf(se), seatOf(db, se, st)); // ディベートの班は、生徒が選んだ席から
      db.writings.push({ id, session: se.code, student: st, grp: team ? team.grp : String(p.grp || ""), round, stance: p.stance, body, words: w, translation: DEMO_TR, flag: "ok", feedback: null, reflection: null, at, upd: at });
      save(db);
      // 本番と同じく、コメント・問いかけ・添削は少し後に届く
      setTimeout(() => {
        const d = load();
        const x = d.writings.find((y) => y.id === id);
        if (!x || x.feedback) return;
        x.feedback = demoFeedback(x, topicOf(d.sessions[x.session] || {}), round === "post" ? preOf(d, { code: x.session }, st) : null);
        x.upd = Date.now();
        save(d);
      }, 3000);
      return { ok: true, round, stance: p.stance, words: w, at };
    },
    async feedback(p) {
      await wait(1500);
      const db = load();
      const se = sess(db, p.s);
      const st = studentId(p);
      needLogin(db, se, st, p.token);
      const w = db.writings.find((x) => x.session === se.code && x.student === st && x.round === p.round);
      if (!w) err("まだ英文を提出していません", 404);
      if (w.feedback) return { feedback: w.feedback, already: true };
      w.feedback = demoFeedback(w, topicOf(se), p.round === "post" ? preOf(db, se, st) : null);
      w.upd = Date.now();
      save(db);
      return { feedback: w.feedback };
    },
    async reflect(p) {
      await wait(200);
      const db = load();
      const se = sess(db, p.s);
      const st = studentId(p);
      needLogin(db, se, st, p.token);
      const w = db.writings.find((x) => x.session === se.code && x.student === st && x.round === "post");
      if (!w) err("英文を提出してから、振り返りを書きましょう", 404);
      const text = cleanBody(p.text).slice(0, 1500);
      w.reflection = text || null;
      w.upd = Date.now();
      save(db);
      return { ok: true, reflection: text, at: w.upd };
    },
    async live(s, key, since, dev) {
      await wait(80);
      const db = load();
      const se = sess(db, s);
      const role = demoRole(se, key);
      const teams = se.teams || null;
      const out = {
        role,
        phase: se.phase,
        lesson: lessonOpen(se),
        topic: topicOf(se),
        votes: db.votes.filter((x) => x.session === se.code),
        writings: db.writings.filter((x) => x.session === se.code && x.upd >= (since || 0)).map(strip),
        summary: se.summary || null,
        teams,
        members: db.members.filter((x) => x.session === se.code).map((m) => ({ student: m.student, ...(teamOf(teams, m.seat) || { seat: m.seat, grp: "", side: "" }) })),
        serverTime: Date.now(),
      };
      if (dev) {
        const list = db.stamps.filter((x) => x.session === se.code);
        out.stamps = Object.fromEntries([...new Set(list.map((x) => x.student))].map((st) => [st, stampsOut(list.filter((x) => x.student === st), dev)]));
      }
      return out;
    },
    async stamp(s, key, p) {
      await wait(120);
      const db = load();
      const se = sess(db, s);
      demoRole(se, key);
      const name = stampName(p.name);
      const mineHere = (x) => x.session === se.code && x.dev === p.dev;
      if (p.rename === true) {
        if (!name) err("スタンプに出すお名前を入れてください");
        let renamed = 0;
        db.stamps.forEach((x) => { if (mineHere(x)) { x.name = name; renamed++; } });
        save(db);
        return { ok: true, name, renamed };
      }
      if (p.on !== false && !name) err("スタンプに出すお名前を入れてください");
      if (!STAMP_IDS.includes(p.stamp)) err("スタンプの種類が正しくありません");
      if (!db.writings.some((x) => x.session === se.code && x.student === p.student)) err("この生徒の英文が見つかりません", 404);
      const same = (x) => x.session === se.code && x.student === p.student && x.dev === p.dev && x.stamp === p.stamp;
      if (p.on === false) db.stamps = db.stamps.filter((x) => !same(x));
      else if (!db.stamps.some(same)) db.stamps.push({ session: se.code, student: p.student, dev: p.dev, stamp: p.stamp, name, at: Date.now() });
      if (name) db.stamps.forEach((x) => { if (mineHere(x)) x.name = name; });
      save(db);
      return { ok: true, student: p.student, ...stampsOut(db.stamps.filter((x) => x.session === se.code && x.student === p.student), p.dev) };
    },
    async teams(s, key, teams) {
      const db = load();
      const se = sess(db, s);
      se.teams = teams ? Object.assign({}, teams, { at: Date.now() }) : null;
      save(db);
      return { code: se.code, teams: se.teams };
    },
    async seatmaps() {
      return { maps: load().seatmaps };
    },
    async seatmap(key, map) {
      const db = load();
      const name = String(map.name || "").trim().slice(0, 40);
      if (!name) err("座席表の名前を入れてください（例：2年4・5・6組）");
      db.seatmaps = db.seatmaps.filter((x) => x.name !== name);
      if (map.remove) { save(db); return { ok: true, removed: 1 }; }
      if (!(map.seats || []).length) err("使う席を1つ以上タップしてください");
      const m = { name, rows: map.rows, cols: map.cols, seats: map.seats.slice(), at: Date.now() };
      db.seatmaps.push(m);
      db.seatmaps.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      save(db);
      return { ok: true, map: m };
    },
    async session(s) {
      const db = load();
      const c = code(s);
      if (!/^[A-Z0-9_-]{1,20}$/.test(c)) err("セッションコードが正しくありません");
      db.sessions[c] = db.sessions[c] || { code: c, phase: "pre", topic: C.DEFAULT_TOPIC, summary: null, obsPass: DEMO_OBSERVER_KEY };
      save(db);
      return { code: c, phase: db.sessions[c].phase, lesson: lessonOpen(db.sessions[c]), topic: topicOf(db.sessions[c]) };
    },
    async password(s, key, password) {
      const db = load();
      const se = sess(db, s);
      const pw = String(password ?? "").trim();
      if (pw.length < 4 || pw.length > 40) err("パスワードは4〜40文字にしてください");
      if (pw === DEMO_TEACHER_KEY) err("教員キーと同じパスワードは使えません");
      se.obsPass = pw;
      save(db);
      return { code: se.code, observerPassword: pw };
    },
    async topic(s, key, topic) {
      const db = load();
      const se = sess(db, s);
      if (!C.TOPICS[topic]) err("トピックが正しくありません");
      if (topic === topicOf(se)) return { code: se.code, topic };
      const has = (list) => list.some((x) => x.session === se.code);
      if (has(db.writings) || has(db.votes)) err("すでにデータがあるので、トピックは変えられません。別のセッションコードを使うか、先にデータを削除してください", 409);
      se.topic = topic;
      se.summary = null;
      save(db);
      return { code: se.code, topic };
    },
    async phase(s, key, phase) {
      const db = load();
      const se = sess(db, s);
      if (!["pre", "lesson", "vote", "wait", "writing", "closed"].includes(phase)) err("phase が正しくありません");
      se.phase = phase;
      save(db);
      return { code: se.code, phase, lesson: lessonOpen(se) };
    },
    async summarize(s) {
      await wait(1500);
      const db = load();
      const se = sess(db, s);
      const ws = db.writings.filter((x) => x.session === se.code);
      if (!ws.length) err("まだ英文がありません");
      const text = DEMO_SUMMARY[topicOf(se)] || DEMO_SUMMARY.refugees;
      const roundOut = (round, key) => {
        const list = ws.filter((x) => x.round === round);
        return Object.fromEntries(["yes", "no", "unsure"].map((k) => {
          const n = list.filter((x) => x.stance === k).length;
          const t = (text[key] || {})[k];
          return [k, n && t ? { count: n, overview: t[0], points: t.slice(1) } : { count: n, overview: "", points: [] }];
        }));
      };
      const before = ws.filter((x) => x.round === "pre").length, after = ws.filter((x) => x.round === "post").length;
      se.summary = {
        demo: true,
        before: roundOut("pre", "before"),
        after: roundOut("post", "after"),
        shift: before && after ? text.shift : "",
        common_ground: after ? text.common : "",
        count: { before, after },
        at: Date.now(),
      };
      save(db);
      return { summary: se.summary };
    },
    async clear(s) {
      const db = load();
      const se = sess(db, s);
      db.votes = db.votes.filter((x) => x.session !== se.code);
      db.writings = db.writings.filter((x) => x.session !== se.code);
      db.logins = db.logins.filter((x) => x.session !== se.code);
      db.members = db.members.filter((x) => x.session !== se.code);
      db.stamps = db.stamps.filter((x) => x.session !== se.code);
      se.phase = "pre";
      se.summary = null;
      se.teams = null;
      save(db);
      return { ok: true };
    },
    async unlock(s, key, cls, num) {
      const db = load();
      const se = sess(db, s);
      const st = studentId({ cls, num });
      const before = db.logins.length;
      db.logins = db.logins.filter((x) => !(x.session === se.code && x.student === st));
      save(db);
      return { ok: true, student: st, removed: before - db.logins.length };
    },
    async info(s) {
      const db = load();
      const se = s ? db.sessions[code(s)] : null;
      return { observerPassword: (se && se.obsPass) || "", model: "（デモモード：AIは使っていません）" };
    },
    async exportCsv(s) {
      const db = load();
      const se = sess(db, s);
      const people = new Map();
      const get = (id) => people.get(id) || people.set(id, { student: id, grp: "", side: "", vote: "", pre: null, post: null }).get(id);
      db.votes.filter((x) => x.session === se.code).forEach((v) => Object.assign(get(v.student), { vote: v.stance, grp: v.grp }));
      db.writings.filter((x) => x.session === se.code).forEach((w) => { get(w.student)[w.round] = w; if (w.grp) get(w.student).grp = w.grp; });
      db.members.filter((x) => x.session === se.code).forEach((m) => { const t = teamOf(se.teams, m.seat); if (t) Object.assign(get(m.student), { grp: t.grp, side: t.side === "yes" ? "Yes側" : "No側" }); });
      const stampsOfSt = (st) => db.stamps.filter((x) => x.session === se.code && x.student === st);
      const stampN = (st, k) => stampsOfSt(st).filter((x) => x.stamp === k).length;
      const whoText = (st) => stampsOut(stampsOfSt(st)).who.map((x) => `${x.who}先生（${x.stamps.map((k) => (C.STAMPS.find((y) => y.id === k) || {}).ja).join("・")}）`).join("／");
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const part = (w) => {
        if (!w) return Array(8).fill("");
        const f = w.feedback || {};
        return [w.stance, w.words, w.body, f.comment || "", (f.questions || []).map((q) => `${q.en}（${q.ja}）`).join(" / "), f.corrected || "", w.translation || "", w.flag || ""];
      };
      const cols = (p) => [`${p}の立場`, `${p}の語数`, `${p}の英文`, `${p}のAIコメント`, `${p}のAIの問いかけ`, `${p}の添削後`, `${p}の和訳(AI)`, `${p}のフラグ`];
      const head = ["組-番号", "グループ", "ディベートの立場", ...cols("読む前"), "最初の考え(投票)", ...cols("授業後"), "振り返り", ...(C.STAMPS || []).map((x) => `スタンプ「${x.ja}」`), "スタンプを押した先生"];
      const rows = [...people.values()].map((x) => [x.student, x.grp, x.side, ...part(x.pre), x.vote, ...part(x.post), (x.post && x.post.reflection) || "", ...STAMP_IDS.map((k) => stampN(x.student, k)), whoText(x.student)].map(esc).join(","));
      return new Blob(["﻿" + [head.map(esc).join(","), ...rows].join("\r\n")], { type: "text/csv" });
    },
    // モニターの見た目確認用：28人分のサンプル（本番のトピックは読む前と後、各 Part のディベートは1回だけ）を投入。
    // チーム分け（デモの教室：5×6 の30席、欠席2）と、席の選択・先生からのスタンプも入れる
    async seed(s) {
      const db = load();
      const se = sess(db, s);
      const topic = topicOf(se);
      const two = !!C.TOPICS[topic].PRE_WRITING; // 読む前にも書くトピック（本番）
      const S = DEMO_SAMPLES[topic] || DEMO_SAMPLES.refugees;
      const stances = ["yes", "no", "unsure"];
      const base = Date.now() - 40 * 60000;
      let n = 0;
      db.votes = db.votes.filter((x) => x.session !== se.code);
      db.writings = db.writings.filter((x) => x.session !== se.code);
      db.members = db.members.filter((x) => x.session !== se.code);
      db.stamps = db.stamps.filter((x) => x.session !== se.code);
      const MAP = "デモの教室（5×6）";
      let map = db.seatmaps.find((m) => m.name === MAP);
      if (!map) {
        map = { name: MAP, rows: 5, cols: 6, seats: [...Array(30).keys()].map((i) => `${Math.floor(i / 6)}-${i % 6}`), at: Date.now() };
        db.seatmaps.push(map);
      }
      const absent = ["2-3", "4-5"];
      const present = map.seats.filter((x) => !absent.includes(x));
      se.teams = { map: MAP, rows: map.rows, cols: map.cols, seats: map.seats.slice(), absent, assign: window.OREO_SEAT.split(map.rows, map.cols, present), at: Date.now() };
      const add = (w) => {
        const x = Object.assign({ id: ++db.seq, session: se.code, flag: "ok", feedback: null, reflection: null }, w, { words: words(w.body), upd: w.at });
        db.writings.push(x);
        return x;
      };
      const REFL = DEMO_REFLECTIONS[topic] || DEMO_REFLECTIONS.parts;
      for (const cls of ["4", "5", "6"]) {
        for (let num = 1; num <= 10 && n < 28; num++, n++) {
          const student = `${cls}-${num}`;
          // 1人を除いて、自分の席を選んだことにする（班はその席から決まる）
          const seat = present[n];
          if (n !== 27) db.members.push({ session: se.code, student, seat, at: base });
          const grp = n !== 27 ? String(se.teams.assign[seat][0]) : "";
          const first = stances[(n * 7) % 3];
          let pre = null;
          if (two) {
            // 読む前は Not sure が多め
            const ps = n % 5 < 2 ? "unsure" : stances[(n * 7 + 1) % 3];
            const t = S.pre[ps][n % S.pre[ps].length];
            pre = add({ student, grp, round: "pre", stance: ps, body: t[0], translation: t[1], at: base - 20 * 86400000 + n * 30000 });
            pre.feedback = demoFeedback(pre, topic, null);
          }
          db.votes.push({ session: se.code, student, grp: "", stance: first });
          if (n >= 26) continue; // 2人はまだ書いていない
          const stance = n % 10 === 3 ? (first === "yes" ? "no" : "yes") : first === "unsure" ? (n % 2 ? "yes" : "no") : first;
          const t = S.post[stance][n % S.post[stance].length];
          const post = add({ student, grp, round: "post", stance, body: t[0], translation: t[1], at: base + 30 * 60000 + n * 20000 });
          if (n !== 25) post.feedback = demoFeedback(post, topic, pre); // 1人はコメントがまだ届いていない
          if (n % 3 !== 2) post.reflection = REFL[n % REFL.length];
          // 先生からのスタンプ（2人の先生が押したことにする。まだもらっていない生徒もいる）
          (C.STAMPS || []).forEach((x, k) => {
            if ((n + k) % 3 === 0) db.stamps.push({ session: se.code, student, dev: "demo-teacher-1", stamp: x.id, name: "山本", at: base + 38 * 60000 + n * 1000 + k });
            if ((n + k) % 5 === 1) db.stamps.push({ session: se.code, student, dev: "demo-teacher-2", stamp: x.id, name: "佐藤", at: base + 39 * 60000 + n * 1000 + k });
          });
        }
      }
      se.phase = "lesson"; // サンプルは授業の後までのデータなので、研究授業の部を開いた状態にする
      save(db);
    },
  };

  /* ---------------- デモのサンプル文 ---------------- */
  const DEMO_SAMPLES = {
    refugees: {
      // 本文を読む前（短め・感覚的な理由。日本語まじりもある）
      pre: {
        yes: [
          ["I think Japan should accept more refugees. Because they are in trouble and we should help them. Japan is a rich country.", "日本はもっと難民を受け入れるべきだと思う。なぜなら彼らは困っていて、私たちは助けるべきだからだ。日本は豊かな国だ。"],
          ["I agree. Refugees are 可哀想. If I am a refugee, I want someone to help me.", "賛成だ。難民は可哀想だ。もし私が難民なら、誰かに助けてほしい。"],
          ["I think yes. Japan is safe country, so refugees can live happy in Japan.", "そう思う。日本は安全な国なので、難民は日本で幸せに暮らせる。"],
        ],
        no: [
          ["I don't think so. I dont know about refugees well, so I feel 不安.", "そうは思わない。難民のことをよく知らないので、不安を感じる。"],
          ["I think Japan should not accept more refugees. Japanese language is difficult and they will have trouble.", "日本はこれ以上難民を受け入れるべきではないと思う。日本語は難しく、彼らは困るだろう。"],
          ["No. Japan have many problems now, for example old people. We need money for us.", "いいえ。日本は今、例えば高齢者など多くの問題を抱えている。私たちのためにお金が必要だ。"],
        ],
        unsure: [
          ["I am not sure. I don't know much about refugees. I didn't see news about them.", "よくわからない。難民についてあまり知らない。彼らについてのニュースを見たことがない。"],
          ["I'm not sure because both ideas are understandable. Helping people is good, but it is not easy.", "どちらの考えもわかるので、よくわからない。人を助けるのは良いことだが、簡単ではない。"],
        ],
      },
      // 授業の後（本文の数字や表現を使って長くなる）
      post: {
        yes: [
          ["I believe Japan should accept more refugees.\n\nFirst of all, Japan has a humanitarian obligation as a rich and peaceful country. For example, about 117.8 million people were forced to leave their homes, but Japan recognized only 187 refugees in 2025. That number is very small.\n\nTherefore, Japan should put human life first, like Ms. Ogata did.", "日本はもっと難民を受け入れるべきだと思う。\n\nまず第一に、日本は豊かで平和な国として、人道的な義務がある。例えば、約1億1780万人が家を追われたが、日本が2025年に難民と認めたのは187人だけだった。その数はとても少ない。\n\nだから、緒方さんのように、日本は人の命を第一にすべきだ。"],
          ["In my opinion, Japan should accept more refugees. This is because Japan is facing a labor shortage because of its aging society. If refugees can study Japanese and get jobs, they can contribute to our society. Many companies need workers now. For these reasons, accepting refugees is good for both Japan and refugees.", "私の意見では、日本はもっと難民を受け入れるべきだ。なぜなら、日本は高齢化社会のため、人手不足に直面しているからだ。難民が日本語を学んで仕事に就ければ、私たちの社会に貢献できる。今、多くの会社が働き手を必要としている。これらの理由から、難民を受け入れることは日本と難民の両方にとって良いことだ。"],
          ["I think Japan should accept more refugee. Japan is a member of the international community. Germany hosts about 2.7 million refugees, but Japan accepts very few. Japan should do more for the world. So Japan should accept more.", "日本はもっと難民を受け入れるべきだと思う。日本は国際社会の一員だ。ドイツは約270万人の難民を受け入れているが、日本はとても少ない。日本は世界のためにもっとするべきだ。だから日本はもっと受け入れるべきだ。"],
          ["I believe Japan should accept more refugees. The main reason is that we can learn to live together with people from other cultures. Ms. Ogata said the 21st century is the age of co-existence and interdependence. Before reading the text, I only thought refugees were poor. Now I think we can learn from each other. Therefore, Japan should open its doors and co-exist with refugees.", "日本はもっと難民を受け入れるべきだと思う。主な理由は、ほかの文化の人々と共に生きることを学べるからだ。緒方さんは、21世紀は共存と相互依存の時代だと言った。本文を読む前、私は難民はかわいそうだとしか思っていなかった。今は、お互いに学び合えると思う。だから、日本は扉を開き、難民と共存すべきだ。"],
        ],
        no: [
          ["I don't think Japan should accept many more refugees right now. This is because Japan does not have a strong support system yet. For example, refugees need housing, Japanese lessons, and job training, but there are not enough teachers and staff. Therefore, Japan should first improve its support system.", "今すぐ日本がもっと多くの難民を受け入れるべきだとは思わない。なぜなら、日本にはまだしっかりした支援の仕組みがないからだ。例えば、難民には住まいや日本語の授業、職業訓練が必要だが、教える人や職員が足りない。だから、日本はまず支援の仕組みを良くするべきだ。"],
          ["In my opinion, Japan should not accept more refugees now. The main reason is the financial burden. Japan already has many problems, such as the aging society, and needs a lot of money for pensions and medical care. Instead, Japan can help refugees by giving money to UNHCR, like Ms. Ogata's organization.", "私の意見では、日本は今、これ以上難民を受け入れるべきではない。主な理由は、財政的な負担だ。日本はすでに高齢化社会など多くの問題を抱えていて、年金や医療に多くのお金が必要だ。その代わりに、日本は緒方さんの組織のような UNHCR にお金を出すことで難民を助けられる。"],
          ["I don't think Japan should accept more refugees. Refugees may face language barriers. Japanese is a difficult language, and they may feel isolated in Japanese society. So Japan should help them in other ways.", "日本がもっと難民を受け入れるべきだとは思わない。難民は言葉の壁にぶつかるかもしれない。日本語は難しい言語で、彼らは日本の社会で孤立していると感じるかもしれない。だから日本は別の方法で彼らを助けるべきだ。"],
          ["I think Japan should not accept more refugees. Many peoples worry about it. Some people feel anxious because they don't know about refugees well. First, Japan should teach people about refugees, and then think again.", "日本はこれ以上難民を受け入れるべきではないと思う。多くの人がそれを心配している。難民のことをよく知らないので、不安に感じる人もいる。まず、日本は人々に難民について教えて、それからもう一度考えるべきだ。"],
        ],
      },
    },
    // 教科書の各 Part の後のディベート（ライティングは1回だけ）
    part1: {
      pre: { yes: [], no: [], unsure: [] },
      post: {
        yes: [
          ["I believe Japan should spend more money to help people in other countries. First of all, many people are suffering from hunger and war. Japan is a rich country, so we can save many lives. For example, UNHCR gives food and medical care to refugees. Therefore, Japan should help more.", "日本は外国の人々を助けるために、もっとお金を使うべきだと思う。まず第一に、多くの人が飢えや戦争で苦しんでいる。日本は豊かな国なので、多くの命を救える。例えば、UNHCR は難民に食料や医療を届けている。だから、日本はもっと助けるべきだ。"],
          ["I think Japan should spend more money. Japan is a member of the international community. If Japan helps other countries now, they will help Japan in the future, for example after a big earthquake.", "日本はもっとお金を使うべきだと思う。日本は国際社会の一員だ。今、日本がほかの国を助ければ、例えば大きな地震のあとなど、将来その国々が日本を助けてくれるだろう。"],
        ],
        no: [
          ["I don't think Japan should spend more money now. This is because Japan has its own problems, such as the aging society. We need money for pensions and hospitals. So Japan should use the money for people in Japan first.", "日本が今、もっとお金を使うべきだとは思わない。なぜなら、日本には高齢化社会など自分たちの課題があるからだ。年金や病院にお金が必要だ。だから、日本はまず日本の人々のためにお金を使うべきだ。"],
          ["In my opinion, Japan should not spend more money. Money is not the only way to help. Japan can send doctors and teachers instead. I think people are more important than money.", "私の意見では、日本はこれ以上お金を使うべきではない。お金だけが助ける方法ではない。日本は代わりに医者や先生を送ることができる。お金より人のほうが大切だと思う。"],
        ],
      },
    },
    part2: {
      pre: { yes: [], no: [], unsure: [] },
      post: {
        yes: [
          ["I think it is OK to break the rules to save people's lives. Human life is the most important thing. Ms. Ogata protected the Kurdish people even though they were not refugees officially. If she followed the rules, many people would die.", "命を救うためなら、ルールを破ってもよいと思う。人の命が何より大切だ。緒方さんは、正式には難民ではなかったクルドの人々を守った。もし彼女がルールに従っていたら、多くの人が死んでいただろう。"],
          ["I believe we can break the rules in an emergency. For example, an ambulance can go through a red light to save a sick person. Rules are made to protect people.", "緊急のときは、ルールを破ってもよいと思う。例えば、救急車は病気の人を救うために赤信号でも進める。ルールは人を守るためにつくられている。"],
        ],
        no: [
          ["I don't think we should break the rules. If one person breaks the rules, other people will do the same thing. Then the rules will not work and people will lose trust.", "ルールを破るべきではないと思う。1人がルールを破ると、ほかの人も同じことをするだろう。そうなるとルールが働かなくなり、人々は信頼を失う。"],
          ["In my opinion, we should not break the rules, but we can change them. Ms. Ogata talked with the leaders of other countries and made a safe place for the people. She did not just break the rules. So we should find another way.", "私の意見では、ルールを破るべきではないが、変えることはできる。緒方さんはほかの国の指導者と話し合い、人々のための安全な場所をつくった。彼女はただルールを破ったのではない。だから、私たちは別の方法を探すべきだ。"],
        ],
      },
    },
    part3: {
      pre: { yes: [], no: [], unsure: [] },
      post: {
        yes: [
          ["I believe refugees should live in a country near their home country. Most refugees want to go back home. If they live near their country, they can go back soon when peace returns.", "難民は、自分の国に近い国で暮らすほうがよいと思う。ほとんどの難民は故郷に帰りたいと思っている。自分の国の近くに住んでいれば、平和が戻ったときにすぐに帰れる。"],
          ["I think a neighboring country is better because the culture and language are similar. Refugees can start a new life more easily. Children can also study in a language they know.", "近くの国のほうがよいと思う。文化や言葉が似ているからだ。難民は新しい生活をより簡単に始められる。子どもたちも、知っている言葉で勉強できる。"],
        ],
        no: [
          ["I don't think refugees have to live near their home country. The neighboring countries are sometimes not safe. Refugees need a safe and stable place, even if it is far from home.", "難民が自分の国の近くに住まなければならないとは思わない。近くの国が安全でないこともある。故郷から遠くても、難民には安全で安定した場所が必要だ。"],
          ["In my opinion, refugees should choose the country. Some neighboring countries already have too many refugees. For example, Iran accepted about 1.3 million Kurdish refugees. Other countries should share the burden.", "私の意見では、難民が国を選ぶべきだ。近くの国の中には、すでに多すぎる難民を受け入れている国もある。例えば、イランは約130万人のクルド難民を受け入れた。ほかの国々も負担を分け合うべきだ。"],
        ],
      },
    },
    part4: {
      pre: { yes: [], no: [], unsure: [] },
      post: {
        yes: [
          ["I believe aid workers should stay in dangerous places. If they leave, refugees will lose their only help. Ms. Ogata told her colleague to stay if he could save refugees.", "支援する人は、危険な場所にとどまるべきだと思う。彼らが去れば、難民はただ1つの助けを失ってしまう。緒方さんは同僚に、難民を救えるならとどまるようにと言った。"],
          ["I think aid workers should stay because refugees trust them. When the workers are there, refugees feel safe. Their work is very important.", "支援する人はとどまるべきだと思う。難民が彼らを信頼しているからだ。支援する人がそこにいると、難民は安心できる。彼らの仕事はとても大切だ。"],
        ],
        no: [
          ["I don't think aid workers should stay in dangerous places. Their lives are also important. They have their own families. If they die, they cannot help anyone in the future.", "支援する人が危険な場所にとどまるべきだとは思わない。彼らの命も大切だ。彼らにも家族がいる。もし死んでしまったら、将来だれも助けられなくなる。"],
          ["In my opinion, aid workers should leave the area for a while. They can help refugees in other ways, for example by sending supplies from a safe place.", "私の意見では、支援する人はしばらくその地域を離れるべきだ。例えば安全な場所から物資を送るなど、ほかの方法で難民を助けられる。"],
        ],
      },
    },
  };
  // デモの振り返り（日本語）
  const DEMO_REFLECTIONS = {
    refugees: [
      "読む前は「かわいそうだから助けたい」としか書けなかった。今日は187人という数字を使って、日本の受け入れが少ないことを理由にできた。",
      "立場は No のままだけど、理由が「なんとなく不安」から「支援の仕組みが足りない」に変わった。不安の正体がわかった気がする。",
      "Not sure から Yes になった。緒方さんの「人の命を第一に」という言葉が心に残った。英語も前の倍くらい書けた。",
      "ディベートで相手に「お金はどうするの？」と言われて、答えられなかった。AI の問いかけも同じことを聞いていたので、もっと調べたい。",
      "前は日本語が混ざっていたけど、今日は全部英語で書けた。labor shortage という表現を使えたのがうれしい。",
    ],
    // 教科書の各 Part の後のディベート（どの Part でも使う）
    parts: [
      "最初は Yes だと思っていたが、相手のメモを読んで、反対の理由にもなるほどと思った。",
      "立場は変わらなかったけど、本文の内容を理由に使えて、言いたいことがはっきりした。",
      "英語で理由を2つ書けた。ディベートで聞いた表現を使ってみた。",
    ],
  };
  // デモのまとめ（[全体の傾向, 主な考え1, 2, 3]）
  const DEMO_SUMMARY = {
    refugees: {
      before: {
        yes: ["困っている人を助けたいという気持ちの理由が多い", "困っている人は助けたい", "日本は豊かで安全な国だから"],
        no: ["よく知らないことへの不安が多い", "なんとなく不安", "言葉が通じないと大変そう", "日本にも問題がある"],
        unsure: ["難民についてよく知らない人が多い", "難民のことをよく知らない", "どちらの考えもわかる"],
      },
      after: {
        yes: ["本文の数字や緒方さんの言葉を根拠にしている", "豊かな国として人道的な義務がある", "人手不足の社会に貢献できる", "国際社会の一員として役割を果たす"],
        no: ["受け入れる前の準備を心配する意見が多い", "支援の仕組みがまだ足りない", "財政の負担が大きい", "言葉の壁で孤立しやすい"],
      },
      shift: "読む前は「かわいそう」「なんとなく不安」など気持ちの理由が多く見られました。授業の後は、本文の数字（187人など）や緒方さんの言葉を根拠にした理由が増え、英文も長くなっています。",
      common: "どちらの立場も、難民の命を大切にしたいこと、受け入れるなら十分な支援が必要だと考えている点は同じです。",
    },
    part1: {
      after: {
        yes: ["困っている人を救いたいという理由が多い", "豊かな国としての責任", "国際社会の一員として", "いつか日本も助けてもらえる"],
        no: ["日本の課題を先に考えたいという意見が多い", "高齢化などにお金が必要", "お金以外の助け方もある"],
      },
      shift: "",
      common: "どちらの立場も、困っている人を助けたい気持ちと、日本の暮らしも大切だという考えは同じです。",
    },
    part2: {
      after: {
        yes: ["命が何より大切だという理由が多い", "緊急のときは命が優先", "ルールは人を守るためのもの"],
        no: ["ルールを守る意味を大切にする意見が多い", "まねをする人が出る", "ルールは破るより変えるべき"],
      },
      shift: "",
      common: "どちらの立場も、命を大切にしたいことと、ルールには人を守る意味があることは同じです。",
    },
    part3: {
      after: {
        yes: ["故郷に帰りやすいことを理由にする意見が多い", "平和になったらすぐ帰れる", "文化や言葉が似ている"],
        no: ["安全を何より大切にする意見が多い", "近くの国が安全とは限らない", "負担を分け合うべき"],
      },
      shift: "",
      common: "どちらの立場も、難民が安全に暮らし、いつか故郷に帰れることを願っています。",
    },
    part4: {
      after: {
        yes: ["難民を見捨てないことを大切にする意見が多い", "難民の唯一の助けになる", "信頼されている人がいると安心"],
        no: ["支援する人の命も大切にする意見が多い", "支援する人にも家族がいる", "安全な場所からも助けられる"],
      },
      shift: "",
      common: "どちらの立場も、難民の命と支援する人の命の両方を大切にしたいと考えています。",
    },
  };

  window.OREO_API = Object.assign({ demo: DEMO, demoObserverKey: DEMO_OBSERVER_KEY, demoTeacherKey: DEMO_TEACHER_KEY }, DEMO ? demo : remote);
})();
