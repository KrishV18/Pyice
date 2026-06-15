// svg-templates.js
// SVG Template-Augmented Generation engine for PYICE notes.
// Each export takes a typed schema object and returns a complete SVG string.
// No external dependencies. ES module syntax.

const DEFS = `
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
`;

const SHARED_STYLES = `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"`;

function getBaseSVG(H, innerContent) {
  return `<svg viewBox="0 0 560 ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" ${SHARED_STYLES}>
    ${DEFS}
    ${innerContent}
  </svg>`;
}

function processFlow(schema) {
  const steps = schema.steps || [];
  const title = schema.title || "Process Flow";
  const highlight = schema.highlight !== undefined ? schema.highlight : null;
  
  const H = 60 + (steps.length * 44) + (Math.max(0, steps.length - 1) * 44) + 40;
  
  let content = `<text x="280" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  steps.forEach((step, i) => {
    const y = 60 + i * 88; // 44 box + 44 gap
    const isHighlight = i === highlight;
    const fill = isHighlight ? "#eff6ff" : "#f8fafc";
    const stroke = isHighlight ? "#bfdbfe" : "#e2e8f0";
    const textFill = isHighlight ? "#1e40af" : "#1a1a1a";
    
    content += `<rect x="40" y="${y}" width="480" height="44" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
    content += `<text x="280" y="${y + 22}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="${textFill}">${step}</text>`;
    
    if (i < steps.length - 1) {
      const arrowY = y + 44 + 12;
      content += `<path d="M280 ${arrowY} L280 ${arrowY + 20}" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)" />`;
    }
  });
  
  return getBaseSVG(H, content);
}

function conceptHierarchy(schema) {
  const title = schema.title || "Hierarchy";
  const root = schema.root || "Root";
  const children = schema.children || [];
  
  let content = `<text x="280" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  content += `<rect x="180" y="50" width="200" height="40" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1"/>`;
  content += `<text x="280" y="70" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">${root}</text>`;
  
  if (children.length > 0) {
    const level1Y = 130;
    const spacingX = 560 / children.length;
    
    children.forEach((child, i) => {
      const cx = (i + 0.5) * spacingX;
      const boxX = cx - 70;
      
      content += `<path d="M280 90 L${cx} ${level1Y}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
      content += `<rect x="${boxX}" y="${level1Y}" width="140" height="40" rx="6" fill="#fefce8" stroke="#fde047" stroke-width="1"/>`;
      content += `<text x="${cx}" y="${level1Y + 20}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#1a1a1a">${child.label}</text>`;
      
      if (child.children && child.children.length > 0) {
        const leafY = 210;
        const leafSpacingX = 140 / child.children.length;
        child.children.forEach((leaf, j) => {
          const lcx = boxX + (j + 0.5) * leafSpacingX;
          const lboxX = lcx - 60;
          content += `<path d="M${cx} ${level1Y + 40} L${lcx} ${leafY}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
          content += `<rect x="${lboxX}" y="${leafY}" width="120" height="40" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`;
          content += `<text x="${lcx}" y="${leafY + 20}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#6b7280">${leaf}</text>`;
        });
      }
    });
  }
  
  return getBaseSVG(280, content);
}

