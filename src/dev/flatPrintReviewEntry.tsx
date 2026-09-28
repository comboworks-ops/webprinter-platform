import { createRoot, type Root } from 'react-dom/client';
import { Review } from './FlatPrintReview';

if (import.meta.env.DEV) {
  const root: Root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<Review />);
}
