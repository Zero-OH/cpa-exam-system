// ============================================================
// 注会备考通 - 核心应用逻辑
// ============================================================

// ---- 应用状态 ----
const STATE = {
  currentPage: 'dashboard',
  practiceChapter: null,
  practiceMode: 'sequence', // sequence | random | wrong
  practiceDiff: 'all',     // all | easy | medium | hard
  quizQuestions: [],
  quizIndex: 0,
  quizAnswers: {},
  quizMode: 'practice',    // practice | exam
  examTimer: null,
  examTimeLeft: 0,
  wrongBook: JSON.parse(localStorage.getItem('cpa_wrongbook') || '[]'),
  stats: JSON.parse(localStorage.getItem('cpa_stats') || '{"total":0,"correct":0,"chapters":{},"days":[]}'),
  examHistory: JSON.parse(localStorage.getItem('cpa_exam_history') || '[]')
};

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  renderDashboard();
  renderKnowledgeLibrary();
  renderPracticeChapters();
  renderRealExams();
  renderWrongBook();
  initEventListeners();
  checkDailyStreak();
});

// ---- 导航 ----
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  STATE.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  if (page === 'dashboard') renderDashboard();
  if (page === 'knowledge') renderKnowledgeLibrary();
  if (page === 'practice') renderPracticeChapters();
  if (page === 'wrongbook') renderWrongBook();
}