function comparisonTable(schema) {
  const title = schema.title || "Comparison";
  const items = schema.items || ["Item A", "Item B"];
  const criteria = schema.criteria || [];
  
  const headerHeight = 40;
  const rowHeight = 40;
  const H = 60 + headerHeight + criteria.length * rowHeight + 20;
  
  let content = `<text x="280" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  const startX = 20;
  const startY = 50;
  
  content += `<rect x="${startX}" y="${startY}" width="520" height="${headerHeight}" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>`;
  content += `<text x="${startX + 80}" y="${startY + 20}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">Criteria</text>`;
  content += `<text x="${startX + 160 + 90}" y="${startY + 20}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">${items[0] || ''}</text>`;
  content += `<text x="${startX + 340 + 90}" y="${startY + 20}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">${items[1] || ''}</text>`;
  
  criteria.forEach((crit, i) => {
    const y = startY + headerHeight + i * rowHeight;
    const fill = i % 2 === 0 ? "#ffffff" : "#f8fafc";
    
    content += `<rect x="${startX}" y="${y}" width="520" height="${rowHeight}" fill="${fill}" />`;
    
    content += `<text x="${startX + 10}" y="${y + 20}" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">${crit.label || ''}</text>`;
    content += `<text x="${startX + 160 + 10}" y="${y + 20}" dominant-baseline="central" font-size="13" fill="#6b7280">${(crit.values && crit.values[0]) || ''}</text>`;
    content += `<text x="${startX + 340 + 10}" y="${y + 20}" dominant-baseline="central" font-size="13" fill="#6b7280">${(crit.values && crit.values[1]) || ''}</text>`;
  });
  
  content += `<rect x="${startX}" y="${startY}" width="520" height="${headerHeight + criteria.length * rowHeight}" rx="6" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  content += `<path d="M${startX + 160} ${startY} L${startX + 160} ${startY + headerHeight + criteria.length * rowHeight}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  content += `<path d="M${startX + 340} ${startY} L${startX + 340} ${startY + headerHeight + criteria.length * rowHeight}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  content += `<path d="M${startX} ${startY + headerHeight} L${startX + 520} ${startY + headerHeight}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  
  return getBaseSVG(H, content);
}

function timeline(schema) {
  const title = schema.title || "Timeline";
  const events = schema.events || [];
  
  const hasDetails = events.some(e => e.detail);
  const boxHeight = hasDetails ? 60 : 48;
  const H = 240;
  const midY = H / 2;
  
  let content = `<text x="280" y="28" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  content += `<path d="M40 ${midY} L520 ${midY}" stroke="#e2e8f0" stroke-width="2"/>`;
  
  if (events.length > 0) {
    const spacing = events.length > 1 ? 480 / (events.length - 1) : 0;
    events.forEach((ev, i) => {
      const cx = 40 + i * spacing;
      const isAbove = i % 2 !== 0;
      
      content += `<circle cx="${cx}" cy="${midY}" r="5" fill="#6366f1"/>`;
      
      const boxY = isAbove ? midY - boxHeight - 20 : midY + 20;
      const lineEndY = isAbove ? midY - 20 : midY + 20;
      content += `<path d="M${cx} ${midY} L${cx} ${lineEndY}" stroke="#94a3b8" stroke-width="1"/>`;
      
      const boxX = cx - 65;
      content += `<rect x="${boxX}" y="${boxY}" width="130" height="${boxHeight}" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`;
      content += `<text x="${cx}" y="${boxY + 16}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">${ev.date || ''}</text>`;
      content += `<text x="${cx}" y="${boxY + 34}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#6b7280">${ev.label || ''}</text>`;
      
      if (ev.detail) {
        content += `<text x="${cx}" y="${boxY + 50}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#94a3b8">${ev.detail}</text>`;
      }
    });
  }
  
  return getBaseSVG(H, content);
}

function cycleDiagram(schema) {
  const title = schema.title || "Cycle Diagram";
  const stages = schema.stages || [];
  
  const H = 480;
  const midX = 280;
  const midY = 260;
  const R = 140;
  
  let content = `<text x="280" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  if (stages.length > 0) {
    const coords = [];
    stages.forEach((stage, i) => {
      const angle = (2 * Math.PI / stages.length) * i - Math.PI / 2;
      const cx = midX + R * Math.cos(angle);
      const cy = midY + R * Math.sin(angle);
      coords.push({ cx, cy, angle });
      
      const boxX = cx - 60;
      const boxY = cy - 22;
      
      content += `<rect x="${boxX}" y="${boxY}" width="120" height="44" rx="6" fill="#fdf4ff" stroke="#e879f9" stroke-width="1"/>`;
      content += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#1a1a1a">${stage}</text>`;
    });
    
    for (let i = 0; i < stages.length; i++) {
      const curr = coords[i];
      const next = coords[(i + 1) % stages.length];
      
      const dx = next.cx - curr.cx;
      const dy = next.cy - curr.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const p1x = curr.cx + dx * (65 / dist);
      const p1y = curr.cy + dy * (65 / dist);
      const p2x = curr.cx + dx * ((dist - 75) / dist);
      const p2y = curr.cy + dy * ((dist - 75) / dist);
      
      content += `<path d="M${p1x} ${p1y} L${p2x} ${p2y}" fill="none" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)" />`;
    }
  }
  
  return getBaseSVG(H, content);
}

