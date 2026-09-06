# 운송일보 PRO Android / Google Play 프로젝트

이 프로젝트는 기존 모바일 HTML 프로토타입을 **실제 Android 앱(APK/AAB)** 으로 실행하기 위한 Android Studio 프로젝트입니다.

## 기본 설정
- 앱 이름: 운송일보 PRO
- 임시 패키지명: `com.transportlog.proapp`
- versionCode: 2
- versionName: 1.1.0
- minSdk: 29 (Android 10)
- compileSdk: 36
- targetSdk: 36
- Java 17
- Play 배포 형식: Android App Bundle (`.aab`)

> **중요:** Google Play에 최초 업로드하기 전에 패키지명을 최종 확정하세요.
> Play에 한 번 등록한 applicationId/package name은 앱의 영구 식별자가 됩니다.

## Android 앱으로 바뀌면서 해결되는 부분
1. 설치하면 홈 화면/앱 목록에 `운송일보 PRO` 아이콘이 자동 생성됩니다.
2. QR 스캔은 Android `CAMERA` 런타임 권한을 사용합니다.
3. WebView를 `https://appassets.androidplatform.net` 보안 origin으로 실행하여 카메라 웹 API 사용 환경을 개선했습니다.
4. QR 사진 촬영/선택은 Android 파일 선택기 + 카메라를 사용합니다.
5. 사고접수 전화 버튼(`tel:`)은 Android 전화 앱으로 연결됩니다.
6. Excel은 Android 네이티브 브리지로 `다운로드/운송일보/` 폴더에 저장합니다.
7. localStorage는 앱 WebView 안에서 유지됩니다.

## V2 - 모바일 아이콘 직접 실행 테스트
- Android Adaptive Launcher Icon 적용
- MAIN/LAUNCHER Activity로 아이콘 클릭 즉시 앱 실행
- Android 12+ Splash Screen 적용
- GitHub Actions에서 debug APK와 release AAB 자동 빌드 가능
- GitHub Actions 빌드는 AGP 9.4 / Gradle 9.6 / API 36 / JDK 17 기준

## Android Studio에서 실행
1. 최신 Android Studio 설치
2. 이 저장소를 Clone/Open 합니다.
3. SDK Manager에서 Android 16 / API 36 설치
4. JDK 17 사용
5. Gradle Sync
6. USB 디버깅한 Android 휴대폰 연결
7. Run ▶ 으로 설치 테스트

## APK 만들기
Android Studio: `Build > Build App Bundles or APKs > Build APKs`

## Google Play용 AAB 만들기
`Build > Generate Signed App Bundle or APK > Android App Bundle`
