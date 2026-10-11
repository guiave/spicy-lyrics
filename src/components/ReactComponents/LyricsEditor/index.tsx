import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { PopupModal } from "../../Modal.ts";
import ApplyLyrics from "../../../utils/Lyrics/Global/Applyer.ts";
import { SpotifyPlayer } from "../../Global/SpotifyPlayer.ts";
import { $currentLyricsData } from "../../../utils/stores.ts";

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
  return (line.Lead?.Syllables ?? []).map((syllable: any) => syllable.Text ?? "").join("");
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
    toast.success("Letra atualizada.");
    onSaved();
  }

  return (
    <div className="sl-lyrics-editor">
      <p className="sl-lyrics-editor__hint">
        Altere ou remova linhas. As marcações de tempo são preservadas.
      </p>
      <div className="sl-lyrics-editor__list">
        {lines.length === 0 ? (
          <div className="sl-lyrics-editor__state" role="status">
            <p>Todas as linhas foram removidas.</p>
          </div>
        ) : (
          lines.map((line, index) => (
            <div className={`sl-lyrics-editor__row${line.deleted ? " is-deleted" : ""}`} key={line.sourceIndex}>
              <span className="sl-lyrics-editor__index" aria-hidden="true">{index + 1}</span>
              <input
                type="text"
                value={line.text}
                disabled={line.deleted}
                aria-label={`Linha ${index + 1}`}
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
