import './style.css'
import { MODEL, requestResponse } from './openai.js'

// VITE_ 환경 변수는 브라우저에 노출됩니다. 로컬 교육 실습 전용입니다.
const apiKey = (import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
const sparkle = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" fill="currentColor"/></svg>'
const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const resetIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="./" aria-label="팝챗 처음 화면">pop<span class="logo-star">✳</span><span class="wordmark-sub">chat</span><span class="logo-period">.</span></a>
    <span class="header-caption">작은 질문에서 시작하는, 커다란 아이디어.</span>
    <button class="help-button" id="open-guide" type="button"><span aria-hidden="true">?</span> 시작 가이드</button>
  </header>
  <main class="workspace">
    <aside class="intro-panel" aria-label="팝챗 소개">
      <div class="eyebrow"><span class="tiny-dot"></span> YOUR EVERYDAY AI PLAYGROUND</div>
      <h1>궁금한 건,<br>일단 <span class="headline-pop">톡<span class="headline-dot">.</span></span></h1>
      <p class="intro-copy">공부부터 엉뚱한 상상까지.<br>생각을 톡 던지면, 아이디어가 팝!</p>
      <div class="illustration" aria-hidden="true">
        <span class="sticker sticker-hey">SAY HELLO!</span>
        <svg class="mascot" viewBox="0 0 300 210" fill="none">
          <path d="m238 20 5 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2 9-15Z" fill="#ff805c" stroke="#28242d" stroke-width="2.5"/>
          <ellipse cx="152" cy="188" rx="100" ry="10" fill="#ded5ef"/>
          <path d="M63 74C63 41 91 27 143 27h17c52 0 80 14 80 47v51c0 32-28 48-80 48h-12l-39 22 3-26c-32-7-49-21-49-44V74Z" fill="#baff50" stroke="#28242d" stroke-width="3"/>
          <path d="M100 91c3-13 13-13 16 0m56 0c3-13 13-13 16 0" stroke="#28242d" stroke-width="6" stroke-linecap="round"/>
          <path d="M126 111c8 18 29 18 38 0" stroke="#28242d" stroke-width="5" stroke-linecap="round"/>
          <ellipse cx="97" cy="109" rx="11" ry="6" fill="#f99bba"/><ellipse cx="191" cy="109" rx="11" ry="6" fill="#f99bba"/>
          <path d="m43 115-12-8m11 26-17 3m218-47 15-7m-13 25 19 4" stroke="#28242d" stroke-width="3" stroke-linecap="round"/>
          <path d="m60 25 3 11 11 3-11 4-3 11-4-11-11-4 11-3 4-11Z" fill="#8252ee"/>
        </svg>
        <span class="sticker sticker-idea">100% YOUR CURIOSITY</span>
      </div>
      <div class="how-it-works">
        <p class="small-label">대화는 이렇게</p>
        <p><span class="step-number">01</span> 떠오른 질문을 자유롭게 보내기</p>
        <p><span class="step-number">02</span> 답변에 이어서 더 깊이 물어보기</p>
        <p><span class="step-number">03</span> 새 주제는 대화 초기화로 시작!</p>
      </div>
      <div class="local-note"><span class="local-symbol" aria-hidden="true">↗</span><div><strong>지금은 로컬 실습 중</strong><p>브라우저에서 OpenAI API로 직접 연결해요.</p></div></div>
    </aside>
    <section class="chat-panel" aria-label="AI와 대화">
      <header class="chat-header">
        <div class="chat-identity"><span class="bot-icon">${sparkle}</span><div><h2>나의 아이디어 메이트</h2><p>POWERED BY OPENAI <span>·</span> <span id="model-name"></span></p></div></div>
        <button class="reset-button" id="reset-chat" type="button" aria-label="대화 초기화">${resetIcon}<span>대화 초기화</span></button>
      </header>
      <div class="connection-bar"><div class="api-status" id="api-status" role="status" aria-live="polite"><span class="status-dot"></span><span id="status-label"></span></div><span id="status-description"></span></div>
      <div class="chat-scroll" id="chat-scroll">
        <div class="welcome" id="welcome">
          <div class="welcome-emblem" aria-hidden="true"><span class="emblem-spark">✳</span><span class="emblem-orbit">✦</span><span class="emblem-bubble">hi!</span></div>
          <span class="welcome-tag">BIG IDEAS START WITH A LITTLE CHAT</span>
          <h2>안녕! 어떤 생각을 하고 있어?</h2>
          <p>정답이 필요한 순간도, 그냥 수다 떨고 싶은 순간도.<br>뭐든 좋아. 우리 이야기해 보자!</p>
          <div class="suggestions" aria-label="질문 아이디어">
            <button class="suggestion suggestion-study" type="button" data-prompt="어려운 개념을 쉽게 이해하는 공부 방법 3가지를 알려줘."><span class="suggestion-icon" aria-hidden="true">✎</span><strong>공부도 가볍게</strong><span>어려운 개념, 쉽게 풀어줘</span><span class="suggestion-arrow" aria-hidden="true">↗</span></button>
            <button class="suggestion suggestion-idea" type="button" data-prompt="친구들과 함께 만들 수 있는 재밌는 앱 아이디어 3가지를 제안해 줘."><span class="suggestion-icon" aria-hidden="true">✧</span><strong>아이디어가 필요해</strong><span>새로운 영감을 톡!</span><span class="suggestion-arrow" aria-hidden="true">↗</span></button>
            <button class="suggestion suggestion-fun" type="button" data-prompt="만약 고양이가 학교 선생님이라면? 짧고 재밌는 이야기를 만들어 줘."><span class="suggestion-icon" aria-hidden="true">☺</span><strong>그냥 재밌는 얘기</strong><span>엉뚱한 상상도 환영해</span><span class="suggestion-arrow" aria-hidden="true">↗</span></button>
          </div>
        </div>
        <div class="messages" id="messages" role="log" aria-label="대화 내용" aria-live="polite" aria-relevant="additions"></div>
        <div class="loading-message" id="loading" role="status" hidden><span class="mini-bot">${sparkle}</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>팝챗이 생각을 모으는 중…</span></div>
      </div>
      <div class="composer-area">
        <div class="error-notice" id="error-notice" role="alert" hidden></div>
        <div class="composer-tip"><span aria-hidden="true">✧</span><span id="composer-tip">작은 질문도 좋아요. 편하게 시작해 보세요.</span></div>
        <form id="chat-form">
          <label class="sr-only" for="message-input">메시지 입력</label>
          <div class="composer"><textarea id="message-input" name="message" rows="1" maxlength="6000" placeholder="생각나는 건 뭐든 물어봐…" aria-describedby="input-hint"></textarea><button class="send-button" id="send-button" type="submit" disabled><span id="send-label">보내기</span>${arrow}</button></div>
          <div class="composer-meta"><span id="input-hint">Enter 전송 <span aria-hidden="true">·</span> Shift + Enter 줄바꿈</span><span><span id="character-count">0</span> / 6,000</span></div>
        </form>
        <p class="ai-disclaimer">AI의 답변은 틀릴 수 있어요. 중요한 내용은 한 번 더 확인해 주세요.</p>
      </div>
    </section>
  </main>
  <footer class="site-footer"><span>STAY CURIOUS. KEEP POPPING. ${sparkle}</span><p>교육용 로컬 실습 · 브라우저 환경 변수는 API 키를 숨기지 못해요. <strong>실제 키가 포함된 빌드 결과물을 공개 배포하지 마세요.</strong></p></footer>
  <dialog id="setup-dialog" aria-labelledby="guide-title">
    <div class="dialog-heading"><span class="guide-tag">LET’S GET STARTED</span><button id="close-guide" class="close-guide" type="button" aria-label="시작 가이드 닫기">×</button></div>
    <h2 id="guide-title">첫 대화까지, 딱 세 단계.</h2>
    <ol class="guide-steps"><li>프로젝트 루트의 <code>.env.local</code>을 열어 주세요.</li><li><code>VITE_OPENAI_API_KEY=</code> 뒤에 본인의 API 키를 입력하고 저장해 주세요.</li><li>터미널에서 <kbd>Ctrl + C</kbd>로 개발 서버를 종료하고 <code>npm run dev</code>로 다시 실행해 주세요.</li></ol>
    <p class="guide-status">키를 입력한 뒤에도 첫 요청 전까지는 ‘연결 미확인’이에요. 실제 Responses API 요청이 완료되어야 ‘요청 성공’으로 바뀝니다.</p>
    <p class="guide-warning">교육용 로컬 실습입니다. <code>VITE_</code> 환경 변수는 브라우저와 빌드 파일에 노출됩니다. <strong>실제 키가 포함된 결과물은 공개 배포하지 마세요.</strong></p>
    <a class="docs-link" href="https://developers.openai.com/api/docs/guides/text" target="_blank" rel="noopener noreferrer">OpenAI 공식 문서 읽기 ↗</a>
  </dialog>
`

const input = document.querySelector('#message-input')
const form = document.querySelector('#chat-form')
const sendButton = document.querySelector('#send-button')
const sendLabel = document.querySelector('#send-label')
const messages = document.querySelector('#messages')
const welcome = document.querySelector('#welcome')
const scrollArea = document.querySelector('#chat-scroll')
const loading = document.querySelector('#loading')
const errorNotice = document.querySelector('#error-notice')
const status = document.querySelector('#api-status')
const statusLabel = document.querySelector('#status-label')
const statusDescription = document.querySelector('#status-description')
const dialog = document.querySelector('#setup-dialog')
const suggestions = [...document.querySelectorAll('.suggestion')]
let conversation = []
let activeRequest = null
document.querySelector('#model-name').textContent = MODEL

function setStatus(state, description) {
  const labels = { missing: '키 미설정', unverified: '연결 미확인', loading: '요청 중', success: '요청 성공', error: '요청 실패' }
  status.dataset.state = state
  statusLabel.textContent = labels[state]
  statusDescription.textContent = description
}
function setInitialStatus() {
  setStatus(apiKey ? 'unverified' : 'missing', apiKey ? '첫 메시지를 보내 연결을 확인해 보세요.' : '.env.local에 키를 입력하고 서버를 재시작해 주세요.')
}
function updateComposer() {
  sendButton.disabled = Boolean(activeRequest) || !input.value.trim()
  document.querySelector('#character-count').textContent = input.value.length.toLocaleString('en-US')
  input.style.height = 'auto'
  input.style.height = `${Math.min(input.scrollHeight, 144)}px`
}
function setLoading(isLoading) {
  loading.hidden = !isLoading
  messages.setAttribute('aria-busy', String(isLoading))
  input.disabled = isLoading
  sendLabel.textContent = isLoading ? '생각 중' : '보내기'
  suggestions.forEach((button) => { button.disabled = isLoading })
  updateComposer()
}
function showError(message) {
  errorNotice.textContent = message
  errorNotice.hidden = false
}
function scrollToLatest() {
  scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' })
}
function addMessage(role, text) {
  const row = document.createElement('article')
  row.className = `message message-${role}`
  const label = document.createElement('span')
  label.className = 'message-label'
  label.textContent = role === 'user' ? '나' : 'POP CHAT'
  const bubble = document.createElement('div')
  bubble.className = 'message-bubble'
  // 사용자와 모델 출력 모두 텍스트로 렌더링해 HTML 실행을 막습니다.
  bubble.textContent = text
  row.append(label, bubble)
  messages.append(row)
  return row
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text || activeRequest) return
  errorNotice.hidden = true
  if (!apiKey) {
    setInitialStatus()
    showError('API 키가 아직 없어요. 시작 가이드에 따라 .env.local의 VITE_OPENAI_API_KEY를 입력한 뒤 개발 서버를 재시작해 주세요.')
    return
  }
  const controller = new AbortController()
  activeRequest = controller
  const pendingInput = [...conversation, { role: 'user', content: text }]
  welcome.hidden = true
  const userRow = addMessage('user', text)
  input.value = ''
  setLoading(true)
  setStatus('loading', 'Responses API에서 답변을 기다리고 있어요.')
  scrollToLatest()
  try {
    const reply = await requestResponse({ apiKey, input: pendingInput, signal: controller.signal })
    if (activeRequest !== controller) return
    conversation = [...pendingInput, ...reply.messages]
    addMessage('assistant', reply.text)
    setStatus('success', '실제 Responses API 요청이 완료되었어요.')
    document.querySelector('#composer-tip').textContent = '앞서 나눈 이야기를 기억해요. 이어서 물어보세요.'
  } catch (error) {
    if (activeRequest !== controller) return
    // 실패한 턴은 문맥에서 제외하고 입력을 복구해 재시도할 수 있게 합니다.
    userRow.remove()
    welcome.hidden = conversation.length > 0
    input.value = text
    setStatus('error', '아래 안내를 확인하고 다시 시도해 주세요.')
    showError(error.message)
  } finally {
    if (activeRequest === controller) {
      activeRequest = null
      setLoading(false)
      input.focus()
      scrollToLatest()
    }
  }
})
input.addEventListener('input', updateComposer)
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    form.requestSubmit()
  }
})
suggestions.forEach((button) => {
  button.addEventListener('click', () => {
    if (activeRequest) return
    input.value = button.dataset.prompt
    updateComposer()
    input.focus()
  })
})
document.querySelector('#reset-chat').addEventListener('click', () => {
  activeRequest?.abort()
  activeRequest = null
  conversation = []
  messages.replaceChildren()
  input.value = ''
  errorNotice.hidden = true
  welcome.hidden = false
  document.querySelector('#composer-tip').textContent = '새로운 대화가 시작됐어요. 어떤 이야기를 해 볼까요?'
  setLoading(false)
  setInitialStatus()
  input.focus()
  scrollArea.scrollTop = 0
})
document.querySelector('#open-guide').addEventListener('click', () => dialog.showModal())
document.querySelector('#close-guide').addEventListener('click', () => dialog.close())
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
setInitialStatus()
updateComposer()
