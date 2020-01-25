import React, { useLayoutEffect, useState, useEffect, useRef } from "react";
import { Render, render } from "./reconciler";

export { Render, NoteValue, Barline } from "./reconciler";

interface Props {
  children: any;
}

/** [entity, x, y, scale] */
type StencilMapItem = [number, number, number, number];
type StencilOrStencilMap = string | Array<StencilMapItem>;
/** [x, y, x2, y2, barIdx, timeFracNum, timeFracDen] */
type StencilMeta = [number, number, number, number, number, number, number];

function StencilView({
  id,
  stencils,
  stencilMeta,
  transform
}: {
  id: number;
  stencils: { [key: string]: StencilOrStencilMap };
  stencilMeta: { [key: string]: StencilMeta };
  transform?: string;
}) {
  const stencil = stencils[id];
  if (typeof stencil === "string") {
    return (
      <g
        transform={transform}
        data-entity-id={id}
        dangerouslySetInnerHTML={{ __html: stencil }}
      />
    );
  } else {
    return (
      <g transform={transform} data-entity-id={id}>
        {stencil.map(([childId, x, y, scale]) => (
          <StencilView
            key={childId}
            id={childId}
            stencils={stencils}
            stencilMeta={stencilMeta}
            transform={
              typeof x === "number"
                ? `translate(${x}, ${y}) scale(${scale})`
                : undefined
            }
          />
        ))}
      </g>
    );
  }
}

export default function SheetMusicView(props: Props) {
  // create/destroy Rust container
  const [container] = useState(() => Render.new());
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
  const [hovering, setHovering] = useState<Array<number>>([]);

  useLayoutEffect(() => {
    console.time("render svg");
    render(props.children, container);
    container.exec();
    let stencilPairs = container.stencils().split("\n");
    let stencilMapPairs = container.stencil_maps().split("\n");
    let stencilMetaPairs = container.get_stencil_bboxes().split("\n");

    let stencils: { [key: number]: StencilOrStencilMap } = {};
    for (let i = 0; i < stencilPairs.length; i += 2) {
      stencils[stencilPairs[i] as any] = stencilPairs[i + 1];
    }

    for (let i = 0; i < stencilMapPairs.length; i += 2) {
      stencils[stencilMapPairs[i] as any] = JSON.parse(stencilMapPairs[i + 1]);
    }

    let stencilMeta: { [key: number]: StencilMeta } = {};
    for (let i = 0; i < stencilMetaPairs.length; i += 2) {
      stencilMeta[stencilMetaPairs[i] as any] = JSON.parse(
        stencilMetaPairs[i + 1]
      );
    }

    console.timeEnd("render svg");

    setStencils(stencils);
    setStencilMeta(stencilMeta);
    setRoot(container.get_root_id() || null);
  }, [container, props.children]);

  const svg = useRef<SVGSVGElement>(null);

  return (
    <svg
      viewBox="0 0 215.9 279.4"
      width="215.9mm"
      height="279.4mm"
      ref={svg}
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
        pt.y = -pt.y;

        // TODO: ask rust, or use r*tree, or both
        const hovering = Object.entries(stencilMeta)
          .filter(([_id, meta]) => {
            return (
              pt.x >= meta[0] &&
              pt.x <= meta[2] &&
              pt.y >= meta[1] &&
              pt.y <= meta[3]
            );
          })
          .map(e => parseInt(e[0]));

        setHovering(hovering);
      }}
    >
      <g transform="scale(1, -1)">
        {root && stencils && stencils[root] && stencilMeta && (
          <StencilView
            id={root}
            stencils={stencils}
            stencilMeta={stencilMeta}
          />
        )}
        {hovering.map(id => {
          if (!stencilMeta || !stencilMeta[id]) {
            return null;
          }
          const [x, y, x2, y2, bar, n, d] = stencilMeta[id];
          console.log(bar, n / d);
          return (
            <React.Fragment key={id}>
              <path
                d={`M${x} ${y}L${x} ${y2}L${x2} ${y2}L${x2} ${y}Z`}
                style={{
                  fill: "none",
                  stroke: "deepskyblue",
                  strokeWidth: 0.5
                }}
              />
              <text
                x={x}
                y={y}
                style={{
                  fontSize: 2,
                  transform: "scale(1,-1)",
                  transformOrigin: "50% 50%",
                  transformBox: "fill-box"
                }}
                className="serif"
              >
                {bar}|{n / d}
              </text>
            </React.Fragment>
          );
        })}
      </g>
    </svg>
  );
}
