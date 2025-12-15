import { useEffect } from "react";
import { getSessionId } from "./getSessionId";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/images";

export const useResetCurrentSessionOnClose = () => {
  useEffect(() => {
    const sid = getSessionId();

    fetch(`${API_BASE_URL}/session/alive`, {
      method: "POST",
      headers: { "X-Session-Id": sid },
    }).catch(() => {});

    const markClosing = () => {
      fetch(`${API_BASE_URL}/session/closing`, {
        method: "POST",
        headers: { "X-Session-Id": sid },
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("pagehide", markClosing);
    window.addEventListener("beforeunload", markClosing);

    return () => {
      window.removeEventListener("pagehide", markClosing);
      window.removeEventListener("beforeunload", markClosing);
    };
  }, []);
}
