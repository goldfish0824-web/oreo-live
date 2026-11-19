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
      throw err;
    }
    return data;
  }
  const q = (o) => "?" + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();

  /* ---------------- 本番（Worker） ---------------- */
  const remote = {
    state: (s, cls, num) => http("/api/state" + q({ s, cls, num })),
    vote: (p) => http("/api/vote", { method: "POST", body: p }),
    write: (p) => http("/api/write", { method: "POST", body: p }),
    feedback: (p) => http("/api/feedback", { method: "POST", body: p, timeout: 90000 }), // コメントが届かなかったときの頼み直し
    reflect: (p) => http("/api/reflect", { method: "POST", body: p }),
    live: (s, key, since) => http("/api/live" + q({ s, since }), { key }),
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
    return db || { sessions: {}, votes: [], writings: [], seq: 0 };
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
  const ROUND_OF_PHASE = { pre: "pre", writing: "post" };
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
    konbini: {
      post: [
        ["If your favorite store closed at night, how would your life change?", "よく行く店が夜に閉まったら、生活はどう変わる？"],
        ["How would a night-shift worker answer your opinion?", "夜勤で働く人は、あなたの意見にどう答えるだろう？"],
      ],
    },
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
    const comment = before
      ? `読む前（${words(before.body)}語）より多い${n}語で書けました。${good}`
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
  // デモの役割：参観者用パスワードなら参観者、教員キーなら先生
  function demoRole(se, key) {
    if (key && key === (se.obsPass || "")) return "observer";
    let mon = null;
    try { mon = JSON.parse(localStorage.getItem("oreolive_monitor")); } catch {}
    if (key && (key === DEMO_TEACHER_KEY || (mon && mon.key === key))) return "teacher";
    err(se.obsPass ? "パスワードが正しくありません" : "参観者用のパスワードがまだ決まっていません。授業の先生に確認してください", 401);
  }

  const demo = {
    async state(s, cls, num) {
      await wait(120);
      const db = load();
      const se = sess(db, s);
      const out = { code: se.code, phase: se.phase, topic: topicOf(se) };
      if (cls) {
        const st = `${cls}-${parseInt(num, 10)}`;
        const v = db.votes.find((x) => x.session === se.code && x.student === st);
        const w = (r) => db.writings.find((x) => x.session === se.code && x.student === st && x.round === r);
        out.mine = { vote: v ? v.stance : null, pre: mineOf(w("pre")), post: mineOf(w("post")) };
      }
      return out;
    },
    async vote(p) {
      await wait(200);
      const db = load();
      const se = sess(db, p.s);
      if (se.phase !== "vote") err("今は投票の時間ではありません", 409);
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
      db.votes = db.votes.filter((x) => !(x.session === se.code && x.student === st));
      db.votes.push({ session: se.code, student: st, grp: String(p.grp || ""), stance: p.stance });
      save(db);
      return { ok: true, stance: p.stance };
    },
    async write(p) {
      await wait(500);
      const db = load();
      const se = sess(db, p.s);
      const round = ROUND_OF_PHASE[se.phase];
      if (!round) err("今は英文を書く時間ではありません", 409);
      if (!STANCES[round].includes(p.stance)) err(round === "pre" ? "Yes・No・Not sure のどれかを選んでください" : "Yes か No を選んでください");
      const body = cleanBody(p.body);
      const w = words(body);
      if (w < 5) err("英文をもう少し書いてから提出しましょう");
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
      if (db.writings.some((x) => x.session === se.code && x.student === st && x.round === round)) err("この英文はもう提出しています", 409);
      const at = Date.now();
      const id = ++db.seq;
      db.writings.push({ id, session: se.code, student: st, grp: String(p.grp || ""), round, stance: p.stance, body, words: w, translation: DEMO_TR, flag: "ok", feedback: null, reflection: null, at, upd: at });
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
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
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
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
      const w = db.writings.find((x) => x.session === se.code && x.student === st && x.round === "post");
      if (!w) err("英文を提出してから、振り返りを書きましょう", 404);
      const text = cleanBody(p.text).slice(0, 1500);
      w.reflection = text || null;
      w.upd = Date.now();
      save(db);
      return { ok: true, reflection: text, at: w.upd };
    },
    async live(s, key, since) {
      await wait(80);
      const db = load();
      const se = sess(db, s);
      const role = demoRole(se, key);
      return {
        role,
        phase: se.phase,
        topic: topicOf(se),
        votes: db.votes.filter((x) => x.session === se.code),
        writings: db.writings.filter((x) => x.session === se.code && x.upd >= (since || 0)).map(strip),
        summary: se.summary || null,
        serverTime: Date.now(),
      };
    },
    async session(s) {
      const db = load();
      const c = code(s);
      if (!/^[A-Z0-9_-]{1,20}$/.test(c)) err("セッションコードが正しくありません");
      db.sessions[c] = db.sessions[c] || { code: c, phase: "vote", topic: C.DEFAULT_TOPIC, summary: null, obsPass: DEMO_OBSERVER_KEY };
      save(db);
      return { code: c, phase: db.sessions[c].phase, topic: topicOf(db.sessions[c]) };
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
      sess(db, s).phase = phase;
      save(db);
      return { code: code(s), phase };
    },
    async summarize(s) {
      await wait(1500);
      const db = load();
      const se = sess(db, s);
      const ws = db.writings.filter((x) => x.session === se.code);
      if (!ws.length) err("まだ英文がありません");
      const konbini = topicOf(se) === "konbini";
      const text = konbini ? DEMO_SUMMARY.konbini : DEMO_SUMMARY.refugees;
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
      se.phase = "vote";
      se.summary = null;
      save(db);
      return { ok: true };
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
      const get = (id) => people.get(id) || people.set(id, { student: id, grp: "", vote: "", pre: null, post: null }).get(id);
      db.votes.filter((x) => x.session === se.code).forEach((v) => Object.assign(get(v.student), { vote: v.stance, grp: v.grp }));
      db.writings.filter((x) => x.session === se.code).forEach((w) => { get(w.student)[w.round] = w; if (w.grp) get(w.student).grp = w.grp; });
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const part = (w) => {
        if (!w) return Array(8).fill("");
        const f = w.feedback || {};
        return [w.stance, w.words, w.body, f.comment || "", (f.questions || []).map((q) => `${q.en}（${q.ja}）`).join(" / "), f.corrected || "", w.translation || "", w.flag || ""];
      };
      const cols = (p) => [`${p}の立場`, `${p}の語数`, `${p}の英文`, `${p}のAIコメント`, `${p}のAIの問いかけ`, `${p}の添削後`, `${p}の和訳(AI)`, `${p}のフラグ`];
      const head = ["組-番号", "グループ", ...cols("読む前"), "最初の考え(投票)", ...cols("授業後"), "振り返り"];
      const rows = [...people.values()].map((x) => [x.student, x.grp, ...part(x.pre), x.vote, ...part(x.post), (x.post && x.post.reflection) || ""].map(esc).join(","));
      return new Blob(["﻿" + [head.map(esc).join(","), ...rows].join("\r\n")], { type: "text/csv" });
    },
    // モニターの見た目確認用：28人分のサンプル（本番のトピックは読む前と後、練習は1回だけ）を投入
    async seed(s) {
      const db = load();
      const se = sess(db, s);
      const konbini = topicOf(se) === "konbini";
      const S = konbini ? DEMO_SAMPLES.konbini : DEMO_SAMPLES.refugees;
      const stances = ["yes", "no", "unsure"];
      const base = Date.now() - 40 * 60000;
      let n = 0;
      db.votes = db.votes.filter((x) => x.session !== se.code);
      db.writings = db.writings.filter((x) => x.session !== se.code);
      const topic = topicOf(se);
      const add = (w) => {
        const x = Object.assign({ id: ++db.seq, session: se.code, flag: "ok", feedback: null, reflection: null }, w, { words: words(w.body), upd: w.at });
        db.writings.push(x);
        return x;
      };
      const REFL = konbini ? DEMO_REFLECTIONS.konbini : DEMO_REFLECTIONS.refugees;
      for (const cls of ["4", "5", "6"]) {
        for (let num = 1; num <= 10 && n < 28; num++, n++) {
          const student = `${cls}-${num}`;
          const grp = String((n % 8) + 1);
          const first = stances[(n * 7) % 3];
          let pre = null;
          if (!konbini) {
            // 読む前は Not sure が多め
            const ps = n % 5 < 2 ? "unsure" : stances[(n * 7 + 1) % 3];
            const t = S.pre[ps][n % S.pre[ps].length];
            pre = add({ student, grp, round: "pre", stance: ps, body: t[0], translation: t[1], at: base - 20 * 86400000 + n * 30000 });
            pre.feedback = demoFeedback(pre, topic, null);
          }
          db.votes.push({ session: se.code, student, grp, stance: first });
          if (n >= 26) continue; // 2人はまだ書いていない
          const stance = n % 10 === 3 ? (first === "yes" ? "no" : "yes") : first === "unsure" ? (n % 2 ? "yes" : "no") : first;
          const t = S.post[stance][n % 4];
          const post = add({ student, grp, round: "post", stance, body: t[0], translation: t[1], at: base + 30 * 60000 + n * 20000 });
          if (n !== 25) post.feedback = demoFeedback(post, topic, pre); // 1人はコメントがまだ届いていない
          if (n % 3 !== 2) post.reflection = REFL[n % REFL.length];
        }
      }
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
    konbini: {
      pre: { yes: [], no: [], unsure: [] },
      post: {
        yes: [
          ["I believe convenience stores should stay open 24 hours. First of all, they are very convenient for people who work late. For example, my father comes home at 11 p.m., and he often buys dinner at a convenience store. Therefore, they should stay open for people with different lifestyles.", "コンビニは24時間営業を続けるべきだと思う。まず第一に、遅くまで働く人にとってとても便利だ。例えば、私の父は午後11時に帰宅し、よくコンビニで夕食を買う。だから、さまざまな生活スタイルの人のために営業を続けるべきだ。"],
          ["In my opinion, convenience stores should stay open 24 hours. This is because they help us in an emergency. When a big typhoon came last year, people could buy water and food at night. For these reasons, we need stores that are always open.", "私の意見では、コンビニは24時間営業を続けるべきだ。なぜなら、緊急のときに私たちを助けてくれるからだ。去年大きな台風が来たとき、人々は夜でも水や食べ物を買えた。これらの理由から、いつでも開いている店が必要だ。"],
          ["I think convenience stores should stay open 24 hours. The main reason is that people feel safe at night. The street near my house is dark, but the store's light makes me feel safe when I come home from club. So they should stay open.", "コンビニは24時間営業を続けるべきだと思う。主な理由は、夜に人々が安心できることだ。家の近くの道は暗いが、部活から帰るとき、店の明かりがあると安心できる。だから営業を続けるべきだ。"],
          ["I believe convenience stores should stay open. Stores can earn more money and give people jobs. Some university students want to work at night because they have classes in the daytime. That is why 24-hour stores are good for our town.", "コンビニは営業を続けるべきだと思う。店はもっとお金を稼げるし、人々に仕事を与えられる。昼間に授業があるので、夜に働きたい大学生もいる。だから、24時間営業の店は私たちの町にとって良いものだ。"],
        ],
        no: [
          ["I don't think convenience stores should stay open 24 hours. This is because Japan has a labor shortage. For example, a store near my station cannot find enough staff, so the owner works more than 12 hours a day. Therefore, stores should close at night.", "コンビニが24時間営業を続けるべきだとは思わない。なぜなら、日本は人手不足だからだ。例えば、駅の近くの店は十分な店員を見つけられず、オーナーが1日12時間以上働いている。だから、店は夜に閉めるべきだ。"],
          ["In my opinion, convenience stores should not stay open 24 hours. The main reason is that the night shift has a bad effect on workers' health. My cousin worked at night for a year, and she was always tired and could not sleep well. For these reasons, stores should close at night.", "私の意見では、コンビニは24時間営業を続けるべきではない。主な理由は、夜勤が働く人の健康に悪い影響を与えることだ。私のいとこは1年間夜に働いていたが、いつも疲れていて、よく眠れなかった。これらの理由から、店は夜に閉めるべきだ。"],
          ["I don't think stores should stay open 24 hours. It wastes a lot of energy. The lights and air conditioners are on all night, even when there are few customers. So closing at night can save energy.", "店が24時間営業を続けるべきだとは思わない。たくさんのエネルギーを無駄にする。客が少ないときでも、照明やエアコンが一晩中ついている。だから、夜に閉めればエネルギーを節約できる。"],
          ["I think convenience stores should close at night. There are few customers late at night. In my town, I see almost no one in the store after midnight. So it is not necessary to stay open.", "コンビニは夜に閉めるべきだと思う。夜遅くは客が少ない。私の町では、真夜中を過ぎると店にほとんど人がいない。だから、営業を続ける必要はない。"],
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
    konbini: [
      "最初は便利だから続けるべきだと思っていたが、店員さんの立場で考えると、夜は大変だとわかった。",
      "立場は変わらなかったけど、災害のときに役立つという理由がはっきりした。",
      "相手の「電気がもったいない」という意見になるほどと思った。英語で理由を2つ書けた。",
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
    konbini: {
      after: {
        yes: ["自分や家族の生活をもとにした理由が多い", "遅くまで働く人に便利", "災害のときに助かる", "夜道が明るく安心"],
        no: ["働く人の負担を心配する意見が多い", "人手不足で店員が大変", "夜勤は健康に悪い", "夜は客が少なく電気がもったいない"],
      },
      shift: "",
      common: "どちらの立場も、便利さは大切だが、働く人の健康も大切だと考えています。",
    },
  };

  window.OREO_API = Object.assign({ demo: DEMO, demoObserverKey: DEMO_OBSERVER_KEY, demoTeacherKey: DEMO_TEACHER_KEY }, DEMO ? demo : remote);
})();