function formulaBreakdown(schema) {
  const title = schema.title || "Formula Breakdown";
  const equation = schema.equation || "";
  const variables = schema.variables || [];
  
  const H = 60 + 72 + 20 + variables.length * 46 + 20;
  
  let content = `<text x="280" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  content += `<rect x="40" y="50" width="480" height="72" rx="6" fill="#fefce8" stroke="#fde047" stroke-width="1"/>`;
  content += `<text x="280" y="86" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="bold" fill="#1a1a1a">${equation}</text>`;
  
  let startY = 140;
  variables.forEach(v => {
    content += `<rect x="40" y="${startY}" width="48" height="36" rx="6" fill="#fef9c3" stroke="#fde047" stroke-width="1"/>`;
    content += `<text x="64" y="${startY + 18}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#1a1a1a">${v.symbol}</text>`;
    
    let desc = v.name;
    if (v.unit) desc += ` (${v.unit})`;
    if (v.description) desc += ` - ${v.description}`;
    
    content += `<text x="100" y="${startY + 18}" dominant-baseline="central" font-size="13" fill="#6b7280">${desc}</text>`;
    
    startY += 40 + 6;
  });
  
  return getBaseSVG(H, content);
}

function mindMap(schema) {
  const title = schema.title || "Mind Map";
  const center = schema.center || "Topic";
  const branches = schema.branches || [];
  
  const H = 500;
  const midX = 280;
  const midY = 250;
  
  let content = `<text x="280" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  const fills = ["#eff6ff", "#f0fdf4", "#fdf4ff", "#fff7ed", "#fef2f2", "#f0fdfa"];
  const strokes = ["#bfdbfe", "#86efac", "#f0abfc", "#fed7aa", "#fecaca", "#99f6e4"];
  
  if (branches.length > 0) {
    branches.forEach((branch, i) => {
      const angle = (2 * Math.PI / branches.length) * i - Math.PI / 2;
      const R = 110;
      const bx = midX + R * Math.cos(angle);
      const by = midY + R * Math.sin(angle);
      
      const fill = fills[i % fills.length];
      const stroke = strokes[i % strokes.length];
      
      content += `<path d="M${midX} ${midY} L${bx} ${by}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
      
      if (branch.items && branch.items.length > 0) {
        branch.items.forEach((item, j) => {
          const itemAngle = angle + (j - (branch.items.length - 1)/2) * 0.4;
          const leafR = 80;
          const lx = bx + leafR * Math.cos(itemAngle);
          const ly = by + leafR * Math.sin(itemAngle);
          
          content += `<path d="M${bx} ${by} L${lx} ${ly}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
          content += `<rect x="${lx - 60}" y="${ly - 17}" width="120" height="34" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`;
          content += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#6b7280">${item}</text>`;
        });
      }
      
      content += `<rect x="${bx - 70}" y="${by - 20}" width="140" height="40" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
      content += `<text x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="bold" fill="#1a1a1a">${branch.label}</text>`;
    });
  }
  
  content += `<rect x="${midX - 80}" y="${midY - 24}" width="160" height="48" rx="6" fill="#1e293b" stroke="#1e293b" stroke-width="1"/>`;
  content += `<text x="${midX}" y="${midY}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#ffffff">${center}</text>`;
  
  return getBaseSVG(H, content);
}

function causeEffect(schema) {
  const title = schema.title || "Cause and Effect";
  const causes = schema.causes || [];
  const effect = schema.effect || "Effect";
  
  const startY = 60;
  const causeH = 40;
  const gap = 16;
  const leftX = 40;
  
  const totalCauseH = causes.length * causeH + Math.max(0, causes.length - 1) * gap;
  const effectH = Math.max(80, totalCauseH * 0.6);
  
  const midY = startY + totalCauseH / 2;
  const effectY = midY - effectH / 2;
  
  const H = Math.max(startY + totalCauseH + 40, effectY + effectH + 40);
  
  let content = `<text x="280" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  causes.forEach((cause, i) => {
    const y = startY + i * (causeH + gap);
    
    content += `<rect x="${leftX}" y="${y}" width="180" height="${causeH}" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1"/>`;
    content += `<text x="${leftX + 90}" y="${y + 20}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#1a1a1a">${cause}</text>`;
    
    const startX = leftX + 180;
    const endX = 350;
    const lineY = y + causeH / 2;
    content += `<path d="M${startX} ${lineY} L${endX} ${midY}" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr)"/>`;
  });
  
  content += `<rect x="350" y="${effectY}" width="180" height="${effectH}" rx="6" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>`;
  content += `<text x="440" y="${midY}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#1e40af">${effect}</text>`;
  
  return getBaseSVG(H, content);
}

