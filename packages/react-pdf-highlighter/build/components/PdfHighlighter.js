function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import React, { PureComponent } from "react";
import ReactDom from "react-dom";
import Pointable from "react-pointable";
import debounce from "lodash.debounce";
import { EventBus, PDFViewer, PDFLinkService } from "pdfjs-dist/web/pdf_viewer"; //$FlowFixMe

import "pdfjs-dist/web/pdf_viewer.css";
import "../style/pdf_viewer.css";
import "../style/PdfHighlighter.css";
import getBoundingRect from "../lib/get-bounding-rect";
import getClientRects from "../lib/get-client-rects";
import getAreaAsPng from "../lib/get-area-as-png";
import { asElement, getPageFromRange, getPageFromElement, getWindow, findOrCreateContainerLayer, isHTMLElement } from "../lib/pdfjs-dom";
import TipContainer from "./TipContainer";
import MouseSelection from "./MouseSelection";
import { scaledToViewport, viewportToScaled } from "../lib/coordinates";
const EMPTY_ID = "empty-id";

class PdfHighlighter extends PureComponent {
  constructor(props) {
    super(props);

    _defineProperty(this, "state", {
      ghostHighlight: null,
      isCollapsed: true,
      range: null,
      scrolledToHighlightId: EMPTY_ID,
      isAreaSelectionInProgress: false,
      tip: null,
      tipPosition: null,
      tipChildren: null
    });

    _defineProperty(this, "eventBus", new EventBus());

    _defineProperty(this, "linkService", new PDFLinkService({
      eventBus: this.eventBus
    }));

    _defineProperty(this, "viewer", void 0);

    _defineProperty(this, "resizeObserver", null);

    _defineProperty(this, "containerNode", null);

    _defineProperty(this, "unsubscribe", () => {});

    _defineProperty(this, "attachRef", ref => {
      const {
        eventBus,
        resizeObserver: observer
      } = this;
      this.containerNode = ref;
      this.unsubscribe();

      if (ref) {
        const {
          ownerDocument: doc
        } = ref;
        eventBus.on("textlayerrendered", this.onTextLayerRendered);
        eventBus.on("pagesinit", this.onDocumentReady);
        doc.addEventListener("selectionchange", this.onSelectionChange);
        doc.addEventListener("keydown", this.handleKeyDown);
        doc.defaultView.addEventListener("resize", this.debouncedScaleValue);
        if (observer) observer.observe(ref);

        this.unsubscribe = () => {
          eventBus.off("pagesinit", this.onDocumentReady);
          eventBus.off("textlayerrendered", this.onTextLayerRendered);
          doc.removeEventListener("selectionchange", this.onSelectionChange);
          doc.removeEventListener("keydown", this.handleKeyDown);
          doc.defaultView.removeEventListener("resize", this.debouncedScaleValue);
          if (observer) observer.disconnect();
        };
      }
    });

    _defineProperty(this, "hideTipAndSelection", () => {
      this.setState({
        tipPosition: null,
        tipChildren: null
      });
      this.setState({
        ghostHighlight: null,
        tip: null
      }, () => this.renderHighlights());
    });

    _defineProperty(this, "renderTip", () => {
      const {
        tipPosition,
        tipChildren
      } = this.state;
      if (!tipPosition) return null;
      const {
        boundingRect,
        pageNumber
      } = tipPosition;
      const page = {
        node: this.viewer.getPageView(pageNumber - 1).div
      };
      return /*#__PURE__*/React.createElement(TipContainer, {
        scrollTop: this.viewer.container.scrollTop,
        pageBoundingRect: page.node.getBoundingClientRect(),
        style: {
          left: page.node.offsetLeft + boundingRect.left + boundingRect.width / 2,
          top: boundingRect.top + page.node.offsetTop,
          bottom: boundingRect.top + page.node.offsetTop + boundingRect.height
        }
      }, tipChildren);
    });

    _defineProperty(this, "onTextLayerRendered", () => {
      this.renderHighlights();
    });

    _defineProperty(this, "scrollTo", highlight => {
      const {
        pageNumber,
        boundingRect,
        usePdfCoordinates
      } = highlight.position;
      this.viewer.container.removeEventListener("scroll", this.onScroll);
      const pageViewport = this.viewer.getPageView(pageNumber - 1).viewport;
      const scrollMargin = 10;
      this.viewer.scrollPageIntoView({
        pageNumber,
        destArray: [null, {
          name: "XYZ"
        }, ...pageViewport.convertToPdfPoint(0, scaledToViewport(boundingRect, pageViewport, usePdfCoordinates).top - scrollMargin), 0]
      });
      this.setState({
        scrolledToHighlightId: highlight.id
      }, () => this.renderHighlights()); // wait for scrolling to finish

      setTimeout(() => {
        this.viewer.container.addEventListener("scroll", this.onScroll);
      }, 100);
    });

    _defineProperty(this, "onDocumentReady", () => {
      const {
        scrollRef
      } = this.props;
      this.handleScaleValue();
      scrollRef(this.scrollTo);
    });

    _defineProperty(this, "onSelectionChange", () => {
      const container = this.containerNode;
      const selection = getWindow(container).getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      if (selection.isCollapsed) {
        this.setState({
          isCollapsed: true
        });
        return;
      }

      if (!range || !container || !container.contains(range.commonAncestorContainer)) {
        return;
      }

      this.setState({
        isCollapsed: false,
        range
      });
      this.debouncedAfterSelection();
    });

    _defineProperty(this, "onScroll", () => {
      const {
        onScrollChange
      } = this.props;
      onScrollChange();
      this.setState({
        scrolledToHighlightId: EMPTY_ID
      }, () => this.renderHighlights());
      this.viewer.container.removeEventListener("scroll", this.onScroll);
    });

    _defineProperty(this, "onMouseDown", event => {
      if (!isHTMLElement(event.target)) {
        return;
      }

      if (asElement(event.target).closest(".PdfHighlighter__tip-container")) {
        return;
      }

      this.hideTipAndSelection();
    });

    _defineProperty(this, "handleKeyDown", event => {
      if (event.code === "Escape") {
        this.hideTipAndSelection();
      }
    });

    _defineProperty(this, "afterSelection", () => {
      const {
        onSelectionFinished
      } = this.props;
      const {
        isCollapsed,
        range
      } = this.state;

      if (!range || isCollapsed) {
        return;
      }

      const page = getPageFromRange(range);

      if (!page) {
        return;
      }

      const rects = getClientRects(range, page.node);

      if (rects.length === 0) {
        return;
      }

      const boundingRect = getBoundingRect(rects);
      const viewportPosition = {
        boundingRect,
        rects,
        pageNumber: page.number
      };
      const content = {
        text: range.toString()
      };
      const scaledPosition = this.viewportPositionToScaled(viewportPosition);
      this.setTip(viewportPosition, onSelectionFinished(scaledPosition, content, () => this.hideTipAndSelection(), () => this.setState({
        ghostHighlight: {
          position: scaledPosition
        }
      }, () => this.renderHighlights())));
    });

    _defineProperty(this, "debouncedAfterSelection", debounce(this.afterSelection, 500));

    _defineProperty(this, "handleScaleValue", () => {
      if (this.viewer) {
        this.viewer.currentScaleValue = this.props.pdfScaleValue; //"page-width";
      }
    });

    _defineProperty(this, "debouncedScaleValue", debounce(this.handleScaleValue, 500));

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.debouncedScaleValue);
    }
  }

  componentDidMount() {
    this.init();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.pdfDocument !== this.props.pdfDocument) {
      this.init();
      return;
    }

    if (prevProps.highlights !== this.props.highlights) {
      this.renderHighlights(this.props);
    }
  }

  init() {
    const {
      pdfDocument
    } = this.props;
    this.viewer = this.viewer || new PDFViewer({
      container: this.containerNode,
      eventBus: this.eventBus,
      enhanceTextSelection: true,
      removePageBorders: true,
      linkService: this.linkService
    });
    this.linkService.setDocument(pdfDocument);
    this.linkService.setViewer(this.viewer);
    this.viewer.setDocument(pdfDocument); // debug

    window.PdfViewer = this;
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  findOrCreateHighlightLayer(page) {
    const {
      textLayer
    } = this.viewer.getPageView(page - 1) || {};

    if (!textLayer) {
      return null;
    }

    return findOrCreateContainerLayer(textLayer.textLayerDiv, "PdfHighlighter__highlight-layer");
  }

  groupHighlightsByPage(highlights) {
    const {
      ghostHighlight
    } = this.state;
    return [...highlights, ghostHighlight].filter(Boolean).reduce((res, highlight) => {
      const {
        pageNumber
      } = highlight.position;
      res[pageNumber] = res[pageNumber] || [];
      res[pageNumber].push(highlight);
      return res;
    }, {});
  }

  showTip(highlight, content) {
    const {
      isCollapsed,
      ghostHighlight,
      isAreaSelectionInProgress
    } = this.state;
    const highlightInProgress = !isCollapsed || ghostHighlight;

    if (highlightInProgress || isAreaSelectionInProgress) {
      return;
    }

    this.setTip(highlight.position, content);
  }

  scaledPositionToViewport({
    pageNumber,
    boundingRect,
    rects,
    usePdfCoordinates
  }) {
    const viewport = this.viewer.getPageView(pageNumber - 1).viewport;
    return {
      boundingRect: scaledToViewport(boundingRect, viewport, usePdfCoordinates),
      rects: (rects || []).map(rect => scaledToViewport(rect, viewport, usePdfCoordinates)),
      pageNumber
    };
  }

  viewportPositionToScaled({
    pageNumber,
    boundingRect,
    rects
  }) {
    const viewport = this.viewer.getPageView(pageNumber - 1).viewport;
    return {
      boundingRect: viewportToScaled(boundingRect, viewport),
      rects: (rects || []).map(rect => viewportToScaled(rect, viewport)),
      pageNumber
    };
  }

  screenshot(position, pageNumber) {
    const canvas = this.viewer.getPageView(pageNumber - 1).canvas;
    return getAreaAsPng(canvas, position);
  }

  renderHighlights(nextProps) {
    const {
      highlightTransform,
      highlights
    } = nextProps || this.props;
    const {
      pdfDocument
    } = this.props;
    const {
      tip,
      scrolledToHighlightId
    } = this.state;
    const highlightsByPage = this.groupHighlightsByPage(highlights);

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const highlightLayer = this.findOrCreateHighlightLayer(pageNumber);

      if (highlightLayer) {
        ReactDom.render( /*#__PURE__*/React.createElement("div", null, (highlightsByPage[String(pageNumber)] || []).map(({
          position,
          id,
          ...highlight
        }, index) => {
          const viewportHighlight = {
            id,
            position: this.scaledPositionToViewport(position),
            ...highlight
          };

          if (tip && tip.highlight.id === String(id)) {
            this.showTip(tip.highlight, tip.callback(viewportHighlight));
          }

          const isScrolledTo = Boolean(scrolledToHighlightId === id);
          return highlightTransform(viewportHighlight, index, (highlight, callback) => {
            this.setState({
              tip: {
                highlight,
                callback
              }
            });
            this.showTip(highlight, callback(highlight));
          }, this.hideTipAndSelection, rect => {
            const viewport = this.viewer.getPageView(pageNumber - 1).viewport;
            return viewportToScaled(rect, viewport);
          }, boundingRect => this.screenshot(boundingRect, pageNumber), isScrolledTo);
        })), highlightLayer);
      }
    }
  }

  setTip(position, inner) {
    this.setState({
      tipPosition: position,
      tipChildren: inner
    });
  }

  toggleTextSelection(flag) {
    this.viewer.viewer.classList.toggle("PdfHighlighter--disable-selection", flag);
  }

  render() {
    const {
      onSelectionFinished,
      enableAreaSelection
    } = this.props;
    return /*#__PURE__*/React.createElement(Pointable, {
      onPointerDown: this.onMouseDown
    }, /*#__PURE__*/React.createElement("div", {
      ref: this.attachRef,
      className: "PdfHighlighter",
      onContextMenu: e => e.preventDefault()
    }, /*#__PURE__*/React.createElement("div", {
      className: "pdfViewer"
    }), this.renderTip(), typeof enableAreaSelection === "function" ? /*#__PURE__*/React.createElement(MouseSelection, {
      onDragStart: () => this.toggleTextSelection(true),
      onDragEnd: () => this.toggleTextSelection(false),
      onChange: isVisible => this.setState({
        isAreaSelectionInProgress: isVisible
      }),
      shouldStart: event => enableAreaSelection(event) && isHTMLElement(event.target) && Boolean(asElement(event.target).closest(".page")),
      onSelection: (startTarget, boundingRect, resetSelection) => {
        const page = getPageFromElement(startTarget);

        if (!page) {
          return;
        }

        const pageBoundingRect = { ...boundingRect,
          top: boundingRect.top - page.node.offsetTop,
          left: boundingRect.left - page.node.offsetLeft
        };
        const viewportPosition = {
          boundingRect: pageBoundingRect,
          rects: [],
          pageNumber: page.number
        };
        const scaledPosition = this.viewportPositionToScaled(viewportPosition);
        const image = this.screenshot(pageBoundingRect, page.number);
        this.setTip(viewportPosition, onSelectionFinished(scaledPosition, {
          image
        }, () => this.hideTipAndSelection(), () => this.setState({
          ghostHighlight: {
            position: scaledPosition,
            content: {
              image
            }
          }
        }, () => {
          resetSelection();
          this.renderHighlights();
        })));
      }
    }) : null));
  }

}

_defineProperty(PdfHighlighter, "defaultProps", {
  pdfScaleValue: "auto"
});

export default PdfHighlighter;