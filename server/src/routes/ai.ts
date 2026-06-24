import { Router } from 'express';
import Groq from 'groq-sdk';

const router = Router();

const apiKey = process.env.GROQ_API_KEY?.trim();
const modelName = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
const groq = apiKey ? new Groq({ apiKey }) : null;

function buildPrompt(question: string, matchTitle?: string, stageLabel?: string) {
  return [
    'Bạn là một chuyên gia phân tích bóng đá nhiều năm kinh nghiệm.',
    'Trả lời bằng tiếng Việt, ngắn gọn, rõ ý, chuyên nghiệp và bám sát câu hỏi của người dùng.',
    `Trận đấu: ${matchTitle ?? 'Không rõ'} (${stageLabel ?? 'Không rõ'})`,
    `Câu hỏi: ${question}`,
  ].join('\n');
}

router.post('/ask', async (req, res) => {
  try {
    if (!groq) {
      res.status(503).json({ message: 'Thiếu GROQ_API_KEY trong môi trường chạy.' });
      return;
    }

    const { question, matchTitle, stageLabel } = req.body ?? {};

    if (typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ message: 'Thiếu câu hỏi.' });
      return;
    }

    const completion = await groq.chat.completions.create({
      model: modelName,
      temperature: 0.5,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'Bạn là trợ lý AI chuyên phân tích bóng đá và dự đoán trận đấu. Trả lời tự nhiên, ngắn gọn, chính xác, không lan man.',
        },
        {
          role: 'user',
          content: buildPrompt(question.trim(), typeof matchTitle === 'string' ? matchTitle : undefined, typeof stageLabel === 'string' ? stageLabel : undefined),
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      res.status(502).json({ message: 'Groq không trả về nội dung hợp lệ.' });
      return;
    }

    res.json({ answer });
  } catch (error) {
    const err = error as { status?: number; message?: string; response?: { status?: number; data?: unknown } };
    // eslint-disable-next-line no-console
    console.error('[ai] Groq request failed:', err?.message ?? err);

    if (err?.status === 401 || err?.status === 403 || err?.response?.status === 401 || err?.response?.status === 403) {
      res.status(502).json({ message: 'Groq bị từ chối truy cập. Kiểm tra lại API key hoặc quyền model.' });
      return;
    }

    res.status(500).json({ message: 'Lỗi khi gọi Groq API, kiểm tra lại.' });
  }
});

export default router;
