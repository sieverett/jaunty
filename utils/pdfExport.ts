/**
 * PDF Export Utility
 * 
 * Exports the Forecast Overview panel as a PDF using jsPDF and html2canvas
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ForecastResponse } from '../types';

interface ExportOptions {
  filename?: string;
  includeMetadata?: boolean;
  user?: {
    name: string;
    email: string;
  };
  scenarioName?: string;
}

/**
 * Export Forecast Overview panel to PDF
 * 
 * @param elementId - ID of the element to export (should be the Forecast Overview panel)
 * @param data - Forecast data for metadata
 * @param options - Export options
 */
export async function exportForecastToPDF(
  elementId: string,
  data: ForecastResponse,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename,
    includeMetadata = true,
    user,
    scenarioName
  } = options;

  try {
    // Get the element to export
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    // Show loading indicator (optional - can be handled by caller)
    element.style.opacity = '0.7';
    element.style.transition = 'opacity 0.3s';

    // Wait a bit for any animations to complete and for styles to compute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the exact dimensions and position of the original element
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    // Create a container that matches the exact viewport conditions
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '0px';
    tempContainer.style.top = '0px';
    tempContainer.style.width = window.innerWidth + 'px';
    tempContainer.style.height = window.innerHeight + 'px';
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.overflow = 'hidden';
    tempContainer.style.zIndex = '99999';
    
    // Deep clone the element with all its children
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Preserve exact positioning and dimensions
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = rect.left + 'px';
    clonedElement.style.top = rect.top + 'px';
    clonedElement.style.width = rect.width + 'px';
    clonedElement.style.height = 'auto';
    clonedElement.style.margin = '0';
    clonedElement.style.transform = 'none';
    
    // Remove style/link tags that might cause issues, but preserve inline styles
    clonedElement.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
    
    // Convert all computed styles to inline styles to preserve exact appearance
    convertAllStylesToInline(clonedElement, element);
    
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);
    
    // Wait longer for everything to render properly
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Force a reflow to ensure all styles are applied
    clonedElement.offsetHeight;

    // Temporarily disable ALL stylesheets to prevent html2canvas from reading oklch CSS
    // This is aggressive but necessary since html2canvas parses CSS directly
    const styleSheets = Array.from(document.styleSheets);
    const disabledSheets: StyleSheet[] = [];
    const removedStyleNodes: HTMLElement[] = [];
    const removedLinkNodes: HTMLElement[] = [];
    const hiddenHeadNodes: HTMLElement[] = [];
    
    try {
      // Disable all stylesheets and remove style/link nodes temporarily
      styleSheets.forEach((sheet) => {
        try {
          const ownerNode = sheet.ownerNode as HTMLElement;
          if (ownerNode) {
            if (ownerNode.tagName === 'STYLE') {
              const styleNode = ownerNode as HTMLStyleElement;
              // Check if it contains oklch or is a stylesheet
              if (styleNode.textContent?.includes('oklch') || styleNode.sheet) {
                // Temporarily hide from DOM
                ownerNode.style.display = 'none';
                ownerNode.setAttribute('data-pdf-export-hidden', 'true');
                removedStyleNodes.push(ownerNode);
                (sheet as any).disabled = true;
                disabledSheets.push(sheet);
              }
            } else if (ownerNode.tagName === 'LINK') {
              const linkNode = ownerNode as HTMLLinkElement;
              if (linkNode.rel === 'stylesheet') {
                // Temporarily hide from DOM
                ownerNode.style.display = 'none';
                ownerNode.setAttribute('data-pdf-export-hidden', 'true');
                removedLinkNodes.push(ownerNode);
                (sheet as any).disabled = true;
                disabledSheets.push(sheet);
              }
            }
          }
        } catch (e) {
          // Can't access some stylesheets (cross-origin), ignore
        }
      });
      
      // Also hide style and link tags from head temporarily
      const headStyleTags = document.head.querySelectorAll('style, link[rel="stylesheet"]');
      headStyleTags.forEach((node) => {
        if (node.textContent?.includes('oklch') || node.tagName === 'LINK') {
          node.setAttribute('data-pdf-export-hidden', 'true');
          node.style.display = 'none';
          hiddenHeadNodes.push(node as HTMLElement);
        }
      });

      // Add comprehensive print-specific styles to cloned element for better PDF rendering
      const printStyle = document.createElement('style');
      printStyle.textContent = `
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        /* Ensure charts render clearly */
        svg {
          shape-rendering: geometricPrecision;
          text-rendering: optimizeLegibility;
        }
        /* Improve text rendering - prevent stretching */
        * {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-stretch: normal !important;
          letter-spacing: normal !important;
        }
        /* Ensure proper aspect ratio */
        #forecast-overview-panel {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box;
        }
        /* Fix stats cards layout - ensure they don't overlap */
        #forecast-overview-panel > div {
          display: block !important;
          clear: both !important;
        }
        #forecast-overview-panel .space-y-4 {
          display: flex !important;
          flex-direction: column !important;
          gap: 1rem !important;
        }
        #forecast-overview-panel .space-y-4 > * {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
        }
        /* Ensure primary card is separate */
        #forecast-overview-panel .space-y-4 > div:first-child {
          margin-bottom: 1rem !important;
        }
        /* Ensure secondary cards grid is properly spaced */
        #forecast-overview-panel .grid {
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 1rem !important;
        }
        #forecast-overview-panel .grid > div {
          min-height: 120px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }
        /* Enhance table readability */
        table {
          border-collapse: collapse;
          width: 100%;
          font-size: 11px;
        }
        th, td {
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
        }
        th {
          background-color: #f1f5f9 !important;
          font-weight: 700;
          color: #334155 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        tbody tr {
          border-bottom: 1px solid #e2e8f0;
        }
        tbody tr:nth-child(even) {
          background-color: #f8fafc;
        }
        tbody tr:hover {
          background-color: #f1f5f9;
        }
        /* Ensure forecast rows are visible */
        .bg-purple-50\\/30,
        [class*="bg-purple"] {
          background-color: #faf5ff !important;
        }
        /* Badge styling */
        [class*="bg-purple-100"] {
          background-color: #f3e8ff !important;
          color: #7c3aed !important;
        }
        [class*="bg-sky-100"] {
          background-color: #e0f2fe !important;
          color: #0369a1 !important;
        }
        /* Improve card shadows and borders for PDF */
        .shadow-sm {
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06) !important;
        }
        .border {
          border-width: 1px;
          border-color: #e2e8f0 !important;
        }
        /* Ensure proper spacing - prevent overlapping */
        .space-y-4 > * + * {
          margin-top: 1rem !important;
          margin-bottom: 0 !important;
        }
        .mb-6 {
          margin-bottom: 1.5rem !important;
        }
        .mb-8 {
          margin-bottom: 2rem !important;
        }
        /* Prevent stats cards from overlapping */
        .grid {
          display: grid !important;
          gap: 1rem !important;
        }
        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
        }
        .grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .grid-cols-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
        /* Ensure cards have proper spacing */
        [class*="bg-white"].p-6,
        [class*="bg-white"].p-5 {
          padding: 1.5rem !important;
          margin-bottom: 1rem !important;
          display: block !important;
          position: relative !important;
        }
        /* Fix flex containers */
        .flex {
          display: flex !important;
        }
        .flex-col {
          flex-direction: column !important;
        }
        .items-center {
          align-items: center !important;
        }
        .justify-between {
          justify-content: space-between !important;
        }
        .space-x-2 > * + * {
          margin-left: 0.5rem !important;
        }
        .space-x-4 > * + * {
          margin-left: 1rem !important;
        }
        /* Improve section headers */
        h3 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a !important;
          margin-bottom: 1rem;
        }
        h4 {
          font-size: 14px;
          font-weight: 600;
          color: #334155 !important;
        }
        /* Better number formatting */
        [class*="text-4xl"] {
          font-size: 36px;
          font-weight: 800;
          line-height: 1.2;
        }
        [class*="text-2xl"] {
          font-size: 24px;
          font-weight: 700;
          line-height: 1.3;
        }
        /* Improve chart container */
        [class*="h-\\[450px\\]"] {
          min-height: 400px;
        }
        /* Improve chart container */
        [class*="bg-white"] {
          background-color: #ffffff !important;
        }
        /* Better contrast for text */
        .text-slate-900 {
          color: #0f172a !important;
        }
        .text-slate-700 {
          color: #334155 !important;
        }
        .text-slate-600 {
          color: #475569 !important;
        }
        /* Ensure badges are visible */
        [class*="bg-purple"], [class*="bg-sky"] {
          opacity: 1 !important;
        }
      `;
      clonedElement.appendChild(printStyle);
      
      // Ensure element is fully visible and rendered
      clonedElement.style.visibility = 'visible';
      clonedElement.style.display = 'block';
      
      // Wait a bit more for styles to fully apply
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get exact dimensions from the rendered element
      const elementWidth = Math.max(clonedElement.scrollWidth, clonedElement.offsetWidth, rect.width);
      const elementHeight = Math.max(clonedElement.scrollHeight, clonedElement.offsetHeight);
      
      // Ensure the cloned element has exact dimensions
      clonedElement.style.width = elementWidth + 'px';
      clonedElement.style.height = elementHeight + 'px';
      clonedElement.style.maxWidth = elementWidth + 'px';
      clonedElement.style.maxHeight = elementHeight + 'px';
      clonedElement.style.minWidth = elementWidth + 'px';
      clonedElement.style.minHeight = elementHeight + 'px';
      
      // Convert element to canvas - capture exactly as displayed
      const canvas = await html2canvas(clonedElement, {
        scale: 2, // Good balance between quality and performance
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: elementWidth,
        height: elementHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: rect.left,
        y: rect.top,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        allowTaint: false,
        // Don't load external resources that might have oklch
        proxy: undefined,
        // Ignore elements that might cause issues
        ignoreElements: (el) => {
          // Ignore script tags, link tags, and style tags
          return el.tagName === 'SCRIPT' || 
                 el.tagName === 'LINK' || 
                 (el.tagName === 'STYLE' && el.textContent?.includes('oklch'));
        },
        // Use foreignObjectRendering for better compatibility
        foreignObjectRendering: false,
        // Better image quality
        imageTimeout: 15000,
        removeContainer: true,
        // Ensure all fonts are loaded and preserve exact appearance
        onclone: (clonedDoc) => {
          // Preserve all styles exactly as they appear
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              htmlEl.style.fontDisplay = 'block';
              htmlEl.style.fontStretch = 'normal';
              htmlEl.style.letterSpacing = 'normal';
              // Preserve transform and positioning
              const originalEl = document.querySelector(`[id="${htmlEl.id}"]`) || 
                                 Array.from(document.querySelectorAll('*')).find(e => 
                                   e.isEqualNode(htmlEl.parentElement)
                                 );
              if (originalEl) {
                const originalStyle = window.getComputedStyle(originalEl as HTMLElement);
                htmlEl.style.transform = originalStyle.transform || 'none';
                htmlEl.style.opacity = originalStyle.opacity || '1';
              }
            }
          });
        }
      });
      
      // Re-enable disabled stylesheets and restore removed nodes
      disabledSheets.forEach(sheet => {
        (sheet as any).disabled = false;
      });
      
      removedStyleNodes.forEach(node => {
        node.style.display = '';
        node.removeAttribute('data-pdf-export-hidden');
      });
      
      removedLinkNodes.forEach(node => {
        node.style.display = '';
        node.removeAttribute('data-pdf-export-hidden');
      });
      
      // Restore head style/link tags
      hiddenHeadNodes.forEach(node => {
        node.style.display = '';
        node.removeAttribute('data-pdf-export-hidden');
      });
      
      // Clean up temp container
      if (tempContainer.parentNode) {
        document.body.removeChild(tempContainer);
      }
      
      // Restore element opacity
      element.style.opacity = '1';

      // Calculate PDF dimensions with professional margins
      // Use actual canvas dimensions to maintain proper aspect ratio
      const canvasAspectRatio = canvas.width / canvas.height;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add image to PDF with higher quality
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Professional margins: larger top/bottom for header/footer, side margins for readability
      const pageHeight = 297; // A4 height in mm
      const pageWidth = 210; // A4 width in mm
      const topMargin = 25; // Space for header
      const bottomMargin = 20; // Space for footer
      const sideMargin = 15; // Left and right margins
      const availableHeight = pageHeight - topMargin - bottomMargin;
      const availableWidth = pageWidth - (sideMargin * 2);
      
      // Calculate dimensions maintaining aspect ratio - don't stretch
      // Determine if we should fit to width or height
      const availableAspectRatio = availableWidth / availableHeight;
      
      let scaledWidth: number;
      let scaledHeight: number;
      
      if (canvasAspectRatio > availableAspectRatio) {
        // Canvas is wider - fit to width
        scaledWidth = availableWidth;
        scaledHeight = scaledWidth / canvasAspectRatio;
      } else {
        // Canvas is taller - fit to height
        scaledHeight = availableHeight;
        scaledWidth = scaledHeight * canvasAspectRatio;
      }
      
      // Ensure we don't exceed available space
      scaledWidth = Math.min(scaledWidth, availableWidth);
      scaledHeight = Math.min(scaledHeight, availableHeight);
      
      if (scaledHeight <= availableHeight) {
        // Single page - center vertically
        const yPosition = topMargin + (availableHeight - scaledHeight) / 2;
        pdf.addImage(imgData, 'PNG', sideMargin, yPosition, scaledWidth, scaledHeight);
      } else {
        // Multi-page with proper page breaks
        let heightLeft = scaledHeight;
        let yPosition = topMargin;
        let sourceY = 0;
        
        // First page
        const firstPageHeight = Math.min(scaledHeight, availableHeight);
        pdf.addImage(
          imgData, 
          'PNG', 
          sideMargin, 
          yPosition, 
          scaledWidth, 
          firstPageHeight,
          undefined,
          'FAST', // Rendering mode
          0, // rotation
          0, // source x
          sourceY, // source y
          scaledWidth, // source width
          firstPageHeight // source height
        );
        heightLeft -= availableHeight;
        sourceY += availableHeight;
        
        // Additional pages if needed
        while (heightLeft > 0) {
          pdf.addPage();
          yPosition = topMargin;
          const pageHeight = Math.min(heightLeft, availableHeight);
          
          pdf.addImage(
            imgData,
            'PNG',
            sideMargin,
            yPosition,
            scaledWidth,
            pageHeight,
            undefined,
            'FAST',
            0,
            0,
            sourceY,
            scaledWidth,
            pageHeight
          );
          
          heightLeft -= availableHeight;
          sourceY += availableHeight;
        }
      }

      // Add metadata if requested
      if (includeMetadata) {
        addMetadataToPDF(pdf, data, user, scenarioName);
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const finalFilename = filename || `forecast-analysis-${timestamp}.pdf`;

      // Save PDF
      pdf.save(finalFilename);
    } catch (error) {
      // Re-enable disabled stylesheets and restore nodes even if there's an error
      disabledSheets.forEach(sheet => {
        (sheet as any).disabled = false;
      });
      
      removedStyleNodes.forEach(node => {
        node.style.display = '';
        node.removeAttribute('data-pdf-export-hidden');
      });
      
      removedLinkNodes.forEach(node => {
        node.style.display = '';
        node.removeAttribute('data-pdf-export-hidden');
      });
      
      hiddenHeadNodes.forEach(node => {
        node.style.display = '';
        node.removeAttribute('data-pdf-export-hidden');
      });
      
      // Clean up temp container
      if (tempContainer.parentNode) {
        document.body.removeChild(tempContainer);
      }
      
      // Restore element opacity
      element.style.opacity = '1';
      
      throw error;
    }

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Add metadata to PDF (header/footer)
 */
