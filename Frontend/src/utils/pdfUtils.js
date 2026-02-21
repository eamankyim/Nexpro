import html2pdf from 'html2pdf.js';

/**
 * Generate a PDF from an HTML element
 * @param {HTMLElement} element - The HTML element to convert to PDF
 * @param {Object} options - PDF generation options
 * @param {string} options.filename - The filename for the PDF (default: 'document.pdf')
 * @param {string} options.format - Page format (default: 'a4')
 * @param {string} options.orientation - Page orientation: 'portrait' or 'landscape' (default: 'portrait')
 * @param {number} options.scale - Scale factor for rendering (default: 2)
 * @param {boolean} options.download - Whether to download immediately (default: true)
 * @returns {Promise} - Promise that resolves when PDF is generated
 */
export const generatePDF = async (element, options = {}) => {
  const {
    filename = 'document.pdf',
    format = 'a4',
    orientation = 'portrait',
    scale = 2,
    download = true,
  } = options;

  // Store original styles
  const originalWidth = element.style.width;
  const originalMaxWidth = element.style.maxWidth;
  const originalPadding = element.style.padding;
  
  // Set fixed width for PDF generation (A4 width minus margins = ~190mm = ~718px at 96dpi)
  element.style.width = '190mm';
  element.style.maxWidth = '190mm';
  element.style.padding = '10mm';

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale,
      useCORS: true,
      logging: false,
      letterRendering: true,
      windowWidth: 794, // A4 width in pixels at 96dpi
    },
    jsPDF: { 
      unit: 'mm', 
      format, 
      orientation,
      compress: true,
    },
    pagebreak: { 
      mode: 'avoid-all',
    },
  };

  try {
    if (download) {
      await html2pdf().set(opt).from(element).save();
    } else {
      return await html2pdf().set(opt).from(element).outputPdf('blob');
    }
  } finally {
    // Restore original styles
    element.style.width = originalWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.padding = originalPadding;
  }
};

/**
 * Generate PDF from a specific element by selector
 * @param {string} selector - CSS selector for the element
 * @param {Object} options - PDF generation options
 */
export const generatePDFFromSelector = async (selector, options = {}) => {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return generatePDF(element, options);
};

/**
 * Open PDF in a new window for printing
 * @param {HTMLElement} element - The HTML element to convert to PDF
 * @param {Object} options - PDF generation options
 */
export const printPDF = async (element, options = {}) => {
  const opt = {
    margin: [10, 10, 10, 10],
    filename: options.filename || 'document.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: options.scale || 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: { 
      unit: 'mm', 
      format: options.format || 'a4', 
      orientation: options.orientation || 'portrait',
    },
  };

  const pdf = await html2pdf().set(opt).from(element).outputPdf('blob');
  const pdfUrl = URL.createObjectURL(pdf);
  
  // Open in new window and trigger print
  const printWindow = window.open(pdfUrl);
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  return pdf;
};

/**
 * Open native print dialog with the given element's content (no PDF download)
 * @param {HTMLElement} element - Element containing printable content (with styles if needed)
 * @param {string} [title='Print'] - Document title for the print window
 */
export const openPrintDialog = (element, title = 'Print') => {
  if (!element) return;
  const content = element.innerHTML;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 8px; font-family: Arial, sans-serif; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.onafterprint = () => printWindow.close();
};

export default {
  generatePDF,
  generatePDFFromSelector,
  printPDF,
  openPrintDialog,
};
