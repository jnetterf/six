/// <reference path="./intrinsic_elements.d.ts" /> #

import {
  Render as _Render,
  Barline,
  Clef,
} from "../../rust_render_built/index";
import { unstable_now as now } from "scheduler";
import ReactReconciler from "react-reconciler";
import { Ref } from "react";

interface RenderExtra {
  classNames: { [key: string]: string };
  html: { [key: string]: any };
}

export type RustRenderApi = _Render & RenderExtra;

export { Barline, Clef } from "../../rust_render_built/index";

export function newRender(): RustRenderApi {
  return Object.assign(_Render.new(), {
    classNames: {} as { [key: string]: string },
    html: {} as { [key: string]: any },
  });
}

export enum NoteValue {
  Maxima = 3,
  Longa = 2,
  DoubleWhole = 1,
  Whole = 0,
  Half = -1,
  Quarter = -2,
  Eighth = -3,
  Sixteenth = -4,
  ThirtySecond = -5,
  SixtyFourth = -6,
  HundredTwentyEighth = -7,
  TwoHundredFiftySixth = -8,
}

interface Instance {
  type: "song" | "staff" | "bar" | "between" | "rnc";
  container: RustRenderApi;
  entity: number;
  meta: any;
}

interface Stylable {
  className?: any;
  html?:
    | ((props: { width: number; height: number }) => any)
    | null
    | undefined
    | false;
}

export interface SongProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<RustRenderApi>;
  freezeSpacing?: number | undefined;
  children: React.ReactNode;
  /** In mm */
  width: number;
  /** In mm */
  height: number;
  title: string;
  author: string;
}

export interface StaffProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<number>;
  children: React.ReactNode;
  className?: any;
}

export interface BarProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<number>;
  numer: number;
  denom: number;
  children?: any;
}

export interface BetweenBarsProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<number>;
  clef?: Clef | undefined;
  tsNum?: number;
  tsDen?: number;
  ks?: number | undefined;
  barline?: Barline | undefined;
}

export interface RncProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<number>;
  noteValue: number;
  dots: number;
  startNum: number;
  startDen: number;
  isNote: boolean;
  isTemporary: boolean;
  pitch?: number;
  pitchModifier?: number;
}

// TODO: dedupe with JSX.IntrinsicElements
type CreateInstanceParam =
  | { type: "song"; props: SongProps }
  | { type: "staff"; props: StaffProps }
  | { type: "bar"; props: BarProps }
  | { type: "between"; props: BetweenBarsProps }
  | { type: "rnc"; props: RncProps }
  | { type: never; props: never };

let context = document.createElement("canvas").getContext("2d", {});

function getTextWidth(fontSize: number, text: string) {
  if (!context) {
    return 0;
  }
  // TODO: sync title font with sys_print_meta.rs.
  context.font = `${fontSize}px "Times New Roman", Times, serif`;

  return context.measureText(text).width;
}

function createInstance(
  spec: CreateInstanceParam,
  container: RustRenderApi,
): Instance | null {
  let type: "song" | "staff" | "bar" | "between" | "rnc";
  let entity;
  let meta: any = null;

  if (spec.type === "song") {
    type = "song";
    const title = spec.props.title || "Untitled";
    const author = spec.props.author || "Anonymous";
    entity = container.song_create();
    container.song_set_freeze_spacing(
      entity,
      typeof spec.props.freezeSpacing === "number"
        ? spec.props.freezeSpacing
        : undefined,
    );
    container.song_set_size(entity, spec.props.width, spec.props.height);
    container.song_set_title(entity, title, getTextWidth(7, title));
    container.song_set_author(entity, author, getTextWidth(5, author));
  } else if (spec.type === "staff") {
    type = "staff";
    entity = container.staff_create();
  } else if (spec.type === "bar") {
    (type = "bar"),
      (entity = container.bar_create(spec.props.numer, spec.props.denom));
  } else if (spec.type === "between") {
    type = "between";
    entity = container.between_bars_create(
      spec.props.barline,
      spec.props.clef,
      spec.props.tsNum || undefined,
      spec.props.tsDen || undefined,
      spec.props.ks,
    );
  } else if (spec.type === "rnc") {
    type = "rnc";
    entity = container.rnc_create(
      spec.props.noteValue,
      spec.props.dots,
      spec.props.startNum,
      spec.props.startDen,
    );
    if (spec.props.isNote) {
      if (spec.props.pitch == null) {
        container.rnc_set_unpitched(entity);
      } else if (spec.props.pitch) {
        container.rnc_set_pitch(
          entity,
          spec.props.pitch,
          spec.props.pitchModifier ?? 0,
        );
      }
    } else {
      container.rnc_set_rest(entity);
    }
    meta = {
      isTemporary: spec.props.isTemporary || false,
    };
  } else {
    // @ts-ignore
    throw new Error(`Invalid type in sheet music reconciler: <${spec.type} />`);
  }

  if ("className" in spec.props) {
    container.classNames[entity] = spec.props.className;
  }

  if ("html" in spec.props) {
    container.html[entity] = spec.props.html;
  }

  return { container, type, entity, meta };
}

function appendChild(parent: Instance, child: Instance) {
  if (!parent || !child || parent.container !== child.container) {
    return;
  }

  if (parent.type === "bar") {
    parent.container.bar_insert(
      parent.entity,
      child.entity,
      child.meta.isTemporary,
    );
  } else {
    parent.container.child_append(parent.entity, child.entity);
  }
}

