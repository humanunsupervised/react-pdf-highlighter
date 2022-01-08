import React, { Component } from "react";
import "../style/Highlight.css";

class Highlight extends Component {
  render() {
    const {
      position,
      onClick,
      onMouseOver,
      onMouseOut,
      comment,
      isScrolledTo
    } = this.props;
    const {
      rects,
      boundingRect
    } = position;
    return /*#__PURE__*/React.createElement("div", {
      className: `Highlight ${isScrolledTo ? "Highlight--scrolledTo" : ""}`
    }, comment ? /*#__PURE__*/React.createElement("div", {
      className: "Highlight__emoji",
      style: {
        left: 20,
        top: boundingRect.top
      }
    }, comment.emoji) : null, /*#__PURE__*/React.createElement("div", {
      className: "Highlight__parts"
    }, rects.map((rect, index) => /*#__PURE__*/React.createElement("div", {
      onMouseOver: onMouseOver,
      onMouseOut: onMouseOut,
      onClick: onClick,
      key: index,
      style: rect,
      className: `Highlight__part`
    }))));
  }

}

export default Highlight;