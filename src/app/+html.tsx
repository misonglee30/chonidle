import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * 웹(PWA) 빌드의 HTML 껍데기. 네이티브 앱에는 영향이 없다.
 * 홈 화면에 추가했을 때 브라우저 주소창 없이 앱처럼 뜨게 하는 설정이 여기 들어간다.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* 홈 화면에 추가 시 전체 화면으로 실행 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="오늘 뭐 입지" />
        <meta name="theme-color" content="#FFFFFF" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />

        {/* 스크롤 영역이 두 번 생기는 문제를 막는다 */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BASE_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BASE_STYLE = `
  html, body { background-color: #FFFFFF; }
  body { overscroll-behavior-y: none; }
`;
