import { z } from 'zod';

export const HELLO = 'HELLO';

const tool = {
    method: HELLO,
    name: 'Hello',
    description: 'Greets a person by name',
    parameters: z.object({ name: z.string().min(1) }),
    execute: async (_rt, _context, input) => {
        const { name } = input;
        return `Hello, ${name}, I'm the Hedera Agent!`;
    }
}

export default {
    name: 'hello-plugin',
    version: '0.1.0',
    description: 'Hello plugin',
    tools: () => [tool]
};