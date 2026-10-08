import { PDFDocument, PDFName, PDFString, PDFOperator, PDFOperatorNames, StandardFonts, rgb } from 'pdf-lib';
import type { RollLabelReviewProfile } from '@/lib/products/rollLabelReview';
import { rollLabelSizeGuide } from '../products/rollLabelSizeGeometry';

/** Candidate-only, source-bound vector template. Retail readiness and special
 * ink support are independent; this adds no printing mask or order approval. */
export async function generateRollLabelSizeTemplate(profile: RollLabelReviewProfile, widthMm: number, heightMm: number) {
  const guide = rollLabelSizeGuide(profile,widthMm,heightMm);
  if (!guide?.vectorGuide) throw Error('Mål eller dokumenterede skabelonregler mangler.');
  const geometry = guide.vectorGuide.pages[0], pt = 72/25.4;
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date('2026-10-06T00:00:00Z')); pdf.setModificationDate(new Date('2026-10-06T00:00:00Z'));
  pdf.setProducer('Webprinter dimension template v1');
  const page = pdf.addPage([geometry.widthPt,geometry.heightPt]);
  page.setCropBox(0,0,geometry.widthPt,geometry.heightPt); page.setBleedBox(0,0,geometry.widthPt,geometry.heightPt);
  page.setTrimBox(guide.bleedMm*pt,guide.bleedMm*pt,widthMm*pt,heightMm*pt);
  page.setArtBox(guide.bleedMm*pt,guide.bleedMm*pt,widthMm*pt,heightMm*pt);
  const layer = (name:string) => pdf.context.register(pdf.context.obj({Type:'OCG',Name:PDFString.of(name),
    Usage:{View:{ViewState:'ON'},Print:{PrintState:'OFF'},Export:{ExportState:'OFF'}}}));
  const geometryLayer = layer('Stans, udfald og sikkerhed - ikke til tryk');
  const infoLayer = layer('Dansk tegnforklaring - ikke til tryk');
  page.node.Resources()!.set(PDFName.of('Properties'),pdf.context.obj({Geometry:geometryLayer,Info:infoLayer}));
  const layers = [geometryLayer,infoLayer];
  pdf.catalog.set(PDFName.of('OCProperties'),pdf.context.obj({OCGs:layers,D:{ON:layers,Order:layers,
    AS:['View','Print','Export'].map(Event=>({Event,OCGs:layers,Category:[Event]}))}}));
  const begin = (key:string)=>page.pushOperators(PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence,[PDFName.of('OC'),PDFName.of(key)]));
  const end = ()=>page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
  const colors = {data:rgb(55/255,65/255,81/255),cut:rgb(236/255,0,140/255),safe:rgb(47/255,128/255,237/255)};
  begin('Geometry');
  for (const path of geometry.paths) page.drawSvgPath(path.d,{x:0,y:geometry.heightPt,scale:1,borderWidth:0.5,
    borderColor:colors[path.role as keyof typeof colors],...(path.role==='cut'?{borderDashArray:[4,2]}:{})});
  end();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const labels = ['Dataformat / udfald','Stans / slutformat','Sikkerhedsafstand'];
  const padding = 3, swatch = 7, gap = 3;
  const safeW = (widthMm-2*guide.safeAreaMm)*pt, safeH = (heightMm-2*guide.safeAreaMm)*pt;
  let size = 0, panelW = 0, panelH = 0;
  for (const candidate of [8,7,6,5]) {
    const w = Math.max(...labels.map(label=>font.widthOfTextAtSize(label,candidate)))+2*padding+swatch+gap;
    const h = 3*(candidate+3)+2*padding;
    const fits = profile.format.shape==='circle' ? (w/safeW)**2+(h/safeH)**2 < 0.95 : w<safeW-2&&h<safeH-2;
    if (fits) { size=candidate;panelW=w;panelH=h;break; }
  }
  if (!size) {
    // At small valid sizes the safe area cannot hold an information panel.
    // Use the documented bleed bands, with explicit compact Danish labels.
    // The cut and safety paths remain entirely unobscured; no page is enlarged.
    const fontPt=6, pad=1, lineWidth=3, lineGap=1, bandH=fontPt+2*pad;
    const rows=[['Data','Stans'],['Sikkerhed']];
    const fullLabels=['Dataformat / udfald','Stans / slutformat','Sikkerhedsafstand'];
    const widths=rows.map(row=>row.map(text=>font.widthOfTextAtSize(text,fontPt)+2*pad+lineWidth+lineGap));
    const bandWidths=widths.map(row=>row.reduce((sum,w)=>sum+w,0));
    const edge=0.25, bleedPt=guide.bleedMm*pt;
    if (bandH+2*edge>bleedPt || bandWidths.some(w=>w+2*edge>geometry.widthPt)) {
      throw Error('En læsbar tegnforklaring passer ikke i dette format. Brug den præcise filguide.');
    }
    const panels:number[][]=[],textBounds:Array<{text:string;fullLabel:string;bboxPt:number[]}> = [];
    let labelIndex=0;
    begin('Info');
    for (const [rowIndex,row] of rows.entries()) {
      const x=(geometry.widthPt-bandWidths[rowIndex])/2;
      const y=rowIndex===0?geometry.heightPt-bleedPt+edge:edge;
      panels.push([x,y,x+bandWidths[rowIndex],y+bandH]);
      page.drawRectangle({x,y,width:bandWidths[rowIndex],height:bandH,color:rgb(14/255,165/255,233/255)});
      let cellX=x;
      for (const [column,text] of row.entries()) {
        const baseline=y+pad,tx=cellX+pad+lineWidth+lineGap;
        page.drawLine({start:{x:cellX+pad,y:baseline+fontPt/3},end:{x:cellX+pad+lineWidth,y:baseline+fontPt/3},
          thickness:0.6,color:[colors.data,colors.cut,colors.safe][labelIndex],...(labelIndex===1?{dashArray:[1,1]}:{})});
        page.drawText(text,{x:tx,y:baseline,size:fontPt,font,color:rgb(1,1,1)});
        const bboxPt=[tx,baseline,tx+font.widthOfTextAtSize(text,fontPt),baseline+fontPt];
        if (bboxPt[2]>cellX+widths[rowIndex][column]-pad+0.001) throw Error('Skabelontekst overskrider panelet.');
        textBounds.push({text,fullLabel:fullLabels[labelIndex],bboxPt});
        cellX+=widths[rowIndex][column];labelIndex++;
      }
    }
    end();
    return {bytes:await pdf.save(),guide,
      legend:{fontPt,panelPt:[Math.min(...panels.map(p=>p[0])),panels[1][1],Math.max(...panels.map(p=>p[2])),panels[0][3]],
        panelsPt:panels,paddingPt:pad,textBounds,layout:'bleed_bands'},
      geometryContractSha256:profile.sizeGeometry!.sha256,DesignerAcceptance:false};
  }
  const x = (geometry.widthPt-panelW)/2, y = (geometry.heightPt-panelH)/2;
  const textBounds:Array<{text:string;bboxPt:number[]}> = [];
  begin('Info');
  page.drawRectangle({x,y,width:panelW,height:panelH,color:rgb(14/255,165/255,233/255)});
  for (const [i,label] of labels.entries()) {
    const baseline = y+panelH-padding-size-i*(size+3), tx=x+padding+swatch+gap;
    page.drawLine({start:{x:x+padding,y:baseline+size/3},end:{x:x+padding+swatch,y:baseline+size/3},
      thickness:0.6,color:[colors.data,colors.cut,colors.safe][i],...(i===1?{dashArray:[2,1]}:{})});
    page.drawText(label,{x:tx,y:baseline,size,font,color:rgb(1,1,1)});
    const bboxPt = [tx,baseline,tx+font.widthOfTextAtSize(label,size),baseline+size];
    if (bboxPt[2]>x+panelW-padding+0.001 || baseline<y+padding) throw Error('Skabelontekst overskrider panelet.');
    textBounds.push({text:label,bboxPt});
  }
  end();
  return {bytes:await pdf.save(),guide,legend:{fontPt:size,panelPt:[x,y,x+panelW,y+panelH],paddingPt:padding,textBounds},
    geometryContractSha256:profile.sizeGeometry!.sha256,DesignerAcceptance:false};
}
