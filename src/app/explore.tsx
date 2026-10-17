import { Redirect } from 'expo-router';

/**
 * 템플릿에 딸려온 화면. 파일을 지우는 대신 리다이렉트로 비워 둔다.
 * 그대로 두면 웹 빌드에 쓰지도 않는 템플릿 코드가 900KB 가까이 들어간다.
 */
export default function Explore() {
  return <Redirect href="/" />;
}
