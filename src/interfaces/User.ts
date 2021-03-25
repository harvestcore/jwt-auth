import UUID from 'uuid';

export interface User {
    id: UUID;
    public_id: UUID;
    name: string;
    surname: string;
    username: string;
    password: string;
    rol: Rol;
    enabled: boolean;
}