const Reconciler = ReactReconciler({
  supportsMutation: true,
  createInstance(type, props, container: RustRenderApi) {
    // @ts-ignore
    return createInstance({ type, props }, container);
  },
  createTextInstance(
    _text,
    _rootContainerInstance: RustRenderApi,
    _hostContext,
    _internalInstanceHandle,
  ) {
    throw new Error("Text not supported.");
  },

  appendChildToContainer(container, child: Instance) {
    container.root_set(child.entity);
  },
  appendChild(parent: Instance, child: Instance) {
    appendChild(parent, child);
  },
  appendInitialChild(parent: Instance, child: Instance) {
    appendChild(parent, child);
  },

  removeChildFromContainer(_container: RustRenderApi, child: Instance) {
    child.container.root_clear(child.entity);
  },
  removeChild(parent: Instance, child: Instance) {
    if (!parent || !child || parent.container !== child.container) {
      return;
    }

    if (parent.type === "bar") {
      child.container.bar_remove(parent.entity, child.entity);
    } else {
      child.container.child_remove(parent.entity, child.entity);
    }

    // TODO: remove child entities from html/classNames
  },
  insertInContainerBefore(
    _container: RustRenderApi,
    _child: Instance,
    _before: Instance,
  ) {
    throw new Error("The root can only have one child");
  },
  insertBefore(parent: Instance, child: Instance, before: Instance) {
    if (parent.type === "bar") {
      parent.container.bar_insert(
        parent.entity,
        child.entity,
        child.meta.isTemporary || false,
      );
    } else {
      parent.container.child_insert_before(
        parent.entity,
        before.entity,
        child.entity,
      );
    }
  },

  prepareUpdate(
    _instance: Instance,
    _type,
    _oldProps: any,
    _newProps: any,
    _rootContainerInstance: RustRenderApi,
    _currentHostContext,
  ) {
    return {};
  },
  commitUpdate(
    instance: Instance,
    _updatePayload: any,
    type,
    oldProps: any,
    newProps: any,
    _finishedWork,
  ) {
    if (type === "song" && oldProps.freezeSpacing !== newProps.freezeSpacing) {
      instance.container.song_set_freeze_spacing(
        instance.entity,
        newProps.freezeSpacing,
      );
    }

    if (
      type === "song" &&
      (oldProps.width !== newProps.width || oldProps.height !== newProps.height)
    ) {
      instance.container.song_set_size(
        instance.entity,
        newProps.width,
        newProps.height,
      );
    }

    if (type === "song" && oldProps.title !== newProps.title) {
      const title = newProps.title || "Untitled";
      instance.container.song_set_title(
        instance.entity,
        title,
        getTextWidth(7, title),
      );
    }

    if (type === "song" && oldProps.author !== newProps.author) {
      const author = newProps.author || "Anonymous";
      instance.container.song_set_author(
        instance.entity,
        author,
        getTextWidth(5, author),
      );
    }

    if (
      type === "rnc" &&
      (oldProps.startNum !== newProps.startNum ||
        oldProps.startDen !== newProps.startDen ||
        oldProps.noteValue !== newProps.noteValue ||
        oldProps.dots !== newProps.dots)
    ) {
      instance.container.rnc_update_time(
        instance.entity,
        newProps.noteValue,
        newProps.dots,
        newProps.startNum,
        newProps.startDen,
        newProps.isTemporary,
      );
    }

    if (
      type === "rnc" &&
      (oldProps.isNote !== newProps.isNote || oldProps.pitch !== newProps.pitch)
    ) {
      if (newProps.isNote) {
        if (newProps.pitch == null) {
          instance.container.rnc_set_unpitched(instance.entity);
        } else {
          instance.container.rnc_set_pitch(
            instance.entity,
            newProps.pitch,
            newProps.pitchModifier ?? 0,
          );
        }
      } else {
        instance.container.rnc_set_rest(instance.entity);
      }
    }

    if (
      type === "between" &&
      (oldProps.clef !== newProps.clef ||
        oldProps.tsNum !== newProps.tsNum ||
        oldProps.tsDen !== newProps.tsDen ||
        oldProps.ks !== newProps.ks ||
        oldProps.barline !== newProps.barline)
    ) {
      instance.container.between_bars_update(
        instance.entity,
        newProps.barline,
        newProps.clef,
        newProps.tsNum,
        newProps.tsDen,
        newProps.ks,
      );
    }

    if (oldProps.className !== newProps.className) {
      instance.container.classNames[instance.entity] = newProps.className;
    }

    if (oldProps.html !== newProps.html) {
      instance.container.html[instance.entity] = newProps.html;
    }
  },

  finalizeInitialChildren() {
    return false;
  },
  getChildHostContext() {},
  getPublicInstance(instance) {
    if (instance.type === "song") {
      return instance.container;
    } else {
      return instance.entity;
    }
  },
  getRootHostContext() {},
  prepareForCommit() {},
  resetAfterCommit() {},
  shouldSetTextContent() {
    return false;
  },

  now,
  setTimeout,
  clearTimeout,
  shouldDeprioritizeSubtree() {
    return false;
  },
  noTimeout: -1,
  supportsHydration: false,
  supportsPersistence: false,
  isPrimaryRenderer: false,
  cancelDeferredCallback() {},
  scheduleDeferredCallback() {
    return false;
  },
});

const roots = new Map<RustRenderApi, ReactReconciler.FiberRoot>();

export function render(whatToRender: any, container: RustRenderApi) {
  let root = roots.get(container);
  if (!root) {
    root = Reconciler.createContainer(container, false, false);
    roots.set(container, root);
  }

  Reconciler.updateContainer(whatToRender, root, null, () => null);
}

Reconciler.injectIntoDevTools({
  bundleType: process.env.NODE_ENV === "production" ? 0 : 1,
  version: "0.10.0",
  rendererPackageName: "six-eight",
  // @ts-ignore
  findFiberByHostInstance() {
    return null;
  },
});