import type { IconStudioProductKey } from '../../../supabase/functions/_shared/iconStudioCatalog.ts';

/** Authored geometry for free UI previews. Never used as a generation guide or print template. */
export interface ProductIllustration {
  surfaces: readonly string[];
  seams?: string;
  artwork?: readonly [x: number, y: number, width: number, height: number];
}

const sheet = (x: number, y: number, w: number, h: number): ProductIllustration => ({
  surfaces: [`M${x} ${y}h${w}v${h}h-${w}Z`], artwork: [x + 12, y + 16, w - 24, h - 32],
});
const book = (thickness: number): ProductIllustration => ({
  surfaces: ['M59 38H169L185 50V191H72L59 181Z', 'M59 38H169V181H59Z'],
  seams: `M72 38V181M59 181H169L185 191M169 181V38M${171 + thickness} 55V180`,
  artwork: [85, 62, 65, 88],
});
const banner = (mesh = false): ProductIllustration => ({
  surfaces: ['M30 63H210V171H30Z'],
  seams: `M38 73h1M201 73h1M38 161h1M201 161h1${mesh ? 'M45 88H195M45 99H195M45 110H195M45 121H195M45 132H195M45 143H195' : ''}`,
  artwork: [57, 86, 126, 60],
});
const bag = (paper = false): ProductIllustration => ({
  surfaces: [paper ? 'M60 81H168L187 177L172 195H53Z' : 'M53 82H187L176 195H64Z'],
  seams: `M88 92V62C88 25 152 25 152 62V92${paper ? 'M168 81V174L172 195M168 174L187 177' : ''}`,
  artwork: [82, 110, 76, 58],
});
const pad = (carbon = false): ProductIllustration => ({
  surfaces: ['M65 41H176V196H65Z', 'M59 35H170V187H59Z'],
  seams: `M59 54H170M65 191H175${carbon ? 'M72 88H158M72 110H158M72 132H158M72 154H158M114 68V169' : ''}`,
  artwork: carbon ? undefined : [80, 75, 70, 83],
});

