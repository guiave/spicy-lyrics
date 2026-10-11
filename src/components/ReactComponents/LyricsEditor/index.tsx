import React, { useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { PopupModal } from "../../Modal.ts";
import ApplyLyrics from "../../../utils/Lyrics/Global/Applyer.ts";
import fetchLyrics from "../../../utils/Lyrics/fetchLyrics.ts";
import { SpotifyPlayer } from "../../Global/SpotifyPlayer.ts";
import {
  $currentLyricsData,
  getLyricsOverride,
  removeLyricsOverride,
  setLyricsOverride,
} from "../../../utils/stores.ts";

type EditorLine = {
  sourceIndex: number;
  text: string;
  deleted: boolean;
};

type LyricsPayload = {
  Type: string;
  Lines?: Array<{ Text?: string; [key: string]: unknown }>;
  Content?: Array<Record<string, any>>;
  [key: string]: any;
};

function getLineText(type: string, line: Record<string, any>): string {
  if (type === "Static") return line.Text ?? "";
  if (type === "Line") return line.Text ?? "";
  return (line.Lead?.Syllables ?? []).reduce((text: string, syllable: any, index: number) => {
    const syllableText = String(syllable.Text ?? "");
    const needsSpace =
      index > 0 &&
      !syllable.IsPartOfWord &&
      text.length > 0 &&
      !/\s$/.test(text) &&
      !/^\s/.test(syllableText);
    return `${text}${needsSpace ? " " : ""}${syllableText}`;
  }, "");
}

function getEditorLines(payload: LyricsPayload): EditorLine[] {
  const source = payload.Type === "Static" ? payload.Lines ?? [] : payload.Content ?? [];
  return source.map((line, sourceIndex) => ({
    sourceIndex,
    text: getLineText(payload.Type, line),
    deleted: false,
  }));
}

function updatePayload(payload: LyricsPayload, lines: EditorLine[]): LyricsPayload {
  const editedByIndex = new Map(lines.map((line) => [line.sourceIndex, line]));
  const source = payload.Type === "Static" ? payload.Lines ?? [] : payload.Content ?? [];
  const nextSource = source.flatMap((line, sourceIndex) => {
    const edit = editedByIndex.get(sourceIndex);
    if (!edit || edit.deleted) return [];

    const nextLine = structuredClone(line);
    if (payload.Type === "Static" || payload.Type === "Line") {
      nextLine.Text = edit.text;
    } else {
      const syllables = nextLine.Lead?.Syllables ?? [];
      const originalText = getLineText(payload.Type, line);
      if (syllables.length === 0) {
        const lead = nextLine.Lead ?? {};
        nextLine.Lead = lead;
        lead.Syllables = [{
          Text: edit.text,
          StartTime: lead.StartTime ?? 0,
          EndTime: lead.EndTime ?? lead.StartTime ?? 0,
        }];
      } else if (edit.text !== originalText) {
        syllables[0].Text = edit.text;
        delete syllables[0].TransliteratedText;
        for (const syllable of syllables.slice(1)) {
          syllable.Text = "";
          delete syllable.TransliteratedText;
        }
      }
    }
    return [nextLine];
  });

  return {
    ...structuredClone(payload),
    ...(payload.Type === "Static" ? { Lines: nextSource } : { Content: nextSource }),
  };
}

function CurrentLyricsEditor({ onSaved }: { onSaved: () => void }): React.ReactElement {
  const payload = useMemo(() => {
    try {
      return JSON.parse($currentLyricsData.get()) as LyricsPayload;
    } catch {
      return null;
    }
  }, []);
  const [lines, setLines] = useState<EditorLine[]>(() => (payload ? getEditorLines(payload) : []));
  const [query, setQuery] = useState("");
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  if (!payload) {
    return (
      <div className="sl-lyrics-editor__state" role="status">
        <p>Não há letras carregadas para editar.</p>
      </div>
    );
  }

  function updateLine(sourceIndex: number, patch: Partial<EditorLine>) {
    setLines((current) =>
      current.map((line) => (line.sourceIndex === sourceIndex ? { ...line, ...patch } : line))
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingLines = lines.filter(
    (line) => !normalizedQuery || line.text.toLocaleLowerCase().includes(normalizedQuery)
  );

  function goToFirstMatch() {
    const firstMatch = matchingLines[0];
    if (!firstMatch) return;
    lineRefs.current[firstMatch.sourceIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    lineRefs.current[firstMatch.sourceIndex]
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
  }

  async function save() {
    const uri = SpotifyPlayer.GetUri();
    if (!uri) {
      toast.error("Não foi possível identificar a música atual.");
      return;
    }

    const edited = updatePayload(payload, lines);
    try {
      await ApplyLyrics([edited, 200, uri]);
    } catch (error) {
      console.error("SpicyLyrics: failed to apply edited lyrics", error);
      toast.error("Não foi possível aplicar a letra editada.");
      return;
    }
    $currentLyricsData.set(JSON.stringify(edited));
    setLyricsOverride(uri, edited);
    toast.success("Letra atualizada.");
    onSaved();
  }

  async function resetToOriginal() {
    const uri = SpotifyPlayer.GetUri();
    if (!uri) {
      toast.error("Não foi possível identificar a música atual.");
      return;
    }
    try {
      const original = await fetchLyrics(uri);
      if (!original) {
        toast.error("Não foi possível carregar a letra original.");
        return;
      }
      removeLyricsOverride(uri);
      await ApplyLyrics(original);
    } catch (error) {
      console.error("SpicyLyrics: failed to restore original lyrics", error);
      toast.error("Não foi possível restaurar a letra original.");
      return;
    }
    toast.success("Letra original restaurada.");
    onSaved();
  }

  return (
    <div className="sl-lyrics-editor">
      <p className="sl-lyrics-editor__hint">
        Altere ou remova linhas. As marcações de tempo são preservadas.
      </p>
      <div className="sl-lyrics-editor__search">
        <input
          type="search"
          value={query}
          placeholder="Buscar uma linha..."
          aria-label="Buscar uma linha da letra"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              goToFirstMatch();
            }
          }}
        />
        <button type="button" onClick={goToFirstMatch} disabled={!matchingLines.length}>
          Ir para linha
        </button>
        <span className="sl-lyrics-editor__search-count" role="status" aria-live="polite">
          {normalizedQuery ? `${matchingLines.length} encontrada(s)` : `${lines.length} linhas`}
        </span>
      </div>
      <div className="sl-lyrics-editor__list">
        {lines.length === 0 ? (
          <div className="sl-lyrics-editor__state" role="status">
            <p>Todas as linhas foram removidas.</p>
          </div>
        ) : matchingLines.length === 0 ? (
          <div className="sl-lyrics-editor__state" role="status">
            <p>Nenhuma linha contém “{query}”.</p>
          </div>
        ) : (
          matchingLines.map((line) => (
            <div
              className={`sl-lyrics-editor__row${line.deleted ? " is-deleted" : ""}`}
              key={line.sourceIndex}
              ref={(element) => {
                lineRefs.current[line.sourceIndex] = element;
              }}
            >
              <span className="sl-lyrics-editor__index" aria-hidden="true">{line.sourceIndex + 1}</span>
              <input
                type="text"
                value={line.text}
                disabled={line.deleted}
                aria-label={`Linha ${line.sourceIndex + 1}`}
                onChange={(event) => updateLine(line.sourceIndex, { text: event.target.value })}
              />
              <button
                type="button"
                className="sl-lyrics-editor__delete"
                aria-pressed={line.deleted}
                onClick={() => updateLine(line.sourceIndex, { deleted: !line.deleted })}
              >
                {line.deleted ? "Restaurar" : "Remover"}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="sl-lyrics-editor__actions">
        <button type="button" className="sl-lyrics-editor__cancel" onClick={() => PopupModal.hide()}>
          Cancelar
        </button>
        <button
          type="button"
          className="sl-lyrics-editor__cancel"
          onClick={resetToOriginal}
          disabled={!getLyricsOverride(SpotifyPlayer.GetUri() ?? "")}
        >
          Redefinir para original
        </button>
        <button type="button" className="sl-lyrics-editor__save" onClick={save}>
          Aplicar alterações
        </button>
      </div>
    </div>
  );
}

export function OpenCurrentLyricsEditor(): void {
  const container = document.createElement("div");
  const root = ReactDOM.createRoot(container);
  flushSync(() => root.render(<CurrentLyricsEditor onSaved={() => PopupModal.hide()} />));

  PopupModal.display({
    title: "Editar letra atual",
    content: container,
    isLarge: true,
    modalId: "lyricsEditor",
    onClose: () => root.unmount(),
  });
}
