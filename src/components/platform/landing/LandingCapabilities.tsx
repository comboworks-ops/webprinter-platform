import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, FileCheck2, FolderOpen, PenLine } from 'lucide-react';
import { platformNavLink } from '@/lib/platform/context';
import { LandingCalculator } from './LandingCalculator';

const capabilities = [
  { id: 'beregner', label: 'Prisberegning', icon: Calculator },
  { id: 'designer', label: 'Online designer', icon: PenLine },
  { id: 'ordrer', label: 'Ordreoverblik', icon: FolderOpen },
] as const;

export function LandingCapabilities() {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % capabilities.length
      : event.key === 'ArrowLeft' ? (index + capabilities.length - 1) % capabilities.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? capabilities.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  };
  return (
    <div className="wp-capabilities">
      <div className="wp-capability-tabs" role="tablist" aria-label="Udforsk systemets muligheder">
        {capabilities.map((item, index) => (
          <button key={item.id} ref={element => { buttons.current[index] = element; }}
            id={`capability-tab-${item.id}`} role="tab" type="button"
            aria-selected={selected === index} aria-controls={`capability-panel-${item.id}`}
            tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)}
            onKeyDown={event => onTabKey(event, index)}>
            <item.icon size={18} aria-hidden="true" /><span>{item.label}</span>
          </button>
        ))}
      </div>
      <div id="capability-panel-beregner" role="tabpanel" aria-labelledby="capability-tab-beregner" hidden={selected !== 0} tabIndex={0}>
        <div className="wp-capability-intro">
          <h3>Prisen følger kundens valg.</h3>
          <p>Formater, materialer og antal i din egen webshop. Prøv et enkelt eksempel her.</p>
        </div>
        <LandingCalculator />
      </div>
      <div id="capability-panel-designer" role="tabpanel" aria-labelledby="capability-tab-designer" hidden={selected !== 1} tabIndex={0}>
        <div className="wp-capability-intro">
          <h3>Fra idé til trykfil i browseren.</h3>
          <p>Tekst, billeder og PDF med skabeloner og hjælpelinjer til den valgte tryksag.</p>
        </div>
        <figure className="wp-capability-designer">
          <img src="/platform/landing/designer.webp" width="1505" height="1045" loading="lazy" alt="Illustration af Webprinters designer med værktøjer, printlayout og lagpanel" />
          <figcaption>Online designer · illustrativt eksempel</figcaption>
        </figure>
        <Link className="wp-text-link" to={platformNavLink('/online-designer')}>Om designeren <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <div id="capability-panel-ordrer" role="tabpanel" aria-labelledby="capability-tab-ordrer" hidden={selected !== 2} tabIndex={0}>
        <div className="wp-capability-intro">
          <h3>Ordren og filerne. Samme sted.</h3>
          <p>Hold styr på kundens valg og følg arbejdet videre fra ét samlet overblik.</p>
        </div>
        <ol className="wp-order-capabilities">
          <li><Calculator size={22} aria-hidden="true" /><div><h4>Ordreoplysninger</h4><p>Produkt, valgte mål, materialer og antal.</p></div></li>
          <li><FolderOpen size={22} aria-hidden="true" /><div><h4>Kundens filer</h4><p>Design og uploadede trykfiler knyttet til ordren.</p></div></li>
          <li><FileCheck2 size={22} aria-hidden="true" /><div><h4>Status og overblik</h4><p>Følg ordrerne i trykkeriets administration.</p></div></li>
        </ol>
        <Link className="wp-text-link" to={platformNavLink('/order-flow')}>Om ordreflowet <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
