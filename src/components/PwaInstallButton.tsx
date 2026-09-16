import { Icon } from './Icon';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface Props {
  className?: string;
  /**
   * 별도 닫기(×) 배지를 같이 보여줄지. 툴바 안에 심는 기존 쓰임에는 필요
   * 없었지만(그 자리 자체가 눈에 덜 띄어 다시 보지 않기 = iOS 힌트 안에서만
   * 가능했다), 플로팅 아이콘처럼 화면 위에 상시로 떠 있으면 네이티브 설치
   * 다이얼로그까지 안 가고도 그 자리에서 치울 방법이 있어야 한다.
   */
  showDismiss?: boolean;
}

/** 모바일 상단·플로팅 아이콘 등에 표시하는 PWA 홈 화면 설치 버튼 */
export function PwaInstallButton({ className = '', showDismiss = false }: Props) {
  const { showInstallButton, install, dismiss, iosHintOpen, closeIosHint } = usePwaInstall();

  if (!showInstallButton) return null;

  return (
    <>
      <span className={`pwa-install-wrap ${className}`.trim()}>
        <button
          type="button"
          className="pwa-install-btn"
          onClick={() => void install()}
          aria-label="앱 설치"
          title="홈 화면에 추가"
        >
          <Icon name="install" size={18} />
          <span className="pwa-install-btn-label">설치</span>
        </button>
        {showDismiss && (
          <button
            type="button"
            className="pwa-install-dismiss-badge"
            onClick={dismiss}
            aria-label="닫기 (다시 보지 않기)"
            title="닫기"
          >
            <Icon name="close" size={11} />
          </button>
        )}
      </span>

      {iosHintOpen && (
        <div className="pwa-ios-hint-backdrop" role="presentation" onClick={closeIosHint}>
          <div
            className="pwa-ios-hint"
            role="dialog"
            aria-labelledby="pwa-ios-hint-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pwa-ios-hint-title">홈 화면에 추가</h3>
            <ol className="pwa-ios-hint-steps">
              <li>
                Safari 하단 <strong>공유</strong> 버튼을 누릅니다.
              </li>
              <li>
                <strong>홈 화면에 추가</strong>를 선택합니다.
              </li>
              <li>이름을 확인한 뒤 <strong>추가</strong>를 누릅니다.</li>
            </ol>
            <div className="pwa-ios-hint-actions">
              <button type="button" className="pwa-ios-hint-dismiss" onClick={dismiss}>
                다시 보지 않기
              </button>
              <button type="button" className="pwa-ios-hint-ok" onClick={closeIosHint}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
