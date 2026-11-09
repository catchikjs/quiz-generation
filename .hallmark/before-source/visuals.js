import { renderMessage } from './render-message.js'

const NS = 'http://www.w3.org/2000/svg'
function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag)
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)))
  if (text !== undefined) node.textContent = text
  return node
}

export function renderVisual(visual) {
  const figure = document.createElement('figure')
  figure.className = `question-visual visual-${visual.type}`
  const heading = document.createElement('div')
  heading.className = 'visual-heading'
  heading.textContent = visual.title || '문제 살펴보기'
  figure.append(heading)
  if (visual.type === 'concept') {
    const cards = document.createElement('div')
    cards.className = 'concept-cards'
    visual.items.forEach((item) => {
      const card = document.createElement('div')
      card.className = 'concept-card'
      renderMessage(card, item.label)
      cards.append(card)
    })
    figure.append(cards)
  } else {
    const svg = svgNode('svg', { viewBox: '0 0 600 240', role: 'img', 'aria-label': `${visual.title}: ${visual.items.map((p) => `${p.label}, ${p.x}${visual.type === 'coordinate' ? `, ${p.y}` : ''}`).join('; ')}` })
    if (visual.type === 'number_line') drawNumberLine(svg, visual.items)
    else if (visual.type === 'bars') drawBars(svg, visual.items)
    else drawCoordinates(svg, visual.items)
    figure.append(svg)
  }
  const caption = document.createElement('figcaption')
  renderMessage(caption, visual.caption)
  figure.append(caption)
  return figure
}

function drawNumberLine(svg, items) {
  const low = Math.min(0, ...items.map((p) => p.x)) - 1
  const high = Math.max(1, ...items.map((p) => p.x)) + 1
  const scale = (x) => 45 + (x - low) / (high - low) * 510
  svg.append(svgNode('line', { x1: 35, y1: 125, x2: 565, y2: 125, class: 'chart-axis' }))
  for (let i = 0; i <= 8; i++) {
    const x = low + (high - low) * i / 8
    svg.append(svgNode('line', { x1: scale(x), y1: 120, x2: scale(x), y2: 130, class: 'chart-tick' }))
    svg.append(svgNode('text', { x: scale(x), y: 155, 'text-anchor': 'middle' }, Number(x.toFixed(2))))
  }
  items.forEach((p, i) => {
    svg.append(svgNode('circle', { cx: scale(p.x), cy: 125, r: 7, class: 'chart-point' }))
    svg.append(svgNode('text', { x: scale(p.x), y: 85 - (i % 2) * 25, 'text-anchor': 'middle' }, `${p.label} (${p.x})`))
  })
}

function drawBars(svg, items) {
  const low = Math.min(0, ...items.map((p) => p.x))
  const high = Math.max(1, ...items.map((p) => p.x))
  const scale = (x) => 160 + (x - low) / (high - low || 1) * 360
  const step = 170 / items.length
  svg.append(svgNode('line', { x1: scale(0), y1: 20, x2: scale(0), y2: 215, class: 'chart-axis' }))
  items.forEach((p, i) => {
    const y = 25 + i * step
    svg.append(svgNode('text', { x: 135, y: y + step / 2 + 5, 'text-anchor': 'end' }, p.label))
    svg.append(svgNode('rect', { x: Math.min(scale(0), scale(p.x)), y, width: Math.max(2, Math.abs(scale(p.x) - scale(0))), height: Math.max(10, step - 10), rx: 5, class: 'chart-bar' }))
    svg.append(svgNode('text', { x: scale(p.x) + 10, y: y + step / 2 + 5 }, p.x))
  })
}

function drawCoordinates(svg, items) {
  const minX = Math.min(-1, ...items.map((p) => p.x)) - 1, maxX = Math.max(1, ...items.map((p) => p.x)) + 1
  const minY = Math.min(-1, ...items.map((p) => p.y)) - 1, maxY = Math.max(1, ...items.map((p) => p.y)) + 1
  const x = (n) => 50 + (n - minX) / (maxX - minX) * 500
  const y = (n) => 205 - (n - minY) / (maxY - minY) * 175
  for (let i = 0; i <= 5; i++) {
    const vx = minX + (maxX - minX) * i / 5, vy = minY + (maxY - minY) * i / 5
    svg.append(svgNode('line', { x1: x(vx), y1: 25, x2: x(vx), y2: 210, class: 'chart-grid' }))
    svg.append(svgNode('line', { x1: 45, y1: y(vy), x2: 560, y2: y(vy), class: 'chart-grid' }))
    svg.append(svgNode('text', { x: x(vx), y: 233, 'text-anchor': 'middle' }, Number(vx.toFixed(1))))
    svg.append(svgNode('text', { x: 35, y: y(vy) + 4, 'text-anchor': 'end' }, Number(vy.toFixed(1))))
  }
  svg.append(svgNode('line', { x1: 45, y1: y(0), x2: 560, y2: y(0), class: 'chart-axis' }))
  svg.append(svgNode('line', { x1: x(0), y1: 25, x2: x(0), y2: 210, class: 'chart-axis' }))
  svg.append(svgNode('polyline', { points: items.map((p) => `${x(p.x)},${y(p.y)}`).join(' '), fill: 'none', class: 'chart-line' }))
  items.forEach((p) => {
    svg.append(svgNode('circle', { cx: x(p.x), cy: y(p.y), r: 5, class: 'chart-point' }))
    svg.append(svgNode('text', { x: x(p.x) + 8, y: y(p.y) - 10 }, p.label))
  })
}
