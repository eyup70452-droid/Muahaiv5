import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { memoryStore, MemoryEntry } from "../core/memory/memoryStore";

export default function CognitiveGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>(memoryStore.getMemories());

  useEffect(() => {
    return memoryStore.subscribe(() => {
      setMemories([...memoryStore.getMemories()]);
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || memories.length === 0) return;

    const width = 600;
    const height = 400;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    svg.selectAll("*").remove();

    const nodes = [
      { id: "OS_CORE", group: 0, label: "AI OS", radius: 10 },
      ...memories.map(m => ({
        id: m.id,
        group: m.category === 'rule' ? 1 : m.category === 'preference' ? 2 : m.category === 'project' ? 3 : 4,
        label: m.content.substring(0, 15) + "...",
        radius: 6
      }))
    ];

    const links = memories.map(m => ({
      source: "OS_CORE",
      target: m.id
    }));

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "#27272a")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    const node = svg.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => {
        if (d.id === "OS_CORE") return "#6366f1";
        if (d.group === 1) return "#f43f5e"; // rule
        if (d.group === 2) return "#f59e0b"; // preference
        if (d.group === 3) return "#06b6d4"; // project
        return "#818cf8"; // fact
      })
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    node.append("title")
      .text(d => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [memories]);

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-700 bg-zinc-950/20 rounded-2xl border border-zinc-900/50">
        <span className="text-xs uppercase font-mono tracking-widest">Bağlantı Grafiği Hazırlanıyor...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-zinc-950/20 rounded-2xl border border-zinc-900/50 overflow-hidden relative">
      <div className="absolute top-4 left-4 flex gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-[9px] text-zinc-500 uppercase font-bold">Kurallar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] text-zinc-500 uppercase font-bold">Tercihler</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <span className="text-[9px] text-zinc-500 uppercase font-bold">Projeler</span>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