// Explicit coverage keeps new catalogue products from silently becoming a generic box.
export const PRODUCT_ILLUSTRATIONS = {
  business_card: sheet(38, 73, 164, 100),
  folded_business_card: { surfaces: ['M35 92L66 60H202L174 92Z', 'M35 92H174V180H35Z'], seams: 'M35 92H174', artwork: [52, 110, 102, 50] },
  flyer: sheet(63, 36, 114, 164),
  leaflet: { surfaces: ['M28 57L88 42L152 57L212 42V179L152 194L88 179L28 194Z'], seams: 'M88 42V179M152 57V194', artwork: [43, 78, 150, 82] },
  brochure: book(1),
  booklet: book(2),
  presentation_folder: { surfaces: ['M27 42L111 59L202 35V165L111 192L27 173Z', 'M111 150L202 124V165L111 192Z', 'M202 35L220 53V143L202 165Z'], seams: 'M111 59V192M111 150L202 124M202 35V165M135 160L165 151M138 172L168 163', artwork: [43, 78, 50, 65] },
  document_folder: { surfaces: ['M35 64H98L112 79H203V187H35Z', 'M35 106L207 94L193 187H35Z'], seams: 'M35 106L207 94', artwork: [68, 123, 95, 42] },
  envelope: { surfaces: ['M29 70H211V175H29Z'], seams: 'M29 70L120 132L211 70M29 175L88 122M211 175L152 122' },
  sticker: { surfaces: ['M56 52H178V154L147 188H56Z', 'M147 188V154H178Z'], seams: 'M147 188V154H178', artwork: [76, 80, 74, 58] },
  product_label: { surfaces: ['M52 64Q52 52 64 52H176Q188 52 188 64V176Q188 188 176 188H64Q52 188 52 176Z'], artwork: [76, 82, 88, 72] },
  poster: sheet(49, 27, 142, 186),
  rollup_banner: { surfaces: ['M72 29H168V185H72Z', 'M63 185H177L188 199H52Z'], seams: 'M72 35H168M77 199L66 211M163 199L174 211', artwork: [91, 57, 58, 101] },
  pvc_banner: banner(),
  mesh_banner: banner(true),
  textile_banner: { surfaces: ['M26 65Q71 48 120 65T214 65V171Q165 188 120 171T26 171Z'], seams: 'M33 73Q75 57 120 73T207 73', artwork: [64, 87, 115, 57] },
  beach_flag: { surfaces: ['M91 32Q175 18 173 100L101 172Z'], seams: 'M91 32Q79 103 83 204M83 204L52 216M83 204L115 216', artwork: [105, 58, 46, 67] },
  menu_card: { surfaces: ['M68 36H178V194H68Z', 'M68 36L48 48V182L68 194Z'], seams: 'M68 36V194M90 102H157M90 123H157M90 144H157M90 165H140', artwork: [91, 55, 65, 29] },
  postcard: sheet(30, 65, 180, 120),
  hang_tag: { surfaces: ['M89 27H151L179 62V196H61V62ZM113 49a7 7 0 1 0 14 0a7 7 0 1 0-14 0'], seams: 'M120 42C91 4 141 0 143 22C145 33 133 43 120 49', artwork: [82, 83, 76, 81] },
  calendar: { surfaces: ['M52 57H188V195H52Z'], seams: 'M52 86H188M78 44V68M106 44V68M134 44V68M162 44V68M73 109H168M73 130H168M73 151H168M73 172H168M96 99V180M120 99V180M144 99V180' },
  softcover_book: book(4),
  hardcover_book: book(7),
  invitation_card: { ...sheet(59, 37, 122, 166), seams: 'M69 47H171V193H69Z', artwork: [89, 77, 62, 88] },
  ticket: { surfaces: ['M27 79H213V109Q190 120 213 131V161H27V131Q50 120 27 109Z'], seams: 'M167 84V92M167 99V107M167 114V122M167 129V137M167 144V153', artwork: [66, 96, 74, 45] },
  badge: { surfaces: ['M120 42a78 78 0 1 1 0 156a78 78 0 1 1 0-156Z'], seams: 'M120 50a70 70 0 1 1 0 140a70 70 0 1 1 0-140Z', artwork: [83, 84, 74, 72] },
  wristband: { surfaces: ['M30 102Q80 68 120 90L210 128V159L120 121Q80 99 30 133Z'], seams: 'M39 108L57 118M179 124l15 6M179 134l15 6' },
  balloon: { surfaces: ['M120 29C211 29 195 146 120 173C45 146 29 29 120 29ZM120 173L113 184H127Z'], seams: 'M120 184C100 201 138 206 116 222', artwork: [88, 66, 64, 72] },
  notepad: pad(),
  folding_carton: { surfaces: ['M43 70L132 40L198 73L109 106Z', 'M43 70L109 106V194L43 157Z', 'M109 106L198 73V160L109 194Z'], seams: 'M88 55L153 90M109 106V194', artwork: [129, 120, 47, 37] },
  brochure_holder: { surfaces: ['M69 37H178V164L153 195H48V107H69Z', 'M48 107H153V195H48Z'], seams: 'M153 107L178 88V164M58 119H143V182H58M83 52H162M83 68H155', artwork: [74, 139, 57, 28] },
  door_hanger: { surfaces: ['M84 26H156V208H84ZM102 56a18 18 0 1 0 36 0a18 18 0 1 0-36 0'], artwork: [97, 101, 46, 80] },
  bunting: { surfaces: ['M26 68L56 142L86 85Z', 'M91 88L120 168L149 88Z', 'M154 85L184 142L214 68Z'], seams: 'M20 63Q120 116 220 63' },
  hand_flag: { surfaces: ['M65 42Q111 27 151 42T208 42V130Q165 145 151 130T65 130Z'], seams: 'M65 36V209', artwork: [88, 64, 82, 42] },
  pole_flag: { surfaces: ['M62 37Q111 22 153 37T211 37V111Q170 128 153 111T62 111Z'], seams: 'M62 30V215M46 215H78', artwork: [90, 51, 81, 42] },
  adhesive_vinyl: { surfaces: ['M57 43H181V165Q181 191 156 191H57Z', 'M57 165H181Q177 191 156 191H57Q33 191 33 177Q33 165 57 165Z'], seams: 'M57 165Q35 166 42 181', artwork: [79, 67, 78, 75] },
  window_decal: { surfaces: ['M40 32H200V208H40ZM48 40V200H192V40Z', 'M71 85H169V155H71Z'], seams: 'M120 40V85M120 155V200', artwork: [87, 102, 66, 35] },
  pavement_sign: { surfaces: ['M75 39H170L201 197H181L156 67H75Z', 'M75 39H170L143 197H48Z'], seams: 'M83 57H154L134 176H62ZM143 197L181 197', artwork: [88, 82, 42, 62] },
  carbonless_pad: pad(true),
  advent_calendar: { surfaces: ['M48 39H190V196H48Z'], seams: 'M60 55H178V182H60ZM60 86H178M60 118H178M60 150H178M89 55V182M119 55V182M149 55V182M81 68v4M111 101v4M141 134v4M170 166v4' },
  lanyard: { surfaces: ['M67 36H85L120 125L155 36H173L130 150H110Z', 'M90 166H150V211H90Z'], seams: 'M120 150V166M111 156H129', artwork: [105, 177, 30, 22] },
  pen: { surfaces: ['M67 180L141 43Q146 34 156 40L165 46Q172 52 166 63L92 199L62 214Z'], seams: 'M67 180L92 199M62 214L72 196M139 49L153 57L128 103M156 40L169 29' },
  ruler: { surfaces: ['M31 133L188 59L210 106L53 180Z'], seams: 'M48 128L55 143M66 120L73 135M84 111L91 126M102 103L109 118M120 94L127 109M138 86L145 101M156 77L163 92M174 69L181 84' },
  clipboard: { surfaces: ['M55 39H185V205H55Z', 'M89 28H151V56H89Z'], seams: 'M67 67H173V191H67Z', artwork: [85, 84, 69, 84] },
  deckchair: { surfaces: ['M92 39H183L147 145H56Z'], seams: 'M86 33L47 157L167 210M188 33L152 156L41 210M56 145L147 145M47 157H152', artwork: [100, 62, 42, 56] },
  tote_bag: bag(),
  rigid_sign: { surfaces: ['M35 56H197L206 65V180H44L35 171Z', 'M35 56H197V171H35Z'], seams: 'M197 171L206 180', artwork: [62, 84, 108, 61] },
  cushion: { surfaces: ['M44 46Q120 61 196 46Q181 120 196 194Q120 179 44 194Q59 120 44 46Z'], seams: 'M55 58Q120 71 185 58Q171 120 185 183Q120 169 55 183Q69 120 55 58Z', artwork: [84, 88, 72, 67] },
  ring_binder: { surfaces: ['M47 46L82 34H183V195H82L47 181Z', 'M47 46L82 34V195L47 181Z'], seams: 'M82 34V195M63 150a7 7 0 1 1 0 14a7 7 0 1 1 0-14M58 63h12v42H58Z', artwork: [104, 66, 57, 90] },
  magazine_file: { surfaces: ['M57 40H100L177 144V198H57Z', 'M100 40H126L199 143V190L177 198V144Z'], seams: 'M57 157H177M78 176h14', artwork: [74, 107, 40, 30] },
  coupon_sheet: { ...sheet(57, 32, 126, 176), seams: 'M57 90H183M57 148H183M120 32V208', artwork: [73, 50, 28, 24] },
  stamp: { surfaces: ['M96 35Q120 23 144 35L150 95H177L187 168H53L63 95H90Z', 'M53 168H187V192H53Z'], seams: 'M70 108H170V150H70Z', artwork: [86, 117, 68, 24] },
  paper_cup: { surfaces: ['M58 56Q120 37 182 56L163 185Q120 201 77 185Z'], seams: 'M58 56Q120 75 182 56M61 65Q120 84 179 65M78 182Q120 196 162 182', artwork: [92, 99, 56, 58] },
  takeaway_box: { surfaces: ['M51 91L65 46H177L192 91L175 187H65Z', 'M51 91H192L175 187H65Z'], seams: 'M51 91L120 114L192 91M65 46L120 67L177 46M120 67V114', artwork: [88, 130, 64, 33] },
  packaging_tape: { surfaces: ['M120 49C220 49 220 190 120 190C20 190 20 49 120 49ZM120 76C61 76 61 163 120 163C179 163 179 76 120 76'], seams: 'M120 49C179 49 179 190 120 190M72 178L36 207H113L139 188' },
  tshirt: { surfaces: ['M81 41L40 63L24 109L60 124L72 100V201H168V100L180 124L216 109L200 63L159 41Q120 79 81 41Z'], seams: 'M83 44Q120 98 157 44M76 191H164M32 104L59 116M181 116L208 104', artwork: [93, 103, 54, 62] },
  pavilion: { surfaces: ['M24 95L120 31L216 95Z', 'M24 95H216V119H24Z'], seams: 'M33 119V211M207 119V211M70 119V177M169 119V177M120 31V95M24 95H216', artwork: [81, 84, 77, 19] },
  wrapping_paper: { surfaces: ['M76 40H171V181H76Z', 'M62 40C45 40 45 57 62 57H76V195H62C45 195 45 178 62 178Z'], seams: 'M76 40V195M62 57V178', artwork: [95, 67, 57, 87] },
  paper_bag: bag(true),
  plastic_card: { ...sheet(36, 69, 168, 106), seams: 'M49 87H191M49 93H191', artwork: [54, 112, 128, 42] },
} satisfies Record<IconStudioProductKey, ProductIllustration>;
