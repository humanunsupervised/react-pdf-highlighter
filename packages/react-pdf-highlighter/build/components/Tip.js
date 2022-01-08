function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import React, { Component } from "react";
import "../style/Tip.css";

class Tip extends Component {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "state", {
      compact: true,
      text: "",
      emoji: ""
    });
  }

  // for TipContainer
  componentDidUpdate(nextProps, nextState) {
    const {
      onUpdate
    } = this.props;

    if (onUpdate && this.state.compact !== nextState.compact) {
      onUpdate();
    }
  }

  render() {
    const {
      onConfirm,
      onOpen
    } = this.props;
    const {
      compact,
      text,
      emoji
    } = this.state;
    return /*#__PURE__*/React.createElement("div", {
      className: "Tip"
    }, compact ? /*#__PURE__*/React.createElement("div", {
      className: "Tip__compact",
      onClick: () => {
        onOpen();
        this.setState({
          compact: false
        });
      }
    }, "Add highlight") : /*#__PURE__*/React.createElement("form", {
      className: "Tip__card",
      onSubmit: event => {
        event.preventDefault();
        onConfirm({
          text,
          emoji
        });
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("textarea", {
      width: "100%",
      placeholder: "Your comment",
      autoFocus: true,
      value: text,
      onChange: event => this.setState({
        text: event.target.value
      }),
      ref: node => {
        if (node) {
          node.focus();
        }
      }
    }), /*#__PURE__*/React.createElement("div", null, ["💩", "😱", "😍", "🔥", "😳", "⚠️"].map(_emoji => /*#__PURE__*/React.createElement("label", {
      key: _emoji
    }, /*#__PURE__*/React.createElement("input", {
      checked: emoji === _emoji,
      type: "radio",
      name: "emoji",
      value: _emoji,
      onChange: event => this.setState({
        emoji: event.target.value
      })
    }), _emoji)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
      type: "submit",
      value: "Save"
    }))));
  }

}

export default Tip;