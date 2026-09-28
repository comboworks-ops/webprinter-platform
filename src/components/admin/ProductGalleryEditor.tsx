import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { WorkspaceImageInput } from './WorkspaceImageInput';
import { type ProductGalleryImage } from '@/lib/products/productGallery';

export type GalleryOptionSection = { id: string; title: string; values: { id: string; name: string }[] };
export function ProductGalleryEditor({ images, sections, tenantId, productId, onChange }: {
  images: ProductGalleryImage[]; sections: GalleryOptionSection[]; tenantId: string; productId: string;
  onChange: (images: ProductGalleryImage[]) => void;
}) {
  const patch = (id: string, change: Partial<ProductGalleryImage>) => onChange(images.map(image => image.id === id ? { ...image, ...change } : image));
  const move = (index: number, offset: number) => { const next = [...images]; next.splice(index + offset, 0, next.splice(index, 1)[0]); onChange(next); };
  const add = (conditional: boolean) => onChange([...images, { id: crypto.randomUUID(), url: '', alt: '', conditions: conditional ? [{ sectionId: '', valueId: '' }] : [] }]);
  return <div className="pw-gallery-editor">
    <h3>Billedgalleri</h3>
    <p>Generelle billeder vises som små billeder under hovedbilledet. Konfigurationsbilleder vises, når kundens valg matcher. Det mest præcise match vinder; ved lige mange valg bruges det øverste billede.</p>
    {images.map((image, index) => <fieldset key={image.id} className="pw-gallery-entry">
      <legend>{image.conditions.length ? 'Konfigurationsbillede' : 'Galleribillede'} {index + 1}</legend>
      <WorkspaceImageInput label={`Billede ${index + 1}`} value={image.url} tenantId={tenantId} productId={productId} onChange={url => patch(image.id, { url })} />
      <label>Billedtekst<input value={image.alt} placeholder="Fx A4 med tryk indvendigt" onChange={event => patch(image.id, { alt: event.target.value })} /></label>
      {image.conditions.length > 0 && <p>Vis billedet, når alle disse valg er valgt:</p>}
      {image.conditions.map((condition, conditionIndex) => {
        const source = sections.find(section => section.id === condition.sectionId);
        const changeCondition = (sectionId: string, valueId: string) => patch(image.id, { conditions: image.conditions.map((item, i) => i === conditionIndex ? { sectionId, valueId } : item) });
        return <div className="pw-gallery-condition" key={conditionIndex}>
          <label>Valggruppe<select aria-label={`Valggruppe ${conditionIndex + 1} for billede ${index + 1}`} value={condition.sectionId} onChange={event => changeCondition(event.target.value, '')}>
            <option value="">Vælg gruppe…</option>
            {!source && condition.sectionId && <option value={condition.sectionId}>Gruppen findes ikke længere</option>}
            {sections.filter(section => section.id === condition.sectionId || !image.conditions.some(item => item.sectionId === section.id)).map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select></label>
          <label>Valg<select aria-label={`Valg ${conditionIndex + 1} for billede ${index + 1}`} value={condition.valueId} disabled={!source} onChange={event => changeCondition(condition.sectionId, event.target.value)}>
            <option value="">Vælg mulighed…</option>
            {condition.valueId && !source?.values.some(value => value.id === condition.valueId) && <option value={condition.valueId}>Valget findes ikke længere</option>}
            {source?.values.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>
          <button type="button" aria-label={`Fjern betingelse ${conditionIndex + 1} fra billede ${index + 1}`} onClick={() => patch(image.id, { conditions: image.conditions.filter((_, i) => i !== conditionIndex) })}><Trash2 size={15}/></button>
        </div>;
      })}
      {image.conditions.some(condition => !sections.some(section => section.id === condition.sectionId && section.values.some(value => value.id === condition.valueId))) && <small>Vælg en gyldig gruppe og mulighed. Billedet vises først, når betingelserne er udfyldt.</small>}
      <div className="pw-gallery-actions">
        <button type="button" disabled={image.conditions.length >= sections.length} onClick={() => patch(image.id, { conditions: [...image.conditions, { sectionId: '', valueId: '' }] })}><Plus size={14}/>Tilføj betingelse</button>
        <button type="button" aria-label={`Flyt billede ${index + 1} op`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14}/></button>
        <button type="button" aria-label={`Flyt billede ${index + 1} ned`} disabled={index === images.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14}/></button>
        <button type="button" aria-label={`Fjern billede ${index + 1} fra galleriet`} onClick={() => onChange(images.filter(item => item.id !== image.id))}><Trash2 size={14}/>Fjern</button>
      </div>
    </fieldset>)}
    <div className="pw-gallery-actions">
      <button type="button" onClick={() => add(false)}><Plus size={15}/>Tilføj galleribillede</button>
      <button type="button" disabled={!sections.length} onClick={() => add(true)}><Plus size={15}/>Tilføj konfigurationsbillede</button>
    </div>
    {!sections.length && <small>Konfigurationsbilleder kan knyttes til valg, når produktets valggrupper er oprettet.</small>}
  </div>;
}
