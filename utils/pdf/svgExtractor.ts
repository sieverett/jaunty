/**
 * SVG Extraction Utilities for Recharts Charts
 *
 * Handles extraction of Recharts SVG elements and conversion to high-quality data URLs
 * for PDF embedding. Preserves vector graphics quality by:
 * - Extracting SVG directly from Recharts components
 * - Inlining computed styles for portability
 * - Fixing gradient ID conflicts
 * - Converting to rasterized PNG or preserving as SVG
 */

import type { SvgExtractionOptions, SvgExtractionResult } from './types';

/**
 * Color conversion utilities for CSS color functions
 */

/**
 * Converts oklch() color function to rgb() format
 *
 * OKLCH uses perceptual color space with:
 * - L: Lightness (0-1)
 * - C: Chroma (0-0.4+)
 * - H: Hue (0-360 degrees)
 *
 * @param oklchString - oklch() CSS color function string
 * @returns RGB color string or original if conversion fails
 *
 * @example
 * ```typescript
 * oklchToRgb('oklch(0.7 0.15 180)') // returns 'rgb(87, 185, 178)'
 * oklchToRgb('oklch(65% 0.15 180)') // returns 'rgb(87, 185, 178)'
 * ```
 */
function oklchToRgb(oklchString: string): string {
  try {
    // Extract values from oklch(L C H) or oklch(L C H / A)
    const match = oklchString.match(/oklch\(\s*([^)]+)\s*\)/i);
    if (!match) {
      console.debug('OKLCH conversion: Invalid format', oklchString);
      return oklchString;
    }

    const values = match[1].split(/[\s,\/]+/).map(v => v.trim()).filter(v => v !== '');
    if (values.length < 3) {
      console.debug('OKLCH conversion: Insufficient values', oklchString, values);
      return oklchString;
    }

    // Parse L (lightness): percentage or decimal
    let l = parseFloat(values[0]);
    if (isNaN(l)) {
      console.debug('OKLCH conversion: Invalid lightness', values[0]);
      return oklchString;
    }
    if (values[0].includes('%')) {
      l = l / 100;
    }
    // Clamp lightness to valid range
    l = Math.max(0, Math.min(1, l));

    // Parse C (chroma): always decimal
    let c = parseFloat(values[1]);
    if (isNaN(c)) {
      console.debug('OKLCH conversion: Invalid chroma', values[1]);
      return oklchString;
    }
    c = Math.max(0, c); // Chroma cannot be negative

    // Parse H (hue): degrees or 'none'
    let h = 0;
    if (values[2] !== 'none') {
      h = parseFloat(values[2]);
      if (isNaN(h)) {
        console.debug('OKLCH conversion: Invalid hue', values[2]);
        return oklchString;
      }
      h = h % 360; // Normalize to 0-360
      if (h < 0) h += 360;
    }

    // Parse alpha if present
    let alpha = 1;
    if (values.length > 3 && values[3] !== 'none') {
      alpha = parseFloat(values[3]);
      if (isNaN(alpha)) {
        console.debug('OKLCH conversion: Invalid alpha', values[3]);
        alpha = 1; // Default to opaque rather than failing
      } else {
        if (values[3].includes('%')) {
          alpha = alpha / 100;
        }
        alpha = Math.max(0, Math.min(1, alpha));
      }
    }

    // Convert OKLCH to RGB through OKLab
    const [r, g, b] = oklchToRgbValues(l, c, h);

    // Validate RGB values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.debug('OKLCH conversion: Invalid RGB output', { l, c, h }, [r, g, b]);
      return oklchString;
    }

    // Return appropriate format
    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else {
      return `rgb(${r}, ${g}, ${b})`;
    }

  } catch (error) {
    // Log error for debugging but return original string for graceful fallback
    console.debug('OKLCH conversion error:', error, 'Input:', oklchString);
    return oklchString;
  }
}

/**
 * Core OKLCH to RGB conversion using color space mathematics
 *
 * Conversion path: OKLCH → OKLab → Linear RGB → sRGB
 */
function oklchToRgbValues(l: number, c: number, h: number): [number, number, number] {
  // Convert OKLCH to OKLab
  const hRad = (h * Math.PI) / 180;
  const aComponent = c * Math.cos(hRad);
  const bComponent = c * Math.sin(hRad);

  // OKLab to Linear RGB transformation matrix
  // Based on OKLab specification
  const l_ = l + 0.3963377774 * aComponent + 0.2158037573 * bComponent;
  const m_ = l - 0.1055613458 * aComponent - 0.0638541728 * bComponent;
  const s_ = l - 0.0894841775 * aComponent - 1.2914855480 * bComponent;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  // Linear RGB values
  const lr = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  // Convert linear RGB to sRGB (apply gamma correction)
  const rFinal = linearToSrgb(lr);
  const gFinal = linearToSrgb(lg);
  const bFinal = linearToSrgb(lb);

  // Convert to 8-bit values
  return [
    Math.round(Math.max(0, Math.min(255, rFinal * 255))),
    Math.round(Math.max(0, Math.min(255, gFinal * 255))),
    Math.round(Math.max(0, Math.min(255, bFinal * 255)))
  ];
}

