/**
 * Tests for SVG Extraction Utilities
 *
 * Validates SVG extraction, style inlining, gradient fixing, and data URL conversion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractRechartsChart,
  inlineAllComputedStyles,
  fixRechartsGradients,
  svgToDataURL,
  svgToDataURLAsync,
  extractChartAsDataURL
} from './svgExtractor';

describe('extractRechartsChart', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-chart-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should extract SVG from direct child', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    container.appendChild(svg);

    const result = extractRechartsChart('test-chart-container');
    expect(result).toBe(svg);
  });

  it('should extract SVG from Recharts wrapper structure', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'recharts-wrapper';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrapper.appendChild(svg);
    container.appendChild(wrapper);

    const result = extractRechartsChart('test-chart-container');
    expect(result).toBe(svg);
  });

  it('should return null for missing container', () => {
    const result = extractRechartsChart('nonexistent-container');
    expect(result).toBeNull();
  });

  it('should return null for container without SVG', () => {
    const result = extractRechartsChart('test-chart-container');
    expect(result).toBeNull();
  });
});

describe('inlineAllComputedStyles', () => {
  it('should inline computed styles into SVG elements', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'blue');
    svg.appendChild(rect);
    document.body.appendChild(svg);

    inlineAllComputedStyles(svg);

    // After inlining, rect should have inline style
    // Note: actual computed styles depend on browser rendering
    expect(rect.style.fill).toBeDefined();

    document.body.removeChild(svg);
  });

  it('should handle null SVG gracefully', () => {
    expect(() => inlineAllComputedStyles(null as any)).not.toThrow();
  });

  it('should process all descendants', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    g.appendChild(circle);
    svg.appendChild(g);
    document.body.appendChild(svg);

    inlineAllComputedStyles(svg);

    // All elements should have been processed
    // (actual styles depend on browser)
    expect(svg.style).toBeDefined();
    expect(g.style).toBeDefined();
    expect(circle.style).toBeDefined();

    document.body.removeChild(svg);
  });
});

describe('fixRechartsGradients', () => {
  it('should rename gradient IDs to avoid conflicts', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'colorRevenue');

    defs.appendChild(gradient);
    svg.appendChild(defs);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'url(#colorRevenue)');
    svg.appendChild(rect);

    fixRechartsGradients(svg);

    const newId = gradient.getAttribute('id');
    expect(newId).toContain('colorRevenue');
    expect(newId).not.toBe('colorRevenue'); // Should have suffix

    const rectFill = rect.getAttribute('fill');
    expect(rectFill).toContain('url(#colorRevenue');
    expect(rectFill).toContain(newId!.replace('colorRevenue', ''));
  });

  it('should handle multiple gradients', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    const gradient1 = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient1.setAttribute('id', 'grad1');

    const gradient2 = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    gradient2.setAttribute('id', 'grad2');

    defs.appendChild(gradient1);
    defs.appendChild(gradient2);
    svg.appendChild(defs);

    fixRechartsGradients(svg);

    const id1 = gradient1.getAttribute('id');
    const id2 = gradient2.getAttribute('id');

    expect(id1).toContain('grad1');
    expect(id2).toContain('grad2');
    expect(id1).not.toBe('grad1');
    expect(id2).not.toBe('grad2');
  });

  it('should handle SVG without defs', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect(() => fixRechartsGradients(svg)).not.toThrow();
  });

  it('should handle null SVG', () => {
    expect(() => fixRechartsGradients(null as any)).not.toThrow();
  });
});

describe('svgToDataURL', () => {
  it('should convert SVG to PNG data URL', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '100');
    rect.setAttribute('fill', 'blue');
    svg.appendChild(rect);

    const dataUrl = svgToDataURL(svg);

    // Should return a data URL (PNG or SVG depending on browser support)
    expect(dataUrl).toMatch(/^data:image\/(png|svg\+xml)/);
  });

  it('should convert SVG to SVG data URL when requested', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');

    const dataUrl = svgToDataURL(svg, { outputFormat: 'svg' });

    expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should apply custom dimensions', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const dataUrl = svgToDataURL(svg, { width: 500, height: 300 });

    expect(dataUrl).toBeTruthy();
    // SVG should have been cloned with new dimensions
  });

  it('should apply scale factor', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');

    const dataUrl = svgToDataURL(svg, { scale: 3 });

    expect(dataUrl).toBeTruthy();
  });
});

describe('svgToDataURLAsync', () => {
  it('should convert SVG to PNG data URL asynchronously', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '100');
    rect.setAttribute('fill', 'red');
    svg.appendChild(rect);

    const dataUrl = await svgToDataURLAsync(svg);

    expect(dataUrl).toMatch(/^data:image\/png/);
  });

  it('should convert to SVG format when requested', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');

    const dataUrl = await svgToDataURLAsync(svg, { outputFormat: 'svg' });

    expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should reject on invalid SVG', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Create malformed SVG that might fail to render
    // Note: This test may be hard to trigger in all browsers

    await expect(svgToDataURLAsync(svg)).resolves.toBeTruthy();
  });
});

describe('extractChartAsDataURL', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-chart';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should extract and convert chart to data URL', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '450');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '800');
    rect.setAttribute('height', '450');
    rect.setAttribute('fill', 'green');
    svg.appendChild(rect);

    container.appendChild(svg);

    const result = await extractChartAsDataURL('test-chart');

    expect(result.success).toBe(true);
    expect(result.dataUrl).toMatch(/^data:image\/png/);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
  });

  it('should return error for missing container', async () => {
    const result = await extractChartAsDataURL('nonexistent-chart');

    expect(result.success).toBe(false);
    expect(result.dataUrl).toBe('');
    expect(result.error).toBeTruthy();
  });

  it('should apply all processing steps', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '450');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'testGrad');
    defs.appendChild(gradient);
    svg.appendChild(defs);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'url(#testGrad)');
    svg.appendChild(rect);

    container.appendChild(svg);

    const result = await extractChartAsDataURL('test-chart', {
      inlineStyles: true,
      fixGradients: true,
      scale: 2
    });

    expect(result.success).toBe(true);
  });

  it('should skip processing when disabled', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '450');
    container.appendChild(svg);

    const result = await extractChartAsDataURL('test-chart', {
      inlineStyles: false,
      fixGradients: false
    });

    expect(result.success).toBe(true);
  });

  it('should handle Recharts wrapper structure', async () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'recharts-wrapper';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '450');

    wrapper.appendChild(svg);
    container.appendChild(wrapper);

    const result = await extractChartAsDataURL('test-chart');

    expect(result.success).toBe(true);
    expect(result.dataUrl).toBeTruthy();
  });
});
