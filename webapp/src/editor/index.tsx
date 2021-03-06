import React, {
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cx from "classnames";

import Scene, { NativeSixDom } from "../scene";
import Frac from "../frac";
import {
  Action,
  addNote,
  changeNotePitch,
  moveCursor,
  removeNote,
  setBarCount,
  State,
  undo,
} from "../store";
import splitDurationIntoParts, {
  NoteAddPatch,
} from "./split_duration_into_parts";
import EditorHotkeys from "./hotkeys";
import Signature from "./signature";
import snapCursor from "./snap_cursor";
import Keyboard, { KeyboardRef } from "./keyboard";
import css from "./index.module.scss";
import appCss from "../app.module.scss";

interface Props {
  appState: State;
  dispatch: (action: Action) => void;
}

const Editor = forwardRef(function Editor(
  { appState, dispatch }: Props,
  ref: React.Ref<{ getPDF: () => string }>,
) {
  const songRef = useRef<NativeSixDom>(null);
  const barRefs = useMemo(
    () =>
      Array.from({ length: appState.song.part.bars.length }).map(() =>
        createRef<number>(),
      ),
    [appState.song.part.bars.length],
  );

  const { cursorTime, cursorBarIdx } = appState;
  const pickup = appState.song.global.pickupSkip;

  const [duration, setDuration] = useState(4);
  const [focused, setFocused] = useState(false);
  const [validAppState, setValidAppState] = useState(appState);
  const [focusNote, setFocusNote] = useState<{ bar: number; t: Frac } | null>(
    null,
  );

  if (
    pickup &&
    cursorBarIdx === 0 &&
    cursorTime[0] / cursorTime[1] < pickup[0] / pickup[1]
  ) {
    dispatch(moveCursor(0, pickup));
  }

  if (cursorBarIdx >= appState.song.part.bars.length) {
    dispatch(moveCursor(0, [0, 1]));
  }

  useImperativeHandle(ref, () => ({
    /**
     * Return the sheet music as a base64 PDF string (not including mimetype).
     *
     * Embeds the song as an embedded document.
     */
    getPDF: () => {
      return songRef.current?.to_pdf(JSON.stringify(appState.song)) ?? "";
    },
  }));

  const preview: NoteAddPatch | null = useMemo(() => {
    // Generate temporary preview taking into account cursor position.
    if (songRef.current && focused && appState === validAppState) {
      const bar = barRefs[cursorBarIdx];
      if (!bar) {
        dispatch(moveCursor(cursorBarIdx, [cursorTime[0], cursorTime[1]]));
        return null;
      }

      const patch = splitDurationIntoParts(
        songRef.current,
        appState,
        bar.current,
        cursorBarIdx,
        cursorTime,
        [1, duration],
      );
      return patch;
    } else {
      return null;
    }
  }, [
    dispatch,
    focused,
    cursorTime,
    cursorBarIdx,
    songRef,
    appState,
    barRefs,
    duration,
    validAppState,
  ]);

  useLayoutEffect(() => {
    setValidAppState(appState);
  }, [setValidAppState, appState]);

  const staff = useRef<number>(null);

  const getCursorTimePlus = useCallback(
    (add: [number, number]) => {
      return (
        staff.current &&
        songRef.current?.staff_time_cursor_add(
          staff.current,
          cursorBarIdx,
          cursorTime[0],
          cursorTime[1],
          add[0],
          add[1],
        )
      );
    },
    [cursorBarIdx, cursorTime, songRef],
  );

  const keyboard = useRef<KeyboardRef>(null);

  const handleTimeBack = useCallback(() => {
    keyboard.current?.onPhysicalKeyPress("back");
    const t = getCursorTimePlus([-1, Math.max(duration, 8)]);
    if (t) {
      dispatch(moveCursor(t[0], [t[1], t[2]]));
    }
    setFocusNote(null);
  }, [getCursorTimePlus, dispatch, duration]);

  const handleBackspace = useCallback(() => {
    keyboard.current?.onPhysicalKeyPress("backspace");
    const t = getCursorTimePlus([-1, Math.max(duration, 8)]);
    if (t) {
      const bar = appState.song.part.bars[t[0]]?.notes;
      for (const note of bar) {
        if (note.startTime[0] === t[1] && note.startTime[1] === t[2]) {
          dispatch(
            removeNote({
              startTime: note.startTime,
              pitch: note.pitch,
              barIdx: t[0],
              divisions: note.divisions,
              beforeTime: cursorTime,
              beforeBarIdx: cursorBarIdx,
            }),
          );
          return;
        }
      }

      // We did not find a note to delete.
      dispatch(moveCursor(t[0], [t[1], t[2]]));
    }
    setFocusNote(null);
    // If we are on a note, remove it.
  }, [
    appState,
    getCursorTimePlus,
    dispatch,
    duration,
    cursorBarIdx,
    cursorTime,
  ]);

  const handleTimeForward = useCallback(() => {
    keyboard.current?.onPhysicalKeyPress("forward");
    let t = getCursorTimePlus([1, Math.max(duration, 8)]);
    if (t) {
      dispatch(moveCursor(t[0], [t[1], t[2]]));
    } else {
      dispatch(setBarCount(appState, appState.song.part.bars.length + 1));
    }
    setFocusNote(null);
    return t;
  }, [getCursorTimePlus, dispatch, duration, appState]);

  const handleOctaveUp = useCallback(() => {
    keyboard.current?.onPhysicalKeyPress("up");
    if (focusNote) {
      const bar = appState.song.part.bars[focusNote.bar].notes;
      for (const note of bar) {
        if (
          note.startTime[0] === focusNote.t.num &&
          note.startTime[1] === focusNote.t.den
        ) {
          const oldPitch = note.pitch;
          // TODO: should depend on clef.
          if (oldPitch.base < 100) {
            const action = changeNotePitch(
              appState,
              focusNote.bar,
              [focusNote.t.num, focusNote.t.den],
              {
                base: oldPitch.base + 12,
                modifier: oldPitch.modifier,
              },
            );
            if (action) {
              dispatch(action);
            }
          }
        }
      }
    }
  }, [appState, dispatch, focusNote]);

  const handleOctaveDown = useCallback(() => {
    keyboard.current?.onPhysicalKeyPress("down");
    if (focusNote) {
      const bar = appState.song.part.bars[focusNote.bar].notes;
      for (const note of bar) {
        if (
          note.startTime[0] === focusNote.t.num &&
          note.startTime[1] === focusNote.t.den
        ) {
          const oldPitch = note.pitch;
          // TODO: should depend on clef.
          if (oldPitch.base > 12) {
            const action = changeNotePitch(
              appState,
              focusNote.bar,
              [focusNote.t.num, focusNote.t.den],
              {
                base: oldPitch.base - 12,
                modifier: oldPitch.modifier,
              },
            );
            if (action) {
              dispatch(action);
            }
          }
        }
      }
    }
  }, [appState, dispatch, focusNote]);

  const handleFocusOut = useCallback(
    _ev => {
      setFocused(false);
    },
    [setFocused],
  );

  const handleFocusIn = useCallback(() => {
    setFocused(true);
  }, [setFocused]);

  const handleNote = (base: string, mod: number) => {
    keyboard.current?.onPhysicalKeyPress(base, mod);
    const api = songRef.current;
    if (!api) {
      return;
    }

    const durationFraction: [number, number] = [1, duration];
    let insertion = splitDurationIntoParts(
      api,
      appState,
      barRefs[cursorBarIdx].current,
      cursorBarIdx,
      [cursorTime[0], cursorTime[1]],
      durationFraction,
    );
    const midi = ({
      C: 60,
      D: 62,
      E: 64,
      F: 65,
      G: 67,
      A: 69,
      B: 71,
    } as { [key: string]: number })[base];

    // We may have added less than durationFraction (e.g., if we're at the end of a bar, or before a note)
    let actualDuration = insertion?.divisions
      .map(d => Frac.fromDuration(d.noteValue, d.dots))
      .reduce((sum, part): Frac => sum.plus(part), Frac.zero());

    if (insertion && actualDuration) {
      const t = getCursorTimePlus([actualDuration.num, actualDuration.den]);
      if (t) {
        dispatch(
          addNote({
            barIdx: insertion.barIdx,
            startTime: insertion.startTime,
            divisions: insertion.divisions,
            pitch: {
              base: midi,
              modifier: mod,
            },
            afterBarIdx: t[0],
            afterTime: [t[1], t[2]],
          }),
        );
        setFocusNote({
          bar: insertion.barIdx,
          t: new Frac(insertion.startTime[0], insertion.startTime[1]),
        });
      }
    }
  };

  // React does not support focusout/focusin: https://github.com/facebook/react/issues/6410
  const editorDiv = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let x = editorDiv.current;
    x?.addEventListener("focusout", handleFocusOut);
    x?.addEventListener("focusin", handleFocusIn);
    return () => {
      x?.removeEventListener("focusout", handleFocusOut);
      x?.removeEventListener("focusin", handleFocusIn);
    };
  }, [editorDiv, handleFocusOut, handleFocusIn]);

  const [cursor, setCursor] = useState("default");

  let currTs = appState.song.global.signatures[0].ts;
  return (
    <EditorHotkeys
      onLeft={handleTimeBack}
      onRight={handleTimeForward}
      onUp={handleOctaveUp}
      onDown={handleOctaveDown}
      onNote={handleNote}
      onDuration={setDuration}
      onBackspace={handleBackspace}
    >
      <div className={appCss.editor} ref={editorDiv}>
        <Keyboard
          ref={keyboard}
          onLeft={handleTimeBack}
          onRight={handleTimeForward}
          onUp={handleOctaveUp}
          onDown={handleOctaveDown}
          onDuration={setDuration}
          duration={duration}
          onUndo={() => {
            dispatch(undo());
          }}
          onNote={handleNote}
          onBackspace={handleBackspace}
        />
        <div style={{ position: "relative", cursor }}>
          <Scene
            transient={appState !== validAppState}
            onHover={hoverInfo => {
              if ("bar" in hoverInfo && cursor !== "text") {
                setCursor("text");
              } else if (!("bar" in hoverInfo) && cursor === "text") {
                setCursor("default");
              }
            }}
            onMouseDown={(hoverInfo, _ev) => {
              if (
                songRef.current &&
                staff.current &&
                hoverInfo &&
                hoverInfo.bar != null &&
                hoverInfo.time != null &&
                hoverInfo.pitch != null
              ) {
                const t = snapCursor(
                  songRef.current,
                  staff.current,
                  hoverInfo.bar,
                  hoverInfo.time,
                );
                if (t) {
                  dispatch(moveCursor(t[0], [t[1], t[2]]));
                }
              }
            }}
          >
            <song
              freezeSpacing={preview ? appState.numChanges : undefined}
              ref={songRef}
              width={215.9}
              height={279.4}
              title={appState.song.global.title}
              author={appState.song.global.author}
            >
              <staff ref={staff}>
                <Signature
                  appState={appState}
                  dispatch={ev => {
                    dispatch(ev);
                  }}
                  beforeBar={0}
                />
                {appState.song.part.bars.map((bar, barIdx) => {
                  currTs =
                    appState.song.global.signatures[barIdx]?.ts ?? currTs;

                  // TODO: have stable keys even when adding/removing bars.
                  return (
                    <React.Fragment key={`${currTs[0]}_${currTs[1]}_${barIdx}`}>
                      <bar
                        ref={barRefs[barIdx]}
                        numer={currTs[0]}
                        denom={currTs[1]}
                        className={css.bar}
                        skipNum={
                          barIdx === 0
                            ? appState.song.global.pickupSkip?.[0]
                            : undefined
                        }
                        skipDen={
                          barIdx === 0
                            ? appState.song.global.pickupSkip?.[1]
                            : undefined
                        }
                      >
                        {bar.notes.map(({ divisions, pitch }, divisionIdx) => (
                          <React.Fragment key={divisionIdx}>
                            {divisions.map(
                              ({ noteValue, dots, startTime }, jdx) => (
                                <chord
                                  className={cx(
                                    css.note,
                                    focused &&
                                      focusNote &&
                                      focusNote.bar === barIdx &&
                                      focusNote.t.num === startTime[0] &&
                                      focusNote.t.den === startTime[1] &&
                                      css.noteHoverPreview,
                                  )}
                                  key={jdx}
                                  noteValue={noteValue}
                                  dots={dots}
                                  startNum={startTime[0]}
                                  startDen={startTime[1]}
                                  isNote={true}
                                  isTemporary={false}
                                  pitch={pitch.base}
                                  pitchModifier={pitch.modifier}
                                >
                                  {focused &&
                                    cursorBarIdx === barIdx &&
                                    cursorTime[0] === startTime[0] &&
                                    cursorTime[1] === startTime[1] && (
                                      <cursor className={css.cursor} />
                                    )}
                                </chord>
                              ),
                            )}
                          </React.Fragment>
                        ))}
                        {preview &&
                          preview.barIdx === barIdx &&
                          preview.divisions.map((div, idx) => (
                            <chord
                              key={idx}
                              noteValue={div.noteValue}
                              dots={div.dots}
                              startNum={div.startTime[0]}
                              startDen={div.startTime[1]}
                              isNote={false}
                              isTemporary={true}
                            >
                              {focused &&
                                cursorBarIdx === barIdx &&
                                cursorTime[0] === div.startTime[0] &&
                                cursorTime[1] === div.startTime[1] && (
                                  <cursor className={css.cursor} />
                                )}
                            </chord>
                          ))}
                      </bar>
                      <Signature
                        appState={appState}
                        dispatch={ev => {
                          dispatch(ev);
                        }}
                        beforeBar={barIdx + 1}
                      >
                        {cursorBarIdx === barIdx &&
                          new Frac(cursorTime[0], cursorTime[1]).eq(
                            new Frac(currTs[0], currTs[1]),
                          ) && <cursor className={css.cursor} />}
                      </Signature>
                    </React.Fragment>
                  );
                })}
              </staff>
            </song>
          </Scene>
        </div>
      </div>
    </EditorHotkeys>
  );
});

export default React.memo(Editor);
