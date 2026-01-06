/**
 * Freepik API Type Definitions
 */

export type FreepikResourceType = 'vector' | 'psd' | 'photo';

export interface FreepikResource {
    id: number;
    title: string;
    url: string;
    thumbnail: {
        url: string;
    };
    preview: {
        url: string;
    };
    author: {
        name: string;
        url: string;
    };
    type: FreepikResourceType;
    licenses: {
        type: string;
    }[];
    tags: string[];
}

export interface FreepikMeta {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
}

export interface FreepikSearchResponse {
    data: FreepikResource[];
    meta: FreepikMeta;
}

export interface FreepikSearchFilters {
    query: string;
    type?: FreepikResourceType[];
    is_premium?: boolean;
    page?: number;
    per_page?: number;
}

export interface FreepikDownloadResponse {
    data: {
        url: string;
        filename: string;
        format: string;
    };
}
