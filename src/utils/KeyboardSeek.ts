import { PageContainer } from "../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../components/Global/SpotifyPlayer.ts";

const SEEK_STEP_MS = 5000;

function isTextEditingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(
    element?.matches("input, textarea, select, [contenteditable='true']") ||
    element?.closest("input, textarea, select, [contenteditable='true']")
  );
}

function seekBy(delta: number): void {
  if (!PageContainer || SpotifyPlayer.IsDJ()) return;

  const progress = Spicetify.Player.getProgress();
  const duration = Spicetify.Player.getDuration();
  if (!Number.isFinite(progress) || !Number.isFinite(duration) || duration <= 0) return;

  Spicetify.Player.seek(Math.min(duration, Math.max(0, progress + delta)));
}

export function registerKeyboardSeek(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isTextEditingTarget(event.target)) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    event.stopPropagation();
    seekBy(event.key === "ArrowRight" ? SEEK_STEP_MS : -SEEK_STEP_MS);
  };

  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}
