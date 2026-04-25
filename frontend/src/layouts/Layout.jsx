import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Menu from "../shared/components/Menu";
import styles from "../css/layout/Layout.module.css";
import { ThemeProvider } from "./ThemeContext";
import OfflineScreen from "./OfflineScreen";
import { prefetchGet } from "../services/api";
import { buildApiUrl } from "../config/apiConfig";

const HEALTH_CHECK_INTERVAL = 15000;
const HEALTH_CHECK_TIMEOUT = 4000;

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    let disposed = false;

    const checkBackendReachability = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!disposed) {
          setIsOnline(false);
        }
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      try {
        const response = await fetch(`${buildApiUrl("/health")}?_=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!disposed) {
          setIsOnline(Boolean(response.ok && navigator.onLine));
        }
      } catch {
        if (!disposed) {
          setIsOnline(false);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const handleOnline = () => {
      checkBackendReachability();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    checkBackendReachability();
    const intervalId = window.setInterval(checkBackendReachability, HEALTH_CHECK_INTERVAL);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    prefetchGet("/others/zones", { ttl: 5 * 60 * 1000 });
    prefetchGet("/others/teams", { ttl: 5 * 60 * 1000 });
    prefetchGet("/others/branches", { ttl: 5 * 60 * 1000 });
    prefetchGet("/manpower/home-summary", { ttl: 20 * 1000 });
  }, [isOnline]);

  return (
    <ThemeProvider>
      {isOnline ? (
        <div className={styles.layout}>
          <Menu collapsed={collapsed} setCollapsed={setCollapsed} />

          <main
            className={`${styles.content} ${
              collapsed ? styles.contentCollapsed : ""
            }`}
          >
            <Outlet />
          </main>
        </div>
      ) : (
        <OfflineScreen />
      )}
    </ThemeProvider>
  );
}