function addMetadataToPDF(
  pdf: jsPDF,
  data: ForecastResponse,
  user?: { name: string; email: string },
  scenarioName?: string
): void {
  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  
  // Add header and footer to each page
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    
    // Header with professional styling
    const headerY = 18;
    
    // Header background (subtle)
    pdf.setFillColor(248, 250, 252); // slate-50
    pdf.rect(0, 0, pageWidth, headerY + 12, 'F');
    
    // Main title
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.setFont('helvetica', 'bold');
    pdf.text('Forecast Analysis Report', 15, headerY);
    
    // Scenario name
    if (scenarioName) {
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105); // slate-600
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Scenario: ${scenarioName}`, 15, headerY + 6);
    }
    
    // Date in header (right-aligned)
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.setFont('helvetica', 'normal');
    pdf.text(dateStr, pageWidth - 15, headerY, { align: 'right' });
    
    // Header line separator (thicker, more prominent)
    pdf.setDrawColor(203, 213, 225); // slate-300
    pdf.setLineWidth(0.8);
    pdf.line(15, headerY + 10, pageWidth - 15, headerY + 10);
    
    // Footer with professional styling
    const footerY = pageHeight - 10;
    
    // Footer background (subtle)
    pdf.setFillColor(248, 250, 252); // slate-50
    pdf.rect(0, footerY - 10, pageWidth, 10, 'F');
    
    // Footer line separator (thicker)
    pdf.setDrawColor(203, 213, 225); // slate-300
    pdf.setLineWidth(0.8);
    pdf.line(15, footerY - 10, pageWidth - 15, footerY - 10);
    
    // Left footer: User info
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105); // slate-600
    pdf.setFont('helvetica', 'normal');
    if (user) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Prepared by:`, 15, footerY - 6);
      pdf.setFont('helvetica', 'normal');
      pdf.text(user.name, 15, footerY - 2);
      if (user.email) {
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139); // slate-500
        pdf.text(user.email, 15, footerY + 2);
      }
    } else {
      pdf.text(`Generated: ${dateStr}`, 15, footerY - 2);
    }
    
    // Right footer: Summary and page number
    const totalForecast = data.forecast.reduce((sum, d) => sum + d.revenue, 0);
    const totalHistorical = data.historical.reduce((sum, d) => sum + d.revenue, 0);
    const avgMonthly = totalForecast / 12;
    
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105); // slate-600
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      `12-Month Forecast:`,
      pageWidth - 15,
      footerY - 6,
      { align: 'right' }
    );
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      formatCurrency(totalForecast),
      pageWidth - 15,
      footerY - 2,
      { align: 'right' }
    );
    
    // Page number
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 15,
      footerY + 2,
      { align: 'right' }
    );
  }
}

