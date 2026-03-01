type ComponentChild = Node | string | number | boolean | null | undefined;

export interface BaseProps {
  children?: ComponentChild | ComponentChild[];
}

export type ComponentFactory<P = any> = (props: P & BaseProps) => Node;

// Map all HTML tags to their specific HTML elements
export type IntrinsicElementsHTML = {
  [K in keyof HTMLElementTagNameMap]: Omit<
    Partial<HTMLElementTagNameMap[K]>,
    "style" | "className" | "children"
  > & {
    class?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration> | string;
    [key: string]: any; // Allow data-* or other custom attributes
  };
};

export type IntrinsicElementsSVG = {
  [K in keyof SVGElementTagNameMap]: Record<string, any>;
};

// DO NOT define JSX.Element! This allows TS 5.1 to infer the exact return type from the factory.
declare global {
  namespace JSX {
    interface IntrinsicElements extends IntrinsicElementsHTML, Omit<IntrinsicElementsSVG, keyof IntrinsicElementsHTML> {}
  }
}

// The generic h factory that infers the specific element
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: IntrinsicElementsHTML[K] | null,
  ...children: ComponentChild[]
): HTMLElementTagNameMap[K];
export function h<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: IntrinsicElementsSVG[K] | null,
  ...children: ComponentChild[]
): SVGElementTagNameMap[K];
export function h<P>(
  tag: ComponentFactory<P>,
  attrs: P | null,
  ...children: ComponentChild[]
): ReturnType<ComponentFactory<P>>;
export function h(tag: any, attrs: any, ...children: any[]): Node {
  if (typeof tag === "function") {
    return tag({ ...attrs, children });
  }

  const isSvg = tag === "svg" || tag === "path" || tag === "g" || tag === "circle" || tag === "rect" || tag === "line" || tag === "polygon" || tag === "polyline";
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tag)
    : document.createElement(tag);

  if (attrs) {
    for (const name of Object.keys(attrs)) {
      const value = attrs[name];
      if (name === "style" && typeof value === "object") {
        Object.assign((element as HTMLElement).style, value);
      } else if (name === "class" || name === "className") {
        element.setAttribute("class", value as string);
      } else if (name.startsWith("on") && typeof value === "function") {
        const eventName = name.toLowerCase().substring(2);
        element.addEventListener(eventName, value as EventListener);
      } else if (value !== false && value != null) {
        if (isSvg) {
          element.setAttributeNS(null, name, value === true ? name : String(value));
        } else {
          element.setAttribute(name, value === true ? name : String(value));
        }
      }
    }
  }

  const appendChildren = (node: Node, childList: any[]) => {
    for (const child of childList) {
      if (child == null || child === false) continue;
      if (Array.isArray(child)) {
        appendChildren(node, child);
      } else if (child instanceof Node) {
        node.appendChild(child);
      } else {
        node.appendChild(document.createTextNode(String(child)));
      }
    }
  };

  appendChildren(element, children);
  return element;
}

export const Fragment = (props: { children?: ComponentChild | ComponentChild[] }) => {
  const frag = document.createDocumentFragment();
  const appendChildren = (node: Node, childList: any[]) => {
    for (const child of childList) {
      if (child == null || child === false) continue;
      if (Array.isArray(child)) {
        appendChildren(node, child);
      } else if (child instanceof Node) {
        node.appendChild(child);
      } else {
        node.appendChild(document.createTextNode(String(child)));
      }
    }
  };
  if (props.children) {
    appendChildren(frag, Array.isArray(props.children) ? props.children : [props.children]);
  }
  return frag;
};
