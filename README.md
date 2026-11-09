# 팝챗 (Pop Chat)

Vanilla JavaScript + Vite로 OpenAI Responses API의 요청·응답 구조를 배우는 로컬 교육용 챗봇입니다. 브라우저의 `fetch`로 `https://api.openai.com/v1/responses`에 직접 요청하며, 백엔드나 Netlify 함수는 사용하지 않습니다.

## 실행

1. `npm install`로 의존성을 설치합니다.
2. 프로젝트 루트의 `.env.local`에 있는 `VITE_OPENAI_API_KEY=` 오른쪽에 본인의 API 키를 입력합니다. 실제 키는 제공하지 않았습니다. `.env.example`은 키가 없는 작성 예시입니다.
3. `npm run dev`를 실행하고 터미널에 표시된 로컬 주소를 엽니다.
4. 키를 수정했다면 개발 서버를 실행한 터미널에서 `Ctrl + C`를 누른 뒤 `npm run dev`를 다시 실행합니다. 브라우저 새로고침만으로는 수정한 환경 변수가 반영되지 않습니다.

코드는 `import.meta.env.VITE_OPENAI_API_KEY`로 키를 읽습니다. 키를 화면이나 로그에 출력하지 않습니다. `.gitignore`는 `.env.local`을 포함한 환경 파일을 제외하며 키가 없는 `.env.example`만 허용합니다.

## 대화와 API 상태

- 메시지를 입력하고 보내기 버튼 또는 Enter를 누릅니다. Shift + Enter는 줄바꿈이며 한글 조합 중 Enter는 전송하지 않습니다.
- 추천 질문을 누르면 입력창에 질문이 들어갑니다. 보내기를 눌러 요청합니다.
- 응답 대기 중 로딩을 표시하고 중복 전송을 막습니다. 60초 뒤에는 시간 초과를 안내합니다.
- 이전 사용자 메시지와 모델의 원본 assistant message를 다음 요청의 `input`에 포함합니다. 실패한 턴은 문맥에 추가하지 않고 입력을 복구합니다.
- 대화 초기화는 대기 중 요청도 취소하며, 화면과 메모리의 대화 기록을 비웁니다. 새로고침하면 대화가 사라집니다.
- 키가 없으면 **키 미설정**, 키가 있지만 아직 요청하지 않았다면 **연결 미확인**, 처리 중이면 **요청 중**, 실제 API 응답이 정상 완료되면 **요청 성공**입니다. 실패하면 **요청 실패**와 한국어 원인·해결 안내를 표시합니다. 초기화 후 상태는 다시 연결 미확인으로 돌아갑니다.

## 요청·응답 읽기

사용 모델: **`gpt-6-luna`**. 2026-11-09에 OpenAI 공식 문서에서 Responses API와 `reasoning.effort: 'none'` 지원을 확인했습니다. 실제 사용 가능 여부는 API 키가 속한 프로젝트의 권한과 사용 한도에 따라 달라집니다.

`src/openai.js`의 `createRequestBody()`에서 다음 요청을 구성합니다. `input` 배열은 매 턴 누적된 대화입니다.

```js
{
  model: 'gpt-6-luna',
  instructions: '...',
  input: [{ role: 'user', content: '안녕!' }],
  reasoning: { effort: 'none' },
  max_output_tokens: 4096,
  store: false,
}
```

HTTP 요청에는 `Content-Type: application/json`과 `Authorization: Bearer …` 헤더가 필요합니다. `store: false`는 나중에 조회하기 위한 응답 저장을 요청하지 않는 설정이며, 데이터 보관 전체가 없다는 의미는 아닙니다.

`parseResponse()`는 원본 JSON의 `status`와 `output` 배열을 검사한 뒤, 모든 assistant message의 `content`에서 `type: 'output_text'`의 `text`를 모읍니다. 첫 항목이 항상 텍스트라는 가정이나 SDK 전용 `output_text` 편의 속성에 의존하지 않습니다. 거절 응답, 불완전한 응답, 빈 응답도 처리합니다. 출력은 `textContent`로 표시해 HTML을 실행하지 않습니다.

## 키 노출 주의

**브라우저 환경 변수는 API 키를 숨기지 못합니다.** Vite의 `VITE_` 값은 클라이언트 JavaScript에 포함되므로 브라우저 개발자 도구, 네트워크 요청, 빌드 파일에서 확인할 수 있습니다. `.gitignore`는 소스 파일 커밋만 방지합니다.

**실제 키를 넣어 빌드한 `dist/`를 GitHub Pages, Netlify 등 어디에도 공개 배포하거나 공유하지 마세요.** 이 프로젝트는 본인 컴퓨터에서만 실행하는 교육용 실습입니다. API 요청은 사용량에 따라 과금됩니다.

## 검증

```sh
npm test
npm run build
```

테스트는 실제 키와 네트워크 요청 없이 요청 형식, 응답 파싱, 오류 및 취소 처리를 확인합니다. 실제 API 연결 성공 여부는 본인의 키를 입력하고 메시지를 전송한 뒤 화면에서 확인합니다.

## 참고한 OpenAI 공식 문서

- [Text generation — HTTP 요청과 output 배열](https://developers.openai.com/api/docs/guides/text)
- [Conversation state — 대화 문맥 전달](https://developers.openai.com/api/docs/guides/conversation-state)
- [GPT-6 Luna — 모델 및 Responses 지원](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Error codes — 오류 원인](https://developers.openai.com/api/docs/guides/error-codes)