function prosCons(schema) {
  const title = schema.title || "Pros & Cons";
  const pros = schema.pros || [];
  const cons = schema.cons || [];
  
  const maxRows = Math.max(pros.length, cons.length);
  const startY = 60;
  const rowH = 40;
  const gap = 8;
  const H = startY + 40 + gap + maxRows * (rowH + gap) + 40;
  
  let content = `<text x="280" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  const leftX = 30;
  const rightX = 290;
  
  content += `<rect x="${leftX}" y="${startY}" width="240" height="40" rx="6" fill="#f0fdf4" stroke="#86efac" stroke-width="1"/>`;
  content += `<text x="${leftX + 120}" y="${startY + 20}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#166534">Pros</text>`;
  
  content += `<rect x="${rightX}" y="${startY}" width="240" height="40" rx="6" fill="#fff1f2" stroke="#fca5a5" stroke-width="1"/>`;
  content += `<text x="${rightX + 120}" y="${startY + 20}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#991b1b">Cons</text>`;
  
  let currY = startY + 40 + gap;
  for (let i = 0; i < maxRows; i++) {
    const y = currY + i * (rowH + gap);
    
    if (pros[i]) {
      content += `<rect x="${leftX}" y="${y}" width="240" height="${rowH}" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`;
      content += `<text x="${leftX + 16}" y="${y + 20}" dominant-baseline="central" font-size="14" font-weight="bold" fill="#166534">✓</text>`;
      content += `<text x="${leftX + 36}" y="${y + 20}" dominant-baseline="central" font-size="13" fill="#1a1a1a">${pros[i]}</text>`;
    }
    
    if (cons[i]) {
      content += `<rect x="${rightX}" y="${y}" width="240" height="${rowH}" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`;
      content += `<text x="${rightX + 16}" y="${y + 20}" dominant-baseline="central" font-size="14" font-weight="bold" fill="#991b1b">✗</text>`;
      content += `<text x="${rightX + 36}" y="${y + 20}" dominant-baseline="central" font-size="13" fill="#1a1a1a">${cons[i]}</text>`;
    }
  }
  
  return getBaseSVG(H, content);
}

function stepList(schema) {
  const title = schema.title || "Steps";
  const steps = schema.steps || [];
  
  const startY = 60;
  let currY = startY;
  
  let content = `<text x="280" y="28" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">${title}</text>`;
  
  steps.forEach(step => {
    const hasDetail = !!step.detail;
    const rowH = hasDetail ? 68 : 48;
    
    content += `<circle cx="56" cy="${currY + 24}" r="16" fill="#6366f1"/>`;
    content += `<text x="56" y="${currY + 24}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="bold" fill="#ffffff">${step.number || ''}</text>`;
    
    content += `<rect x="88" y="${currY}" width="432" height="${rowH}" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>`;
    
    if (hasDetail) {
      content += `<text x="100" y="${currY + 24}" dominant-baseline="central" font-size="14" font-weight="bold" fill="#1a1a1a">${step.label || ''}</text>`;
      content += `<text x="100" y="${currY + 46}" dominant-baseline="central" font-size="12" fill="#6b7280">${step.detail}</text>`;
    } else {
      content += `<text x="100" y="${currY + 24}" dominant-baseline="central" font-size="14" font-weight="bold" fill="#1a1a1a">${step.label || ''}</text>`;
    }
    
    currY += rowH + 12;
  });
  
  return getBaseSVG(currY + 20, content);
}

function fallbackDiagram(schema) {
  const title = (schema && schema.title) ? schema.title : "Diagram unavailable";
  const H = 120;
  let content = `<rect x="40" y="20" width="480" height="80" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>`;
  content += `<text x="280" y="60" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#94a3b8">${title}</text>`;
  return getBaseSVG(H, content);
}

export function templateRouter(schema) {
  if (!schema || typeof schema !== 'object') return fallbackDiagram(schema);
  
  const map = {
    process_flow:  processFlow,
    hierarchy:     conceptHierarchy,
    compare:       comparisonTable,
    timeline:      timeline,
    cycle:         cycleDiagram,
    formula:       formulaBreakdown,
    mindmap:       mindMap,
    cause_effect:  causeEffect,
    pros_cons:     prosCons,
    step_list:     stepList,
  };

  const fn = map[schema.type];
  if (!fn) return fallbackDiagram(schema);

  try {
    return fn(schema);
  } catch (e) {
    console.warn('[PYICE] SVG template error for type:', schema.type, e);
    return fallbackDiagram(schema);
  }
}