/**
 * Add CSS overrides to handle oklch colors
 * html2canvas doesn't support modern CSS color functions like oklch()
 */
function addOklchColorOverrides(clonedDoc: Document): void {
  // Create a comprehensive style override that replaces oklch with rgb
  const style = clonedDoc.createElement('style');
  style.id = 'pdf-export-color-override';
  style.textContent = `
    /* Override oklch colors - html2canvas compatibility fix */
    /* Replace all oklch() color functions with rgb equivalents */
    
    /* Common Tailwind v4 oklch colors converted to rgb */
    * {
      /* Slate colors */
      --slate-50: rgb(248, 250, 252) !important;
      --slate-100: rgb(241, 245, 249) !important;
      --slate-200: rgb(226, 232, 240) !important;
      --slate-300: rgb(203, 213, 225) !important;
      --slate-400: rgb(148, 163, 184) !important;
      --slate-500: rgb(100, 116, 139) !important;
      --slate-600: rgb(71, 85, 105) !important;
      --slate-700: rgb(51, 65, 85) !important;
      --slate-800: rgb(30, 41, 59) !important;
      --slate-900: rgb(15, 23, 42) !important;
      
      /* Brand/Blue colors */
      --brand-50: rgb(239, 246, 255) !important;
      --brand-100: rgb(219, 234, 254) !important;
      --brand-200: rgb(191, 219, 254) !important;
      --brand-300: rgb(147, 197, 253) !important;
      --brand-400: rgb(96, 165, 250) !important;
      --brand-500: rgb(59, 130, 246) !important;
      --brand-600: rgb(37, 99, 235) !important;
      --brand-700: rgb(29, 78, 216) !important;
      --brand-800: rgb(30, 64, 175) !important;
      --brand-900: rgb(30, 58, 138) !important;
    }
  `;
  clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
  
  // Also try to process and replace oklch in existing stylesheets
  try {
    const styleSheets = Array.from(clonedDoc.styleSheets);
    styleSheets.forEach((sheet) => {
      try {
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach((rule) => {
            if (rule instanceof CSSStyleRule && rule.cssText.includes('oklch')) {
              // Try to replace oklch in the rule
              try {
                const newRule = rule.cssText.replace(/oklch\([^)]+\)/g, (match) => {
                  // Fallback to a safe color
                  return 'rgb(0, 0, 0)';
                });
                // Note: Can't directly modify CSSRule, but the style override above should help
              } catch (e) {
                // Ignore errors
              }
            }
          });
        }
      } catch (e) {
        // Cross-origin or inaccessible stylesheets
      }
    });
  } catch (e) {
    // Ignore errors in stylesheet processing
  }
}

