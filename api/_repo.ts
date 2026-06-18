import { createRepository } from '../server/src/store.js';

declare global {
    // cache the repository promise across lambda invocations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var __repoPromise: Promise<any> | undefined;
}

export async function getRepository() {
    if (!globalThis.__repoPromise) {
        // createRepository initializes and returns a ready repository
        // (connects to MongoDB when MONGODB_URI is provided)
        // store the promise on the global scope so subsequent invocations reuse it.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        globalThis.__repoPromise = createRepository();
    }
    return globalThis.__repoPromise;
}

export default getRepository;
