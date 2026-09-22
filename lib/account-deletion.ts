import {z} from 'zod';
export const accountDeletionSchema=z.object({
 confirmation:z.literal('DELETE MY ACCOUNT'),
 acknowledge:z.literal(true),
}).strict();
