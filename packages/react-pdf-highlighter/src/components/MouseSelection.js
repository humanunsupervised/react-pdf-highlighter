// @flow

import React, { Component } from "react";

import { asElement, isHTMLElement } from "../lib/pdfjs-dom";
import styles from "../style/MouseSelection.module.css";

import type { T_LTWH } from "../types.js";

type Coords = {
  x: number,
  y: number
};

type State = {
  locked: boolean,
  start: ?Coords,
  end: ?Coords
};

type Props = {
  onSelection: (
    startTarget: HTMLElement,
    boundingRect: T_LTWH,
    resetSelection: () => void
  ) => void,
  onDragStart: () => void,
  onDragEnd: () => void,
  shouldStart: (event: MouseEvent) => boolean,
  onChange: (isVisible: boolean) => void
};

class MouseSelection extends Component<Props, State> {
  state: State = {
    locked: false,
    start: null,
    end: null,
    startTarget: null
  };

  root: ?HTMLElement;

  reset = () => {
    const { onDragEnd } = this.props;

    onDragEnd();
    this.setState({ start: null, end: null, locked: false });
  };

  getBoundingRect(start: Coords, end: Coords): T_LTWH {
    return {
      left: Math.min(end.x, start.x),
      top: Math.min(end.y, start.y),

      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }

  getContainer = () => asElement(this.root.parentElement);

  getContainerCoords = (
    pageX: number,
    pageY: number,
    container?: HTMLElement
  ) => {
    const containerElem = container || this.getContainer();
    let containerBoundingRect = null;

    if (!containerBoundingRect) {
      containerBoundingRect = containerElem.getBoundingClientRect();
    }

    return {
      x: pageX - containerBoundingRect.left + containerElem.scrollLeft,
      y: pageY - containerBoundingRect.top + containerElem.scrollTop
    };
  };

  onMouseMove = (event: MouseEvent) => {
    const { start, locked } = this.state;

    if (!start || locked) {
      return;
    }

    this.setState({
      ...this.state,
      end: this.getContainerCoords(event.pageX, event.pageY)
    });
  };

  onMouseUp = (event: MouseEvent) => {
    const { onSelection, onDragEnd } = this.props;
    // emulate listen once
    event.currentTarget.removeEventListener("mouseup", this.onMouseUp);

    const { start } = this.state;

    if (!start) {
      return;
    }

    const container = this.getContainer();
    const end = this.getContainerCoords(event.pageX, event.pageY, container);

    const boundingRect = this.getBoundingRect(start, end);

    if (
      !isHTMLElement(event.target) ||
      !container.contains(asElement(event.target)) ||
      !this.shouldRender(boundingRect)
    ) {
      this.reset();
      return;
    }

    this.setState(
      {
        end,
        locked: true
      },
      () => {
        const { start, end } = this.state;

        if (!start || !end) {
          return;
        }

        if (isHTMLElement(event.target)) {
          onSelection(this.state.startTarget, boundingRect, this.reset);

          onDragEnd();
          this.setState({
            startTarget: null
          });
        }
      }
    );
  };

  onMouseDown = (event: MouseEvent) => {
    const { onDragStart, shouldStart } = this.props;
    if (!shouldStart(event)) {
      this.reset();
      return;
    }

    const startTarget = asElement(event.target);
    if (!isHTMLElement(startTarget)) {
      return;
    }

    const container = this.getContainer();

    onDragStart();

    this.setState({
      start: this.getContainerCoords(event.pageX, event.pageY, container),
      end: null,
      locked: false,
      startTarget
    });

    const { ownerDocument: doc } = container;
    if (doc.body) {
      doc.body.addEventListener("mouseup", this.onMouseUp);
    }
  };

  componentDidUpdate() {
    const { onChange } = this.props;
    const { start, end } = this.state;

    const isVisible = Boolean(start && end);

    onChange(isVisible);
  }

  componentDidMount() {
    if (!this.root) {
      return;
    }

    const that = this;

    const container = asElement(this.root.parentElement);

    if (!isHTMLElement(container)) {
      return;
    }

    container.addEventListener("mousemove", this.onMouseMove);
    container.addEventListener("mousedown", this.onMouseDown);
  }

  componentWillUnmount() {
    console.log("Mouse selection will unmount, remove event listeners");
    const container = asElement(this.root.parentElement);
    if (!container) return;

    container.removeEventListener("mousemove", this.onMouseMove);
    container.removeEventListener("mousedown", this.onMouseDown);

    if (container.ownerDocument.body)
      container.ownerDocument.body.removeEventListener(
        "mouseup",
        this.onMouseUp
      );
  }

  shouldRender(boundingRect: T_LTWH) {
    return boundingRect.width >= 1 && boundingRect.height >= 1;
  }

  render() {
    const { start, end } = this.state;

    return (
      <div
        ref={node => (this.root = node)}
      >
        {start && end ? (
          <div
            className={styles.root}
            style={this.getBoundingRect(start, end)}
          />
        ) : null}
      </div>
    );
  }
}

export default MouseSelection;
