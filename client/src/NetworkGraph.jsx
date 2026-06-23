import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { Maximize2, Minimize2 } from 'lucide-react';

const LINK_COLORS = {
  gang_member: '#ef4444',     // Bright Red
  associate: '#3b82f6',       // Bright Blue
  family: '#22c55e',          // Bright Green
  'prior_co-accused': '#f97316', // Bright Orange
};

export default function NetworkGraph({ accused, links }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 450 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle Responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({ 
          width: entry.contentRect.width, 
          height: entry.contentRect.height > 100 ? entry.contentRect.height : 450 
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isFullscreen]);

  useEffect(() => {
    if (!accused?.length || !links?.length || dimensions.width === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;

    const nodeMap = new Map();
    accused.forEach((a) => {
      nodeMap.set(String(a.ROWID), {
        id: String(a.ROWID),
        name: a.name || 'Unknown',
        age: a.age,
        gender: a.gender,
        priorRecord: a.prior_record,
      });
    });

    const validLinks = links
      .filter((l) => nodeMap.has(String(l.accused_id_1)) && nodeMap.has(String(l.accused_id_2)))
      .map((l) => ({
        source: String(l.accused_id_1),
        target: String(l.accused_id_2),
        type: l.link_type,
      }));

    const connectedIds = new Set();
    validLinks.forEach((l) => {
      connectedIds.add(l.source);
      connectedIds.add(l.target);
    });
    const nodes = Array.from(nodeMap.values()).filter((n) => connectedIds.has(n.id));

    if (nodes.length === 0 || validLinks.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);

    // Define Premium SVG Filters (Drop Shadow)
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks).id((d) => d.id).distance(160).strength(0.8))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(75))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // Draw Smooth Bezier Curve Links
    const link = svg
      .append('g')
      .selectAll('path')
      .data(validLinks)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => LINK_COLORS[d.type] || '#94a3b8')
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.6);

    const linkLabel = svg
      .append('g')
      .selectAll('text')
      .data(validLinks)
      .join('text')
      .text((d) => d.type.replace('_', ' '))
      .attr('font-size', 10)
      .attr('fill', '#64748b')
      .attr('font-weight', 600)
      .attr('text-anchor', 'middle');

    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(
        d3.drag()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded)
      )
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).select('circle').attr('stroke', '#38bdf8').attr('stroke-width', 3);
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY - 20,
          data: d
        });
      })
      .on('mousemove', (event, d) => {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY - 20 }));
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).select('circle').attr('stroke', '#ffffff').attr('stroke-width', 2);
        setTooltip({ visible: false, x: 0, y: 0, data: null });
      });

    // Premium Node Circles
    node
      .append('circle')
      .attr('r', 24)
      .attr('fill', '#0f172a') // Deep navy background
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('filter', 'url(#glow)');

    // Inner Text (Initials)
    node
      .append('text')
      .text((d) => d.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase())
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('fill', '#ffffff')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('letter-spacing', '1px');

    // Name Label below node
    node
      .append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', 42)
      .attr('font-size', 11)
      .attr('fill', '#1e293b')
      .attr('font-weight', 600);

    const nodeRadius = 24;

    simulation.on('tick', () => {
      // Keep nodes within boundaries
      nodes.forEach((d) => {
        d.x = Math.max(nodeRadius + 50, Math.min(width - nodeRadius - 50, d.x));
        d.y = Math.max(nodeRadius + 30, Math.min(height - nodeRadius - 30, d.y));
      });

      // Update curved paths
      link.attr('d', (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curve factor
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      linkLabel
        .attr('x', (d) => {
          // Midpoint of arc approx
          return (d.source.x + d.target.x) / 2 + (d.source.y > d.target.y ? 15 : -15);
        })
        .attr('y', (d) => {
          return (d.source.y + d.target.y) / 2 + (d.source.x < d.target.x ? 15 : -15);
        });

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => simulation.stop();
  }, [accused, links, dimensions, isFullscreen]);

  const hasData = accused?.length > 0 && links?.length > 0;

  const graphContent = (
    <>
      {!hasData ? (
        <div className="text-sm text-slate-400 py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No interconnected criminal network found in this result set.
        </div>
      ) : (
        <div className={`bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden relative shadow-sm ${isFullscreen ? 'w-full h-full shadow-2xl bg-white' : 'w-full h-full'}`}>
          <svg ref={svgRef} className="w-full h-full" />
          
          <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white/80 backdrop-blur px-4 py-3 rounded-xl border border-slate-200/60 shadow-sm">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Network Links</div>
            {Object.entries(LINK_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 text-xs font-semibold text-slate-700 capitalize">
                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                {type.replace('_', ' ')}
              </div>
            ))}
          </div>

          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur rounded-xl border border-slate-200/60 shadow-sm text-slate-500 hover:text-slate-900 hover:bg-white transition-all active:scale-95 z-50"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          {/* Premium Glassmorphic Tooltip */}
          {tooltip.visible && tooltip.data && (
            <div 
              className="fixed z-50 pointer-events-none transition-transform duration-75"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700/50 min-w-[200px]">
                <div className="font-bold text-sm mb-1">{tooltip.data.name}</div>
                <div className="text-xs text-slate-300 flex items-center gap-2 mb-2">
                  <span className="bg-slate-800 px-2 py-0.5 rounded-md">{tooltip.data.gender || 'Unknown'}</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded-md">Age: {tooltip.data.age || 'N/A'}</span>
                </div>
                {tooltip.data.priorRecord && (
                  <div className="text-[10px] text-red-300 font-medium bg-red-500/10 px-2 py-1.5 rounded-md border border-red-500/20">
                    ⚠ {tooltip.data.priorRecord}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isFullscreen) {
    return createPortal(
      <div 
        ref={containerRef} 
        className="fixed inset-0 z-[9999] bg-slate-50/95 backdrop-blur-sm p-6 flex flex-col w-screen h-screen"
      >
        {graphContent}
      </div>,
      document.body
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full relative h-[450px]"
    >
      {graphContent}
    </div>
  );
}