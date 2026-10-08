export type ExactGuideGeometry = {
  version: 1; articleId: string; templateSha256: string | null; geometryContractSha256?: string;
  pages: Array<{widthPt:number;heightPt:number;label:string;
    paths:Array<{role:string;d:string}>;labels:Array<{text:string;x:number;y:number}>}>;
};
