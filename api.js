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
      throw new Error(e.name === "AbortError" ? "時間がかかりすぎています。もう一度送信してください" : "通信できませんでした。Wi-Fiを確認して、もう一度試してください");
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
    prevote: (p) => http("/api/prevote", { method: "POST", body: p }),
    vote: (p) => http("/api/vote", { method: "POST", body: p }),
    submit: (p) => http("/api/submit", { method: "POST", body: p, timeout: 90000 }),
    live: (s, key, since, observer) => http("/api/live" + q({ s, since, observer }), { key }),
    star: (s, key, subId, observer, on) => http("/api/star", { method: "POST", key, body: { s, subId, observer, on } }),
    session: (s, key) => http("/api/admin/session", { method: "POST", key, body: { s } }),
    phase: (s, key, phase) => http("/api/admin/phase", { method: "POST", key, body: { s, phase } }),
    topic: (s, key, topic) => http("/api/admin/topic", { method: "POST", key, body: { s, topic } }),
    summarize: (s, key) => http("/api/admin/summarize", { method: "POST", key, body: { s }, timeout: 90000 }),
    clear: (s, key) => http("/api/admin/clear", { method: "POST", key, body: { s } }),
    info: (s, key) => http("/api/admin/info" + q({ s }), { key }),
    exportCsv: async (s, key) => (await http("/api/admin/export" + q({ s }), { key, raw: true })).blob(),
  };

  /* ---------------- デモ（localStorage） ---------------- */
  const LS = "oreolive_demo_v1";
  const load = () => {
    let db = null;
    try {
      db = JSON.parse(localStorage.getItem(LS));
    } catch {}
    db = db || { sessions: {}, votes: [], subs: [], stars: [], seq: 0 };
    db.prevotes = db.prevotes || []; // 単元に入る前の考え
    return db;
  };
  const topicOf = (se) => (C.TOPICS[se.topic] ? se.topic : C.DEFAULT_TOPIC);
  const save = (db) => {
    try {
      localStorage.setItem(LS, JSON.stringify(db));
    } catch {}
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const err = (m) => {
    throw new Error(m);
  };
  const code = (s) => String(s || "").trim().toUpperCase();
  const sess = (db, s) => db.sessions[code(s)] || err("セッションが見つかりません。コードを確認してください");
  const words = (t) => (String(t).match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const oreo = (r) => [r.opinion, r.reason, r.example, r.conclusion].filter(Boolean).join(" ");

  const DEMO_KONBINI = {
    rules: [
      ["labor", /shortage|not enough (staff|workers)|hard to find/],
      ["workers", /tired|health|sleep|night shift|working conditions|hard work/],
      ["environment", /energy|electric|waste|light/],
      ["demand", /few customers|few people|nobody|no one|empty/],
      ["emergency", /emergency|disaster|earthquake|typhoon|sick/],
      ["safety", /safe|dark|crime|danger/],
      ["economy", /money|sales|job|earn|business/],
      ["convenience", /convenient|anytime|late|lifestyle|hungry/],
    ],
    yes: ["convenience", "safety", "emergency", "economy"],
    no: ["labor", "workers", "environment", "demand"],
    target: /labor shortage|working conditions|night shift|convenient|emergency|save energy|food waste|customers|staff|lifestyle/i,
    better: { yes: "Convenience stores are very useful in an emergency.", no: "Working the night shift has a bad effect on staff's health." },
    challenge: {
      yes: { en: "Who will work at night if there is a labor shortage?", ja: "人手不足のなか、夜はだれが働くのでしょう？" },
      no: { en: "What should people do if they need something late at night?", ja: "夜遅くに何か必要になった人は、どうすればよいでしょう？" },
    },
  };

  function demoTag(text, stance, topic) {
    const t = text.toLowerCase();
    if (topic === "konbini") {
      for (const [tag, re] of DEMO_KONBINI.rules) if (re.test(t) && DEMO_KONBINI[stance].includes(tag)) return tag;
      return "other";
    }
    const rules = [
      ["cost", /money|financial|cost|tax|burden|expensive/],
      ["support", /support|system|ready|prepare/],
      ["language", /language|culture|isolat|barrier/],
      ["safety", /safe|worr|anxi|crime|afraid/],
      ["labor", /labor|labour|work|job|shortage|aging|ageing/],
      ["international", /world|international|other countries|germany|global/],
      ["diversity", /divers|co-exist|coexist|together/],
      ["humanitarian", /human|life|lives|obligation|help|save/],
    ];
    const yesTags = ["labor", "international", "diversity", "humanitarian"];
    const noTags = ["cost", "support", "language", "safety"];
    for (const [tag, re] of rules) {
      if (re.test(t) && (stance === "yes" ? yesTags : noTags).includes(tag)) return tag;
    }
    return "other";
  }

  function demoFeedback(p, w, version, topic) {
    const K = topic === "konbini" ? DEMO_KONBINI : null;
    const text = oreo(p);
    const hasNumber = /\d/.test(p.example || "");
    const logic = !p.example || w < 30 ? "C" : w >= 65 && hasNumber ? "A" : "B";
    const target = (K ? K.target : /humanitarian|financial burden|labor shortage|support system|language barrier|contribute|international community|human life first/i).test(text);
    const corrections = [];
    const rules = [
      [/\bi\b/, "i", "I", "「私は」の I は常に大文字です。"],
      [/more refugee\b(?!s)/i, "more refugee", "more refugees", "refugee は数えられる名詞なので複数形にします。"],
      [/\bpeoples\b/i, "peoples", "people", "「人々」は people で複数の意味になります。"],
      [/\bshould accepts\b/i, "should accepts", "should accept", "should の後ろは動詞の原形です。"],
      [/\bJapan have\b/, "Japan have", "Japan has", "Japan は三人称単数なので has です。"],
      [/\bmany money\b/i, "many money", "a lot of money", "money は数えられないので many は使えません。"],
    ];
    for (const [re, o, c, why] of rules) if (re.test(text)) corrections.push({ original: o, corrected: c, why });
    const fb = {
      demo: true,
      scores: { logic, grammar: corrections.length > 2 ? "C" : corrections.length ? "B" : "A", vocabulary: target ? "A" : "B" },
      good_point:
        (version > 1 ? "前回の指摘を生かして書き直せています。" : "") +
        (hasNumber ? "Example に数字を入れていて、説得力があります。" : "自分の立場がはっきり書けています。"),
      logic_comment: hasNumber
        ? "理由と根拠のつながりがはっきりしています。最後の Opinion で、もう一度理由に触れるとさらに良くなります。"
        : "Example に資料の数字や具体例を1つ入れると、説得力がぐっと増します。",
      corrections,
      better_expressions: K
        ? [{ original: "", suggestion: K.better[p.stance], why: "「使える表現」を使うと伝わりやすくなります。" }]
        : target
        ? [{ original: "", suggestion: "In addition, Japan can contribute to the international community.", why: "理由をもう1つ足す表現です。" }]
        : [{ original: "", suggestion: p.stance === "yes" ? "Japan has a humanitarian obligation to help them." : "It would be a big financial burden for Japan.", why: "資料の表現を使うと伝わりやすくなります。" }],
      challenge: K
        ? K.challenge[p.stance]
        : p.stance === "yes"
          ? { en: "Who will pay for housing and Japanese lessons for refugees?", ja: "難民の住まいや日本語の授業の費用は、だれが払うのでしょう？" }
          : { en: "If Japan does not accept them, where can they live safely?", ja: "日本が受け入れないなら、彼らはどこで安全に暮らせるでしょう？" },
      summary_en: (p.opinion || "").slice(0, 120),
      reason_tag: demoTag(text, p.stance, topic),
      flag: "ok",
    };
    return fb;
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
        const pv = db.prevotes.find((x) => x.session === se.code && x.student === st);
        out.mine = { pre: pv ? { stance: pv.stance, reason: pv.reason } : null, vote: v ? v.stance : null, submissions: db.subs.filter((x) => x.session === se.code && x.student === st).length, max: C.MAX_SUBMISSIONS };
      }
      return out;
    },
    async prevote(p) {
      await wait(200);
      const db = load();
      const se = sess(db, p.s);
      if (se.phase !== "pre") err("今は「単元の前の考え」を書く時間ではありません");
      const reason = String(p.reason || "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!reason) err("理由を一言書いてから送信しましょう");
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
      db.prevotes = db.prevotes.filter((x) => !(x.session === se.code && x.student === st));
      db.prevotes.push({ session: se.code, student: st, grp: String(p.grp || ""), stance: p.stance, reason });
      save(db);
      return { ok: true, stance: p.stance, reason };
    },
    async vote(p) {
      await wait(200);
      const db = load();
      const se = sess(db, p.s);
      if (se.phase !== "vote") err("今は投票の時間ではありません");
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
      db.votes = db.votes.filter((x) => !(x.session === se.code && x.student === st));
      db.votes.push({ session: se.code, student: st, grp: String(p.grp || ""), stance: p.stance });
      save(db);
      return { ok: true, stance: p.stance };
    },
    async submit(p) {
      await wait(1800);
      const db = load();
      const se = sess(db, p.s);
      if (se.phase !== "writing") err("今はライティングの時間ではありません");
      const st = `${p.cls}-${parseInt(p.num, 10)}`;
      const prev = db.subs.filter((x) => x.session === se.code && x.student === st);
      if (prev.length >= C.MAX_SUBMISSIONS) err(`提出は${C.MAX_SUBMISSIONS}回までです`);
      const w = words(oreo(p));
      if (w < 5) err("英文をもう少し書いてから送信しましょう");
      const fb = demoFeedback(p, w, prev.length + 1, topicOf(se));
      const row = {
        id: ++db.seq, session: se.code, student: st, grp: String(p.grp || ""), version: prev.length + 1, stance: p.stance,
        opinion: p.opinion, reason: p.reason, example: p.example, conclusion: p.conclusion, words: w, consent: !!p.consent,
        logic: fb.scores.logic, grammar: fb.scores.grammar, vocab: fb.scores.vocabulary, reason_tag: fb.reason_tag,
        summary_en: fb.summary_en, flag: fb.flag, feedback: fb,
        // 本番では Worker が AI に和訳を頼む（参観者画面だけに出す）。デモでは訳せないので注意書きだけ入れる
        translation: { opinion: "（デモモードでは和訳を作りません。本番では、ここに AI の参考訳が出ます）", reason: "", example: "", conclusion: "" },
        at: Date.now(),
      };
      db.subs.push(row);
      save(db);
      return { id: row.id, version: row.version, remaining: C.MAX_SUBMISSIONS - row.version, words: w, feedback: fb };
    },
    async live(s, key, since, observer) {
      await wait(80);
      const db = load();
      const se = sess(db, s);
      const starCounts = {};
      const myStars = [];
      for (const r of db.stars.filter((x) => x.session === se.code)) {
        starCounts[r.sub_id] = (starCounts[r.sub_id] || 0) + 1;
        if (observer && r.observer === observer) myStars.push(r.sub_id);
      }
      return {
        role: "teacher",
        phase: se.phase,
        topic: topicOf(se),
        prevotes: db.prevotes.filter((x) => x.session === se.code),
        votes: db.votes.filter((x) => x.session === se.code),
        subs: db.subs.filter((x) => x.session === se.code && x.id > (since || 0)),
        starCounts,
        myStars,
        summary: se.summary || null,
        serverTime: Date.now(),
      };
    },
    async star(s, key, subId, observer, on) {
      const db = load();
      const se = sess(db, s);
      if (!observer) err("お名前（表示名）を入力してください");
      db.stars = db.stars.filter((x) => !(x.sub_id === subId && x.observer === observer));
      if (on) db.stars.push({ session: se.code, sub_id: subId, observer });
      save(db);
      return { ok: true };
    },
    async session(s) {
      const db = load();
      const c = code(s);
      if (!/^[A-Z0-9_-]{1,20}$/.test(c)) err("セッションコードが正しくありません");
      db.sessions[c] = db.sessions[c] || { code: c, phase: "vote", topic: C.DEFAULT_TOPIC, summary: null };
      save(db);
      return { code: c, phase: db.sessions[c].phase, topic: topicOf(db.sessions[c]) };
    },
    async topic(s, key, topic) {
      const db = load();
      const se = sess(db, s);
      if (!C.TOPICS[topic]) err("トピックが正しくありません");
      if (topic === topicOf(se)) return { code: se.code, topic };
      const has = (list) => list.some((x) => x.session === se.code);
      if (has(db.subs) || has(db.votes) || has(db.prevotes)) err("すでにデータがあるので、トピックは変えられません。別のセッションコードを使うか、先にデータを削除してください");
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
      const latest = Object.values(
        db.subs.filter((x) => x.session === se.code).reduce((m, r) => ((!m[r.student] || r.version > m[r.student].version) && (m[r.student] = r), m), {})
      );
      if (!latest.length) err("まだ提出がありません");
      const T = C.TOPICS[topicOf(se)];
      const konbini = topicOf(se) === "konbini";
      const hasPre = db.prevotes.some((x) => x.session === se.code);
      const top = (stance) => {
        const counts = {};
        latest.filter((r) => r.stance === stance).forEach((r) => (counts[r.reason_tag] = (counts[r.reason_tag] || 0) + 1));
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => (T.REASON_LABELS[t] || [t])[0]);
      };
      const rank = { A: 3, B: 2, C: 1, D: 0 };
      const best = (stance) => {
        const c = latest.filter((r) => r.stance === stance && r.consent && r.flag === "ok").sort((a, b) => rank[b.logic] - rank[a.logic] || b.words - a.words)[0];
        return c ? { id: c.id, student: c.student, why_ja: "理由と具体的な数字がしっかりつながっていて、説得力のある意見です。", text: oreo(c) } : null;
      };
      const yes = latest.filter((r) => r.stance === "yes").length;
      se.summary = {
        demo: true,
        overview_ja: `提出した${latest.length}人のうち、Yes は${yes}人、No は${latest.length - yes}人でした。どちらの立場でも、データや具体例を根拠に挙げた意見が多く見られました。`,
        yes_points: top("yes"),
        no_points: top("no"),
        common_ground_en: konbini ? "Both sides think convenience is nice, and workers' health is important too." : "Both sides want to protect refugees' lives and think good support is important.",
        common_ground_ja: konbini ? "どちらの立場も、便利さは大切で、働く人の健康も大切だと考えています。" : "どちらの立場も、難民の命を守りたいこと、十分な支援が大切だと考えている点は共通しています。",
        shift_en: hasPre ? "Before the unit, many reasons were feelings. Now more students use numbers and examples." : "",
        shift_ja: hasPre ? "単元の前は「なんとなく」「かわいそうだから」といった感覚の理由が多く見られました。今は、数字や具体例をもとにした理由が増えています。" : "",
        pick_yes: best("yes"),
        pick_no: best("no"),
        count: latest.length,
        at: Date.now(),
      };
      save(db);
      return { summary: se.summary };
    },
    async clear(s) {
      const db = load();
      const se = sess(db, s);
      db.votes = db.votes.filter((x) => x.session !== se.code);
      db.prevotes = db.prevotes.filter((x) => x.session !== se.code);
      db.subs = db.subs.filter((x) => x.session !== se.code);
      db.stars = db.stars.filter((x) => x.session !== se.code);
      se.phase = "vote";
      se.summary = null;
      save(db);
      return { ok: true };
    },
    async info() {
      return { observerKey: "demo", model: "（デモモード：AIは使っていません）" };
    },
    async exportCsv(s) {
      const db = load();
      const se = sess(db, s);
      const rows = db.subs.filter((x) => x.session === se.code);
      const head = "id,組-番号,グループ,版,単元前の考え,単元前の理由,立場,語数,本文,論理,文法,語彙,理由タグ";
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const pre = Object.fromEntries(db.prevotes.filter((x) => x.session === se.code).map((x) => [x.student, x]));
      const body = rows.map((r) => [r.id, r.student, r.grp, r.version, (pre[r.student] || {}).stance || "", (pre[r.student] || {}).reason || "", r.stance, r.words, oreo(r), r.logic, r.grammar, r.vocab, r.reason_tag].map(esc).join(","));
      const done = new Set(rows.map((r) => r.student));
      Object.values(pre).filter((x) => !done.has(x.student)).forEach((x) => body.push(["", x.student, x.grp, "", x.stance, x.reason, "", "", "", "", "", "", ""].map(esc).join(",")));
      return new Blob(["﻿" + [head, ...body].join("\r\n")], { type: "text/csv" });
    },
    // モニターの見た目確認用：28人分のサンプルを投入
    async seed(s) {
      const db = load();
      const se = sess(db, s);
      const samples = {
        yes: [
          ["I believe Japan should accept more refugees.", "First of all, Japan has a humanitarian obligation as a rich and peaceful country.", "For example, about 117.8 million people were forced to leave their homes, but Japan recognized only 187 refugees in 2025.", "Therefore, Japan should put human life first, like Ms. Ogata did."],
          ["In my opinion, Japan should accept more refugees.", "This is because Japan is facing a labor shortage because of its aging society.", "If refugees can study Japanese and get jobs, they can contribute to our society. Many companies need workers now.", "For these reasons, accepting refugees is good for both Japan and refugees."],
          ["I think Japan should accept more refugee.", "Japan is a member of the international community.", "Germany hosts about 2.7 million refugees. Japan should do more for the world.", "So Japan should accept more."],
          ["I believe Japan should accept more refugees.", "The main reason is that we can learn to live together with people from other cultures.", "Ms. Ogata said the 21st century is the age of co-existence and interdependence.", "Therefore, Japan should open its doors and co-exist with refugees."],
        ],
        no: [
          ["I don't think Japan should accept many more refugees right now.", "This is because Japan does not have a strong support system yet.", "For example, refugees need housing, Japanese lessons, and job training, but there are not enough teachers and staff.", "Therefore, Japan should first improve its support system."],
          ["In my opinion, Japan should not accept more refugees now.", "The main reason is the financial burden.", "Japan already has many problems, such as the aging society, and needs a lot of money for pensions and medical care.", "Instead, Japan can help refugees by giving money to UNHCR."],
          ["I don't think Japan should accept more refugees.", "Refugees may face language barriers.", "Japanese is a difficult language, and they may feel isolated in Japanese society.", "So Japan should help them in other ways."],
          ["I think Japan should not accept more refugees.", "Many peoples worry about it.", "Some people feel anxious because they don't know about refugees well.", "First, Japan should teach people about refugees."],
        ],
      };
      // 参観者画面に出す和訳（本番では AI の参考訳。誤りは直さずに訳す）
      const samplesJa = {
        yes: [
          ["日本はもっと難民を受け入れるべきだと思う。", "まず第一に、日本は豊かで平和な国として、人道的な義務がある。", "例えば、約1億1780万人が家を追われたが、日本が2025年に難民と認めたのは187人だけだった。", "だから、緒方さんのように、日本は人の命を第一にすべきだ。"],
          ["私の意見では、日本はもっと難民を受け入れるべきだ。", "なぜなら、日本は高齢化社会のため、人手不足に直面しているからだ。", "難民が日本語を学んで仕事に就ければ、私たちの社会に貢献できる。今、多くの会社が働き手を必要としている。", "これらの理由から、難民を受け入れることは日本と難民の両方にとって良いことだ。"],
          ["日本はもっと難民を受け入れるべきだと思う。", "日本は国際社会の一員だ。", "ドイツは約270万人の難民を受け入れている。日本は世界のためにもっとするべきだ。", "だから日本はもっと受け入れるべきだ。"],
          ["日本はもっと難民を受け入れるべきだと思う。", "主な理由は、ほかの文化の人々と共に生きることを学べるからだ。", "緒方さんは、21世紀は共存と相互依存の時代だと言った。", "だから、日本は扉を開き、難民と共存すべきだ。"],
        ],
        no: [
          ["今すぐ日本がもっと多くの難民を受け入れるべきだとは思わない。", "なぜなら、日本にはまだしっかりした支援の仕組みがないからだ。", "例えば、難民には住まいや日本語の授業、職業訓練が必要だが、教える人や職員が足りない。", "だから、日本はまず支援の仕組みを良くするべきだ。"],
          ["私の意見では、日本は今、これ以上難民を受け入れるべきではない。", "主な理由は、財政的な負担だ。", "日本はすでに高齢化社会など多くの問題を抱えていて、年金や医療に多くのお金が必要だ。", "その代わりに、日本は UNHCR にお金を出すことで難民を助けられる。"],
          ["日本がもっと難民を受け入れるべきだとは思わない。", "難民は言葉の壁にぶつかるかもしれない。", "日本語は難しい言語で、彼らは日本の社会で孤立していると感じるかもしれない。", "だから日本は別の方法で彼らを助けるべきだ。"],
          ["日本はこれ以上難民を受け入れるべきではないと思う。", "多くの人がそれを心配している。", "難民のことをよく知らないので、不安に感じる人もいる。", "まず、日本は人々に難民について教えるべきだ。"],
        ],
      };
      const konbini = topicOf(se) === "konbini";
      if (konbini) {
        samplesJa.yes = [
          ["コンビニは24時間営業を続けるべきだと思う。", "まず第一に、遅くまで働く人にとってとても便利だ。", "例えば、私の父は午後11時に帰宅し、よくコンビニで夕食を買う。", "だから、さまざまな生活スタイルの人のために営業を続けるべきだ。"],
          ["私の意見では、コンビニは24時間営業を続けるべきだ。", "なぜなら、緊急のときに私たちを助けてくれるからだ。", "去年大きな台風が来たとき、人々は夜でも水や食べ物を買えた。", "これらの理由から、いつでも開いている店が必要だ。"],
          ["コンビニは24時間営業を続けるべきだと思う。", "主な理由は、夜に人々が安心できることだ。", "家の近くの道は暗いが、部活から帰るとき、店の明かりがあると安心できる。", "だから営業を続けるべきだ。"],
          ["コンビニは営業を続けるべきだと思う。", "店はもっとお金を稼げるし、人々に仕事を与えられる。", "昼間に授業があるので、夜に働きたい大学生もいる。", "だから、24時間営業の店は私たちの町にとって良いものだ。"],
        ];
        samplesJa.no = [
          ["コンビニが24時間営業を続けるべきだとは思わない。", "なぜなら、日本は人手不足だからだ。", "例えば、駅の近くの店は十分な店員を見つけられず、オーナーが1日12時間以上働いている。", "だから、店は夜に閉めるべきだ。"],
          ["私の意見では、コンビニは24時間営業を続けるべきではない。", "主な理由は、夜勤が働く人の健康に悪い影響を与えることだ。", "私のいとこは1年間夜に働いていたが、いつも疲れていて、よく眠れなかった。", "これらの理由から、店は夜に閉めるべきだ。"],
          ["店が24時間営業を続けるべきだとは思わない。", "たくさんのエネルギーを無駄にする。", "客が少ないときでも、照明やエアコンが一晩中ついている。", "だから、夜に閉めればエネルギーを節約できる。"],
          ["コンビニは夜に閉めるべきだと思う。", "夜遅くは客が少ない。", "私の町では、真夜中を過ぎると店にほとんど人がいない。", "だから、営業を続ける必要はない。"],
        ];
        samples.yes = [
          ["I believe convenience stores should stay open 24 hours.", "First of all, they are very convenient for people who work late.", "For example, my father comes home at 11 p.m., and he often buys dinner at a convenience store.", "Therefore, they should stay open for people with different lifestyles."],
          ["In my opinion, convenience stores should stay open 24 hours.", "This is because they help us in an emergency.", "When a big typhoon came last year, people could buy water and food at night.", "For these reasons, we need stores that are always open."],
          ["I think convenience stores should stay open 24 hours.", "The main reason is that people feel safe at night.", "The street near my house is dark, but the store's light makes me feel safe when I come home from club.", "So they should stay open."],
          ["I believe convenience stores should stay open.", "Stores can earn more money and give people jobs.", "Some university students want to work at night because they have classes in the daytime.", "That is why 24-hour stores are good for our town."],
        ];
        samples.no = [
          ["I don't think convenience stores should stay open 24 hours.", "This is because Japan has a labor shortage.", "For example, a store near my station cannot find enough staff, so the owner works more than 12 hours a day.", "Therefore, stores should close at night."],
          ["In my opinion, convenience stores should not stay open 24 hours.", "The main reason is that the night shift has a bad effect on workers' health.", "My cousin worked at night for a year, and she was always tired and could not sleep well.", "For these reasons, stores should close at night."],
          ["I don't think stores should stay open 24 hours.", "It wastes a lot of energy.", "The lights and air conditioners are on all night, even when there are few customers.", "So closing at night can save energy."],
          ["I think convenience stores should close at night.", "There are few customers late at night.", "In my town, I see almost no one in the store after midnight.", "So it is not necessary to stay open."],
        ];
      }
      const preReasons = {
        yes: ["困っている人は助けたほうがいいと思うから", "日本は豊かな国だから", "かわいそうだから"],
        no: ["なんとなく不安だから", "日本語が通じないと大変そうだから", "お金がかかりそうだから"],
        unsure: ["難民についてよく知らないから", "ニュースであまり見たことがないから", "どちらの意見もわかるから"],
      };
      const stances = ["yes", "no", "unsure"];
      let n = 0;
      for (const cls of ["4", "5", "6"]) {
        for (let num = 1; num <= 10 && n < 28; num++, n++) {
          const student = `${cls}-${num}`;
          const grp = String((n % 8) + 1);
          const first = stances[(n * 7) % 3];
          if (!konbini) {
            // 単元の前は Not sure が多め（本番のトピックのときだけ入れる）
            const pre = n % 5 < 2 ? "unsure" : stances[(n * 7 + 1) % 3];
            db.prevotes = db.prevotes.filter((x) => !(x.session === se.code && x.student === student));
            db.prevotes.push({ session: se.code, student, grp, stance: pre, reason: preReasons[pre][n % 3] });
          }
          db.votes = db.votes.filter((x) => !(x.session === se.code && x.student === student));
          db.votes.push({ session: se.code, student, grp, stance: first });
          if (n >= 26) continue; // 2人は未提出
          const stance = n % 10 === 3 ? (first === "yes" ? "no" : "yes") : first === "unsure" ? (n % 2 ? "yes" : "no") : first;
          const t = samples[stance][n % 4];
          const p = { stance, opinion: t[0], reason: t[1], example: t[2], conclusion: t[3] };
          const tj = samplesJa[stance][n % 4];
          const translation = { opinion: tj[0], reason: tj[1], example: tj[2], conclusion: tj[3] };
          const versions = n % 4 === 0 ? 2 : 1;
          for (let v = 1; v <= versions; v++) {
            const w = words(oreo(p));
            const fb = demoFeedback(p, w, v, topicOf(se));
            if (v === 2 && fb.scores.logic === "B") fb.scores.logic = "A";
            db.subs.push({
              id: ++db.seq, session: se.code, student, grp, version: v, stance, ...p, words: w, consent: n % 6 !== 5,
              logic: fb.scores.logic, grammar: fb.scores.grammar, vocab: fb.scores.vocabulary, reason_tag: fb.reason_tag,
              summary_en: fb.summary_en, flag: "ok", feedback: fb, translation, at: Date.now() - (30 - n) * 20000,
            });
          }
        }
      }
      save(db);
    },
  };

  window.OREO_API = Object.assign({ demo: DEMO }, DEMO ? demo : remote);
})();
