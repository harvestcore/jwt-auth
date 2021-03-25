import UUID from 'uuid';

export interface Service {
    id: UUID;
    name: string;
    description?: string;
    url?: boolean;
}