/**
 * Convert linear RGB to sRGB (gamma correction)
 */
function linearToSrgb(val: number): number {
  if (val <= 0.0031308) {
    return 12.92 * val;
  } else {
    return 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
  }
}

/**
 * Convert any CSS color function to RGB-compatible format
 *
 * Handles oklch(), oklab(), lch(), lab(), and preserves rgb(), hsl(), hex
 *
 * @param colorValue - CSS color value
 * @returns RGB-compatible color string
 */
function convertColorToRgb(colorValue: string): string {
  if (!colorValue || typeof colorValue !== 'string') {
    return colorValue;
  }

  const trimmed = colorValue.trim();

  // Handle oklch() colors
  if (trimmed.toLowerCase().startsWith('oklch(')) {
    return oklchToRgb(trimmed);
  }

  // Add other color space conversions here as needed
  // For now, focus on oklch which is the primary issue with Tailwind v4

  // Return unchanged for rgb(), hsl(), hex, named colors
  return colorValue;
}

/**
 * Convert oklch colors within CSS style attribute strings
 *
 * Parses CSS declarations and converts any oklch() color functions to rgb()
 *
 * @param styleString - CSS style attribute value
 * @returns Style string with converted colors
 *
 * @example
 * ```typescript
 * convertStyleAttributeColors('fill: oklch(0.7 0.15 180); stroke-width: 2px')
 * // returns 'fill: rgb(87, 185, 178); stroke-width: 2px'
 * ```
 */
function convertStyleAttributeColors(styleString: string): string {
  if (!styleString || typeof styleString !== 'string') {
    return styleString;
  }

  // Match oklch() functions anywhere in the style string
  return styleString.replace(/oklch\([^)]+\)/gi, (match) => {
    return convertColorToRgb(match);
  });
}

/**
 * Extracts a Recharts chart from a container element
 *
 * Recharts structure: ResponsiveContainer > div.recharts-wrapper > svg.recharts-surface
 *
 * @param containerId - ID of the container element (ResponsiveContainer or parent)
 * @returns SVG element or null if not found
 *
 * @example
 * ```typescript
 * const svg = extractRechartsChart('revenue-chart-container');
 * if (svg) {
 *   const dataUrl = svgToDataURL(svg);
 * }
 * ```
 */
export function extractRechartsChart(containerId: string): SVGElement | null {
  const container = document.getElementById(containerId);

  if (!container) {
    console.warn(`Container element not found: ${containerId}`);
    return null;
  }

  // Try direct SVG child first
  let svg = container.querySelector('svg');

  // If not found, look for Recharts wrapper structure
  if (!svg) {
    const wrapper = container.querySelector('.recharts-wrapper');
    if (wrapper) {
      svg = wrapper.querySelector('svg');
    }
  }

  // Last resort: any SVG descendant
  if (!svg) {
    svg = container.querySelector('svg');
  }

  if (!svg) {
    console.warn(`SVG element not found in container: ${containerId}`);
    return null;
  }

  return svg;
}

/**
 * Inlines all computed styles into SVG elements
 *
 * Ensures styles are preserved when SVG is extracted from the DOM
 * Focuses on critical properties: fill, stroke, font properties
 *
 * @param svg - SVG element to inline styles into
 *
 * @example
 * ```typescript
 * const svg = extractRechartsChart('chart-container');
 * if (svg) {
 *   inlineAllComputedStyles(svg);
 *   // SVG now has inline styles
 * }
 * ```
 */
export function inlineAllComputedStyles(svg: SVGElement): void {
  if (!svg) {
    return;
  }

  // Properties to inline for maximum compatibility
  const styleProps = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'text-anchor',
    'dominant-baseline',
    'color',
    'background-color',
    'display',
    'visibility'
  ];

  // Process SVG root
  inlineElementStyles(svg, styleProps);

  // Process all descendants
  const elements = svg.querySelectorAll('*');
  elements.forEach((element) => {
    inlineElementStyles(element as SVGElement, styleProps);
  });
}

/**
 * Inline styles for a single element with color conversion support
 */