/**
 * Convert all computed styles to inline styles (avoiding oklch parsing issues)
 * This ensures html2canvas only sees RGB colors, not oklch
 */
function convertAllStylesToInline(clonedElement: HTMLElement, originalElement: HTMLElement): void {
  // Remove all style and link tags from cloned element
  clonedElement.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
  
  const allClonedElements = Array.from(clonedElement.querySelectorAll('*'));
  const allOriginalElements = Array.from(originalElement.querySelectorAll('*'));
  
  // Process the root element
  copyComputedStyles(originalElement, clonedElement);
  
  // Process all child elements
  allClonedElements.forEach((clonedEl, index) => {
    const originalEl = allOriginalElements[index] as HTMLElement;
    if (originalEl && clonedEl instanceof HTMLElement) {
      copyComputedStyles(originalEl, clonedEl);
    }
  });
  
  // Also remove any SVG elements that might have oklch in their styles
  clonedElement.querySelectorAll('svg').forEach(svg => {
    const computedStyle = window.getComputedStyle(svg);
    if (computedStyle.fill && !computedStyle.fill.includes('rgb') && !computedStyle.fill.includes('#')) {
      svg.setAttribute('fill', 'currentColor');
    }
    if (computedStyle.stroke && !computedStyle.stroke.includes('rgb') && !computedStyle.stroke.includes('#')) {
      svg.setAttribute('stroke', 'currentColor');
    }
  });
}

