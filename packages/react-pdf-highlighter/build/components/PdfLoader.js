function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import React, { Component } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/lib/pdf";
import PdfjsWorker from "pdfjs-dist/lib/pdf.worker";
setPdfWorker(PdfjsWorker);
export function setPdfWorker(workerSrcOrClass) {
  if (typeof window !== "undefined") delete window.pdfjsWorker;
  delete GlobalWorkerOptions.workerSrc;
  delete GlobalWorkerOptions.workerPort;

  if (typeof workerSrcOrClass === "string") {
    GlobalWorkerOptions.workerSrc = workerSrcOrClass;
  } else if (typeof workerSrcOrClass === "function") {
    GlobalWorkerOptions.workerPort = workerSrcOrClass();
  } else if (workerSrcOrClass instanceof Worker) {
    GlobalWorkerOptions.workerPort = workerSrcOrClass;
  } else if (typeof window !== "undefined" && workerSrcOrClass) {
    window.pdfjsWorker = workerSrcOrClass;
  }
}

class PdfLoader extends Component {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "state", {
      pdfDocument: null,
      error: null
    });

    _defineProperty(this, "documentRef", /*#__PURE__*/React.createRef());
  }

  componentDidMount() {
    this.load();
  }

  componentWillUnmount() {
    const {
      pdfDocument: discardedDocument
    } = this.state;

    if (discardedDocument) {
      discardedDocument.destroy();
    }
  }

  componentDidUpdate({
    url
  }) {
    if (this.props.url !== url) {
      this.load();
    }
  }

  componentDidCatch(error, info) {
    const {
      onError
    } = this.props;

    if (onError) {
      onError(error);
    }

    this.setState({
      pdfDocument: null,
      error
    });
  }

  load() {
    const {
      ownerDocument = document
    } = this.documentRef.current || {};
    const {
      url
    } = this.props;
    const {
      pdfDocument: discardedDocument
    } = this.state;
    this.setState({
      pdfDocument: null,
      error: null
    });
    Promise.resolve().then(() => discardedDocument && discardedDocument.destroy()).then(() => url && getDocument({
      url,
      ownerDocument
    }).promise.then(pdfDocument => {
      this.setState({
        pdfDocument
      });
    })).catch(e => this.componentDidCatch(e));
  }

  render() {
    const {
      children,
      beforeLoad
    } = this.props;
    const {
      pdfDocument,
      error
    } = this.state;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      ref: this.documentRef
    }), error ? this.renderError() : !pdfDocument || !children ? beforeLoad : children(pdfDocument));
  }

  renderError() {
    const {
      errorMessage
    } = this.props;

    if (errorMessage) {
      return /*#__PURE__*/React.cloneElement(errorMessage, {
        error: this.state.error
      });
    }

    return null;
  }

}

export default PdfLoader;