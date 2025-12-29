export type FontCategory = 'sans' | 'serif' | 'display' | 'mono';

export interface FontDefinition {
    id: string;
    name: string;
    family: string;
    category: FontCategory;
    weights: number[];
    hasItalic: boolean;
}

export const FONT_CATALOG: FontDefinition[] = [
    // Sans-Serif
    { id: 'inter', name: 'Inter', family: 'Inter', category: 'sans', weights: [300, 400, 500, 600, 700, 800], hasItalic: true },
    { id: 'roboto', name: 'Roboto', family: 'Roboto', category: 'sans', weights: [100, 300, 400, 500, 700, 900], hasItalic: true },
    { id: 'open-sans', name: 'Open Sans', family: 'Open Sans', category: 'sans', weights: [300, 400, 500, 600, 700, 800], hasItalic: true },
    { id: 'lato', name: 'Lato', family: 'Lato', category: 'sans', weights: [100, 300, 400, 700, 900], hasItalic: true },
    { id: 'montserrat', name: 'Montserrat', family: 'Montserrat', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'poppins', name: 'Poppins', family: 'Poppins', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'raleway', name: 'Raleway', family: 'Raleway', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'oswald', name: 'Oswald', family: 'Oswald', category: 'sans', weights: [200, 300, 400, 500, 600, 700], hasItalic: false },
    { id: 'nunito', name: 'Nunito', family: 'Nunito', category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'work-sans', name: 'Work Sans', family: 'Work Sans', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'source-sans-3', name: 'Source Sans 3', family: 'Source Sans 3', category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'ubuntu', name: 'Ubuntu', family: 'Ubuntu', category: 'sans', weights: [300, 400, 500, 700], hasItalic: true },
    { id: 'pt-sans', name: 'PT Sans', family: 'PT Sans', category: 'sans', weights: [400, 700], hasItalic: true },
    { id: 'fira-sans', name: 'Fira Sans', family: 'Fira Sans', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'dm-sans', name: 'DM Sans', family: 'DM Sans', category: 'sans', weights: [400, 500, 700], hasItalic: true },
    { id: 'manrope', name: 'Manrope', family: 'Manrope', category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800], hasItalic: false },
    { id: 'mulish', name: 'Mulish', family: 'Mulish', category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'quicksand', name: 'Quicksand', family: 'Quicksand', category: 'sans', weights: [300, 400, 500, 600, 700], hasItalic: false },
    { id: 'cabin', name: 'Cabin', family: 'Cabin', category: 'sans', weights: [400, 500, 600, 700], hasItalic: true },
    { id: 'karla', name: 'Karla', family: 'Karla', category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800], hasItalic: true },
    { id: 'rubik', name: 'Rubik', family: 'Rubik', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'barlow', name: 'Barlow', family: 'Barlow', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'archivo', name: 'Archivo', family: 'Archivo', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'league-spartan', name: 'League Spartan', family: 'League Spartan', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: false },
    { id: 'space-grotesk', name: 'Space Grotesk', family: 'Space Grotesk', category: 'sans', weights: [300, 400, 500, 600, 700], hasItalic: false },
    { id: 'libre-franklin', name: 'Libre Franklin', family: 'Libre Franklin', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'ibm-plex-sans', name: 'IBM Plex Sans', family: 'IBM Plex Sans', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700], hasItalic: true },

    // Serif
    { id: 'merriweather', name: 'Merriweather', family: 'Merriweather', category: 'serif', weights: [300, 400, 700, 900], hasItalic: true },
    { id: 'playfair-display', name: 'Playfair Display', family: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'lora', name: 'Lora', family: 'Lora', category: 'serif', weights: [400, 500, 600, 700], hasItalic: true },
    { id: 'pt-serif', name: 'PT Serif', family: 'PT Serif', category: 'serif', weights: [400, 700], hasItalic: true },
    { id: 'source-serif-4', name: 'Source Serif 4', family: 'Source Serif 4', category: 'serif', weights: [200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'alegreya', name: 'Alegreya', family: 'Alegreya', category: 'serif', weights: [400, 500, 700, 800, 900], hasItalic: true },
    { id: 'cormorant-garamond', name: 'Cormorant Garamond', family: 'Cormorant Garamond', category: 'serif', weights: [300, 400, 500, 600, 700], hasItalic: true },
    { id: 'crimson-text', name: 'Crimson Text', family: 'Crimson Text', category: 'serif', weights: [400, 600, 700], hasItalic: true },
    { id: 'eb-garamond', name: 'EB Garamond', family: 'EB Garamond', category: 'serif', weights: [400, 500, 600, 700, 800], hasItalic: true },
    { id: 'libre-baskerville', name: 'Libre Baskerville', family: 'Libre Baskerville', category: 'serif', weights: [400, 700], hasItalic: true },
    { id: 'bitter', name: 'Bitter', family: 'Bitter', category: 'serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
    { id: 'cinzel', name: 'Cinzel', family: 'Cinzel', category: 'serif', weights: [400, 500, 600, 700, 800, 900], hasItalic: false },

    // Display
    { id: 'anton', name: 'Anton', family: 'Anton', category: 'display', weights: [400], hasItalic: false },
    { id: 'bebas-neue', name: 'Bebas Neue', family: 'Bebas Neue', category: 'display', weights: [400], hasItalic: false },
    { id: 'abril-fatface', name: 'Abril Fatface', family: 'Abril Fatface', category: 'display', weights: [400], hasItalic: false },
    { id: 'pacifico', name: 'Pacifico', family: 'Pacifico', category: 'display', weights: [400], hasItalic: false },
    { id: 'dancing-script', name: 'Dancing Script', family: 'Dancing Script', category: 'display', weights: [400, 500, 600, 700], hasItalic: false },
    { id: 'lobster', name: 'Lobster', family: 'Lobster', category: 'display', weights: [400], hasItalic: false },
    { id: 'permanent-marker', name: 'Permanent Marker', family: 'Permanent Marker', category: 'display', weights: [400], hasItalic: false },
    { id: 'alfa-slab-one', name: 'Alfa Slab One', family: 'Alfa Slab One', category: 'display', weights: [400], hasItalic: false },

    // Mono
    { id: 'jetbrains-mono', name: 'JetBrains Mono', family: 'JetBrains Mono', category: 'mono', weights: [100, 200, 300, 400, 500, 600, 700, 800], hasItalic: true },
    { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: 'IBM Plex Mono', category: 'mono', weights: [100, 200, 300, 400, 500, 600, 700], hasItalic: true },
    { id: 'space-mono', name: 'Space Mono', family: 'Space Mono', category: 'mono', weights: [400, 700], hasItalic: true },
    { id: 'inconsolata', name: 'Inconsolata', family: 'Inconsolata', category: 'mono', weights: [200, 300, 400, 500, 600, 700, 800, 900], hasItalic: false },
    { id: 'fira-code', name: 'Fira Code', family: 'Fira Code', category: 'mono', weights: [300, 400, 500, 600, 700], hasItalic: false },
    { id: 'source-code-pro', name: 'Source Code Pro', family: 'Source Code Pro', category: 'mono', weights: [200, 300, 400, 500, 600, 700, 800, 900], hasItalic: true },
];
