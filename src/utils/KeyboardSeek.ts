import { PageContainer } from "../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../components/Global/SpotifyPlayer.ts";
import { $currentLyricsType } from "./stores.ts";
import { LyricsObject, type LyricsLine, type LyricsSyllable } from "./Lyrics/lyrics.ts";

function isTextEditingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(
    element?.matches("input, textarea, select, [contenteditable='true']") ||
    element?.closest("input, textarea, select, [contenteditable='true']")
  );
}

function getTimedLines(): Array<LyricsLine | LyricsSyllable> {
  const type = $currentLyricsType.get();
  if (type === "Line" || type === "Syllable") {
    return LyricsObject.Types[type].Lines.filter(
      (line) => !line.DotLine && line.HTMLElement.textContent?.trim()
    );
  }
  return [];
}

function seekToAdjacentLine(direction: -1 | 1): void {
  if (!PageContainer || SpotifyPlayer.IsDJ()) return;

  const progress = Spicetify.Player.getProgress();
  if (!Number.isFinite(progress)) return;

  const lines = getTimedLines();
  if (lines.length === 0) return;

  const target =
    direction > 0
      ? lines.find((line) => line.StartTime > progress)?.StartTime
      : [...lines].reverse().find((line) => line.StartTime < progress)?.StartTime;

  if (target === undefined) return;
  Spicetify.Player.seek(target);
}

export function registerKeyboardSeek(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isTextEditingTarget(event.target)) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    seekToAdjacentLine(event.key === "ArrowRight" ? 1 : -1);
  };

  window.addEventListener("keydown", onKeyDown, true);
  return () => window.removeEventListener("keydown", onKeyDown, true);
}
