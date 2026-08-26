function trainerApp() {
  return {
    view: "today",
    inputMode: "pdf",
    rawText: "",
    pdfBase64: "",
    material: {},
    quiz: [],
    quizIndex: 0,
    answered: false,
    selected: null,
    lastCorrect: false,
    busy: false,
    busyMessage: "",
    toast: "",
    questionStartedAt: null,
    questionElapsed: 0,
    timer: null,
    profile: { examDate: "", hoursPerDay: 2 },
    attempts: [],
    errors: [],
    reviews: [],
    lastMock: null,
    stats: {
      totalAnswered: 0, correct: 0, currentStreak: 0, domain: 0,
      precision: 0, retention: 0, difficulty: 0, speed: 0,
      consistency: 0, recency: 0, avgTime: 0, prediction: 0
    },
    simConfig: { qtd: 20, nivel: "Adaptativo", minutos: 60 },

    boot() {
      this.loadAll();
      this.recompute();
      this.$nextTick(() => this.startTimer());
    },

    startTimer() {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.questionStartedAt && !this.answered) {
          this.questionElapsed = Math.floor((Date.now() - this.questionStartedAt) / 1000);
        }
      }, 500);
    },

    navClass(v) {
      return this.view === v ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-white";
    },

    async handlePdf(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf") return this.showToast("Selecione um PDF.");
      if (file.size > 14 * 1024 * 1024) return this.showToast("PDF muito grande para esta versão. Use um PDF menor.");
      this.pdfBase64 = await this.fileToBase64(file);
      this.showToast("PDF carregado. Clique em Entender Material.");
    },

    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    async api(action, payload = {}) {
      const r = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Falha na API.");
      return data;
    },

    async processMaterial() {
      if (this.inputMode === "text" && this.rawText.trim().length < 50) return this.showToast("Cole pelo menos 50 caracteres.");
      if (this.inputMode === "pdf" && !this.pdfBase64) return this.showToast("Selecione um PDF primeiro.");
      this.busy = true;
      this.busyMessage = "A IA está lendo e entendendo o material antes de gerar questões...";
      try {
        this.material = await this.api("process", {
          text: this.inputMode === "text" ? this.rawText.trim() : "",
          fileBase64: this.inputMode === "pdf" ? this.pdfBase64 : ""
        });
        this.saveAll();
        this.showToast("Material compreendido.");
      } catch (e) {
        this.showToast(e.message);
      } finally {
        this.busy = false;
        this.busyMessage = "";
      }
    },

    async generateQuizFromMaterial(qtd = 10, mode = "treino") {
      if (!this.material.tema) {
        this.view = "study";
        return this.showToast("Primeiro processe um material.");
      }
      this.busy = true;
      this.busyMessage = "Gerando questões situacionais, com correção completa...";
      try {
        this.quiz = await this.api("quiz", {
          quantidade: qtd,
          tema: this.material.tema,
          topicos: this.material.topicos_chave || [],
          resumo: this.material.resumo || "",
          contexto: (this.material.subtopicos || []).join("; "),
          nivel: mode === "simulado" ? this.simConfig.nivel : "adaptativo"
        });
        this.quizIndex = 0;
        this.answered = false;
        this.selected = null;
        this.view = "quiz";
        this.startQuestionClock();
        this.showToast(`${this.quiz.length} questões prontas.`);
      } catch (e) {
        this.showToast(e.message);
      } finally {
        this.busy = false;
        this.busyMessage = "";
      }
    },

    startQuestionClock() {
      this.questionStartedAt = Date.now();
      this.questionElapsed = 0;
    },

    answerQuestion(letter) {
      if (this.answered) return;
      const q = this.quiz[this.quizIndex];
      this.selected = letter;
      this.lastCorrect = q.correta === letter;
      this.answered = true;

      const time = this.questionElapsed;
      const now = new Date();
      const record = {
        id: crypto.randomUUID(),
        question: q.pergunta,
        materia: q.materia,
        assunto: q.assunto,
        topico: q.topico,
        dificuldade: q.dificuldade,
        correct: this.lastCorrect,
        chosen: letter,
        answer: q.correta,
        time,
        date: now.toISOString()
      };
      this.attempts.push(record);

      if (!this.lastCorrect) this.registerError(record);
      else this.promoteReview(record);
      this.saveAll();
      this.recompute();
    },

    answerClass(letter) {
      if (!this.answered) return "";
      const q = this.quiz[this.quizIndex];
      if (letter === q.correta) return "border-emerald-400 bg-emerald-400/10";
      if (letter === this.selected) return "border-red-400 bg-red-400/10";
      return "opacity-70";
    },

    registerError(r) {
      const existing = this.errors.find(x => x.topico === r.topico && x.assunto === r.assunto);
      const next = new Date();
      next.setDate(next.getDate() + 1);
      if (existing) {
        existing.count += 1;
        existing.interval = 1;
        existing.nextReview = next.toISOString().slice(0,10);
      } else {
        this.errors.push({
          id: crypto.randomUUID(),
          materia: r.materia,
          assunto: r.assunto,
          topico: r.topico,
          count: 1,
          interval: 1,
          nextReview: next.toISOString().slice(0,10)
        });
      }
      const existingReview = this.reviews.find(x => x.topico === r.topico);
      if (existingReview) {
        existingReview.next = next.toISOString().slice(0,10);
        existingReview.interval = 1;
        existingReview.correctStreak = 0;
      } else {
        this.reviews.push({ topico: r.topico, assunto: r.assunto, next: next.toISOString().slice(0,10), interval: 1, correctStreak: 0 });
      }
    },

    promoteReview(r) {
      const existing = this.reviews.find(x => x.topico === r.topico);
      const seq = existing ? existing.correctStreak + 1 : 1;
      const intervals = [3,7,15,30];
      const days = intervals[Math.min(seq - 1, intervals.length - 1)];
      const next = new Date();
      next.setDate(next.getDate() + days);
      if (existing) {
        existing.correctStreak = seq;
        existing.interval = days;
        existing.next = next.toISOString().slice(0,10);
      } else {
        this.reviews.push({ topico: r.topico, assunto: r.assunto, next: next.toISOString().slice(0,10), interval: days, correctStreak: seq });
      }
      const err = this.errors.find(x => x.topico === r.topico);
      if (err) {
        err.interval = days;
        err.nextReview = next.toISOString().slice(0,10);
      }
    },

    nextQuestion() {
      this.quizIndex += 1;
      this.answered = false;
      this.selected = null;
      if (this.quizIndex < this.quiz.length) this.startQuestionClock();
      this.saveAll();
    },

    quizScore() {
      if (!this.quiz.length) return 0;
      const last = this.attempts.slice(-this.quiz.length);
      const c = last.filter(x => x.correct).length;
      return Math.round((c / this.quiz.length) * 100);
    },

    startDailyMission() {
      if (this.dueReviews().length) {
        this.view = "errors";
        return this.showToast("Há revisões pendentes. Corrija primeiro os pontos que venceram.");
      }
      if (this.material.tema) {
        this.generateQuizFromMaterial(10);
      } else {
        this.view = "study";
        this.showToast("Envie seu primeiro material para criar a missão.");
      }
    },

    startSimulado() {
      if (!this.material.tema) {
        this.view = "study";
        return this.showToast("Processe pelo menos um material antes do simulado.");
      }
      this.generateQuizFromMaterial(this.simConfig.qtd, "simulado");
    },

    dueReviews() {
      const today = new Date().toISOString().slice(0,10);
      return this.reviews.filter(x => x.next <= today);
    },

    weakTopics() {
      const map = {};
      this.attempts.forEach(a => {
        const key = `${a.assunto} • ${a.topico}`;
        if (!map[key]) map[key] = {wrong:0,total:0};
        map[key].total++;
        if (!a.correct) map[key].wrong++;
      });
      return Object.entries(map).sort((a,b) => (b[1].wrong/(b[1].total||1)) - (a[1].wrong/(a[1].total||1))).map(x => x[0]);
    },

    trendLabel() {
      const recent = this.attempts.slice(-20);
      if (recent.length < 5) return "Ainda em formação";
      const first = recent.slice(0, Math.ceil(recent.length/2)).filter(x=>x.correct).length / Math.ceil(recent.length/2);
      const last = recent.slice(Math.floor(recent.length/2)).filter(x=>x.correct).length / Math.floor(recent.length/2);
      if (last > first + 0.08) return "📈 Melhorando";
      if (last < first - 0.08) return "📉 Queda";
      return "→ Estável";
    },

    recompute() {
      const a = this.attempts;
      this.stats.totalAnswered = a.length;
      this.stats.correct = a.filter(x => x.correct).length;
      this.stats.precision = a.length ? (this.stats.correct/a.length)*100 : 0;

      const retentionBase = a.filter(x => {
        const age = (Date.now() - new Date(x.date).getTime()) / 86400000;
        return age >= 3;
      });
      this.stats.retention = retentionBase.length ? retentionBase.filter(x=>x.correct).length/retentionBase.length*100 : this.stats.precision;

      const weights = {"fácil":0.5,"média":0.75,"difícil":1,"muito_difícil":1.1};
      let difficulty = 0, denom = 0;
      a.forEach(x => { const w=weights[x.dificuldade]||0.75; difficulty += (x.correct?100:0)*w; denom += 100*w; });
      this.stats.difficulty = denom ? difficulty/denom*100 : 0;

      const target = 90;
      this.stats.avgTime = a.length ? a.reduce((s,x)=>s+x.time,0)/a.length : 0;
      this.stats.speed = a.length ? Math.min(100, a.reduce((s,x)=>s+(x.time<=target?100:Math.max(0,target/x.time*100)),0)/a.length) : 0;

      if (a.length < 2) this.stats.consistency = 100;
      else {
        const chunks=[];
        for(let i=0;i<a.length;i+=10) chunks.push(a.slice(i,i+10).filter(x=>x.correct).length/(Math.min(10,a.length-i)||1)*100);
        const mean=chunks.reduce((s,x)=>s+x,0)/chunks.length;
        const variance=chunks.reduce((s,x)=>s+Math.pow(x-mean,2),0)/chunks.length;
        this.stats.consistency=Math.max(0,100-Math.sqrt(variance));
      }

      const last30 = a.filter(x => (Date.now()-new Date(x.date).getTime()) <= 30*86400000);
      this.stats.recency = last30.length ? last30.filter(x=>x.correct).length/last30.length*100 : 50;

      this.stats.domain = this.stats.precision*.35 + this.stats.retention*.25 + this.stats.difficulty*.15 + this.stats.speed*.10 + this.stats.consistency*.10 + this.stats.recency*.05;
      this.stats.prediction = Math.max(0, Math.min(100, this.stats.domain + (this.trendLabel().includes("Melhorando")?4:this.trendLabel().includes("Queda")?-5:0)));

      const uniqueDays = new Set(a.map(x=>new Date(x.date).toDateString())).size;
      this.stats.currentStreak = uniqueDays;
    },

    daysLeft() {
      if (!this.profile.examDate) return "—";
      const diff = new Date(this.profile.examDate + "T23:59:59") - new Date();
      return Math.max(0, Math.ceil(diff/86400000));
    },

    formatDate(s) {
      if (!s) return "—";
      const d = new Date(s+"T00:00:00");
      return d.toLocaleDateString("pt-BR");
    },

    formatSeconds(s) {
      s = Math.max(0, Math.round(s||0));
      const m = Math.floor(s/60), sec=s%60;
      return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    },

    saveAll() {
      localStorage.setItem("pcma_profile", JSON.stringify(this.profile));
      localStorage.setItem("pcma_material", JSON.stringify(this.material));
      localStorage.setItem("pcma_attempts", JSON.stringify(this.attempts));
      localStorage.setItem("pcma_errors", JSON.stringify(this.errors));
      localStorage.setItem("pcma_reviews", JSON.stringify(this.reviews));
      localStorage.setItem("pcma_mock", JSON.stringify(this.lastMock));
    },

    loadAll() {
      try {
        this.profile = JSON.parse(localStorage.getItem("pcma_profile")) || this.profile;
        this.material = JSON.parse(localStorage.getItem("pcma_material")) || {};
        this.attempts = JSON.parse(localStorage.getItem("pcma_attempts")) || [];
        this.errors = JSON.parse(localStorage.getItem("pcma_errors")) || [];
        this.reviews = JSON.parse(localStorage.getItem("pcma_reviews")) || [];
        this.lastMock = JSON.parse(localStorage.getItem("pcma_mock")) || null;
      } catch (_) {}
    },

    showToast(msg) {
      this.toast = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.toast = "", 4200);
    }
  }
}
