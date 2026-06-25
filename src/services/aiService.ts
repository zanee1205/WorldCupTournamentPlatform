import { apiPath } from './apiService.ts';

type AskAiInput = {
  question: string;
  matchTitle?: string;
  stageLabel?: string;
};

type AskAiResponse = {
  answer?: string;
  message?: string;
};

async function readJson(response: Response): Promise<AskAiResponse | null> {
  try {
    return (await response.json()) as AskAiResponse;
  } catch {
    return null;
  }
}

export async function askAiQuestion({ question, matchTitle, stageLabel }: AskAiInput): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error('Thiếu câu hỏi.');
  }

  const response = await fetch(apiPath('/api/ai/ask'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: trimmed,
      matchTitle,
      stageLabel,
    }),
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data?.message ?? 'Không thể kết nối AI.');
  }

  const answer = data?.answer?.trim();
  if (!answer) {
    throw new Error('AI không trả lời.');
  }

  return answer;
}
