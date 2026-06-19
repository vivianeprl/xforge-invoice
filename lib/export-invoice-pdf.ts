const CAPTURE_STYLE_PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-right-width",
  "border-right-style",
  "border-right-color",
  "border-bottom-width",
  "border-bottom-style",
  "border-bottom-color",
  "border-left-width",
  "border-left-style",
  "border-left-color",
  "border-radius",
  "box-shadow",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "display",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-self",
  "gap",
  "flex",
  "grid-template-columns",
  "grid-template-rows",
  "overflow",
  "white-space",
  "word-break",
  "vertical-align",
  "border-collapse",
  "table-layout",
] as const;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load captured image"));
    img.src = dataUrl;
  });
}

function prepareCloneForHtml2Canvas(doc: Document, root: HTMLElement) {
  const view = doc.defaultView;
  if (!view) return;

  const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const computed = view.getComputedStyle(node);
    for (const prop of CAPTURE_STYLE_PROPS) {
      node.style.setProperty(prop, computed.getPropertyValue(prop));
    }
    node.removeAttribute("class");
  }

  doc.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => {
    el.remove();
  });
}

async function captureWithModernScreenshot(
  element: HTMLElement,
): Promise<string> {
  const { domToPng } = await import("modern-screenshot");
  return domToPng(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    style: {
      margin: "0",
      boxShadow: "none",
    },
  });
}

async function captureWithHtml2Canvas(element: HTMLElement): Promise<string> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
    onclone: (doc, cloned) => {
      prepareCloneForHtml2Canvas(doc, cloned);
    },
  });
  return canvas.toDataURL("image/png");
}

async function captureInvoiceImage(element: HTMLElement): Promise<string> {
  try {
    const dataUrl = await captureWithModernScreenshot(element);
    if (dataUrl && dataUrl.length > 100) return dataUrl;
  } catch (error) {
    console.warn("modern-screenshot failed, falling back to html2canvas:", error);
  }

  return captureWithHtml2Canvas(element);
}

export async function exportInvoicePdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const dataUrl = await captureInvoiceImage(element);
  const img = await loadImage(dataUrl);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  const aspect = img.height / img.width;
  let renderWidth = maxWidth;
  let renderHeight = renderWidth * aspect;

  if (renderHeight > maxHeight) {
    renderHeight = maxHeight;
    renderWidth = renderHeight / aspect;
  }

  pdf.addImage(
    dataUrl,
    "PNG",
    (pageWidth - renderWidth) / 2,
    margin,
    renderWidth,
    renderHeight,
  );
  pdf.save(filename);
}
