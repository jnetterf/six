/// <reference path="./jsx_ext.d.ts" /> #

import { Barline, Clef, NativeSixDom } from "../../rust_render_built/index";
import { unstable_now as now } from "scheduler";
import ReactReconciler from "react-reconciler";
import { Ref } from "react";

export { NativeSixDom, Barline, Clef } from "../../rust_render_built/index";

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
  type: "song" | "staff" | "bar" | "signature" | "chord" | "cursor";
  container: NativeSixDom;
  entity: number;
  meta: any;
}

interface Stylable {
  className?: any;
}

export interface SongProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<NativeSixDom>;
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
  skipNum?: number | undefined;
  skipDen?: number | undefined;
  children?: any;
}

export interface SignatureProps extends Stylable {
  key?: string | number | null | undefined;
  ref?: Ref<number>;
  clef?: Clef | undefined;
  tsNum?: number;
  tsDen?: number;
  ks?: number | undefined;
  barline?: Barline | undefined;
  children?: any;
}

export interface ChordProps extends Stylable {
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
  children?: any;
}

export interface CursorProps extends Stylable {}

type CreateInstanceParam =
  | { type: "song"; props: SongProps }
  | { type: "staff"; props: StaffProps }
  | { type: "bar"; props: BarProps }
  | { type: "signature"; props: SignatureProps }
  | { type: "chord"; props: ChordProps }
  | { type: "cursor"; props: CursorProps };

type TypedInstrinsicProps = {
  song: SongProps;
  staff: StaffProps;
  bar: BarProps;
  signature: SignatureProps;
  chord: ChordProps;
};

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
  container: NativeSixDom,
): Instance {
  let type: "song" | "staff" | "bar" | "signature" | "chord" | "cursor";
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
    type = "bar";
    entity = container.bar_create(spec.props.numer, spec.props.denom);

    if (spec.props.skipDen != null && spec.props.skipNum != null) {
      container.bar_set_skip(entity, spec.props.skipNum, spec.props.skipDen);
    }
  } else if (spec.type === "signature") {
    type = "signature";
    entity = container.signature_create(
      spec.props.barline,
      spec.props.clef,
      spec.props.tsNum || undefined,
      spec.props.tsDen || undefined,
      spec.props.ks,
    );
  } else if (spec.type === "chord") {
    type = "chord";
    entity = container.chord_create(
      spec.props.noteValue,
      spec.props.dots,
      spec.props.startNum,
      spec.props.startDen,
    );
    if (spec.props.isNote) {
      if (spec.props.pitch == null) {
        container.chord_set_unpitched(entity);
      } else if (spec.props.pitch) {
        container.chord_set_pitch(
          entity,
          spec.props.pitch,
          spec.props.pitchModifier ?? 0,
        );
      }
    } else {
      container.chord_set_rest(entity);
    }
    meta = {
      isTemporary: spec.props.isTemporary || false,
    };
  } else if (spec.type === "cursor") {
    type = "cursor";
    entity = container.cursor_create();
  } else {
    // @ts-ignore
    throw new Error(`Invalid type in sheet music reconciler: <${spec.type} />`);
  }

  if ("className" in spec.props) {
    container.css_set_class(entity, spec.props.className);
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
  createInstance(type, props, container: NativeSixDom) {
    // @ts-ignore
    return createInstance({ type, props }, container);
  },
  createTextInstance(
    _text,
    _rootContainerInstance: NativeSixDom,
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

  removeChildFromContainer(_container: NativeSixDom, child: Instance) {
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
  },
  insertInContainerBefore(
    _container: NativeSixDom,
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
    _rootContainerInstance: NativeSixDom,
    _currentHostContext,
  ) {
    return {};
  },
  commitUpdate(
    instance: Instance,
    _updatePayload: any,
    type: keyof TypedInstrinsicProps,
    oldProps: TypedInstrinsicProps[typeof type],
    newProps: TypedInstrinsicProps[typeof type],
    _finishedWork,
  ) {
    function is<T extends keyof TypedInstrinsicProps>(
      type: string,
      matches: T,
      _props1: unknown,
    ): _props1 is TypedInstrinsicProps[T] {
      return type === matches;
    }

    if (is(type, "song", oldProps) && is(type, "song", newProps)) {
      if (oldProps.freezeSpacing !== newProps.freezeSpacing) {
        instance.container.song_set_freeze_spacing(
          instance.entity,
          newProps.freezeSpacing,
        );
      }

      if (
        oldProps.width !== newProps.width ||
        oldProps.height !== newProps.height
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

      if (oldProps.author !== newProps.author) {
        const author = newProps.author || "Anonymous";
        instance.container.song_set_author(
          instance.entity,
          author,
          getTextWidth(5, author),
        );
      }
    }

    if (is(type, "chord", oldProps) && is(type, "chord", newProps)) {
      if (
        oldProps.startNum !== newProps.startNum ||
        oldProps.startDen !== newProps.startDen ||
        oldProps.noteValue !== newProps.noteValue ||
        oldProps.dots !== newProps.dots
      ) {
        instance.container.chord_update_time(
          instance.entity,
          newProps.noteValue,
          newProps.dots,
          newProps.startNum,
          newProps.startDen,
          newProps.isTemporary,
        );
      }

      if (
        oldProps.isNote !== newProps.isNote ||
        oldProps.pitch !== newProps.pitch
      ) {
        if (newProps.isNote) {
          if (newProps.pitch == null) {
            instance.container.chord_set_unpitched(instance.entity);
          } else {
            instance.container.chord_set_pitch(
              instance.entity,
              newProps.pitch,
              newProps.pitchModifier ?? 0,
            );
          }
        } else {
          instance.container.chord_set_rest(instance.entity);
        }
      }
    }

    if (is(type, "bar", oldProps) && is(type, "bar", newProps)) {
      if (
        oldProps.skipNum !== newProps.skipNum ||
        oldProps.skipDen !== newProps.skipDen
      ) {
        if (newProps.skipNum != null && newProps.skipDen != null) {
          instance.container.bar_set_skip(
            instance.entity,
            newProps.skipNum,
            newProps.skipDen,
          );
        } else {
          instance.container.bar_clear_skip(instance.entity);
        }
      }
    }

    if (is(type, "signature", oldProps) && is(type, "signature", newProps)) {
      if (
        oldProps.clef !== newProps.clef ||
        oldProps.tsNum !== newProps.tsNum ||
        oldProps.tsDen !== newProps.tsDen ||
        oldProps.ks !== newProps.ks ||
        oldProps.barline !== newProps.barline
      ) {
        instance.container.signature_update(
          instance.entity,
          newProps.barline,
          newProps.clef,
          newProps.tsNum,
          newProps.tsDen,
          newProps.ks,
        );
      }
    }

    if (oldProps.className !== newProps.className) {
      if (newProps.className) {
        instance.container.css_set_class(instance.entity, newProps.className);
      } else {
        instance.container.css_clear_class(instance.entity);
      }
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

const roots = new Map<NativeSixDom, ReactReconciler.FiberRoot>();

export function render(whatToRender: any, container: NativeSixDom) {
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
