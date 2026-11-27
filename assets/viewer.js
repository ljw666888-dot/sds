(function () {
  var cfg = window.SDS_CONFIG || {};
  var pdfUrl = cfg.pdfUrl;
  var fileName = cfg.fileName || "sds.pdf";

  var statusBox = document.getElementById("status-box");
  var statusText = document.getElementById("status-text");
  var pageInfo = document.getElementById("page-info");
  var pagesContainer = document.getElementById("pages-container");
  var zoomOutBtn = document.getElementById("zoom-out");
  var zoomInBtn = document.getElementById("zoom-in");
  var zoomFitBtn = document.getElementById("zoom-fit");
  var zoomValEl = document.getElementById("zoom-val");

  var pdfDoc = null;
  var zoomFactor = 1.0;
  var renderingToken = 0;

  function showError(msg) {
    statusBox.className = "status-box error-box";
    statusBox.style.display = "block";
    statusBox.innerHTML =
      '<div style="font-weight:700;margin-bottom:8px;">在线预览加载失败</div>' +
      '<div style="font-size:13px;margin-bottom:14px;">' + msg + "</div>" +
      '<a class="btn btn-primary" href="' + pdfUrl + '" download="' + fileName + '">点击直接打开 / 下载原版 PDF</a>';
  }

  function updateZoomLabel() {
    if (zoomValEl) {
      zoomValEl.textContent = Math.round(zoomFactor * 100) + "%";
    }
  }

  function renderAllPages() {
    if (!pdfDoc) return;
    var myToken = ++renderingToken;
    pagesContainer.innerHTML = "";
    updateZoomLabel();

    var containerWidth = Math.min(
      Math.max((pagesContainer.clientWidth || window.innerWidth) - 8, 280),
      920
    );
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var total = pdfDoc.numPages;

    function renderPage(num) {
      if (myToken !== renderingToken) return Promise.resolve();
      return pdfDoc.getPage(num).then(function (page) {
        if (myToken !== renderingToken) return;
        var unscaled = page.getViewport({ scale: 1 });
        var fitScale = containerWidth / unscaled.width;
        var cssScale = fitScale * zoomFactor;
        var renderViewport = page.getViewport({ scale: cssScale * dpr });
        var cssWidth = Math.floor(unscaled.width * cssScale);
        var cssHeight = Math.floor(unscaled.height * cssScale);

        var card = document.createElement("div");
        card.className = "pdf-page-card";
        card.style.width = cssWidth + "px";

        var canvas = document.createElement("canvas");
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = cssWidth + "px";
        canvas.style.height = cssHeight + "px";

        var tag = document.createElement("div");
        tag.className = "page-tag";
        tag.textContent = "第 " + num + " / " + total + " 页";

        card.appendChild(canvas);
        card.appendChild(tag);
        pagesContainer.appendChild(card);

        var ctx = canvas.getContext("2d");
        return page.render({ canvasContext: ctx, viewport: renderViewport }).promise.then(function () {
          if (num === 1 && myToken === renderingToken) {
            statusBox.style.display = "none";
          }
          if (pageInfo && myToken === renderingToken) {
            pageInfo.textContent = "共 " + total + " 页（已加载 " + num + "/" + total + "）";
          }
          if (num < total) {
            return renderPage(num + 1);
          } else if (pageInfo && myToken === renderingToken) {
            pageInfo.textContent = "共 " + total + " 页";
          }
        });
      });
    }

    renderPage(1).catch(function (err) {
      if (myToken === renderingToken) {
        showError("渲染出错：" + (err && err.message ? err.message : String(err)));
      }
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", function () {
      zoomFactor = Math.max(0.6, +(zoomFactor - 0.2).toFixed(2));
      renderAllPages();
    });
  }
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", function () {
      zoomFactor = Math.min(2.4, +(zoomFactor + 0.2).toFixed(2));
      renderAllPages();
    });
  }
  if (zoomFitBtn) {
    zoomFitBtn.addEventListener("click", function () {
      zoomFactor = 1.0;
      renderAllPages();
    });
  }

  if (typeof window.pdfjsLib === "undefined") {
    showError("PDF 预览组件未能加载，请点击下方按钮直接打开 PDF 文件。");
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "../vendor/pdf.worker.min.js";

  var loadingTask = window.pdfjsLib.getDocument({
    url: pdfUrl,
    disableRange: false,
    disableStream: false
  });

  loadingTask.onProgress = function (p) {
    if (statusText && p && p.total) {
      var pct = Math.min(100, Math.round((p.loaded / p.total) * 100));
      statusText.textContent = "正在加载说明书 (" + pct + "%)...";
    }
  };

  loadingTask.promise
    .then(function (pdf) {
      pdfDoc = pdf;
      if (pageInfo) pageInfo.textContent = "共 " + pdf.numPages + " 页";
      renderAllPages();
    })
    .catch(function (err) {
      showError("无法读取 PDF 文件：" + (err && err.message ? err.message : String(err)));
    });
})();
