import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
      setIsInitialized(true);
    }
  }, [isInitialized]);

  useLayoutEffect(() => {
    if (!isInitialized || !containerRef.current) return;

    const renderChart = async () => {
      try {
        containerRef.current!.innerHTML = '';

        let decodedChart: string;
        try {
          decodedChart = atob(chart);
          // decodedChart = decodedChart.replace(/^MERMAID_START\n|\nMERMAID_END$/g, '').trim();
        } catch (e) {
          decodedChart = chart;
        }

        const { svg } = await mermaid.render('mermaid-diagram', decodedChart);
        containerRef.current!.innerHTML = svg;

        const svgElement = containerRef.current!.querySelector('svg');
        if (svgElement) {
          svgElement.setAttribute('width', '100%');
          svgElement.removeAttribute('height');
          svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }

        setError(null);
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        setError(`Error rendering diagram: ${err.message}`);
      }
    };

    renderChart();
  }, [chart, isInitialized]);

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', minHeight: '100px', textAlign: 'center' }} />
      {error && <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div>
  );
};

export default MermaidDiagram;