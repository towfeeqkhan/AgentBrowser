declare namespace Protocol {
  namespace Accessibility {
    interface AXValueSource {
      type: string;
      value?: unknown;
    }

    interface AXValue {
      type: string;
      value?: unknown;
      sources?: AXValueSource[];
    }

    interface AXProperty {
      name: string;
      value: AXValue;
    }

    interface AXNode {
      nodeId: string;
      backendDOMNodeId?: number;
      ignored?: boolean;
      role?: AXValue;
      name?: AXValue;
      properties?: AXProperty[];
      childIds?: string[];
    }
  }
}
