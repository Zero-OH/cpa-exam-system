// ============================================================
// 注会备考通 v2.0 - 核心应用逻辑
// ============================================================

const STATE = {
  currentPage: 'dashboard',
  practiceChapter: null,
  practiceMode: 'sequence',
  practiceDiff: 'all',
  quizQuestions: [],
  quizIndex: 0,
  quizAnswers: {},
  quizMode: 'practice',
  examTimer: null,
  examTimeLeft: 0,
  wrongBook: JSON.parse(localStorage.getItem('cpa_wrongbook') || '[]'),
  stats: JSON.parse(localStorage.getItem('cpa_stats') || '{"total":0,"correct":0,"days":[]}'),
  examHistory: JSON.parse(localStorage.getItem('cpa_exam_history') || '[]'),
  submittedQuestions: new Set()
};

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  renderDashboard();
  renderKnowledgeLibrary();
  renderPracticeChapters();
  renderRealExams();
  renderWrongBook();
  renderRecommendations();
  initEventListeners();
  checkDailyStreak();
});

// ---- 导航 ----
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });
}

function navigateTo(page) {
  STATE.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');
  if (page === 'dashboard') renderDashboard();
  if (page === 'knowledge') renderKnowledgeLibrary();
  if (page === 'practice') renderPracticeChapters();
  if (page === 'wrongbook') renderWrongBook();
  if (page === 'realexam') renderRealExams();
}

