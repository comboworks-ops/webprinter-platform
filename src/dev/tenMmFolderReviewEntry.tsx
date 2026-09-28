import { createRoot, type Root } from 'react-dom/client';
import { A4_TEN_MM_FOLDER } from '@/lib/mockup/tenMmFolderDefinition';
import { SpineFolderReview } from './SpineFolderReview';
if (import.meta.env.DEV) {
  const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<SpineFolderReview definition={A4_TEN_MM_FOLDER} />);
}