function inlineElementStyles(element: SVGElement, styleProps: string[]): void {
  try {
    const computedStyle = window.getComputedStyle(element);

    // Properties that may contain color values needing conversion
    const colorProps = new Set([
      'fill',
      'stroke',
      'color',
      'background-color',
      'border-color',
      'outline-color',
      'text-decoration-color'
    ]);

    styleProps.forEach((prop) => {
      let value = computedStyle.getPropertyValue(prop);

      // Only process non-default values
      if (value && value !== '' && value !== 'none' && value !== 'normal') {
        // Convert color values to RGB-compatible format
        if (colorProps.has(prop)) {
          value = convertColorToRgb(value);
        }

        // Skip if already set inline (don't override)
        if (!element.style.getPropertyValue(prop)) {
          element.style.setProperty(prop, value);
        }
      }
    });
  } catch (error) {
    // Silently skip elements that can't have styles computed
    // (e.g., some SVG internal elements)
    console.debug('Failed to inline styles for element:', error);
  }
}

/**
 * Fixes Recharts gradient IDs to avoid conflicts
 *
 * Recharts generates gradients with generic IDs that can conflict
 * when multiple charts are on the same page. This function:
 * - Finds all gradient/pattern definitions
 * - Generates unique IDs based on container
 * - Updates all references (fill="url(#gradient)")
 *
 * @param svg - SVG element to fix gradients in
 *
 * @example
 * ```typescript
 * const svg = extractRechartsChart('chart-container');
 * if (svg) {
 *   fixRechartsGradients(svg);
 *   // Gradient IDs are now unique
 * }
 * ```
 */
export function fixRechartsGradients(svg: SVGElement): void {
  if (!svg) {
    return;
  }

  // Find all defs section
  const defs = svg.querySelector('defs');
  if (!defs) {
    return;
  }

  // Generate unique suffix based on timestamp
  const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Map of old ID -> new ID
  const idMap = new Map<string, string>();

  // Process gradients and patterns
  const definitions = defs.querySelectorAll('linearGradient, radialGradient, pattern, clipPath, mask');

  definitions.forEach((def) => {
    const oldId = def.getAttribute('id');
    if (oldId) {
      const newId = `${oldId}${uniqueSuffix}`;
      idMap.set(oldId, newId);
      def.setAttribute('id', newId);
    }
  });

  // Update all references to these IDs
  if (idMap.size > 0) {
    updateIdReferences(svg, idMap);
  }
}

/**
 * Updates all references to renamed IDs in SVG
 */
function updateIdReferences(svg: SVGElement, idMap: Map<string, string>): void {
  // Attributes that can reference IDs via url(#id)
  const refAttributes = ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end'];

  // Process all elements
  const elements = svg.querySelectorAll('*');

  elements.forEach((element) => {
    refAttributes.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value && value.includes('url(#')) {
        // Extract ID from url(#id)
        const match = value.match(/url\(#([^)]+)\)/);
        if (match && match[1]) {
          const oldId = match[1];
          const newId = idMap.get(oldId);
          if (newId) {
            const newValue = value.replace(`url(#${oldId})`, `url(#${newId})`);
            element.setAttribute(attr, newValue);
          }
        }
      }
    });

    // Also check style attribute for both ID references and color conversion
    const styleAttr = element.getAttribute('style');
    if (styleAttr) {
      let updatedStyle = styleAttr;

      // Update ID references
      idMap.forEach((newId, oldId) => {
        updatedStyle = updatedStyle.replace(
          new RegExp(`url\\(#${oldId}\\)`, 'g'),
          `url(#${newId})`
        );
      });

      // Convert oklch colors in style attribute
      updatedStyle = convertStyleAttributeColors(updatedStyle);

      if (updatedStyle !== styleAttr) {
        element.setAttribute('style', updatedStyle);
      }
    }
  });
}

/**
 * Converts SVG element to data URL for PDF embedding
 *
 * Supports two output modes:
 * - PNG: Rasterized image (guaranteed compatibility, larger file size)
 * - SVG: Vector format (smaller, but may have rendering issues)
 *
 * @param svg - SVG element to convert
 * @param options - Conversion options
 * @returns Data URL string
 *
 * @example
 * ```typescript
 * const svg = extractRechartsChart('chart-container');
 * if (svg) {
 *   inlineAllComputedStyles(svg);
 *   fixRechartsGradients(svg);
 *   const dataUrl = svgToDataURL(svg, { scale: 2 });
 *   // Use dataUrl with jsPDF.addImage()
 * }
 * ```
 */
