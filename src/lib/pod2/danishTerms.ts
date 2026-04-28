// Print.com property/option terms → Danish.
// Used as a preview default in the POD v2 import wizard so admins
// don't have to retype obvious translations. Unknown terms pass through
// unchanged so the admin can still edit them by hand.

const PHRASES: Record<string, string> = {
    "business cards": "Visitkort",
    "business card": "Visitkort",
    "double sided": "Dobbeltsidet",
    "double-sided": "Dobbeltsidet",
    "single sided": "Enkeltsidet",
    "single-sided": "Enkeltsidet",
    "two sided": "Dobbeltsidet",
    "one sided": "Enkeltsidet",
    "full colour": "Fuld farve",
    "full color": "Fuld farve",
    "black and white": "Sort/hvid",
    "black & white": "Sort/hvid",
    "saddle stitch": "Hæftet",
    "saddle stitched": "Hæftet",
    "perfect bound": "Limindbinding",
    "perfect binding": "Limindbinding",
    "spiral bound": "Spiralindbinding",
    "spiral binding": "Spiralindbinding",
    "wire-o": "Wire-o-indbinding",
    "wire o": "Wire-o-indbinding",
    "rounded corners": "Afrundede hjørner",
    "square corners": "Lige hjørner",
    "matte lamination": "Mat laminering",
    "matt lamination": "Mat laminering",
    "glossy lamination": "Blank laminering",
    "gloss lamination": "Blank laminering",
    "soft touch lamination": "Soft-touch laminering",
    "anti-scratch lamination": "Anti-ridse laminering",
    "no lamination": "Ingen laminering",
    "paper type": "Papirtype",
    "paper weight": "Papirvægt",
    "paper finish": "Papiroverflade",
    "sheet size": "Arkstørrelse",
    "print method": "Trykmetode",
    "printing method": "Trykmetode",
    "delivery time": "Leveringstid",
    "delivery promise": "Leveringstid",
    "rush delivery": "Ekspreslevering",
    "standard delivery": "Standardlevering",
    "express delivery": "Ekspreslevering",
    "uncoated paper": "Ubelagt papir",
    "coated paper": "Belagt papir",
    "recycled paper": "Genbrugspapir",
    "greeting card": "Lykønskningskort",
    "greeting cards": "Lykønskningskort",
    "thank you card": "Takkekort",
    "save the date": "Save the date",
    "table tent": "Bordkort",

    // print colour ratios — N/N or N-N = both sides, N/0 or N-0 = one side
    "4/4": "4+4 tryk på begge sider",
    "4/0": "4+0 tryk på 1 side",
    "1/1": "1+1 tryk på begge sider",
    "1/0": "1+0 tryk på 1 side",
    "2/2": "2+2 tryk på begge sider",
    "2/0": "2+0 tryk på 1 side",
    "3/3": "3+3 tryk på begge sider",
    "3/0": "3+0 tryk på 1 side",
    "5/5": "5+5 tryk på begge sider",
    "5/0": "5+0 tryk på 1 side",
    "4/1": "4+1 tryk på begge sider",
    "5/4": "5+4 tryk på begge sider",

    "4-4": "4+4 tryk på begge sider",
    "4-0": "4+0 tryk på 1 side",
    "1-1": "1+1 tryk på begge sider",
    "1-0": "1+0 tryk på 1 side",
    "2-2": "2+2 tryk på begge sider",
    "2-0": "2+0 tryk på 1 side",
    "3-3": "3+3 tryk på begge sider",
    "3-0": "3+0 tryk på 1 side",
    "5-5": "5+5 tryk på begge sider",
    "5-0": "5+0 tryk på 1 side",
    "4-1": "4+1 tryk på begge sider",
    "5-4": "5+4 tryk på begge sider",
};