// ==================== 仪表盘 ====================
function renderDashboard() {
  document.getElementById('stat-days').textContent = STATE.stats.days?.length || 0;
  document.getElementById('stat-total').textContent = STATE.stats.total;
  const accuracy = STATE.stats.total > 0 ? Math.round(STATE.stats.correct / STATE.stats.total * 100) : 0;
  document.getElementById('stat-accuracy').textContent = accuracy + '%';
  // 已完成章节数（有做过题的章节）
  const doneChapters = new Set();
  CHAPTERS.forEach(ch => {
    if (getChapterDoneCount(ch.id) > 0) doneChapters.add(ch.id);
  });
  document.getElementById('stat-chapters').textContent = doneChapters.size + '/30';
  document.getElementById('stat-wrong').textContent = STATE.wrongBook.length;

  // 章节进度条
  const progressDiv = document.getElementById('chapter-progress');
  progressDiv.innerHTML = CHAPTERS.map(ch => {
    const done = getChapterDoneCount(ch.id);
    const totalQ = QUESTIONS.filter(q => q.chapter === ch.id).length;
    const pct = totalQ > 0 ? Math.min(done / totalQ * 100, 100) : 0;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="width:200px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Ch${ch.id} ${ch.name}</span>
      <span style="font-size:12px;color:var(--text-secondary);width:40px;">${ch.score}</span>
      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${pct>60?'var(--success)':pct>20?'var(--warning)':'var(--border)'};border-radius:3px;transition:width .5s;"></div>
      </div>
      <span style="font-size:11px;color:var(--text-secondary);width:36px;">${Math.round(pct)}%</span>
    </div>`;
  }).join('');

  // 学习建议
  renderRecommendations();
}

// ---- 智能推荐 ----
function renderRecommendations() {
  const container = document.getElementById('recommendation-area');
  if (!container) return;

  const recommends = [];
  // 1. 分析错题薄弱章节
  const chapterErrors = {};
  STATE.wrongBook.forEach(w => {
    chapterErrors[w.chapter] = (chapterErrors[w.chapter] || 0) + w.wrongCount;
  });
  const weakChapters = Object.entries(chapterErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 2. 找高重要性但尚未练习的章节
  const highImportance = CHAPTERS.filter(ch => ch.importance === 'high' && getChapterDoneCount(ch.id) === 0);

  if (weakChapters.length > 0) {
    recommends.push({
      title: '🎯 薄弱章节，建议重点突破',
      items: weakChapters.map(([chId, count]) => {
        const ch = CHAPTERS.find(c => c.id === parseInt(chId));
        return { chapterId: parseInt(chId), label: `第${chId}章 ${ch?.name||''}（错题${count}次）`, priority: 'high' };
      })
    });
  }

  if (highImportance.length > 0) {
    recommends.push({
      title: '📖 高分章节尚未练习',
      items: highImportance.slice(0, 3).map(ch => ({
        chapterId: ch.id, label: `第${ch.id}章 ${ch.name}（${ch.score}）`, priority: 'mid'
      }))
    });
  }

  // 3. 最近错题直接推荐
  if (STATE.wrongBook.length > 0) {
    const recentWrong = STATE.wrongBook.sort((a, b) => new Date(b.lastWrong) - new Date(a.lastWrong)).slice(0, 3);
    recommends.push({
      title: '🔄 最近错题，再来一遍',
      items: recentWrong.map(w => {
        const ch = CHAPTERS.find(c => c.id === w.chapter);
        return { chapterId: w.chapter, label: `第${w.chapter}章 ${ch?.name||''}`, priority: 'low', questionId: w.questionId };
      })
    });
  }

  if (recommends.length === 0) {
    recommends.push({
      title: '🚀 开始你的备考之旅',
      items: [{ chapterId: 1, label: '第1章 总论（入门必学）', priority: 'mid' }]
    });
  }

  container.innerHTML = recommends.map(rec => `
    <div style="margin-bottom:16px;">
      <div style="font-weight:600;margin-bottom:8px;font-size:14px;">${rec.title}</div>
      ${rec.items.map(item => `
        <div class="recommend-item" onclick="${item.questionId ? `retryWrongQuestion('${item.questionId}')` : `startChapterPractice(${item.chapterId})`}" 
          style="padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .2s;"
          onmouseover="this.style.background='var(--primary-light)';" onmouseout="this.style.background='var(--card)';">
          <span style="font-size:14px;">${item.label}</span>
          <span style="margin-left:auto;color:var(--primary);">→</span>
        </div>`).join('')}
    </div>
  `).join('');
}

// ==================== 学习库 ====================
function renderKnowledgeLibrary(filter = 'all') {
  const container = document.getElementById('knowledge-list');
  let cards = KNOWLEDGE_CARDS;
  if (filter === 'high') {
    cards = cards.filter(c => CHAPTERS.find(ch => ch.id === c.chapter)?.importance === 'high');
  } else if (filter === 'mid') {
    cards = cards.filter(c => CHAPTERS.find(ch => ch.id === c.chapter)?.importance === 'mid');
  } else if (filter === 'low') {
    cards = cards.filter(c => CHAPTERS.find(ch => ch.id === c.chapter)?.importance === 'low');
  }
  container.innerHTML = cards.map(c => {
    const ch = CHAPTERS.find(x => x.id === c.chapter);
    return `<div class="knowledge-card" onclick="showKnowledgeDetail('${c.id}')">
      <div class="kc-chapter">第${c.chapter}章 ${ch?.name||''} · ${ch?.score||''}</div>
      <div class="kc-title">${c.title}</div>
      <div class="kc-desc">${c.desc}</div>
      <div class="kc-tags">
        ${c.tags.map(t => `<span class="knowledge-tag">${t}</span>`).join('')}
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
  const ch = CHAPTERS.find(x => x.id === card.chapter);
  content.innerHTML = `
    <button class="close-btn" onclick="closeKnowledgeModal()">&times;</button>
    <h2>${card.title}</h2>
    <p style="color:var(--text-secondary);margin-bottom:16px;">第${card.chapter}章 ${ch?.name||''} · ${ch?.score||''} · 难度：${card.difficulty==='easy'?'⭐':card.difficulty==='medium'?'⭐⭐':'⭐⭐⭐'}</p>
    ${card.detail}
    <div style="margin-top:20px;display:flex;gap:8px;">
      ${card.tags.map(t => `<span class="knowledge-tag">${t}</span>`).join('')}
    </div>
    <div style="margin-top:20px;">
      <button class="btn btn-primary btn-sm" onclick="closeKnowledgeModal();startChapterPractice(${card.chapter})">✏️ 练习本章题目</button>
    </div>`;
  modal.classList.add('show');
}

function closeKnowledgeModal() {
  document.getElementById('knowledge-modal').classList.remove('show');
}

// ==================== 章节练习 ====================
function renderPracticeChapters() {
  const container = document.getElementById('practice-chapters');
  container.innerHTML = CHAPTERS.map(ch => {
    const done = getChapterDoneCount(ch.id);
    const qCount = QUESTIONS.filter(q => q.chapter === ch.id).length;
    const importanceClass = ch.importance === 'high' ? 'importance-high' : ch.importance === 'mid' ? 'importance-mid' : '';
    return `<div class="chapter-item" onclick="startChapterPractice(${ch.id})">
      <div class="chapter-num">${ch.id}</div>
      <div class="chapter-info">
        <div class="chapter-name">${ch.name} ${importanceClass ? `<span class="badge badge-${ch.importance}">${ch.importance==='high'?'重点':'中等'}</span>` : ''}</div>
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
  STATE.submittedQuestions = new Set();

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
    const ch = CHAPTERS.find(c => c.id === chapterId);
    alert(`第${chapterId}章「${ch?.name||''}」当前筛选条件下没有题目。\n\n建议：调整难度过滤或切换练习模式。`);
    return;
  }

  navigateTo('practice-quiz');
  renderQuiz();
}

function renderQuiz() {
  const container = document.getElementById('quiz-area');
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) { showQuizResult(); return; }

  const typeLabel = q.type === 'single' ? '单选题' : q.type === 'multi' ? '多选题' : q.type === 'calc' ? '计算分析题' : '综合题';
  const typeClass = 'qtype-' + (q.type === 'complex' ? 'complex' : q.type === 'calc' ? 'calc' : q.type === 'multi' ? 'multi' : 'single');
  const multiHint = q.type === 'multi' ? '（多选，请选择所有正确答案）' : '';
  const userAnswer = STATE.quizAnswers[q.id] || [];
  const hasSelection = STATE.quizAnswers[q.id] !== undefined && STATE.quizAnswers[q.id].length > 0;
  const isSubmitted = STATE.submittedQuestions.has(q.id);

  container.innerHTML = `
    <div class="quiz-header">
      <span class="quiz-progress">第 ${STATE.quizIndex + 1}/${STATE.quizQuestions.length} 题</span>
      <span class="quiz-timer" style="font-size:13px;color:var(--text-secondary);">第${q.chapter}章 · ${CHAPTERS.find(c=>c.id===q.chapter)?.name||''}</span>
    </div>
    <div class="quiz-question">
      <div class="question-type ${typeClass}">${typeLabel} · ${q.difficulty==='easy'?'简单':q.difficulty==='medium'?'中等':'困难'}</div>
      <div class="question-stem">${q.stem.replace(/\n/g, '<br>')}</div>
      <div class="options">
        ${q.options.map((opt, i) => {
          const optText = opt.includes('.') ? opt.substring(opt.indexOf('.')+1).trim() : opt;
          const letter = String.fromCharCode(65 + i);
          let cls = '';
          const isCorrectOption = q.answer.includes(i);
          const isSelected = userAnswer.includes(i);
          if (isSubmitted && isCorrectOption) cls = 'correct';
          else if (isSubmitted && isSelected && !isCorrectOption) cls = 'wrong';
          else if (!isSubmitted && isSelected) cls = 'selected';
          return `<div class="option ${cls}" onclick="${isSubmitted ? '' : `toggleOption(${i})`}">
            <div class="option-letter">${letter}</div>
            <div>${optText}</div>
          </div>`;
        }).join('')}
      </div>
      ${multiHint ? `<p style="font-size:13px;color:var(--warning);margin-top:8px;">${multiHint}</p>` : ''}
      ${isSubmitted ? renderExplanation(q) : ''}
    </div>
    <div class="quiz-actions">
      ${hasSelection && !isSubmitted ? `<button class="btn btn-primary" onclick="submitAnswer()">✓ 提交答案</button>` : ''}
      ${isSubmitted && STATE.quizIndex < STATE.quizQuestions.length - 1 ? `<button class="btn btn-primary" onclick="nextQuestion()">下一题 →</button>` : ''}
      ${isSubmitted && STATE.quizIndex === STATE.quizQuestions.length - 1 ? `<button class="btn btn-success" onclick="showQuizResult()">查看结果</button>` : ''}
      <button class="btn btn-outline" onclick="navigateTo('practice')">返回章节列表</button>
    </div>`;
}

function renderExplanation(q) {
  const userAnswer = STATE.quizAnswers[q.id] || [];
  const correctSorted = [...q.answer].sort();
  const userSorted = [...userAnswer].sort();
  const isCorrect = arraysEqual(userSorted, correctSorted);
  const relatedKnowledge = (q.knowledge || []).map(kid => {
    const kc = KNOWLEDGE_CARDS.find(k => k.id === kid);
    return kc ? `<span class="knowledge-tag" style="cursor:pointer;" onclick="showKnowledgeDetail('${kid}')">📚 ${kc.title}</span>` : '';
  }).filter(Boolean).join('');

  let expertTip = '';
  if (!isCorrect && relatedKnowledge === '') {
    // 无关联知识点时，自动匹配同章节知识点
    const chapterCards = KNOWLEDGE_CARDS.filter(k => k.chapter === q.chapter);
    if (chapterCards.length > 0) {
      expertTip = `<div style="margin-top:12px;padding:12px;background:#fef3c7;border-radius:8px;">
        <strong>👨‍🏫 注册会计师专家提示：</strong>本题涉及第${q.chapter}章核心知识点，建议查阅学习库中的相关卡片加深理解。
        <div style="margin-top:8px;">${chapterCards.slice(0,2).map(kc => 
          `<span class="knowledge-tag" style="cursor:pointer;" onclick="showKnowledgeDetail('${kc.id}')">📚 ${kc.title}</span>`
        ).join(' ')}</div>
      </div>`;
    }
  }

  return `<div class="explanation show ${isCorrect ? '' : 'wrong'}">
    <div class="explanation-title">${isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}</div>
    <div class="explanation-body">
      <p style="font-weight:600;margin-bottom:4px;">【正确答案】${q.answer.map(a=>String.fromCharCode(65+a)).join('、')}</p>
      <p>${q.explanation.replace(/\n/g, '<br>')}</p>
      ${relatedKnowledge ? `<div style="margin-top:12px;"><strong>关联知识点：</strong><br>${relatedKnowledge}</div>` : expertTip}
    </div>
  </div>`;
}

function toggleOption(index) {
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) return;
  if (STATE.submittedQuestions.has(q.id)) return;
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

  const userAnswer = [...STATE.quizAnswers[q.id]].sort();
  const correctAnswer = [...q.answer].sort();
  const isCorrect = arraysEqual(userAnswer, correctAnswer);

  // 更新统计
  STATE.stats.total++;
  if (isCorrect) STATE.stats.correct++;
  saveStats();

  // 记录已做题（修复已练0题bug的核心）
  markQuestionDone(q.id, q.chapter);

  // 标记已提交（触发错题本、统计等逻辑）
  STATE.submittedQuestions.add(q.id);

  // 错题本
  if (!isCorrect) {
    const exists = STATE.wrongBook.find(w => w.questionId === q.id);
    if (!exists) {
      STATE.wrongBook.push({ questionId: q.id, chapter: q.chapter, wrongCount: 1, lastWrong: new Date().toISOString(), userAnswer });
    } else {
      exists.wrongCount++;
      exists.lastWrong = new Date().toISOString();
      exists.userAnswer = userAnswer;
    }
    saveWrongBook();
  } else {
    const exists = STATE.wrongBook.find(w => w.questionId === q.id);
    if (exists) {
      exists.wrongCount = Math.max(0, exists.wrongCount - 1);
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
    if (ans && arraysEqual([...ans].sort(), [...q.answer].sort())) correct++;
  });

  const score = total > 0 ? Math.round(correct / total * 100) : 0;
  let grade, gradeColor;
  if (score >= 80) { grade = '优秀 🌟'; gradeColor = 'var(--success)'; }
  else if (score >= 60) { grade = '良好 👍'; gradeColor = 'var(--primary)'; }
  else if (score >= 40) { grade = '还需努力 💪'; gradeColor = 'var(--warning)'; }
  else { grade = '需要加油 🔥'; gradeColor = 'var(--danger)'; }

  // 找出薄弱知识点
  const wrongChapters = {};
  STATE.quizQuestions.forEach(q => {
    const ans = STATE.quizAnswers[q.id];
    if (!ans || !arraysEqual([...ans].sort(), [...q.answer].sort())) {
      wrongChapters[q.chapter] = (wrongChapters[q.chapter] || 0) + 1;
    }
  });
  const weakTips = Object.entries(wrongChapters).sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([chId, cnt]) => {
      const ch = CHAPTERS.find(c=>c.id===parseInt(chId));
      return `<span class="knowledge-tag" style="cursor:pointer;background:#fee2e2;" onclick="startChapterPractice(${chId})">第${chId}章 ${ch?.name||''} 错${cnt}题</span>`;
    }).join(' ');

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
      ${weakTips ? `<div style="margin-top:12px;"><strong>薄弱章节：</strong><br>${weakTips}</div>` : ''}
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="startChapterPractice(${STATE.practiceChapter})">🔄 重新练习</button>
        <button class="btn btn-outline" onclick="navigateTo('practice')">📋 返回章节列表</button>
        <button class="btn btn-outline" onclick="navigateTo('wrongbook')">📕 查看错题</button>
      </div>
    </div>`;

  // 刷新仪表盘
  renderDashboard();
}

// ==================== 模拟考试 ====================
function startMockExam() {
  STATE.quizMode = 'exam';
  STATE.quizQuestions = generateMockExam();
  STATE.quizIndex = 0;
  STATE.quizAnswers = {};
  STATE.submittedQuestions = new Set();
  STATE.examTimeLeft = 180 * 60;
  navigateTo('practice-quiz');
  renderExamQuiz();
  startExamTimer();
}

function renderExamQuiz() {
  const container = document.getElementById('quiz-area');
  const q = STATE.quizQuestions[STATE.quizIndex];
  if (!q) { finishExam(); return; }

  const typeLabel = q.type === 'single' ? '单选题' : q.type === 'multi' ? '多选题' : q.type === 'calc' ? '计算分析题' : '综合题';
  const typeClass = 'qtype-' + (q.type === 'complex' ? 'complex' : q.type === 'calc' ? 'calc' : q.type === 'multi' ? 'multi' : 'single');
  const scoreLabel = q.type === 'single' ? '2分' : q.type === 'multi' ? '2分' : q.type === 'calc' ? '9分' : '16分';
  const mins = Math.floor(STATE.examTimeLeft / 60);
  const secs = STATE.examTimeLeft % 60;
  const timerWarning = STATE.examTimeLeft < 600 ? ' warning' : '';
  const userAnswer = STATE.quizAnswers[q.id] || [];

  container.innerHTML = `
    <div class="quiz-header">
      <span class="quiz-progress">📝 模拟考试 · 第 ${STATE.quizIndex+1}/${STATE.quizQuestions.length} 题</span>
      <span class="quiz-timer${timerWarning}">⏱ ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</span>
    </div>
    <div class="quiz-question">
      <div class="question-type ${typeClass}">${typeLabel} · ${scoreLabel}</div>
      <div class="question-stem">${q.stem.replace(/\n/g, '<br>')}</div>
      <div class="options">
        ${q.options.map((opt, i) => {
          const sel = userAnswer.includes(i);
          const letter = String.fromCharCode(65+i);
          const optText = opt.includes('.') ? opt.substring(opt.indexOf('.')+1).trim() : opt;
          return `<div class="option ${sel?'selected':''}" onclick="toggleExamOption(${i})">
            <div class="option-letter">${letter}</div><div>${optText}</div></div>`;
        }).join('')}
      </div>
      ${q.type==='multi' ? '<p style="font-size:13px;color:var(--warning);margin-top:8px;">（多选题，请选择所有正确答案）</p>' : ''}
    </div>
    <div class="quiz-actions">
      <button class="btn btn-outline btn-sm" onclick="prevExamQuestion()" ${STATE.quizIndex===0?'disabled':''}>← 上一题</button>
      <button class="btn btn-primary btn-sm" onclick="nextExamQuestion()">下一题 →</button>
      <button class="btn btn-danger btn-sm" onclick="submitExam()">📩 交卷</button>
    </div>
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
      ${STATE.quizQuestions.map((_, i) => {
        const answered = STATE.quizQuestions[i].id in STATE.quizAnswers && STATE.quizAnswers[STATE.quizQuestions[i].id].length > 0;
        return `<div style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;
          font-size:11px;cursor:pointer;font-weight:600;
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
  if (STATE.quizIndex < STATE.quizQuestions.length - 1) { STATE.quizIndex++; renderExamQuiz(); }
}
function prevExamQuestion() {
  if (STATE.quizIndex > 0) { STATE.quizIndex--; renderExamQuiz(); }
}

function startExamTimer() {
  clearInterval(STATE.examTimer);
  STATE.examTimer = setInterval(() => {
    STATE.examTimeLeft--;
    if (STATE.examTimeLeft <= 0) { clearInterval(STATE.examTimer); finishExam(); return; }
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
  const unanswered = STATE.quizQuestions.filter(q => !(q.id in STATE.quizAnswers) || STATE.quizAnswers[q.id].length === 0).length;
  let msg = '确定要交卷吗？交卷后无法继续作答。';
  if (unanswered > 0) msg += `\n\n⚠️ 还有 ${unanswered} 道题未作答！`;
  if (!confirm(msg)) return;
  finishExam();
}

function finishExam() {
  clearInterval(STATE.examTimer);
  let totalScore = 0, correctCount = 0;
  const total = STATE.quizQuestions.length;
  STATE.quizQuestions.forEach(q => {
    const ans = STATE.quizAnswers[q.id];
    const isCorrect = ans && arraysEqual([...ans].sort(), [...q.answer].sort());
    if (isCorrect) {
      correctCount++;
      const scoreMap = { single: 2, multi: 2, calc: 9, complex: 16 };
      totalScore += scoreMap[q.type] || 0;
    }
    if (!isCorrect && ans && ans.length > 0) {
      const exists = STATE.wrongBook.find(w => w.questionId === q.id);
      if (!exists) {
        STATE.wrongBook.push({ questionId: q.id, chapter: q.chapter, wrongCount: 1, lastWrong: new Date().toISOString(), userAnswer: [...ans] });
      } else { exists.wrongCount++; exists.lastWrong = new Date().toISOString(); }
    }
  });
  saveWrongBook();
  STATE.stats.total += total;
  STATE.stats.correct += correctCount;
  saveStats();
  STATE.examHistory.push({ date: new Date().toISOString(), score: totalScore, total, correct: correctCount });
  localStorage.setItem('cpa_exam_history', JSON.stringify(STATE.examHistory));

  let grade, gradeColor;
  if (totalScore >= 80) { grade = '优秀 🌟 有望通过！'; gradeColor = 'var(--success)'; }
  else if (totalScore >= 60) { grade = '及格 👍 继续保持！'; gradeColor = 'var(--primary)'; }
  else if (totalScore >= 40) { grade = '还需努力 💪'; gradeColor = 'var(--warning)'; }
  else { grade = '需要加油 🔥 建议系统复习'; gradeColor = 'var(--danger)'; }

  const container = document.getElementById('quiz-area');
  container.innerHTML = `
    <div class="quiz-question result-card">
      <h2>📝 模拟考试完成！</h2>
      <div class="result-score" style="color:${gradeColor}">${totalScore}<span style="font-size:24px;">分</span></div>
      <div class="result-grade" style="color:${gradeColor}">${grade}</div>
      <p style="color:var(--text-secondary);margin-bottom:16px;">满分100分 · 及格线60分</p>
      <div class="result-detail">
        <div class="result-item"><div class="num">${total}</div><div class="lbl">总题数</div></div>
        <div class="result-item"><div class="num" style="color:var(--success);">${correctCount}</div><div class="lbl">正确</div></div>
        <div class="result-item"><div class="num" style="color:var(--danger);">${total-correctCount}</div><div class="lbl">错误</div></div>
      </div>
      <div class="score-bar"><div class="score-fill ${totalScore>=60?'high':'low'}" style="width:${totalScore}%"></div></div>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="startMockExam()">🔄 重新考试</button>
        <button class="btn btn-outline" onclick="navigateTo('dashboard')">🏠 返回仪表盘</button>
        <button class="btn btn-outline" onclick="navigateTo('wrongbook')">📕 查看错题</button>
      </div>
    </div>`;
}

// ==================== 真题库 ====================
function renderRealExams() {
  const container = document.getElementById('realexam-list');
  if (!container) return;
  container.innerHTML = REAL_EXAMS.map((e, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">
      <div>
        <div style="font-weight:600;">${e.name}</div>
        <div style="font-size:13px;color:var(--text-secondary);">${e.desc} · 约${e.questions}道题目</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="startRealExam(${idx})">开始模拟</button>
    </div>
  `).join('');
}

function startRealExam(idx) {
  const exam = REAL_EXAMS[idx];
  if (!exam) return;
  STATE.quizMode = 'exam';
  STATE.quizQuestions = generateRealExam();
  STATE.quizIndex = 0;
  STATE.quizAnswers = {};
  STATE.submittedQuestions = new Set();
  STATE.examTimeLeft = 180 * 60;
  navigateTo('practice-quiz');
  // 显示真题提示
  const container = document.getElementById('quiz-area');
  container.innerHTML = `
    <div class="quiz-question result-card" style="text-align:center;">
      <h2>📋 ${exam.name}</h2>
      <p style="color:var(--text-secondary);margin:16px 0;">共 ${STATE.quizQuestions.length} 道题 · 180分钟 · 满分100分</p>
      <p style="font-size:13px;color:var(--warning);">⚠️ 本套题为模拟卷，题目按真题风格和分值分布随机组卷，用于模拟真实考试体验。</p>
      <div style="margin-top:24px;">
        <button class="btn btn-primary" onclick="renderExamQuiz();startExamTimer();">开始答题</button>
      </div>
    </div>`;
}

// ==================== 错题本 ====================
function renderWrongBook() {
  const statsDiv = document.getElementById('wrong-stats');
  const chapterCount = {};
  STATE.wrongBook.forEach(w => { chapterCount[w.chapter] = (chapterCount[w.chapter] || 0) + 1; });
  const topChapters = Object.entries(chapterCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  statsDiv.innerHTML = `
    <div><div class="stat-label">错题总数</div><div class="stat-value" style="color:var(--danger);">${STATE.wrongBook.length}</div></div>
    <div><div class="stat-label">涉及章节</div><div class="stat-value" style="color:var(--warning);">${Object.keys(chapterCount).length}</div></div>
    <div><div class="stat-label">薄弱章节</div><div style="font-size:14px;font-weight:600;margin-top:4px;">${topChapters.length>0 ? '第'+topChapters[0][0]+'章 '+(CHAPTERS.find(c=>c.id===parseInt(topChapters[0][0]))?.name||'') : '-'}</div></div>
  `;

  const listDiv = document.getElementById('wrong-list');
  if (STATE.wrongBook.length === 0) {
    listDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px;">🎉 太棒了！没有错题记录。继续保持！</p>';
    return;
  }

  // 按错误次数排序
  listDiv.innerHTML = STATE.wrongBook.sort((a, b) => b.wrongCount - a.wrongCount).map(w => {
    const q = QUESTIONS.find(x => x.id === w.questionId);
    const ch = CHAPTERS.find(x => x.id === w.chapter);
    if (!q) return '';
    return `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--card);">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
        <div style="flex:1;">
          <div style="font-size:12px;color:var(--primary);margin-bottom:4px;">第${w.chapter}章 ${ch?.name||''} · ${q.type==='single'?'单选':q.type==='multi'?'多选':q.type==='calc'?'计算分析':'综合'} · <span style="color:var(--danger);">错误${w.wrongCount}次</span></div>
          <div style="font-weight:600;margin-bottom:8px;">${q.stem.length > 80 ? q.stem.substring(0,80)+'...' : q.stem}</div>
          <div style="font-size:13px;color:var(--success);">✅ 正确答案：${q.answer.map(a=>String.fromCharCode(65+a)).join('、')}</div>
          ${w.userAnswer ? `<div style="font-size:13px;color:var(--danger);">❌ 你的答案：${w.userAnswer.map(a=>String.fromCharCode(65+a)).join('、')}</div>` : ''}
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
  STATE.submittedQuestions = new Set();
  STATE.quizQuestions = [q];
  navigateTo('practice-quiz');
  renderQuiz();
}

// ==================== 事件监听 ====================
function initEventListeners() {
  document.querySelectorAll('#knowledge-tabs .tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('#knowledge-tabs .tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderKnowledgeLibrary(this.dataset.filter);
    });
  });

  document.querySelectorAll('.practice-mode').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.practice-mode').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      STATE.practiceMode = this.dataset.mode;
    });
  });

  document.querySelectorAll('.diff-filter').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.diff-filter').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      STATE.practiceDiff = this.dataset.diff;
    });
  });

  document.getElementById('knowledge-modal').addEventListener('click', function(e) {
    if (e.target === this) closeKnowledgeModal();
  });
}

// ==================== 工具函数 ====================
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
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

// 关闭弹窗
document.addEventListener('click', function(e) {
  const modal = document.getElementById('knowledge-modal');
  if (e.target === modal) modal.classList.remove('show');
});
