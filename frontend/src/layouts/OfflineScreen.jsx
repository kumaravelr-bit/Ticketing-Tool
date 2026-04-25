import styles from "../css/layout/OfflineScreen.module.css";

export default function OfflineScreen() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.loaderWrap}>
          <div className={styles.loader}>
            <svg height="0" width="0" viewBox="0 0 64 64" className={styles.absolute}>
              <defs xmlns="http://www.w3.org/2000/svg">
                <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="offline-g1">
                  <stop stopColor="#973BED" />
                  <stop stopColor="#007CFF" offset="1" />
                </linearGradient>
                <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id="offline-g2">
                  <stop stopColor="#FFC800" />
                  <stop stopColor="#FF00FF" offset="1" />
                  <animateTransform
                    repeatCount="indefinite"
                    keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1"
                    keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1"
                    dur="8s"
                    values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32"
                    type="rotate"
                    attributeName="gradientTransform"
                  />
                </linearGradient>
                <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="offline-g3">
                  <stop stopColor="#00E0ED" />
                  <stop stopColor="#00DA72" offset="1" />
                </linearGradient>
                <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="offline-g4">
                  <stop stopColor="#FF6B6B" />
                  <stop stopColor="#FFE66D" offset="1" />
                </linearGradient>
                <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="offline-g5">
                  <stop stopColor="#A8EDEA" />
                  <stop stopColor="#FED6E3" offset="1" />
                </linearGradient>
                <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="offline-g6">
                  <stop stopColor="#F953C6" />
                  <stop stopColor="#B91D73" offset="1" />
                </linearGradient>
                <linearGradient gradientUnits="userSpaceOnUse" y2="2" x2="0" y1="62" x1="0" id="offline-g7">
                  <stop stopColor="#43E97B" />
                  <stop stopColor="#38F9D7" offset="1" />
                </linearGradient>
              </defs>
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="42" className={styles.inlineBlock} style={{ marginRight: "-12px" }}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="11" stroke="url(#offline-g1)" d="M 32,-4 V 70" className={styles.dash} pathLength="360" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="56" className={styles.inlineBlock}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="8" stroke="url(#offline-g2)" d="M 8,60 V 4 L 56,60 V 4" className={styles.dash} pathLength="360" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="52" className={styles.inlineBlock}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="8" stroke="url(#offline-g3)" d="M 52,4 H 8 V 60 M 8,34 H 46" className={styles.dash} pathLength="360" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="64" className={styles.inlineBlock}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="9" stroke="url(#offline-g4)" d="M 32 32 m 0 -26 a 26 26 0 1 1 0 52 a 26 26 0 1 1 0 -52" className={styles.spin} pathLength="360" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="56" className={styles.inlineBlock}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="8" stroke="url(#offline-g5)" d="M 8,60 V 4 L 56,60 V 4" className={styles.dash} pathLength="360" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="52" className={styles.inlineBlock}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="8" stroke="url(#offline-g6)" d="M 52,4 H 8 V 60 H 52 M 8,32 H 46" className={styles.dash} pathLength="360" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="64" width="52" className={styles.inlineBlock}>
              <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="8" stroke="url(#offline-g7)" d="M 4,4 H 60 M 32,4 V 60" className={styles.dash} pathLength="360" />
            </svg>
          </div>
        </div>

        <div className={styles.content}>
          <p className={styles.eyebrow}>CRM Panel Unreachable</p>
          <h1 className={styles.title}>Please connect to the CRM network or server to continue</h1>
          <p className={styles.description}>
            This screen checks whether the app can reach the CRM backend.
            LAN and Wi-Fi will both work, and the page will reconnect automatically once the server is reachable again.
          </p>
        </div>
      </div>
    </div>
  );
}
