export type Message =
    | { role: 'user' | 'AI' }
    | { text: string }