const WORDS: Record<string, string> = {
    // properties / structural
    paper: "Papir",
    card: "Kort",
    cards: "Kort",
    thickness: "Tykkelse",
    weight: "Vægt",
    size: "Størrelse",
    sizes: "Størrelser",
    format: "Format",
    finish: "Overflade",
    lamination: "Laminering",
    binding: "Indbinding",
    bound: "Indbundet",
    stapled: "Hæftet",
    corners: "Hjørner",
    corner: "Hjørne",
    perforation: "Perforering",
    perforated: "Perforeret",
    holes: "Huller",
    hole: "Hul",
    sides: "Sider",
    side: "Side",
    copies: "Antal",
    bundle: "Pakke",
    quantity: "Antal",
    quantities: "Antal",
    colour: "Farve",
    color: "Farve",
    colours: "Farver",
    colors: "Farver",
    orientation: "Retning",
    delivery: "Levering",
    shipping: "Forsendelse",
    method: "Metode",

    // finishes / surfaces
    glossy: "Blank",
    gloss: "Blank",
    matte: "Mat",
    matt: "Mat",
    silk: "Silke",
    satin: "Satin",
    lustre: "Glans",
    luster: "Glans",
    uncoated: "Ubelagt",
    coated: "Belagt",

    // print methods
    digital: "Digital",
    offset: "Offset",
    printing: "Tryk",
    print: "Tryk",
    indigo: "Indigo",
    large: "Stor",
    small: "Lille",

    // delivery speeds
    rush: "Ekspres",
    express: "Ekspres",
    economy: "Standard",
    standard: "Standard",
    premium: "Premium",

    // colours
    white: "Hvid",
    black: "Sort",
    grey: "Grå",
    gray: "Grå",
    blue: "Blå",
    red: "Rød",
    green: "Grøn",
    yellow: "Gul",

    // shapes / orientations
    portrait: "Portræt",
    landscape: "Landskab",
    square: "Kvadratisk",
    rounded: "Afrundet",
    round: "Rund",
    rectangle: "Rektangel",
    rectangular: "Rektangulær",
    custom: "Brugerdefineret",
    recycled: "Genbrug",

    // common products
    flyer: "Flyer",
    flyers: "Flyers",
    brochure: "Brochure",
    brochures: "Brochurer",
    poster: "Plakat",
    posters: "Plakater",
    postcard: "Postkort",
    postcards: "Postkort",
    sticker: "Sticker",
    stickers: "Stickers",
    banner: "Banner",
    banners: "Bannere",
    leaflet: "Folder",
    leaflets: "Foldere",
    booklet: "Hæfte",
    booklets: "Hæfter",
    catalogue: "Katalog",
    catalogues: "Kataloger",
    catalog: "Katalog",
    catalogs: "Kataloger",
    calendar: "Kalender",
    calendars: "Kalendere",
    notebook: "Notesbog",
    notebooks: "Notesbøger",
    envelope: "Kuvert",
    envelopes: "Kuverter",
    letterhead: "Brevpapir",
    invitation: "Invitation",
    invitations: "Invitationer",
    menu: "Menukort",
    menus: "Menukort",
    magazine: "Magasin",
    magazines: "Magasiner",
    magnet: "Magnet",
    magnets: "Magneter",
    notepad: "Notesblok",
    notepads: "Notesblokke",
    label: "Etiket",
    labels: "Etiketter",
    folder: "Mappe",
    folders: "Mapper",
};

const looksTranslatable = (token: string) => /[A-Za-z]/.test(token);

export function toDanish(input: string | null | undefined): string {
    if (!input) return input ?? "";
    const trimmed = input.trim();
    if (!trimmed) return input;

    const phraseHit = PHRASES[trimmed.toLowerCase()];
    if (phraseHit) return phraseHit;

    const tokens = trimmed.split(/(\s+|[-/])/);
    let didTranslate = false;
    const out = tokens.map((token) => {
        if (!looksTranslatable(token)) return token;
        const hit = WORDS[token.toLowerCase()];
        if (hit) {
            didTranslate = true;
            return hit;
        }
        return token;
    });

    return didTranslate ? out.join("") : input;
}
