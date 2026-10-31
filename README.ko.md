<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/inkra-dark.png">
    <img src="./assets/inkra.png" alt="Inkra 연필 로고" width="96" height="96">
  </picture>
</p>

<p align="center"><a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.ja.md">日本語</a> | 한국어 | <a href="./README.fr.md">Français</a></p>

<h1 align="center">Inkra</h1>

<p align="center">그림을 그리듯 인터페이스를 만들어 보세요.</p>

<p align="center">
  <a href="https://inkrajs.github.io/">직접 사용해 보기</a> ·
  <a href="https://inkrajs.github.io/docs/getting-started">문서</a> ·
  <a href="https://www.npmjs.com/package/@inkra/react">npm</a>
</p>

연필로 쓴 듯한 글자, 질감 있는 선, 부드러운 색감이 어우러지는
손그림 스타일의 React 컴포넌트 라이브러리입니다.

<p align="center">
  <a href="https://inkrajs.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/preview-dark.png">
      <img src="./assets/preview-light.png" alt="Inkra 폼, 달력, 여행 지도" width="1100">
    </picture>
  </a>
</p>

- **글자까지 연필 느낌으로.** 손글씨와 종이 질감, 자연스러운 선을 담았습니다.
- **익숙한 조작 그대로.** 입력, 선택, 복사와 키보드 탐색을 지원합니다.
- **나만의 스타일로.** 색상, 글꼴, 필치를 조절하고 밝은 테마와 어두운 테마를 사용할 수 있습니다.
- **기본 컴포넌트에서 다양한 화면까지.** 폼, 레이아웃, 지도, 스킬 트리를 조합해 보세요.

## 시작하기

```sh
npm install @inkra/react
```

```tsx
import '@inkra/react/styles.css';
import { Button } from '@inkra/react';

export function App() {
  return <Button>작은 영감 저장하기</Button>;
}
```

스타일시트에는 기본 글꼴과 디자인 토큰이 포함되어 있습니다.
[문서](https://inkrajs.github.io/docs/getting-started)에서 실제 예제를 사용해 보고 코드를 수정해 보세요.

## 더 알아보기

[컴포넌트](https://inkrajs.github.io/docs/components/button) ·
[테마 설정](https://inkrajs.github.io/docs/theming) ·
[변경 이력](./CHANGELOG.md) ·
[기여 안내](./CONTRIBUTING.md) ·
[문제 및 제안](https://github.com/inkrajs/inkra/issues)

[MIT 라이선스](./LICENSE). 포함된 글꼴과 기타 리소스에는 각각의
[라이선스](./packages/inkra/THIRD_PARTY_NOTICES.md)가 적용됩니다.
