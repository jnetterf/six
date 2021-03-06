import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import StencilView, {
  StencilMeta,
  StencilOrStencilMap,
  Props as StencilViewProps,
} from "./stencil_view";
import { NativeSixDom, render } from "./reconciler";
import css from "./index.module.scss";

export { NativeSixDom, Barline, Clef } from "./reconciler";

export const TYPE_RNC = 0;
export const TYPE_BETWEEN_BARS = 1;

export interface HoverInfo {
  bar?: number;
  time?: [number, number];
  pitch?: {
    base: number;
    modifier: number;
  };
}

interface Props {
  transient?: boolean;
  children: any;
  onMouseDown?: (info: null | HoverInfo, ev: React.MouseEvent) => void;
  onMouseUp?: (info: null | HoverInfo, ev: React.MouseEvent) => void;
  onClick?: (info: null | HoverInfo, ev: React.MouseEvent) => void;
  onMouseMove?: (ev: React.MouseEvent) => void;
  onHover: (info: HoverInfo) => void;
}

export const StencilViewLazy = memo<StencilViewProps & { transient: boolean }>(
  StencilView,
  (_prevProps, nextProps) => nextProps.transient,
);

export default function Scene(props: Props) {
  // create/destroy Rust container
  const [container] = useState(NativeSixDom.new);
  useEffect(() => {
    return () => {
      container.free();
    };
  }, [container]);

  // render loop
  const [stencils, setStencils] = useState<{
    [key: number]: StencilOrStencilMap;
  } | null>(null);
  const [stencilMeta, setStencilMeta] = useState<{
    [key: number]: StencilMeta;
  } | null>(null);
  const [root, setRoot] = useState<number | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    render(props.children, container);
    container.exec();

    if (props.transient) {
      return;
    }

    let stencilTuples = container.stencils().split("\n");
    let stencilMapTuples = container.stencil_maps().split("\n");
    let stencilMetaTuples = container.get_stencil_bboxes().split("\n");
    let parents = container.parents().split("\n");

    let stencils: { [key: number]: StencilOrStencilMap } = {};
    for (let i = 0; i < stencilTuples.length; i += 3) {
      stencils[stencilTuples[i] as any] = [
        stencilTuples[i + 1],
        stencilTuples[i + 2],
      ];
    }

    for (let i = 0; i < stencilMapTuples.length; i += 3) {
      stencils[stencilMapTuples[i] as any] = [
        stencilMapTuples[i + 1],
        JSON.parse(stencilMapTuples[i + 2]),
      ];
    }

    let stencilMeta: { [key: number]: StencilMeta } = {};
    for (let i = 0; i < stencilMetaTuples.length; i += 2) {
      stencilMeta[stencilMetaTuples[i] as any] = JSON.parse(
        stencilMetaTuples[i + 1],
      );
    }

    let children: { [key: number]: Array<number> } = {};
    for (let i = 0; i < parents.length; i += 2) {
      let cl = children[parents[i + 1] as any] || [];
      cl.push(parseInt(parents[i]));
      children[parents[i + 1] as any] = cl;
    }

    setStencils(stencils);
    setStencilMeta(stencilMeta);
    const root = container.get_root_id();
    setRoot(root || null);
    setPageSize({
      width: (root && container.get_song_width(root)) || 0,
      height: (root && container.get_song_height(root)) || 0,
    });
  }, [container, props.children, props.transient]);

  const svg = useRef<SVGSVGElement>(null);

  function makeMouseHandler(
    fn?: (time: null | HoverInfo, ev: React.MouseEvent) => void,
  ) {
    return (ev: React.MouseEvent) => {
      if (!stencilMeta || !fn) {
        return;
      }

      fn(hoverInfo, ev);
    };
  }

  return (
    <svg
      className={css.sheet}
      viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
      width="100%"
      ref={svg}
      onMouseDownCapture={makeMouseHandler(props.onMouseDown)}
      onMouseUpCapture={makeMouseHandler(props.onMouseUp)}
      onClick={makeMouseHandler(props.onClick)}
      tabIndex={0}
      onMouseMove={ev => {
        if (!svg || !svg.current || !stencilMeta) {
          return;
        }
        const ctm = svg.current.getScreenCTM();
        if (!ctm) {
          return;
        }
        let pt = svg.current.createSVGPoint();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        pt = pt.matrixTransform(ctm.inverse());

        const newHoverInfo = container.get_hover_info(pt.x, pt.y);

        if (newHoverInfo) {
          if (
            Boolean(hoverInfo) !== Boolean(newHoverInfo) ||
            (hoverInfo &&
              (newHoverInfo[0] !== hoverInfo.bar ||
                newHoverInfo[1] !== hoverInfo.time?.[0] ||
                newHoverInfo[2] !== hoverInfo.time?.[1] ||
                newHoverInfo[3] !== hoverInfo.pitch?.base ||
                newHoverInfo[4] !== hoverInfo.pitch?.modifier))
          ) {
            const formattedHoverInfo: HoverInfo = {
              bar: newHoverInfo[0],
              time: [newHoverInfo[1], newHoverInfo[2]],
              pitch: {
                base: newHoverInfo[3],
                modifier: newHoverInfo[4],
              },
            };
            setHoverInfo(formattedHoverInfo);
            props.onHover(formattedHoverInfo);
          }
        } else {
          setHoverInfo(null);
          props.onHover({});
        }

        if (props.onMouseMove) {
          props.onMouseMove(ev);
        }
      }}
    >
      {root && stencils && stencils[root] && stencilMeta && (
        <StencilViewLazy
          id={root}
          stencils={stencils}
          transient={props.transient ?? false}
        />
      )}
    </svg>
  );
}
