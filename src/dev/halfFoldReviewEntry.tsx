import { createRoot, type Root } from 'react-dom/client';
import { HalfFoldReview } from './HalfFoldReview';

if (import.meta.env.DEV) {
  const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<HalfFoldReview />);
}
