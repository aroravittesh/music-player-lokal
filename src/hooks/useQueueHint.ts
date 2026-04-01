import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../store/playerStore";

const DURATION_MS = 2200;

export function useQueueHint() {
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const showMessage = useCallback((text: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(text);
    timerRef.current = setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, DURATION_MS);
  }, []);

  const enqueueWithFeedback = useCallback(
    (song: any) => {
      const id = String(song?.id ?? "");
      if (!id) {
        showMessage("Couldn't add track");
        return;
      }
      addToQueue(song);
      showMessage("Added to queue");
    },
    [addToQueue, showMessage]
  );

  return { message, showMessage, enqueueWithFeedback };
}
