import React, { useState } from 'react';
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react';

export type FileNode = {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  path: string;
  content?: string;
};

export const FileExplorer = ({ fileTree, onFileSelect }: { fileTree: FileNode[], onFileSelect: (file: FileNode) => void }) => {
  return (
    <div className="bg-gray-900 text-gray-300 p-4  h-full overflow-y-auto">
      <h2 className="text-white font-bold mb-4">Files</h2>
      {fileTree.map(node => (
        <FileNodeItem key={node.path} node={node} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
};

const FileNodeItem = ({ node, onFileSelect }: { node: FileNode, onFileSelect: (file: FileNode) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = node.type === 'folder';

  return (
    <div className="ml-2">
      <div 
        className="flex items-center cursor-pointer hover:text-white py-1"
        onClick={() => {
          if (isFolder) setIsOpen(!isOpen);
          else onFileSelect(node);
        }}
      >
        {isFolder ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <File size={16} className="mr-2" />}
        {isFolder && <Folder size={16} className="mr-2 text-blue-400" />}
        {node.name}
      </div>
      {isOpen && node.children?.map(child => (
        <FileNodeItem key={child.path} node={child} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
};