// ---- 仪表盘 ----
function renderDashboard() {
  document.getElementById('stat-days').textContent = STATE.stats.days?.length || 0;
  document.getElementById('stat-total').textContent = STATE.stats.total;
  const accuracy = STATE.stats.total > 0 ? Math.round(STATE.stats.correct / STATE.stats.total * 100) : 0;
  document.getElementById('stat-accuracy').textContent = accuracy + '%';
  const completedChapters = Object.keys(STATE.stats.chapters || {}).length;
  document.getElementById('stat-chapters').textContent = completedChapters + '/30';
  document.getElementById('stat-wrong').textContent = STATE.wrongBook.length;

  // 章节进度条
  const progressDiv = document.getElementById('chapter-progress');
  progressDiv.innerHTML = CHAPTERS.map(ch => {
    const done = (STATE.stats.chapters || {})[ch.id] || 0;
    const pct = ch.importance === 'high' ? Math.min(done / 20 * 100, 100) : Math.min(done / 10 * 100, 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="width:200px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Ch${ch.id} ${ch.name}</span>
      <span style="font-size:12px;color:var(--text-secondary);width:40px;">${ch.score}</span>
      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${pct>60?'var(--success)':pct>20?'var(--warning)':'var(--border)'};border-radius:3px;transition:width .5s;"></div>
      </div>
      <span style="font-size:11px;color:var(--text-secondary);width:36px;">${Math.round(pct)}%</span>
    </div>`;
  }).join('');
}

// ---- 学习库 ----
function renderKnowledgeLibrary(filter = 'all') {
  const container = document.getElementById('knowledge-list');
  let cards = KNOWLEDGE_CARDS;
  if (filter === 'high') {
    cards = cards.filter(c => CHAPTERS.find(ch=>ch.id===c.chapter)?.importance==='high');
  } else if (filter === 'mid') {
    cards = cards.filter(c => CHAPTERS.find(ch=>ch.id===c.chapter)?.importance==='mid');
  } else if (filter === 'low') {
    cards = cards.filter(c => CHAPTERS.find(ch=>ch.id===c.chapter)?.importance==='low');
  }
  container.innerHTML = cards.map(c => {
    const ch = CHAPTERS.find(x=>x.id===c.chapter);
    return `<div class="knowledge-card" onclick="showKnowledgeDetail('${c.id}')">
      <div class="kc-chapter">第${c.chapter}章 ${ch?.name||''} · ${ch?.score||''}</div>
      <div class="kc-title">${c.title}</div>
      <div class="kc-desc">${c.desc}</div>
      <div class="kc-tags">
        ${c.tags.map(t=>`<span class="knowledge-tag">${t}</span>`).join('')}
        <span class="kc-difficulty diff-${c.difficulty}">${c.difficulty==='easy'?'简单':c.difficulty==='medium'?'中等':'困难'}</span>
      </div>
    </div>`;
  }).join('');
}

function showKnowledgeDetail(id) {
  const card = KNOWLEDGE_CARDS.find(c => c.id === id);
  if (!card) return;
  const modal = document.getElementById('knowledge-modal');
  const content = document.getElementById('knowledge-modal-content');
  const ch = CHAPTERS.find(x=>x.id===card.chapter);
  content.innerHTML = `
    <button class="close-btn" onclick="closeKnowledgeModal()">&times;</button>
    <h2>${card.title}</h2>
    <p style="color:var(--text-secondary);margin-bottom:16px;">第${card.chapter}章 ${ch?.name||''} · ${ch?.score||''} · 难度：${card.difficulty==='easy'?'⭐':card.difficulty==='medium'?'⭐⭐':'⭐⭐⭐'}</p>
    ${card.detail}
    <div style="margin-top:20px;display:flex;gap:8px;">
      ${card.tags.map(t=>`<span class="knowledge-tag">${t}</span>`).join('')}
    </div>
    <div style="margin-top:20px;">
      <button class="btn btn-primary btn-sm" onclick="closeKnowledgeModal();startChapterPractice(${card.chapter})">✏️ 练习本章题目</button>
    </div>`;
  modal.classList.add('show');
}

function closeKnowledgeModal() {
  document.getElementById('knowledge-modal').classList.remove('show');
}

// ---- 章节练习 ----
function renderPracticeChapters() {
  const container = document.getElementById('practice-chapters');
  container.innerHTML = CHAPTERS.map(ch => {
    const done = (STATE.stats.chapters || {})[ch.id] || 0;
    const qCount = QUESTIONS.filter(q=>q.chapter===ch.id).length;
    return `<div class="chapter-item" onclick="startChapterPractice(${ch.id})">
      <div class="chapter-num">${ch.id}</div>
      <div class="chapter-info">
        <div class="chapter-name">${ch.name}</div>
        <div class="chapter-meta">${qCount}题 · 已练${done}题</div>
      </div>
      <div class="chapter-score">考${ch.score}</div>
    </div>`;
  }).join('');
}

function startChapterPractice(chapterId) {
  STATE.quizMode = 'practice';
  STATE.practiceChapter = chapterId;
  STATE.quizIndex = 0;
  STATE.quizAnswers = {};

  let questions = QUESTIONS.filter(q => q.chapter === chapterId);

  // 模式过滤
  if (STATE.practiceMode === 'wrong') {
    const wrongIds = STATE.wrongBook.map(w => w.questionId);
    questions = questions.filter(q => wrongIds.includes(q.id));
  }

  // 难度过滤
  if (STATE.practiceDiff !== 'all') {
    questions = questions.filter(q => q.difficulty === STATE.practiceDiff);
  }

  // 随机
  if (STATE.practiceMode === 'random') {
    questions = shuffleArray([...questions]);
  }

  STATE.quizQuestions = questions;

  if (questions.length === 0) {
    alert('当前筛选条件下没有题目，请调整筛选条件。');
    return;
  }

  navigateTo('practice-quiz');
  renderQuiz();
}

function renderQuiz() {
  const container = document.getElementById('quiz-area');
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) {
    showQuizResult();
    return;
  }

  const typeLabel = q.type === 'single' ? '单选题' : q.type === 'multi' ? '多选题' : q.type === 'calc' ? '计算分析题' : '综合题';
  const typeClass = q.type === 'single' ? 'qtype-single' : q.type === 'multi' ? 'qtype-multi' : q.type === 'calc' ? 'qtype-calc' : 'qtype-complex';
  const multiHint = q.type === 'multi' ? '（多选，请选择所有正确答案）' : '';

  const userAnswer = STATE.quizAnswers[q.id] || [];
  const isAnswered = STATE.quizAnswers[q.id] !== undefined;

  container.innerHTML = `
    <div class="quiz-header">
      <span class="quiz-progress">第 ${STATE.quizIndex + 1}/${STATE.quizQuestions.length} 题</span>
      <span class="quiz-timer">第${q.chapter}章 · ${CHAPTERS.find(c=>c.id===q.chapter)?.name||''}</span>
    </div>
    <div class="quiz-question">
      <div class="question-type ${typeClass}">${typeLabel} · ${q.difficulty==='easy'?'简单':q.difficulty==='medium'?'中等':'困难'}</div>
      <div class="question-stem">${q.stem}</div>
      <div class="options">
        ${q.options.map((opt, i) => {
          let cls = '';
          if (isAnswered) {
            const isCorrect = q.answer.includes(i);
            const isSelected = userAnswer.includes(i);
            if (isCorrect) cls = 'correct';
            else if (isSelected) cls = 'wrong';
          } else if (userAnswer.includes(i)) {
            cls = 'selected';
          }
          return `<div class="option ${cls}" onclick="${isAnswered ? '' : `toggleOption(${i})`}">
            <div class="option-letter">${String.fromCharCode(65+i)}</div>
            <div>${opt.substring(2)}</div>
          </div>`;
        }).join('')}
      </div>
      ${multiHint ? `<p style="font-size:13px;color:var(--warning);margin-top:8px;">${multiHint}</p>` : ''}
      ${isAnswered ? renderExplanation(q) : ''}
    </div>
    <div class="quiz-actions">
      ${!isAnswered ? `<button class="btn btn-primary" onclick="submitAnswer()">✓ 提交答案</button>` : ''}
      ${isAnswered && STATE.quizIndex < STATE.quizQuestions.length - 1 ? `<button class="btn btn-primary" onclick="nextQuestion()">下一题 →</button>` : ''}
      ${isAnswered && STATE.quizIndex === STATE.quizQuestions.length - 1 ? `<button class="btn btn-success" onclick="showQuizResult()">查看结果</button>` : ''}
      <button class="btn btn-outline" onclick="navigateTo('practice')">返回章节列表</button>
    </div>`;
}

function renderExplanation(q) {
  const userAnswer = STATE.quizAnswers[q.id] || [];
  const isCorrect = arraysEqual(userAnswer.sort(), [...q.answer].sort());
  const relatedKnowledge = (q.knowledge || []).map(kid => {
    const kc = KNOWLEDGE_CARDS.find(k => k.id === kid);
    return kc ? `<span class="knowledge-tag" style="cursor:pointer;" onclick="showKnowledgeDetail('${kid}')">📚 ${kc.title}</span>` : '';
  }).join('');

  return `<div class="explanation show">
    <div class="explanation-title">${isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}</div>
    <div class="explanation-body">
      <p style="font-weight:600;margin-bottom:4px;">【正确答案】${q.answer.map(a=>String.fromCharCode(65+a)).join('、')}</p>
      <p>${q.explanation}</p>
      ${relatedKnowledge ? `<div style="margin-top:12px;"><strong>关联知识点：</strong><br>${relatedKnowledge}</div>` : ''}
    </div>
  </div>`;
}

function toggleOption(index) {
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) return;
  if (!STATE.quizAnswers[q.id]) STATE.quizAnswers[q.id] = [];

  if (q.type === 'single' || q.type === 'calc' || q.type === 'complex') {
    STATE.quizAnswers[q.id] = [index];
  } else {
    const arr = STATE.quizAnswers[q.id];
    const pos = arr.indexOf(index);
    if (pos > -1) arr.splice(pos, 1);
    else arr.push(index);
  }
  renderQuiz();
}

function submitAnswer() {
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) return;
  if (!STATE.quizAnswers[q.id] || STATE.quizAnswers[q.id].length === 0) {
    alert('请先选择答案！');
    return;
  }

  const userAnswer = STATE.quizAnswers[q.id].sort();
  const isCorrect = arraysEqual(userAnswer, [...q.answer].sort());

  // 更新统计
  STATE.stats.total++;
  if (isCorrect) STATE.stats.correct++;
  if (!STATE.stats.chapters) STATE.stats.chapters = {};
  STATE.stats.chapters[q.chapter] = (STATE.stats.chapters[q.chapter] || 0) + 1;
  saveStats();

  // 错题本
  if (!isCorrect) {
    const exists = STATE.wrongBook.find(w => w.questionId === q.id);
    if (!exists) {
      STATE.wrongBook.push({
        questionId: q.id,
        chapter: q.chapter,
        wrongCount: 1,
        lastWrong: new Date().toISOString(),
        userAnswer: userAnswer
      });
    } else {
      exists.wrongCount++;
      exists.lastWrong = new Date().toISOString();
    }
    saveWrongBook();
  } else {
    // 答对了，如果之前在错题本中，减少计数
    const exists = STATE.wrongBook.find(w => w.questionId === q.id);
    if (exists) {
      exists.wrongCount--;
      if (exists.wrongCount <= 0) {
        STATE.wrongBook = STATE.wrongBook.filter(w => w.questionId !== q.id);
      }
      saveWrongBook();
    }
  }

  renderQuiz();
}

function nextQuestion() {
  STATE.quizIndex++;
  renderQuiz();
}

function showQuizResult() {
  const total = STATE.quizQuestions.length;
  let correct = 0;
  STATE.quizQuestions.forEach(q => {
    const ans = STATE.quizAnswers[q.id];
    if (ans && arraysEqual(ans.sort(), [...q.answer].sort())) correct++;
  });

  const score = total > 0 ? Math.round(correct / total * 100) : 0;
  let grade, gradeColor;
  if (score >= 80) { grade = '优秀 🌟'; gradeColor = 'var(--success)'; }
  else if (score >= 60) { grade = '良好 👍'; gradeColor = 'var(--primary)'; }
  else if (score >= 40) { grade = '还需努力 💪'; gradeColor = 'var(--warning)'; }
  else { grade = '需要加油 🔥'; gradeColor = 'var(--danger)'; }

  const container = document.getElementById('quiz-area');
  container.innerHTML = `
    <div class="quiz-question result-card">
      <h2>练习完成！</h2>
      <div class="result-score" style="color:${gradeColor}">${score}<span style="font-size:24px;">分</span></div>
      <div class="result-grade" style="color:${gradeColor}">${grade}</div>
      <div class="result-detail">
        <div class="result-item"><div class="num" style="color:var(--text);">${total}</div><div class="lbl">总题数</div></div>
        <div class="result-item"><div class="num" style="color:var(--success);">${correct}</div><div class="lbl">正确</div></div>
        <div class="result-item"><div class="num" style="color:var(--danger);">${total-correct}</div><div class="lbl">错误</div></div>
      </div>
      <div class="score-bar"><div class="score-fill ${score>=60?'high':score>=40?'mid':'low'}" style="width:${score}%"></div></div>
      <p style="margin-top:8px;font-size:13px;color:var(--text-secondary);">正确率 ${score}%</p>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;">
        <button class="btn btn-primary" onclick="startChapterPractice(${STATE.practiceChapter})">🔄 重新练习</button>
        <button class="btn btn-outline" onclick="navigateTo('practice')">📋 返回章节列表</button>
        <button class="btn btn-outline" onclick="navigateTo('wrongbook')">📕 查看错题</button>
      </div>
    </div>`;
}

// ---- 模拟考试 ----
function startMockExam() {
  STATE.quizMode = 'exam';
  const allQuestions = generateMockExam();
  STATE.quizQuestions = allQuestions;
  STATE.quizIndex = 0;
  STATE.quizAnswers = {};
  STATE.examTimeLeft = 180 * 60; // 180分钟

  navigateTo('practice-quiz');
  renderExamQuiz();
  startExamTimer();
}

function renderExamQuiz() {
  const container = document.getElementById('quiz-area');
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) {
    finishExam();
    return;
  }

  const typeLabel = q.type === 'single' ? '单选题' : q.type === 'multi' ? '多选题' : q.type === 'calc' ? '计算分析题' : '综合题';
  const typeClass = q.type === 'single' ? 'qtype-single' : q.type === 'multi' ? 'qtype-multi' : q.type === 'calc' ? 'qtype-calc' : 'qtype-complex';
  const scoreLabel = q.type === 'single' ? '2分' : q.type === 'multi' ? '2分' : q.type === 'calc' ? '9分' : '16分';

  const mins = Math.floor(STATE.examTimeLeft / 60);
  const secs = STATE.examTimeLeft % 60;
  const timerWarning = STATE.examTimeLeft < 600 ? ' warning' : '';

  container.innerHTML = `
    <div class="quiz-header">
      <span class="quiz-progress">📝 模拟考试 · 第 ${STATE.quizIndex + 1}/${STATE.quizQuestions.length} 题</span>
      <span class="quiz-timer${timerWarning}">⏱ ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</span>
    </div>
    <div class="quiz-question">
      <div class="question-type ${typeClass}">${typeLabel} · ${scoreLabel}</div>
      <div class="question-stem">${q.stem}</div>
      <div class="options">
        ${q.options.map((opt, i) => {
          const selected = (STATE.quizAnswers[q.id] || []).includes(i);
          return `<div class="option ${selected?'selected':''}" onclick="toggleExamOption(${i})">
            <div class="option-letter">${String.fromCharCode(65+i)}</div>
            <div>${opt.substring(2)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="quiz-actions">
      <button class="btn btn-outline btn-sm" onclick="prevExamQuestion()" ${STATE.quizIndex===0?'disabled':''}>← 上一题</button>
      <button class="btn btn-primary btn-sm" onclick="nextExamQuestion()">下一题 →</button>
      <button class="btn btn-danger btn-sm" onclick="submitExam()">📩 交卷</button>
    </div>
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
      ${STATE.quizQuestions.map((_, i) => {
        const answered = STATE.quizQuestions[i].id in STATE.quizAnswers && STATE.quizAnswers[STATE.quizQuestions[i].id].length > 0;
        return `<div style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;
          font-size:12px;cursor:pointer;font-weight:600;
          background:${i===STATE.quizIndex?'var(--primary)':answered?'var(--primary-light)':'var(--bg)'};
          color:${i===STATE.quizIndex?'#fff':answered?'var(--primary)':'var(--text-secondary)'};
          border:1px solid ${i===STATE.quizIndex?'var(--primary)':answered?'var(--primary)':'var(--border)'};"
          onclick="STATE.quizIndex=${i};renderExamQuiz();">${i+1}</div>`;
      }).join('')}
    </div>`;
}

function toggleExamOption(index) {
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) return;
  if (!STATE.quizAnswers[q.id]) STATE.quizAnswers[q.id] = [];
  if (q.type === 'single' || q.type === 'calc' || q.type === 'complex') {
    STATE.quizAnswers[q.id] = [index];
  } else {
    const arr = STATE.quizAnswers[q.id];
    const pos = arr.indexOf(index);
    if (pos > -1) arr.splice(pos, 1);
    else arr.push(index);
  }
  renderExamQuiz();
}

function nextExamQuestion() {
  if (STATE.quizIndex < STATE.quizQuestions.length - 1) {
    STATE.quizIndex++;
    renderExamQuiz();
  }
}

function prevExamQuestion() {
  if (STATE.quizIndex > 0) {
    STATE.quizIndex--;
    renderExamQuiz();
  }
}

function startExamTimer() {
  clearInterval(STATE.examTimer);
  STATE.examTimer = setInterval(() => {
    STATE.examTimeLeft--;
    if (STATE.examTimeLeft <= 0) {
      clearInterval(STATE.examTimer);
      finishExam();
      return;
    }
    // Update timer display without full re-render
    const timerEl = document.querySelector('.quiz-timer');
    if (timerEl) {
      const mins = Math.floor(STATE.examTimeLeft / 60);
      const secs = STATE.examTimeLeft % 60;
      timerEl.textContent = `⏱ ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      if (STATE.examTimeLeft < 600) timerEl.classList.add('warning');
    }
  }, 1000);
}

function submitExam() {
  if (!confirm('确定要交卷吗？交卷后无法继续作答。')) return;
  finishExam();
}

function finishExam() {
  clearInterval(STATE.examTimer);

  let totalScore = 0;
  let correctCount = 0;
  const total = STATE.quizQuestions.length;

  STATE.quizQuestions.forEach(q => {
    const ans = STATE.quizAnswers[q.id];
    const isCorrect = ans && arraysEqual(ans.sort(), [...q.answer].sort());
    if (isCorrect) {
      correctCount++;
      const scoreMap = { single: 2, multi: 2, calc: 9, complex: 16 };
      totalScore += scoreMap[q.type] || 0;
    }

    // 错题记录
    if (!isCorrect && ans && ans.length > 0) {
      const exists = STATE.wrongBook.find(w => w.questionId === q.id);
      if (!exists) {
        STATE.wrongBook.push({ questionId: q.id, chapter: q.chapter, wrongCount: 1, lastWrong: new Date().toISOString(), userAnswer: ans });
      } else {
        exists.wrongCount++;
        exists.lastWrong = new Date().toISOString();
      }
    }
  });

  saveWrongBook();
  STATE.stats.total += total;
  STATE.stats.correct += correctCount;
  saveStats();

  // 保存考试历史
  STATE.examHistory.push({ date: new Date().toISOString(), score: totalScore, total, correct: correctCount });
  localStorage.setItem('cpa_exam_history', JSON.stringify(STATE.examHistory));

  let grade, gradeColor;
  if (totalScore >= 80) { grade = '优秀 🌟 有望通过！'; gradeColor = 'var(--success)'; }
  else if (totalScore >= 60) { grade = '及格 👍 继续保持！'; gradeColor = 'var(--primary)'; }
  else if (totalScore >= 40) { grade = '还需努力 💪 查漏补缺'; gradeColor = 'var(--warning)'; }
  else { grade = '需要加油 🔥 建议系统复习'; gradeColor = 'var(--danger)'; }

  const container = document.getElementById('quiz-area');
  container.innerHTML = `
    <div class="quiz-question result-card">
      <h2>📝 模拟考试完成！</h2>
      <div class="result-score" style="color:${gradeColor}">${totalScore}<span style="font-size:24px;">分</span></div>
      <div class="result-grade" style="color:${gradeColor}">${grade}</div>
      <p style="color:var(--text-secondary);margin-bottom:16px;">满分100分 · 及格线60分</p>
      <div class="result-detail">
        <div class="result-item"><div class="num" style="color:var(--text);">${total}</div><div class="lbl">总题数</div></div>
        <div class="result-item"><div class="num" style="color:var(--success);">${correctCount}</div><div class="lbl">正确</div></div>
        <div class="result-item"><div class="num" style="color:var(--danger);">${total-correctCount}</div><div class="lbl">错误</div></div>
      </div>
      <div class="score-bar"><div class="score-fill ${totalScore>=60?'high':totalScore>=40?'mid':'low'}" style="width:${totalScore}%"></div></div>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;">
        <button class="btn btn-primary" onclick="startMockExam()">🔄 重新考试</button>
        <button class="btn btn-outline" onclick="navigateTo('dashboard')">🏠 返回仪表盘</button>
        <button class="btn btn-outline" onclick="navigateTo('wrongbook')">📕 查看错题</button>
      </div>
    </div>`;
}

// ---- 真题库 ----
function renderRealExams() {
  const container = document.getElementById('realexam-list');
  container.innerHTML = REAL_EXAMS.map(e => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);">
      <div>
        <div style="font-weight:600;">${e.name}</div>
        <div style="font-size:13px;color:var(--text-secondary);">${e.questions}道题目</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="alert('真题库模块建设中，敬请期待！\\n当前系统已包含基于真题风格的高质量练习题。')">开始练习</button>
    </div>
  `).join('');
}

// ---- 错题本 ----
function renderWrongBook() {
  // 统计
  const statsDiv = document.getElementById('wrong-stats');
  const chapterCount = {};
  STATE.wrongBook.forEach(w => {
    chapterCount[w.chapter] = (chapterCount[w.chapter] || 0) + 1;
  });
  const topChapters = Object.entries(chapterCount).sort((a,b) => b[1]-a[1]).slice(0,5);

  statsDiv.innerHTML = `
    <div><div class="stat-label">错题总数</div><div class="stat-value" style="color:var(--danger);">${STATE.wrongBook.length}</div></div>
    <div><div class="stat-label">待复习章节</div><div class="stat-value" style="color:var(--warning);">${Object.keys(chapterCount).length}</div></div>
    <div><div class="stat-label">薄弱章节</div><div style="font-size:14px;font-weight:600;margin-top:4px;">${topChapters.length>0?topChapters[0][0]?'第'+topChapters[0][0]+'章 ' + (CHAPTERS.find(c=>c.id===parseInt(topChapters[0][0]))?.name||''):'暂无':'-'}</div></div>
  `;

  // 列表
  const listDiv = document.getElementById('wrong-list');
  if (STATE.wrongBook.length === 0) {
    listDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px;">🎉 太棒了！没有错题记录。继续保持！</p>';
    return;
  }

  listDiv.innerHTML = STATE.wrongBook.sort((a,b) => new Date(b.lastWrong) - new Date(a.lastWrong)).map(w => {
    const q = QUESTIONS.find(x => x.id === w.questionId);
    const ch = CHAPTERS.find(x => x.id === w.chapter);
    if (!q) return '';
    return `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--card);">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
        <div style="flex:1;">
          <div style="font-size:12px;color:var(--primary);margin-bottom:4px;">第${w.chapter}章 ${ch?.name||''} · ${q.type==='single'?'单选':q.type==='multi'?'多选':'综合'} · 错误${w.wrongCount}次</div>
          <div style="font-weight:600;margin-bottom:8px;">${q.stem}</div>
          <div style="font-size:13px;color:var(--success);">✅ 正确答案：${q.answer.map(a=>String.fromCharCode(65+a)).join('、')} ${q.options[q.answer[0]].substring(2)}</div>
          ${w.userAnswer ? `<div style="font-size:13px;color:var(--danger);">❌ 你的答案：${w.userAnswer.map(a=>String.fromCharCode(65+a)).join('、')}</div>` : ''}
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${q.explanation.substring(0,100)}...</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="retryWrongQuestion('${w.questionId}')">重做</button>
      </div>
    </div>`;
  }).join('');
}

function retryWrongQuestion(questionId) {
  const q = QUESTIONS.find(x => x.id === questionId);
  if (!q) return;
  STATE.quizMode = 'practice';
  STATE.practiceChapter = q.chapter;
  STATE.quizIndex = 0;
  STATE.quizAnswers = {};
  STATE.quizQuestions = [q];
  navigateTo('practice-quiz');
  renderQuiz();
}

// ---- 事件监听 ----
function initEventListeners() {
  // 知识库标签切换
  document.querySelectorAll('#knowledge-tabs .tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('#knowledge-tabs .tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderKnowledgeLibrary(this.dataset.filter);
    });
  });

  // 练习模式切换
  document.querySelectorAll('.practice-mode').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.practice-mode').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      STATE.practiceMode = this.dataset.mode;
    });
  });

  // 难度过滤
  document.querySelectorAll('.diff-filter').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.diff-filter').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      STATE.practiceDiff = this.dataset.diff;
    });
  });

  // 关闭知识弹窗
  document.getElementById('knowledge-modal').addEventListener('click', function(e) {
    if (e.target === this) closeKnowledgeModal();
  });
}

// ---- 工具函数 ----
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function saveStats() {
  localStorage.setItem('cpa_stats', JSON.stringify(STATE.stats));
}

function saveWrongBook() {
  localStorage.setItem('cpa_wrongbook', JSON.stringify(STATE.wrongBook));
}

function checkDailyStreak() {
  const today = new Date().toISOString().split('T')[0];
  if (!STATE.stats.days) STATE.stats.days = [];
  if (!STATE.stats.days.includes(today)) {
    STATE.stats.days.push(today);
    saveStats();
  }
}

// 关闭弹窗的全局点击
document.addEventListener('click', function(e) {
  const modal = document.getElementById('knowledge-modal');
  if (e.target === modal) {
    modal.classList.remove('show');
  }
});