export function svgToDataURL(
  svg: SVGElement,
  options: SvgExtractionOptions = {}
): string {
  const {
    width,
    height,
    scale = 2,
    backgroundColor = '#ffffff',
    outputFormat = 'png'
  } = options;

  // Clone to avoid modifying original
  const svgClone = svg.cloneNode(true) as SVGElement;

  // Get dimensions
  const svgWidth = width || svg.clientWidth || parseInt(svg.getAttribute('width') || '800');
  const svgHeight = height || svg.clientHeight || parseInt(svg.getAttribute('height') || '450');

  // Ensure SVG has proper attributes
  svgClone.setAttribute('width', svgWidth.toString());
  svgClone.setAttribute('height', svgHeight.toString());
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // If SVG output requested, return directly
  if (outputFormat === 'svg') {
    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    return svgDataUrl;
  }

  // PNG rasterization
  const canvas = document.createElement('canvas');
  canvas.width = svgWidth * scale;
  canvas.height = svgHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Set scale for high DPI
  ctx.scale(scale, scale);

  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, svgWidth, svgHeight);

  // Convert SVG to data URL
  const svgString = new XMLSerializer().serializeToString(svgClone);
  const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

  // Create image and draw to canvas (synchronous for this use case)
  const img = new Image();
  img.width = svgWidth;
  img.height = svgHeight;

  // Note: This is a synchronous fallback. For async usage, wrap in Promise
  // For PDF export, we typically call this in an async context anyway
  try {
    // Attempt synchronous draw (works if SVG is simple)
    img.src = svgDataUrl;
    ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
    return canvas.toDataURL('image/png', 1.0);
  } catch (error) {
    // Fallback: return SVG data URL if rasterization fails
    console.warn('PNG rasterization failed, returning SVG data URL:', error);
    return svgDataUrl;
  }
}

/**
 * Async version of svgToDataURL for guaranteed rasterization
 *
 * @param svg - SVG element to convert
 * @param options - Conversion options
 * @returns Promise resolving to data URL
 *
 * @example
 * ```typescript
 * const svg = extractRechartsChart('chart-container');
 * if (svg) {
 *   inlineAllComputedStyles(svg);
 *   fixRechartsGradients(svg);
 *   const dataUrl = await svgToDataURLAsync(svg);
 * }
 * ```
 */
export async function svgToDataURLAsync(
  svg: SVGElement,
  options: SvgExtractionOptions = {}
): Promise<string> {
  const {
    width,
    height,
    scale = 2,
    backgroundColor = '#ffffff',
    outputFormat = 'png'
  } = options;

  // Clone to avoid modifying original
  const svgClone = svg.cloneNode(true) as SVGElement;

  // Get dimensions
  const svgWidth = width || svg.clientWidth || parseInt(svg.getAttribute('width') || '800');
  const svgHeight = height || svg.clientHeight || parseInt(svg.getAttribute('height') || '450');

  // Ensure SVG has proper attributes
  svgClone.setAttribute('width', svgWidth.toString());
  svgClone.setAttribute('height', svgHeight.toString());
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Serialize SVG
  const svgString = new XMLSerializer().serializeToString(svgClone);
  const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

  // If SVG output requested, return directly
  if (outputFormat === 'svg') {
    return svgDataUrl;
  }

  // PNG rasterization with Promise
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = svgWidth * scale;
    canvas.height = svgHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas 2D context'));
      return;
    }

    // Set scale for high DPI
    ctx.scale(scale, scale);

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, svgWidth, svgHeight);

    const img = new Image();

    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
        resolve(canvas.toDataURL('image/png', 1.0));
      } catch (error) {
        reject(new Error(`Failed to draw SVG to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = svgDataUrl;
  });
}

/**
 * Complete extraction pipeline for Recharts charts
 *
 * Combines all extraction steps into a single function:
 * 1. Extract SVG from container
 * 2. Inline computed styles
 * 3. Fix gradient IDs
 * 4. Convert to data URL
 *
 * @param containerId - ID of container element
 * @param options - Extraction options
 * @returns Promise with extraction result
 *
 * @example
 * ```typescript
 * const result = await extractChartAsDataURL('revenue-chart-container');
 * if (result.success) {
 *   pdf.addImage(result.dataUrl, 'PNG', 10, 10, 190, 100);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function extractChartAsDataURL(
  containerId: string,
  options: SvgExtractionOptions = {}
): Promise<SvgExtractionResult> {
  try {
    // Step 1: Extract SVG
    const svg = extractRechartsChart(containerId);

    if (!svg) {
      return {
        dataUrl: '',
        width: 0,
        height: 0,
        success: false,
        error: `Chart not found in container: ${containerId}`
      };
    }

    // Step 2: Inline styles (unless explicitly disabled)
    if (options.inlineStyles !== false) {
      inlineAllComputedStyles(svg);
    }

    // Step 3: Fix gradients (unless explicitly disabled)
    if (options.fixGradients !== false) {
      fixRechartsGradients(svg);
    }

    // Step 4: Convert to data URL
    const dataUrl = await svgToDataURLAsync(svg, options);

    const width = svg.clientWidth || parseInt(svg.getAttribute('width') || '800');
    const height = svg.clientHeight || parseInt(svg.getAttribute('height') || '450');

    return {
      dataUrl,
      width,
      height,
      success: true
    };

  } catch (error) {
    return {
      dataUrl: '',
      width: 0,
      height: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error'
    };
  }
}
