import React, { useRef, useEffect } from 'react';

interface CanvasRendererProps {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
  className?: string;
}

function CanvasRenderer({ width, height, draw, className }: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx);
  }, [draw, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
}

export default React.memo(CanvasRenderer);
