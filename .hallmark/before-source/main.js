import 'katex/dist/katex.min.css'
import './style.css'
import { UNITS, STAGES, SOURCES } from './curriculum.js'
import { MODEL } from './openai.js'
import { generateQuiz, askGuide } from './quiz-api.js'
import { validateSettings, createProgress, answerQuestion, stageComplete, summarize, safeGuidance } from './quiz.js'
import { demoQuiz, DEMO_SETTINGS } from './demo.js'
import { renderMessage } from './render-message.js'
import { renderVisual } from './visuals.js'
import { createQuestionHistory } from './question-history.js'

const apiKey = (import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
let historyStorage
try { historyStorage = window.localStorage } catch { /* 저장소가 차단되면 현재 방문 동안만 이력을 유지합니다. */ }
const questionHistory = createQuestionHistory(historyStorage)
const $ = (selector) => document.querySelector(selector)
const node = (tag, className = '', text) => {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}
const rich = (tag, className, text) => {
  const element = node(tag, className)
  renderMessage(element, text)
  return element
}
const action = (text, className, callback) => {
  const button = node('button', className, text)
  button.type = 'button'
  button.addEventListener('click', callback)
  return button
}
let session = null
let generationController = null
let guideController = null
let pendingGuideThread = null
let generationError = ''
let pendingStage = 0
let showingSummary = false

$('#app').innerHTML = `
  <header class="site-header">
    <a href="./" class="wordmark" aria-label="퀴즈팝 처음 화면"><span class="logo-mark" aria-hidden="true">✳</span>퀴즈<span>팝</span><i>.</i></a>
    <span class="header-description">한 문제씩, 나의 속도로.</span>
    <div class="header-actions"><span class="audience-badge">특성화고 · 1학년 수학</span><button class="icon-button" id="help-button" type="button" aria-label="사용 방법">?</button></div>
  </header>
  <main class="app-layout">
    <aside class="settings-panel">
      <details id="settings-details" open>
        <summary><span class="section-icon">⚙</span><span>나의 학습 설정<small>오늘은 무엇을 배워 볼까요?</small></span><span class="details-chevron">⌄</span></summary>
        <form id="settings-form">
          <fieldset id="settings-fields">
            <label class="field-label" for="course">과목</label>
            <select id="course" name="course"><option>공통수학1</option><option>공통수학2</option></select>
            <label class="field-label" for="unit">단원</label><select id="unit" name="unit"></select>
            <label id="custom-unit-label" class="field-label" for="custom-unit" hidden>단원명 직접 입력</label><input id="custom-unit" maxlength="100" placeholder="예: 이차함수의 최댓값과 최솟값" hidden>
            <label class="field-label" for="range">학습 범위 <span>선택</span></label><textarea id="range" rows="2" maxlength="700" placeholder="예: 교과서 20~35쪽, 다항식의 덧셈과 곱셈"></textarea>
            <div class="label-row"><span class="field-label">성취기준</span><span class="tiny-label">여러 개 선택 가능</span></div>
            <div id="standards" class="standards-list" role="group" aria-label="성취기준 선택"></div>
            <p class="source-note">선택 문구는 원문의 요약입니다. <a id="standards-source" target="_blank" rel="noopener noreferrer">교육청 자료 ↗</a></p>
            <label class="field-label" for="custom-standards">성취기준 직접 입력 <span>선택</span></label><textarea id="custom-standards" rows="2" maxlength="1500" placeholder="학교에서 사용하는 기준을 한 줄에 하나씩 입력하세요."></textarea>
            <div class="field-divider"></div>
            <label class="field-label" for="difficulty">시작 난이도</label><select id="difficulty"></select>
            <label class="field-label" for="question-count">단계당 문항 수</label><select id="question-count"><option value="3">3문항 · 가볍게 시작</option><option value="5">5문항 · 충분히 연습</option><option value="7">7문항 · 꼼꼼히 확인</option></select>
          </fieldset>
          <p id="setup-error" class="inline-error" role="alert" hidden></p>
          <button class="primary-button start-button" id="start-button" type="submit">나의 퀴즈 만들기 <span aria-hidden="true">↗</span></button>
          <button class="secondary-button reset-settings" id="reset-button" type="button" hidden>설정 바꾸고 새로 시작</button>
          <button class="text-button demo-button" id="demo-button" type="button">먼저 예시 퀴즈 체험하기 →</button>
          <p class="setup-footnote" id="setup-footnote">선택한 단계부터 최상위까지 차근차근 이어져요.</p>
        </form>
      </details>
      <div class="settings-bottom"><span class="connection-dot" id="connection-dot"></span><span id="connection-label"></span><span class="model-label"></span></div>
    </aside>
    <section class="learning-column" aria-label="퀴즈 학습">
      <div class="learning-topline"><span class="eyebrow">MY MATH JOURNEY</span><span class="session-chip" id="session-chip">오늘의 작은 도전</span></div>
      <div class="journey-heading"><h1 id="journey-title">한 단계씩, 수학 자신감.</h1><p id="journey-description">정답을 찾는 것보다, 알아가는 과정이 중요하니까.</p></div>
      <ol class="stage-track" id="stage-track" aria-label="난이도 학습 단계"></ol>
      <div id="session-progress" class="session-progress" hidden><div><span id="progress-label"></span><strong id="progress-value"></strong></div><progress id="total-progress" max="100" value="0" aria-label="전체 학습 진행률"></progress></div>
      <div id="quiz-workspace" aria-live="polite"></div>
      <p class="learning-footnote">틀려도 괜찮아요. 힌트와 질문으로 다시 생각하면, 그것도 배움이에요.</p>
    </section>
    <aside class="guide-panel" aria-labelledby="guide-heading">
      <div class="guide-top"><div class="guide-avatar" aria-hidden="true">✦</div><div><h2 id="guide-heading">생각 길잡이</h2><p>답 대신, 다음 한 걸음.</p></div><span class="guide-status-dot" aria-hidden="true"></span></div>
      <div class="guide-context" id="guide-context">퀴즈를 시작하면 함께할게요</div>
      <div class="guide-log" id="guide-log" role="log" aria-live="polite" aria-label="생각 길잡이 대화"></div>
      <div class="guide-prompts" id="guide-prompts"></div>
      <p class="inline-error guide-error" id="guide-error" role="alert" hidden></p>
      <form id="guide-form"><label class="sr-only" for="guide-input">모르는 부분 질문하기</label><div class="guide-composer"><textarea id="guide-input" rows="2" maxlength="1200" placeholder="어떤 부분이 헷갈리나요?" disabled></textarea><button id="guide-send" type="submit" aria-label="질문 보내기" disabled>↑</button></div></form>
      <p class="guide-note">정답·보기 번호를 알려주지 않아요.<br>개념을 함께 짚으며 스스로 풀도록 도와요.</p>
    </aside>
  </main>
  <footer class="site-footer"><span>SMALL STEPS. BIG POSSIBILITIES. ✳</span><p>AI 문항은 오류가 있을 수 있어요. 수업 활용 전 확인해 주세요. <button id="local-help" type="button">로컬 실습 안내</button></p></footer>
  <dialog id="help-dialog" aria-labelledby="help-title"><button class="close-dialog" id="close-help" type="button" aria-label="안내 닫기">×</button><span class="eyebrow">LET’S GET STARTED</span><h2 id="help-title">작은 도전, 큰 성장.</h2><ol><li>단원 또는 범위와 성취기준을 선택해요.</li><li>시작 난이도와 문항 수를 정하고 퀴즈를 만들어요.</li><li>보기의 번호나 내용을 누르면 바로 채점돼요. 키보드 숫자 1~5도 사용할 수 있어요.</li><li>오답이면 힌트를 보고 다른 답을 골라요. 모르는 것은 생각 길잡이에게 물어보세요.</li><li>한 단계의 모든 문제를 맞히면 결과를 확인하고 다음 단계로 올라가요.</li></ol><div class="local-help"><strong>로컬 API 설정</strong><p>프로젝트의 <code>.env.local</code>에 <code>VITE_OPENAI_API_KEY=본인의키</code> 형식으로 설정하세요. 키가 없다면 예시 퀴즈를 먼저 체험할 수 있어요.</p><p>실제 키는 브라우저와 빌드 파일에 노출됩니다. 키가 포함된 빌드를 공개 배포하지 마세요. 새로고침하면 현재 진행만 초기화되고, 최근 출제 이력은 이 브라우저에 유지돼요.</p></div></dialog>
`

$('.model-label').textContent = MODEL
STAGES.forEach((stage, i) => $('#difficulty').append(new Option(`${i + 1}. ${stage.name} · ${stage.subtitle}`, i)))

function populateUnits() {
  $('#unit').replaceChildren()
  UNITS.filter((u) => u.course === $('#course').value).forEach((u) => $('#unit').append(new Option(u.name, u.id)))
  $('#unit').append(new Option('단원 / 범위 직접 입력', 'custom'))
  populateStandards()
}
function populateStandards() {
  const unit = UNITS.find((u) => u.id === $('#unit').value)
  $('#standards').replaceChildren()
  for (const [index, [id, text]] of (unit?.standards ?? []).entries()) {
    const label = node('label', 'standard-option')
    const input = node('input')
    input.type = 'checkbox'
    input.value = id
    input.checked = index === 0
    input.dataset.text = text
    const copy = node('span')
    copy.append(node('small', 'standard-code', id), node('span', '', text))
    label.append(input, copy)
    $('#standards').append(label)
  }
  const custom = !unit
  $('#custom-unit').hidden = !custom
  $('#custom-unit-label').hidden = !custom
  $('#standards').hidden = custom
  $('#custom-standards').placeholder = custom ? '성취기준이나 학습목표를 반드시 입력해 주세요.' : '추가할 성취기준을 한 줄에 하나씩 입력하세요.'
  $('#standards-source').href = $('#course').value === '공통수학1' ? SOURCES.common1 : SOURCES.common2
}
function readSettings() {
  const unit = UNITS.find((u) => u.id === $('#unit').value)
  const standards = [...document.querySelectorAll('#standards input:checked')].map((input) => ({ id: input.value, text: input.dataset.text }))
  $('#custom-standards').value.split('\n').map((s) => s.trim()).filter(Boolean).forEach((text, i) => standards.push({ id: `custom-${i + 1}`, text }))
  return validateSettings({ course: $('#course').value, unit: unit?.name ?? $('#custom-unit').value.trim(), range: $('#range').value.trim(), standards, count: Number($('#question-count').value), startStage: Number($('#difficulty').value) })
}
function setConnection(state, text) {
  $('#connection-dot').dataset.state = state
  $('#connection-label').textContent = text
}
function setupLock() {
  const active = Boolean(session)
  $('#settings-fields').disabled = active
  $('#start-button').hidden = active
  $('#reset-button').hidden = !active
  $('#demo-button').hidden = active
  $('#setup-footnote').textContent = active ? '설정을 바꾸려면 새로 시작을 눌러 주세요.' : '선택한 단계부터 최상위까지 차근차근 이어져요.'
}
function currentQuestion() { return session?.questions[session.questionIndex] }
function currentProgress() { return session?.progress[session.questionIndex] }
function abortGuide() {
  guideController?.abort()
  guideController = null
  if (pendingGuideThread?.at(-1)?.role === 'user') pendingGuideThread.pop()
  pendingGuideThread = null
  $('#guide-log').setAttribute('aria-busy', 'false')
}
function focusContent(selector, block = 'start') {
  const element = $(selector)
  if (!element) return
  element.tabIndex = -1
  element.focus({ preventScroll: true })
  element.scrollIntoView?.({ block, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
function resetSession() {
  generationController?.abort()
  generationController = null
  abortGuide()
  session = null
  showingSummary = false
  generationError = ''
  $('#setup-error').hidden = true
  $('#guide-error').hidden = true
  $('#guide-input').value = ''
  $('#settings-details').open = true
  setConnection(apiKey ? 'ready' : 'missing', apiKey ? 'API 키 설정됨' : '예시 퀴즈 체험 가능')
  setupLock()
  renderAll()
}
function begin(settings, mode) {
  abortGuide()
  session = { settings, mode, stage: settings.startStage, questions: [], progress: [], questionIndex: 0, history: [], threads: [], previous: [] }
  showingSummary = false
  $('#setup-error').hidden = true
  setupLock()
  if (window.matchMedia?.('(max-width: 760px)').matches) $('#settings-details').open = false
  void loadStage(settings.startStage)
}
async function loadStage(stage) {
  if (!session || generationController) return
  abortGuide()
  const target = session
  const controller = new AbortController()
  generationController = controller
  pendingStage = stage
  generationError = ''
  renderAll()
  setConnection('loading', '맞춤 문항 생성 중')
  try {
    const previous = [...new Set([...questionHistory.get(target.settings), ...target.previous])]
    const quiz = target.mode === 'demo'
      ? demoQuiz(stage, { previous, randomize: true })
      : await generateQuiz({ apiKey, settings: target.settings, stage, previous, signal: controller.signal })
    if (generationController !== controller || session !== target) return
    questionHistory.remember(target.settings, quiz.questions)
    if (target.questions.length) {
      target.history.push({ stage: target.stage, ...summarize(target.progress), concepts: target.questions.filter((_, i) => target.progress[i].attempts.length > 1).map((q) => q.concept) })
    }
    target.stage = stage
    target.questions = quiz.questions
    target.title = quiz.title
    target.progress = createProgress(quiz.questions)
    target.questionIndex = 0
    target.threads = quiz.questions.map(() => [])
    target.previous.push(...quiz.questions.map((q) => q.prompt))
    $('#guide-input').value = ''
    $('#guide-error').hidden = true
    showingSummary = false
    setConnection('success', target.mode === 'demo' ? '예시 퀴즈 체험 중' : '맞춤 문항 준비 완료')
  } catch (error) {
    if (generationController !== controller || session !== target) return
    generationError = error.message
    setConnection('error', '문항 생성 재시도 필요')
  } finally {
    if (generationController === controller) {
      generationController = null
      renderAll()
      if (!generationError) focusContent('#question-title')
    }
  }
}

function renderTrack() {
  $('#stage-track').replaceChildren()
  STAGES.forEach((stage, i) => {
    const active = session && (generationController ? pendingStage : session.stage) === i
    const completed = session?.history.some((s) => s.stage === i) || (session?.stage === i && stageComplete(session.progress))
    const skipped = session && i < session.settings.startStage
    const item = node('li', [active && 'active', completed && 'complete', skipped && 'skipped'].filter(Boolean).join(' '))
    if (active) item.setAttribute('aria-current', 'step')
    item.append(node('span', 'stage-number', completed ? '✓' : String(i + 1)), node('strong', '', stage.name), node('small', '', skipped ? '선택한 시작 단계 이전' : stage.subtitle))
    $('#stage-track').append(item)
  })
  $('#session-progress').hidden = !session
  $('#session-chip').textContent = session ? session.mode === 'demo' ? '예시 체험 · 다항식' : `${session.settings.course} · 맞춤 퀴즈` : '오늘의 작은 도전'
  $('#journey-title').textContent = session ? session.settings.unit || '나만의 학습 범위' : '한 단계씩, 수학 자신감.'
  $('#journey-description').textContent = session ? `${session.settings.standards.length}개 성취기준 · 단계당 ${session.settings.count}문항 · ${STAGES[session.settings.startStage].name}부터 최상위까지` : '정답을 찾는 것보다, 알아가는 과정이 중요하니까.'
  if (!session) return
  const done = session.history.reduce((sum, s) => sum + s.solved, 0) + summarize(session.progress).solved
  const total = (STAGES.length - session.settings.startStage) * session.settings.count
  $('#progress-label').textContent = '나의 학습 여정'
  $('#progress-value').textContent = `${done} / ${total}문항 완료`
  $('#total-progress').value = done / total * 100
}
function renderWelcome() {
  const welcome = node('div', 'welcome-card')
  welcome.innerHTML = `<div class="welcome-art" aria-hidden="true"><span class="art-orbit orbit-one">✦</span><span class="art-orbit orbit-two">✳</span><div class="art-card"><span class="art-card-eyebrow">I CAN DO IT!</span><span class="art-equation">x + 나 = 가능성</span><span class="art-face">◡</span></div><span class="art-sticker">나만의 속도로 ↗</span></div><span class="eyebrow">READY, SET, GROW!</span><h2>내가 풀어내는 순간,<br>수학이 조금 더 가까워져요.</h2><p>배울 내용을 고르면, 나에게 맞는 문제가 준비돼요.<br>틀려도 괜찮아요. 생각 길잡이가 함께할게요.</p><div class="welcome-features"><div><span>01</span><strong>톡, 누르면 바로 채점</strong><p>클릭도 터치도 편하게</p></div><div><span>02</span><strong>모르면 힌트 한 조각</strong><p>스스로 찾는 즐거움</p></div><div><span>03</span><strong>끝내면 다음 단계로</strong><p>기초부터 최상위까지</p></div></div>`
  return welcome
}
function renderAll() {
  renderTrack()
  const workspace = $('#quiz-workspace')
  workspace.replaceChildren()
  workspace.setAttribute('aria-busy', String(Boolean(generationController)))
  if (!session) workspace.append(renderWelcome())
  else if (generationController) {
    const loading = node('div', 'loading-card')
    loading.append(node('div', 'loading-spark', '✳'), node('span', 'eyebrow', `${STAGES[pendingStage].name.toUpperCase()} · GETTING READY`), node('h2', '', '생각이 자라는 문제를 만들고 있어요.'), node('p', '', '선택한 성취기준과 난이도에 맞춰 문항과 힌트를 준비해요.'), node('div', 'skeleton-line'), node('div', 'skeleton-line short'), action('생성 취소', 'text-button', () => { generationController?.abort() }))
    workspace.append(loading)
  } else {
    if (generationError) workspace.append(node('p', 'error-notice', generationError))
    if (!session.questions.length) {
      const empty = node('div', 'loading-card')
      empty.append(node('h2', '', '다시 한번 준비해 볼까요?'), action('같은 설정으로 다시 생성', 'primary-button', () => void loadStage(pendingStage)))
      workspace.append(empty)
    } else if (showingSummary) workspace.append(renderSummary())
    else workspace.append(renderQuestion())
  }
  renderGuide()
}
function changeQuestion(index) {
  if (!session || index < 0 || index >= session.questions.length) return
  abortGuide()
  session.questionIndex = index
  showingSummary = false
  $('#guide-input').value = ''
  $('#guide-error').hidden = true
  renderAll()
  focusContent('#question-title')
}
function renderQuestion() {
  const q = currentQuestion(), p = currentProgress()
  const card = node('article', 'question-card')
  const top = node('div', 'question-top')
  const badge = node('span', 'difficulty-badge', `${STAGES[session.stage].name} · ${session.questionIndex + 1} / ${session.questions.length}`)
  const nav = node('nav', 'question-nav')
  nav.setAttribute('aria-label', '이번 단계 문제 선택')
  session.progress.forEach((progress, index) => {
    const b = action(progress.solved ? '✓' : String(index + 1), `question-dot ${index === session.questionIndex ? 'current' : ''} ${progress.solved ? 'solved' : ''}`, () => changeQuestion(index))
    b.setAttribute('aria-label', `${index + 1}번 문제${progress.solved ? ', 완료' : ''}`)
    if (index === session.questionIndex) b.setAttribute('aria-current', 'true')
    nav.append(b)
  })
  top.append(badge, nav)
  const standard = session.settings.standards.find((s) => s.id === q.standardId)
  const standardLabel = node('p', 'question-standard', `${q.standardId.startsWith('custom-') ? '직접 입력한 성취기준' : q.standardId} · ${standard?.text ?? q.concept}`)
  const title = rich('h2', 'question-title', q.prompt)
  title.id = 'question-title'
  card.setAttribute('aria-labelledby', title.id)
  card.append(top, standardLabel, title, renderVisual(q.visual))
  const options = node('div', 'answer-options')
  options.setAttribute('role', 'group')
  options.setAttribute('aria-label', '정답을 골라 주세요')
  q.options.forEach((option, index) => {
    const wrong = p.attempts.includes(index) && index !== q.correctIndex
    const correct = p.solved && index === q.correctIndex
    const button = action('', `answer-option ${wrong ? 'is-wrong' : ''} ${correct ? 'is-correct' : ''}`, () => chooseAnswer(index))
    button.dataset.option = index
    button.disabled = p.solved || wrong
    button.append(node('span', 'option-number', String(index + 1)), rich('span', 'option-copy', option))
    if (wrong || correct) button.append(node('span', 'option-state', correct ? '✓ 정답' : '다시 생각해요'))
    options.append(button)
  })
  card.append(node('p', 'choice-instruction', '알맞은 보기를 눌러 보세요. 숫자 키 1~5로도 선택할 수 있어요.'), options)
  if (p.solved || p.hintsUsed) {
    const feedback = node('div', `answer-feedback ${p.solved ? 'feedback-success' : 'feedback-hint'}`)
    const label = node('h3', '', p.solved ? '맞았어요! 스스로 한 걸음 나아갔네요.' : p.attempts.length ? '아직 정답은 아니에요. 함께 생각해 볼까요?' : '생각을 여는 작은 힌트')
    label.id = 'feedback-title'
    label.tabIndex = -1
    const message = p.solved ? q.explanation : safeGuidance(q.hints[p.hintsUsed - 1], q, p.hintsUsed - 1)
    feedback.append(label, rich('p', '', message))
    if (!p.solved) feedback.append(node('small', '', `힌트 ${p.hintsUsed} / 3 · 다른 보기를 골라 다시 도전해 보세요.`))
    card.append(feedback)
  }
  const bottom = node('div', 'question-bottom')
  const hint = action(`✧ 힌트 ${p.hintsUsed ? `${p.hintsUsed}/3` : '보기'}`, 'secondary-button', () => {
    p.hintsUsed = Math.min(3, p.hintsUsed + 1)
    renderAll()
    focusContent('#feedback-title', 'nearest')
  })
  hint.disabled = p.solved || p.hintsUsed >= 3
  const next = action(stageComplete(session.progress) ? '단계 결과 보기 →' : '다음 문제 →', 'primary-button', () => {
    if (stageComplete(session.progress)) { showingSummary = true; abortGuide(); renderAll(); focusContent('.summary-card h2') }
    else {
      const remaining = session.progress.findIndex((progress, index) => index > session.questionIndex && !progress.solved)
      changeQuestion(remaining >= 0 ? remaining : session.progress.findIndex((progress) => !progress.solved))
    }
  })
  next.disabled = !p.solved
  bottom.append(hint, next)
  card.append(bottom)
  return card
}
function chooseAnswer(index) {
  if (!session || generationController || showingSummary) return
  const before = currentProgress()
  const after = answerQuestion(currentQuestion(), before, index)
  if (after === before) return
  abortGuide()
  session.progress[session.questionIndex] = after
  renderAll()
  focusContent('#feedback-title', 'nearest')
}
function renderSummary() {
  const result = summarize(session.progress)
  const final = session.stage === STAGES.length - 1
  const card = node('section', 'summary-card')
  card.append(node('div', 'summary-medal', final ? '✳' : '✓'), node('span', 'eyebrow', final ? 'YOU DID IT!' : 'ONE STEP HIGHER!'), node('h2', '', final ? '최상위까지, 끝까지 해냈어요!' : `${STAGES[session.stage].name} 단계 완료!`), node('p', 'summary-subtitle', final ? '틀린 문제도 다시 생각하며 여기까지 온 과정이 실력이에요.' : '이번에 배운 개념을 가지고, 다음 도전으로 가 볼까요?'))
  const stats = node('div', 'summary-stats')
  ;[[`${result.solved}/${session.questions.length}`, '문제 완료'], [String(result.firstTry), '첫 시도 정답'], [String(result.retried), '다시 생각해 해결']].forEach(([value, label]) => {
    const stat = node('div')
    stat.append(node('strong', '', value), node('span', '', label))
    stats.append(stat)
  })
  card.append(stats)
  const review = node('div', 'review-box')
  review.append(node('h3', '', '이번 단계에서 익힌 개념'))
  const concepts = node('div', 'concept-tags')
  ;[...new Set(session.questions.map((q) => q.concept))].forEach((concept) => concepts.append(node('span', '', concept)))
  review.append(concepts)
  card.append(review)
  if (final) {
    const all = [...session.history, { ...result }]
    card.append(
      node('p', 'completion-total', `총 ${all.reduce((n, s) => n + s.solved, 0)}문항 완료 · 첫 시도 정답 ${all.reduce((n, s) => n + s.firstTry, 0)}문항`),
      node('p', 'next-stage-note', '같은 단원에 다시 도전하면 이전과 다른 문제를 만나요.'),
      action('같은 단원, 새 문제로 다시 도전 ↻', 'primary-button', () => begin(structuredClone(session.settings), session.mode)),
      action('다른 단원 선택하기', 'text-button', resetSession),
    )
  } else {
    card.append(node('p', 'next-stage-note', `다음은 ${STAGES[session.stage + 1].name} · ${STAGES[session.stage + 1].subtitle}`), action(generationError ? '다음 단계 생성 다시 시도 →' : `${STAGES[session.stage + 1].name} 단계 시작 →`, 'primary-button', () => void loadStage(session.stage + 1)))
  }
  card.append(action('이번 단계 문제 다시 보기', 'text-button', () => changeQuestion(0)))
  return card
}

function renderGuide() {
  const available = Boolean(currentQuestion()) && !generationController && !showingSummary
  if (!available) $('#guide-error').hidden = true
  $('#guide-context').textContent = available ? `지금 함께 보는 개념 · ${currentQuestion().concept}` : showingSummary ? '잘 해냈어요. 다음 도전도 함께해요!' : '퀴즈를 시작하면 함께할게요'
  $('#guide-log').replaceChildren()
  const thread = available ? session.threads[session.questionIndex] : []
  if (!thread.length) {
    const message = node('div', 'guide-bubble')
    message.append(node('strong', '', '안녕! 나는 생각 길잡이야. ✦'), node('p', '', available ? '어디서부터 풀어야 할지 막막한가요? 헷갈리는 부분을 말해 주세요. 필요한 개념부터 하나씩 살펴볼게요.' : '정답을 바로 말해 주는 대신, 스스로 풀 수 있도록 작은 질문과 개념 설명을 건넬게요.'))
    $('#guide-log').append(message)
  } else thread.forEach((message) => $('#guide-log').append(rich('div', `guide-bubble ${message.role === 'user' ? 'guide-user' : ''}`, message.content)))
  if (guideController) $('#guide-log').append(node('div', 'guide-thinking', '작은 실마리를 찾고 있어요…'))
  $('#guide-prompts').replaceChildren()
  if (available && !thread.length) ['어떤 개념이 필요한가요?', '어디서부터 시작할까요?'].forEach((text) => {
    const b = action(text, 'guide-prompt', () => { $('#guide-input').value = text; $('#guide-input').focus(); updateGuideComposer() })
    b.disabled = Boolean(guideController)
    $('#guide-prompts').append(b)
  })
  $('#guide-input').disabled = !available || Boolean(guideController)
  updateGuideComposer()
}
function updateGuideComposer() {
  $('#guide-send').disabled = $('#guide-input').disabled || !$('#guide-input').value.trim()
}
async function submitGuide(event) {
  event.preventDefault()
  const text = $('#guide-input').value.trim()
  if (!text || !currentQuestion() || guideController || generationController || showingSummary) return
  const target = session, questionIndex = session.questionIndex, q = currentQuestion()
  const thread = target.threads[questionIndex]
  const history = [...thread]
  const controller = new AbortController()
  guideController = controller
  pendingGuideThread = thread
  thread.push({ role: 'user', content: text })
  $('#guide-input').value = ''
  $('#guide-error').hidden = true
  $('#guide-log').setAttribute('aria-busy', 'true')
  renderGuide()
  try {
    const answer = target.mode === 'demo'
      ? safeGuidance(q.hints[Math.min(2, Math.floor(history.length / 2))], q)
      : await askGuide({ apiKey, settings: target.settings, question: q, history, text, hintIndex: currentProgress().hintsUsed, signal: controller.signal })
    if (guideController !== controller || session !== target || session.questionIndex !== questionIndex) return
    thread.push({ role: 'assistant', content: answer })
  } catch (error) {
    if (guideController !== controller) return
    thread.pop()
    $('#guide-input').value = text
    $('#guide-error').textContent = error.message
    $('#guide-error').hidden = false
  } finally {
    if (guideController === controller) {
      guideController = null
      pendingGuideThread = null
      $('#guide-log').setAttribute('aria-busy', 'false')
      renderGuide()
      $('#guide-input').focus()
      $('#guide-log').scrollTop = $('#guide-log').scrollHeight
    }
  }
}

$('#course').addEventListener('change', populateUnits)
$('#unit').addEventListener('change', populateStandards)
$('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault()
  if (session) return
  try {
    const settings = readSettings()
    if (!apiKey) throw new Error('API 키가 아직 없어요. 사용 방법의 로컬 API 설정을 확인하거나 예시 퀴즈를 체험해 보세요.')
    begin(settings, 'ai')
  } catch (error) {
    $('#setup-error').textContent = error.message
    $('#setup-error').hidden = false
  }
})
$('#reset-button').addEventListener('click', resetSession)
$('#demo-button').addEventListener('click', () => {
  $('#course').value = '공통수학1'
  populateUnits()
  $('#range').value = DEMO_SETTINGS.range
  $('#difficulty').value = '0'
  $('#question-count').value = '3'
  $('#custom-standards').value = ''
  begin(structuredClone(DEMO_SETTINGS), 'demo')
})
$('#guide-input').addEventListener('input', updateGuideComposer)
$('#guide-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); $('#guide-form').requestSubmit() }
})
$('#guide-form').addEventListener('submit', submitGuide)
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName) || event.target.isContentEditable || $('#help-dialog').open) return
  if (/^[1-5]$/.test(event.key)) { event.preventDefault(); chooseAnswer(Number(event.key) - 1) }
})
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal())
$('#local-help').addEventListener('click', () => $('#help-dialog').showModal())
$('#close-help').addEventListener('click', () => $('#help-dialog').close())
$('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) $('#help-dialog').close() })
populateUnits()
setConnection(apiKey ? 'ready' : 'missing', apiKey ? 'API 키 설정됨' : '예시 퀴즈 체험 가능')
renderAll()
