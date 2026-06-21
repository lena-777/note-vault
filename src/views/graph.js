import { getGoals, getSubtopics, getSources, getNotes, getNoteRelations } from '../store/db.js';
import { cSelect, initCustomSelects } from '../utils/helpers.js';
import { navigate } from '../app.js';

export async function renderGraph(filter = {}) {
  const goals = await getGoals();
  const goalOptions = [{ value:'',label:'全部目标'}, ...goals.map(g => ({value:g.id,label:g.title}))];
  return `
    <div class="page-header">
      <div><div class="page-title">知识图谱</div><div class="page-subtitle">以目标为中心，查看知识网络</div></div>
      ${cSelect('graph-goal-filter', goalOptions, filter.goalId || '', { style: 'width:220px' })}
    </div>
    <div class="graph-legend">
      <div class="legend-item"><div class="legend-dot" style="background:#9b87e8"></div>目标</div>
      <div class="legend-item"><div class="legend-dot" style="background:#80c8e8"></div>子问题</div>
      <div class="legend-item"><div class="legend-dot" style="background:#98d4a8"></div>文章</div>
      <div class="legend-item"><div class="legend-dot" style="background:#f5c94e"></div>重点卡片</div>
    </div>
    <div id="graph-container"><div class="graph-tooltip" id="graph-tooltip"></div></div>
  `;
}

export function bindGraph(filter = {}) {
  initCustomSelects((id, value) => {
    if (id === 'graph-goal-filter') navigate('graph', { goalId: value || undefined });
  });
  requestAnimationFrame(() => drawGraph(filter));
}

async function drawGraph(filter = {}) {
  const container = document.getElementById('graph-container');
  if (!container) return;

  const allGoals = await getGoals();
  const goals = filter.goalId ? allGoals.filter(g => g.id === filter.goalId) : allGoals;
  if (goals.length === 0) {
    container.innerHTML = '<div class="empty-state" style="height:100%"><div class="empty-icon">⋈</div><div class="empty-text">暂无数据可展示</div></div>';
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  const nodes = [], links = [], nodeMap = {};
  const addNode = n => { if (!nodeMap[n.id]) { nodeMap[n.id] = n; nodes.push(n); } };

  for (const g of goals) {
    addNode({ id:`g_${g.id}`, label:g.title, type:'goal', rawId:g.id });
    const subs = await getSubtopics(g.id);
    for (const s of subs) {
      addNode({ id:`s_${s.id}`, label:s.title, type:'subtopic', rawId:s.id });
      links.push({ source:`g_${g.id}`, target:`s_${s.id}`, type:'hierarchy' });
      const notes = await getNotes({ subtopicId: s.id });
      for (const n of notes) {
        addNode({ id:`n_${n.id}`, label:n.content.slice(0,30), type:'note', rawId:n.id });
        links.push({ source:`s_${s.id}`, target:`n_${n.id}`, type:'hierarchy' });
      }
    }
    const srcs = await getSources(g.id);
    for (const src of srcs) {
      addNode({ id:`src_${src.id}`, label:src.title, type:'source', rawId:src.id });
      links.push({ source:`g_${g.id}`, target:`src_${src.id}`, type:'hierarchy' });
    }
  }

  const noteIds = nodes.filter(n => n.type === 'note').map(n => n.rawId);
  const seen = new Set();
  for (const nid of noteIds) {
    const rels = await getNoteRelations(nid);
    for (const r of rels) {
      if (seen.has(r.id)) continue; seen.add(r.id);
      if (nodeMap[`n_${r.fromId}`] && nodeMap[`n_${r.toId}`])
        links.push({ source:`n_${r.fromId}`, target:`n_${r.toId}`, type:r.type });
    }
  }

  const colorMap = { goal:'#9b87e8', subtopic:'#80c8e8', source:'#98d4a8', note:'#f5c94e' };
  const sizeMap  = { goal:20, subtopic:14, source:12, note:9 };
  const linkColor = { hierarchy:'#e0daf0', support:'#6cc798', extend:'#9b87e8', conflict:'#e88080', sequence:'#80a8e8' };
  const linkDash  = { hierarchy:'0', support:'0', extend:'4,2', conflict:'0', sequence:'2,2' };

  const svg = d3.select('#graph-container').append('svg').attr('width', width).attr('height', height);
  svg.append('defs').append('marker').attr('id','arrowhead').attr('viewBox','0 -3 6 6').attr('refX',12).attr('refY',0).attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto')
    .append('path').attr('d','M0,-3L6,0L0,3').attr('fill','#c0b8e0');
  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.2,3]).on('zoom', e => g.attr('transform', e.transform)));

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id).distance(d => d.type==='hierarchy'?90:140).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('collision', d3.forceCollide().radius(d => sizeMap[d.type]+10));

  const link = g.append('g').selectAll('line').data(links).enter().append('line')
    .attr('stroke', d => linkColor[d.type]||'#e0daf0')
    .attr('stroke-width', d => d.type==='hierarchy'?1:2)
    .attr('stroke-dasharray', d => linkDash[d.type]||'0')
    .attr('opacity', 0.7)
    .attr('marker-end', d => d.type!=='hierarchy'?'url(#arrowhead)':null);

  const node = g.append('g').selectAll('g').data(nodes).enter().append('g')
    .call(d3.drag()
      .on('start', (e,d) => { if(!e.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
      .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y; })
      .on('end',   (e,d) => { if(!e.active) simulation.alphaTarget(0); d.fx=null; d.fy=null; }));

  node.append('circle').attr('r', d=>sizeMap[d.type]).attr('fill', d=>colorMap[d.type]).attr('stroke','#fff').attr('stroke-width',2).style('cursor','pointer');
  node.append('text').attr('dy', d=>sizeMap[d.type]+12).attr('text-anchor','middle').attr('font-size', d=>d.type==='goal'?'12px':'10px').attr('fill','#6b6380').attr('font-weight', d=>d.type==='goal'?'600':'400').text(d=>d.label.slice(0,16)+(d.label.length>16?'…':''));

  const tooltip = document.getElementById('graph-tooltip');
  node.on('mouseover',(e,d)=>{ tooltip.style.opacity='1'; tooltip.style.left=(e.clientX-container.getBoundingClientRect().left+10)+'px'; tooltip.style.top=(e.clientY-container.getBoundingClientRect().top-30)+'px'; tooltip.textContent=d.label; }).on('mouseout',()=>{ tooltip.style.opacity='0'; });

  simulation.on('tick', () => {
    link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('transform', d=>`translate(${d.x},${d.y})`);
  });
}