/**
 * Copy computed styles from original to cloned element as inline styles
 * Only copies RGB/hex colors to avoid oklch parsing errors
 */
function copyComputedStyles(original: HTMLElement, cloned: HTMLElement): void {
  try {
    const computed = window.getComputedStyle(original);
    
    // Copy important visual properties
    const propertiesToCopy = [
      'color',
      'backgroundColor',
      'border',
      'borderColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      'borderWidth',
      'borderStyle',
      'borderRadius',
      'padding',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'margin',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'fontSize',
      'fontWeight',
      'fontFamily',
      'textAlign',
      'display',
      'flexDirection',
      'justifyContent',
      'alignItems',
      'width',
      'height',
      'minWidth',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'opacity',
      'visibility',
      'overflow',
      'overflowX',
      'overflowY'
    ];
    
    propertiesToCopy.forEach((prop) => {
      try {
        const value = computed.getPropertyValue(prop);
        // Only set if value exists and doesn't contain oklch
        // Computed styles should already be RGB, but double-check
        if (value && value.trim() && !value.includes('oklch')) {
          // For color properties, ensure they're RGB format
          if (prop.includes('color') || prop === 'backgroundColor' || prop === 'borderColor') {
            // Get the computed RGB value
            const rgbValue = computed.getPropertyValue(prop);
            if (rgbValue && (rgbValue.includes('rgb') || rgbValue.includes('#'))) {
              cloned.style.setProperty(prop, rgbValue, 'important');
            }
          } else {
            cloned.style.setProperty(prop, value, 'important');
          }
        }
      } catch (e) {
        // Ignore errors for individual properties
      }
    });
    
    // Copy box model properties
    try {
      cloned.style.width = computed.width;
      cloned.style.height = computed.height;
      cloned.style.boxSizing = computed.boxSizing;
    } catch (e) {
      // Ignore
    }
  } catch (e) {
    // Ignore errors for this element
  }
}

/**
 * Convert oklch colors to rgb/hex in cloned document
 * html2canvas doesn't support modern CSS color functions like oklch()
 */
function convertOklchColors(element: HTMLElement): void {
  // Get all elements and convert computed styles to inline styles
  const allElements = element.querySelectorAll('*');
  const elementList = [element, ...Array.from(allElements)] as HTMLElement[];
  
  elementList.forEach((htmlEl) => {
    try {
      const computedStyle = window.getComputedStyle(htmlEl);
      
      // Check common color properties
      const colorProperties = [
        'color',
        'backgroundColor',
        'borderColor',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'outlineColor',
        'fill',
        'stroke'
      ];
      
      colorProperties.forEach((prop) => {
        try {
          const value = computedStyle.getPropertyValue(prop);
          // If the computed value is rgb/rgba, use it directly
          if (value && (value.includes('rgb') || value.includes('#'))) {
            htmlEl.style.setProperty(prop, value, 'important');
          }
        } catch (e) {
          // Ignore errors for individual properties
        }
      });
    } catch (e) {
      // Ignore errors for individual elements
    }
  });
}

/**
 * Format currency for PDF
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

