import { useStore } from "@nanostores/react";
import React from "react";
import {
  $lineHoverBackground,
  $fullscreenLyricsScale,
  $fullscreenSingleLine,
  $minimalLyricsMode,
  $simpleLyricsMode,
  $simpleLyricsModeRenderingType
} from "../../../utils/stores.ts";
import { matches, Row, Select, SectionTitle, Slider, Toggle } from "./components.tsx";

const SECTION_NAME = "Lyrics Display";
const renderingTypeOptions = ["calculate", "animate"];

interface Props {
  query: string;
  sectionFilter: string;
}

export default function LyricsSection({ query, sectionFilter }: Props) {
  const simpleLyricsMode = useStore($simpleLyricsMode);
  const simpleLyricsModeRenderingType = useStore($simpleLyricsModeRenderingType);
  const minimalLyricsMode = useStore($minimalLyricsMode);
  const lineHoverBackground = useStore($lineHoverBackground);
  const fullscreenLyricsScale = useStore($fullscreenLyricsScale);
  const fullscreenSingleLine = useStore($fullscreenSingleLine);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r1 = matches(query, "Simple Lyrics Mode", "Remove extra visual effects from lyrics");
  const r2 = matches(query, "Simple Mode: Text Animation Style", "How lyrics text transitions are rendered in Simple Lyrics Mode.");
  const r3 = matches(query, "Minimal Lyrics Mode", "Hides sung lyrics lines in Fullscreen and Cinema Mode");
  const r4 = matches(query, "Line Hover Background", "Shows a highlight box behind a lyrics line when you hover over it");
  const r5 = matches(query, "Fullscreen Lyrics Size", "Change the lyric font size used in Fullscreen and Cinema View");
  const r6 = matches(query, "One Fullscreen Line", "Show only the line currently being sung, centered across the screen");

  if (!r1 && !r2 && !r3 && !r4 && !r5 && !r6) return null;

  return (
    <>
      <SectionTitle>Lyrics Display</SectionTitle>

      {r1 && (
        <Row label="Simple Lyrics Mode" description="Remove extra visual effects from lyrics">
          <Toggle checked={simpleLyricsMode} onChange={(v) => $simpleLyricsMode.set(v)} />
        </Row>
      )}

      {r2 && (
        <Row
          label="Simple Mode: Text Animation Style"
          description="How lyrics text transitions are rendered in Simple Lyrics Mode."
          disabled={!simpleLyricsMode}
          disabledReason="Enable Simple Lyrics Mode to modify this setting"
        >
          <Select
            value={simpleLyricsModeRenderingType}
            options={renderingTypeOptions}
            onChange={(v) => $simpleLyricsModeRenderingType.set(v)}
            disabled={!simpleLyricsMode}
          />
        </Row>
      )}

      {r3 && (
        <Row
          label="Minimal Lyrics Mode"
          description="Hides sung lyrics lines in Fullscreen and Cinema Mode"
        >
          <Toggle checked={minimalLyricsMode} onChange={(v) => $minimalLyricsMode.set(v)} />
        </Row>
      )}

      {r4 && (
        <Row
          label="Line Hover Background"
          description="Shows a highlight box behind a lyrics line when you hover over it"
        >
          <Toggle checked={lineHoverBackground} onChange={(v) => $lineHoverBackground.set(v)} />
        </Row>
      )}

      {r5 && (
        <Row
          label="Fullscreen Lyrics Size"
          description="Adjust the lyric font size used in Fullscreen and Cinema View for a projector or distant display."
          stacked
        >
          <Slider
            value={fullscreenLyricsScale}
            min={60}
            max={240}
            step={5}
            defaultValue={100}
            unit="%"
            onChange={(v) => $fullscreenLyricsScale.set(v)}
          />
        </Row>
      )}

      {r6 && (
        <Row
          label="One Fullscreen Line"
          description="Show only the line currently being sung, centered on screen. The next line appears when its timing begins."
        >
          <Toggle checked={fullscreenSingleLine} onChange={(v) => $fullscreenSingleLine.set(v)} />
        </Row>
      )}
 
    </>
  );
}
