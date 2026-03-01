import { useMemo, useState } from 'react';
import { ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react';

interface FileExplorerProps {
  filePaths: string[];
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
}

type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: Record<string, FileNode>;
};

const ROOT_PATH = 'testbench/blog';

function createDirNode(name: string, path: string): FileNode {
  return { name, path, type: 'dir', children: {} };
}

function createFileNode(name: string, path: string): FileNode {
  return { name, path, type: 'file', children: {} };
}

export default function FileExplorer({ filePaths, selectedFile, onSelectFile }: FileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    () => new Set(['testbench/blog', 'testbench/blog/src', 'testbench/blog/database', 'testbench/blog/database/posts']),
  );

  const tree = useMemo(() => {
    const root = createDirNode('blog', ROOT_PATH);

    const scopedPaths = filePaths
      .filter((path) => path.startsWith(`${ROOT_PATH}/`))
      .sort((a, b) => a.localeCompare(b));

    for (const fullPath of scopedPaths) {
      const relative = fullPath.replace(`${ROOT_PATH}/`, '');
      const segments = relative.split('/').filter(Boolean);

      let cursor = root;
      segments.forEach((segment, index) => {
        const isFile = index === segments.length - 1;
        const nodePath = `${ROOT_PATH}/${segments.slice(0, index + 1).join('/')}`;

        if (!cursor.children[segment]) {
          cursor.children[segment] = isFile
            ? createFileNode(segment, nodePath)
            : createDirNode(segment, nodePath);
        }

        cursor = cursor.children[segment];
      });
    }

    return root;
  }, [filePaths]);

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: FileNode, depth = 0) => {
    if (node.type === 'file') {
      const isSelected = selectedFile === node.path;
      return (
        <button
          key={node.path}
          onClick={() => onSelectFile(node.path)}
          className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left text-xs font-mono transition-colors ${
            isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <FileCode2 size={13} className="shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      );
    }

    const isOpen = expandedDirs.has(node.path);
    const children = Object.values(node.children).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    return (
      <div key={node.path}>
        <button
          onClick={() => toggleDir(node.path)}
          className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left text-xs font-mono text-gray-300 hover:bg-white/5"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <ChevronRight size={13} className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          {isOpen ? <FolderOpen size={13} className="text-emerald-300" /> : <Folder size={13} className="text-gray-400" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && <div>{children.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <div className="h-full w-[320px] shrink-0 border-r border-white/10 bg-[#111111] flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-500 shrink-0">
        File Explorer
      </div>
      <div className="p-2 overflow-y-auto overflow-x-auto min-h-0">{renderNode(tree)}</div>
    </div>
  );
}
