import { useState, useRef, useEffect } from 'react';

interface ResizableColumnHeaderProps {
  columnName: string;
  width: number;
  onResize: (newWidth: number) => void;
  onReorder?: (draggedColumn: string, targetColumn: string) => void;
  children: React.ReactNode;
}

export default function ResizableColumnHeader({
  columnName,
  width,
  onResize,
  onReorder,
  children
}: ResizableColumnHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + delta);
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnName);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onReorder) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedColumn = e.dataTransfer.getData('text/plain');
    if (draggedColumn !== columnName && onReorder) {
      onReorder(draggedColumn, columnName);
    }
    setIsDragging(false);
  };

  return (
    <th
      draggable={!!onReorder}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={() => setIsDragging(false)}
      style={{
        position: 'relative',
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        cursor: isDragging ? 'grabbing' : (onReorder ? 'grab' : 'default'),
        opacity: isDragging ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      {children}
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '8px',
          cursor: 'col-resize',
          backgroundColor: isResizing ? '#007bff' : 'transparent',
          zIndex: 10,
        }}
        onMouseOver={(e) => {
          (e.target as HTMLElement).style.backgroundColor = '#007bff';
        }}
        onMouseOut={(e) => {
          if (!isResizing) {
            (e.target as HTMLElement).style.backgroundColor = 'transparent';
          }
        }}
      />
    </th>
  );
}
